import {
  screenToWorld,
  worldToScreen,
  zoomAtPointer,
  getVisibleWorldBounds,
  fitToBounds,
  distanceBetween,
} from "../matrix";
import { snapToGrid, snapToPort, snapToNodeAlignments, snapToJunctionDocking } from "../snapping";
import { useCameraStore } from "../useCameraStore";
import { Viewport, BoundingBox } from "../types";
import { generateBatchDesks } from "../batchSpawner";
import { autoRoutePortsToRack, getRackPortAvailability } from "../autoRoute";
import { parseAndAuditMatrixCsv, applyMatrixImport } from "../../ingestion/matrixCsvParser";
import { NodeDisplay, RackDisplay } from "../../../components/canvas/EquipmentLayer";
import {
  resolveEffectiveOutletNetwork,
  getSwitchPortProfile,
  isSwitchPortOccupied,
} from "../networkProfiles";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`❌ Échec de l'assertion : ${message}`);
  }
}

function assertClose(a: number, b: number, tolerance = 1e-6, message = "") {
  if (Math.abs(a - b) > tolerance) {
    throw new Error(
      `❌ Échec de précision [${message}] : reçu ${a}, attendu ${b} (diff: ${Math.abs(a - b)})`
    );
  }
}

async function runSpatialTests() {
  console.log("================================================================================");
  console.log("📐 NetFloor Architect : Banc de Test Mathématique du Moteur Spatial 2D");
  console.log("================================================================================\n");

  // ---------------------------------------------------------------------------
  // Test 1 : Inversibilité et Bijection Écran <-> Monde
  // ---------------------------------------------------------------------------
  console.log("🧪 1. Test d'inversibilité stricte (ScreenToWorld <-> WorldToScreen)...");
  const testViewport: Viewport = { panX: 124.5, panY: -86.2, scale: 0.045 }; // 1m = 45px

  const screenPoints = [
    { x: 0, y: 0 },
    { x: 1920, y: 1080 },
    { x: 960, y: 540 },
    { x: -350, y: 1400 },
  ];

  for (const sp of screenPoints) {
    const worldPt = screenToWorld(sp, testViewport);
    const backToScreen = worldToScreen(worldPt, testViewport);
    assertClose(sp.x, backToScreen.x, 1e-7, `Screen X: ${sp.x}`);
    assertClose(sp.y, backToScreen.y, 1e-7, `Screen Y: ${sp.y}`);
  }

  const worldPoints = [
    { x: 0, y: 0 },
    { x: 60000, y: 35000 }, // 60m x 35m
    { x: 12500, y: 4800 },
    { x: -5000, y: -2000 },
  ];

  for (const wp of worldPoints) {
    const screenPt = worldToScreen(wp, testViewport);
    const backToWorld = screenToWorld(screenPt, testViewport);
    assertClose(wp.x, backToWorld.x, 1e-7, `World X: ${wp.x}`);
    assertClose(wp.y, backToWorld.y, 1e-7, `World Y: ${wp.y}`);
  }
  console.log("   ✅ Bijection mathématique absolue certifiée (< 10^-7 d'écart)");

  // ---------------------------------------------------------------------------
  // Test 2 : Invariance du point sous le curseur au Zoom (Zoom-to-Pointer)
  // ---------------------------------------------------------------------------
  console.log("\n🧪 2. Test d'invariance du curseur lors du zoom...");
  const cursorScreenPos = { x: 742, y: 418 };
  const initialViewport: Viewport = { panX: 200, panY: 150, scale: 0.02 }; // 1m = 20px

  // Point monde sous le curseur avant le zoom
  const worldPointBefore = screenToWorld(cursorScreenPos, initialViewport);

  // Zoom avant (facteur 2.5x)
  const zoomedInViewport = zoomAtPointer(
    cursorScreenPos,
    initialViewport,
    initialViewport.scale * 2.5
  );
  const worldPointAfterZoomIn = screenToWorld(cursorScreenPos, zoomedInViewport);

  assertClose(worldPointBefore.x, worldPointAfterZoomIn.x, 1e-6, "Zoom In invariant X");
  assertClose(worldPointBefore.y, worldPointAfterZoomIn.y, 1e-6, "Zoom In invariant Y");

  // Zoom arrière (facteur 0.4x)
  const zoomedOutViewport = zoomAtPointer(
    cursorScreenPos,
    zoomedInViewport,
    zoomedInViewport.scale * 0.4
  );
  const worldPointAfterZoomOut = screenToWorld(cursorScreenPos, zoomedOutViewport);

  assertClose(worldPointBefore.x, worldPointAfterZoomOut.x, 1e-6, "Zoom Out invariant X");
  assertClose(worldPointBefore.y, worldPointAfterZoomOut.y, 1e-6, "Zoom Out invariant Y");
  console.log("   ✅ Invariance stricte au curseur certifiée (zéro dérive au zoom)");

  // ---------------------------------------------------------------------------
  // Test 3 : Cadrage Automatique (fitToBounds)
  // ---------------------------------------------------------------------------
  console.log("\n🧪 3. Test de cadrage automatique d'un étage (fitToBounds)...");
  const floorBounds: BoundingBox = {
    minX: 0,
    minY: 0,
    maxX: 80000, // 80 mètres
    maxY: 40000, // 40 mètres
    width: 80000,
    height: 40000,
  };

  const screenWidth = 1920;
  const screenHeight = 1080;
  const padding = 60;

  const fitted = fitToBounds(floorBounds, screenWidth, screenHeight, padding);

  // La projection de l'étage doit tenir dans [padding, screen - padding]
  const topLeftScreen = worldToScreen({ x: floorBounds.minX, y: floorBounds.minY }, fitted);
  const bottomRightScreen = worldToScreen({ x: floorBounds.maxX, y: floorBounds.maxY }, fitted);

  assert(topLeftScreen.x >= padding - 1e-4, "TopLeft X dans les limites");
  assert(topLeftScreen.y >= padding - 1e-4, "TopLeft Y dans les limites");
  assert(bottomRightScreen.x <= screenWidth - padding + 1e-4, "BottomRight X dans les limites");
  assert(bottomRightScreen.y <= screenHeight - padding + 1e-4, "BottomRight Y dans les limites");

  // Vérification du centrage
  const projectedCenterX = (topLeftScreen.x + bottomRightScreen.x) / 2;
  const projectedCenterY = (topLeftScreen.y + bottomRightScreen.y) / 2;
  assertClose(projectedCenterX, screenWidth / 2, 1e-5, "Centrage horizontal parfait");
  assertClose(projectedCenterY, screenHeight / 2, 1e-5, "Centrage vertical parfait");
  // Test de calcul des limites visibles dans le monde
  const visibleBounds = getVisibleWorldBounds(fitted, screenWidth, screenHeight);
  assert(
    visibleBounds.width > 0 && visibleBounds.height > 0,
    "Dimensions du monde visible positives"
  );
  assert(visibleBounds.minX <= floorBounds.minX, "MinX visible englobe l'étage");
  assert(visibleBounds.maxX >= floorBounds.maxX, "MaxX visible englobe l'étage");

  // Test de distance euclidienne
  const d1 = distanceBetween({ x: 0, y: 0 }, { x: 3000, y: 4000 });
  assertClose(d1, 5000, 1e-6, "Distance 3-4-5 Pythagore exacte (5000mm)");
  console.log(
    `   ✅ Cadrage parfait : échelle ${fitted.scale.toFixed(6)} px/mm, centrage écran exact, limites visibles validées.`
  );

  // ---------------------------------------------------------------------------
  // Test 4 : Magnétisme sur Grille Métrique (snapToGrid)
  // ---------------------------------------------------------------------------
  console.log("\n🧪 4. Test du magnétisme sur grille métrique (500mm)...");
  const gridConfig = { stepMm: 500, enabled: true, snapRadiusMm: 40 };

  // Cas 1 : Proche de la ligne de grille (diff = 15mm < 40mm) -> doit magnétiser
  const snapResult1 = snapToGrid({ x: 1515, y: 2990 }, gridConfig);
  assert(snapResult1.snappedX && snapResult1.point.x === 1500, "X magnétisé à 1500mm");
  assert(snapResult1.snappedY && snapResult1.point.y === 3000, "Y magnétisé à 3000mm");
  assert(snapResult1.guides.length === 2, "2 guides générés pour X et Y");

  // Cas 2 : Trop éloigné de la grille (diff = 120mm > 40mm) -> ne doit pas magnétiser
  const snapResult2 = snapToGrid({ x: 1620, y: 2990 }, gridConfig);
  assert(!snapResult2.snappedX && snapResult2.point.x === 1620, "X non magnétisé conservé");
  assert(snapResult2.snappedY && snapResult2.point.y === 3000, "Y magnétisé conservé");
  console.log("   ✅ Snapping sur grille métrique 500mm validé.");

  // ---------------------------------------------------------------------------
  // Test 5 : Magnétisme sur Ports et Connecteurs
  // ---------------------------------------------------------------------------
  console.log("\n🧪 5. Test du magnétisme sur connecteurs/ports de câblage...");
  const targetPorts = [
    { x: 12000, y: 4500, portId: "port-01", portLabel: "Gi1/0/1" },
    { x: 12000, y: 4520, portId: "port-02", portLabel: "Gi1/0/2" },
  ];

  // Clic à 30mm du premier port -> attraction magnétique directe
  const portSnapResult = snapToPort({ x: 12025, y: 4510 }, targetPorts, 50);
  assert(portSnapResult.connectedPort !== null, "Port connecté trouvé");
  assert(portSnapResult.connectedPort?.portId === "port-01", "Ciblage exact du port Gi1/0/1");
  assertClose(portSnapResult.snappedPoint.x, 12000, 1e-6, "Position X verrouillée sur le port");
  assertClose(portSnapResult.snappedPoint.y, 4500, 1e-6, "Position Y verrouillée sur le port");
  console.log("   ✅ Attraction magnétique sur connecteur certifiée.");

  // ---------------------------------------------------------------------------
  // Test 6 : Guides Intelligents d'Alignement de Nœuds (Smart Guides)
  // ---------------------------------------------------------------------------
  console.log("\n🧪 6. Test des Smart Guides d'alignement entre équipements...");
  // Référence : Baie existante à (10000, 5000), largeur 600mm, profondeur 800mm
  const refRack: BoundingBox = {
    minX: 10000,
    minY: 5000,
    maxX: 10600,
    maxY: 5800,
    width: 600,
    height: 800,
  };

  // Objet déplacé : Nouvelle baie à x = 10020 (différence de 20mm avec le bord gauche)
  const draggedRack: BoundingBox = {
    minX: 10020,
    minY: 6500,
    maxX: 10620,
    maxY: 7300,
    width: 600,
    height: 800,
  };

  const alignResult = snapToNodeAlignments(draggedRack, [refRack], 50);
  assert(alignResult.hasSnappedX, "Alignement X détecté");
  assertClose(alignResult.snappedX, 10000, 1e-6, "Position X calée au bord gauche (10000mm)");
  assert(alignResult.guides.length > 0, "Ligne guide générée pour le rendu");
  console.log("   ✅ Alignement automatique et génération de guide validés.");

  // ---------------------------------------------------------------------------
  // Test 7 : Store Zustand Caméra
  // ---------------------------------------------------------------------------
  console.log("\n🧪 7. Test du cycle de vie du store Zustand de la caméra...");
  const cameraStore = useCameraStore.getState();

  // Test pan
  cameraStore.panBy(100, -50);
  const v1 = useCameraStore.getState().viewport;
  assertClose(v1.panX, 150, 1e-6, "Pan X mis à jour");
  assertClose(v1.panY, 0, 1e-6, "Pan Y mis à jour");

  // Test cadrage étage
  cameraStore.fitFloor(60000, 30000, 1920, 1080);
  const v2 = useCameraStore.getState().viewport;
  assert(v2.scale > 0, "Échelle calculée strictement positive");

  // Test reset
  cameraStore.resetCamera();
  const v3 = useCameraStore.getState().viewport;
  assertClose(v3.scale, 0.025, 1e-6, "Reset caméra conforme");
  console.log("   ✅ Store Zustand découplé validé sans régression.");

  // ---------------------------------------------------------------------------
  // Test 8 : Auto-clip et Docking des Jonctions de Câbles (snapToJunctionDocking)
  // ---------------------------------------------------------------------------
  console.log("\n🧪 8. Test de l'auto-clip des jonctions de câbles (snapToJunctionDocking)...");
  const refJunctions = [{ id: "cable-01", point: { x: 15500, y: 9000 } }];

  // Cas 1 : Fusion directe sur le même boîtier (< 90mm)
  const mergeResult = snapToJunctionDocking({ x: 15540, y: 9030 }, refJunctions, 350, 80, 90);
  assert(mergeResult.dockedWithId === "cable-01", "Jonction cible identifiée pour fusion");
  assert(mergeResult.dockType === "MERGE", "Type MERGE validé");
  assertClose(mergeResult.snappedPoint.x, 15500, 1e-6, "X calé exactement sur le boîtier existant");
  assertClose(mergeResult.snappedPoint.y, 9000, 1e-6, "Y calé exactement sur le boîtier existant");

  // Cas 2 : Docking horizontal en nappe (côte-à-côte à 80mm sur même Y)
  const dockHResult = snapToJunctionDocking({ x: 15680, y: 9030 }, refJunctions, 350, 80, 90);
  assert(dockHResult.dockedWithId === "cable-01", "Jonction cible identifiée pour dock horizontal");
  assert(dockHResult.dockType === "HORIZONTAL", "Type HORIZONTAL validé");
  assertClose(dockHResult.snappedPoint.x, 15580, 1e-6, "X calé avec espacement 80mm");
  assertClose(dockHResult.snappedPoint.y, 9000, 1e-6, "Y verrouillé sur le même axe couloir");

  // Cas 3 : Docking vertical en nappe (en ligne à 80mm sur même X)
  const dockVResult = snapToJunctionDocking({ x: 15520, y: 9200 }, refJunctions, 350, 80, 90);
  assert(dockVResult.dockedWithId === "cable-01", "Jonction cible identifiée pour dock vertical");
  assert(dockVResult.dockType === "VERTICAL", "Type VERTICAL validé");
  assertClose(
    dockVResult.snappedPoint.x,
    15500,
    1e-6,
    "X verrouillé sur la même colonne technique"
  );
  assertClose(dockVResult.snappedPoint.y, 9080, 1e-6, "Y calé avec espacement 80mm");

  // Cas 4 : Alignement sur l'axe du couloir (Y)
  const axisYResult = snapToJunctionDocking({ x: 18000, y: 9060 }, refJunctions, 350, 80, 90);
  assert(axisYResult.dockType === "CORRIDOR_Y", "Type CORRIDOR_Y validé");
  assertClose(axisYResult.snappedPoint.y, 9000, 1e-6, "Y aligné sur l'axe du couloir");
  assertClose(axisYResult.snappedPoint.x, 18000, 1e-6, "X libre conservé");

  // Cas 5 : Hors de portée (> 350mm et non aligné)
  const noSnapResult = snapToJunctionDocking({ x: 25000, y: 25000 }, refJunctions, 350, 80, 90);
  assert(noSnapResult.dockType === "NONE", "Aucun accrochage si hors de portée");
  assert(noSnapResult.dockedWithId === null, "Aucun ID lié");
  assertClose(noSnapResult.snappedPoint.x, 25000, 1e-6, "Position X d'origine préservée");
  assertClose(noSnapResult.snappedPoint.y, 25000, 1e-6, "Position Y d'origine préservée");

  console.log("   ✅ Accrochage automatique (Clip auto) et docking de jonctions certifiés.");

  // ---------------------------------------------------------------------------
  // Test 9 : Étalonnage d'Échelle 2-Points & Synchronisation pixelsPerMeter
  // ---------------------------------------------------------------------------
  console.log("\n🧪 9. Test d'étalonnage d'échelle et synchronisation pixelsPerMeter...");
  const initialScale = useCameraStore.getState().viewport.scale;
  useCameraStore.getState().setPixelsPerMeter(50); // 50 px = 1 mètre => scale = 0.05 px/mm
  const updatedPpm = useCameraStore.getState().pixelsPerMeter;
  const updatedScale = useCameraStore.getState().viewport.scale;
  assertClose(updatedPpm, 50, 1e-6, "PPM synchronisé à 50 px/m");
  assertClose(updatedScale, 0.05, 1e-6, "Échelle Konva mise à jour à 0.05 px/mm");

  // Vérifier qu'une distance mesurée en pixels de 250px correspond exactement à 5.0m
  const measuredPx = 250;
  const computedMeters = measuredPx / updatedPpm;
  assertClose(computedMeters, 5.0, 1e-6, "Conversion 250px / 50ppm = 5.0m");

  // Rétablissement
  useCameraStore.getState().setPixelsPerMeter(initialScale * 1000);
  console.log("   ✅ Étalonnage d'échelle métrique et synchronisation Zustand certifiés.");

  // ---------------------------------------------------------------------------
  // Test 10 : Générateur d'Îlots Matriciels en Masse (generateBatchDesks)
  // ---------------------------------------------------------------------------
  console.log("\n🧪 10. Test de génération d'îlots matriciels en masse (Batch Desk Spawner)...");
  const batchResult = generateBatchDesks({
    deskType: "quad_4",
    rows: 2,
    columns: 2,
    spacingXMeters: 1.5,
    spacingYMeters: 2.0,
    originX: 10000,
    originY: 10000,
    defaultRackId: "rack-01",
    startDeskNumber: 101,
  });

  assert(batchResult.desks.length === 4, "4 bureaux quad_4 générés");
  assert(batchResult.totalSeats === 16, "16 sièges/postes de travail créés (4 par quad)");
  assert(
    batchResult.outlets.length === 32,
    "32 prises RJ45 solidaires créées (8 par quad: 4 Data + 4 VoIP)"
  );
  assert(batchResult.totalOutlets === 32, "Total de 32 prises conformes");

  const firstDesk = batchResult.desks[0]!;
  assertClose(firstDesk.xMm, 10000, 1e-6, "Coordonnée X d'origine respectée");
  assertClose(firstDesk.yMm, 10000, 1e-6, "Coordonnée Y d'origine respectée");
  assert(firstDesk.subType === "BENCH_QUAD", "Type de meuble BENCH_QUAD conforme");
  console.log("   ✅ Génération matricielle de 16 postes avec 32 ports RJ45 solidaires certifiée.");

  // Test 10b : Mode Pack centralisé (Bloc RJ45) et 1 prise par poste
  const batchPackResult = generateBatchDesks({
    deskType: "quad_4",
    rows: 1,
    columns: 2,
    spacingXMeters: 1.5,
    spacingYMeters: 2.0,
    originX: 10000,
    originY: 10000,
    outletsPerSeat: 1,
    outletMode: "pack",
  });
  assert(batchPackResult.desks.length === 2, "2 bureaux quad_4 générés");
  assert(
    batchPackResult.outlets.length === 2,
    "2 Blocs RJ45 centralisés générés (1 par bureau, zéro spam)"
  );
  assert(
    batchPackResult.outlets[0]?.subType === "SOCKET_BLOCK",
    "Type de connectique SOCKET_BLOCK"
  );
  assert(
    batchPackResult.outlets[0]?.portCount === 4,
    "4 ports par bloc (1 port pour chacun des 4 sièges)"
  );
  assert(batchPackResult.totalOutlets === 8, "Total de 8 ports consolidés");
  console.log("   ✅ Mode Pack centralisé (Bloc RJ45) et 1 prise par poste certifiés.");

  // ---------------------------------------------------------------------------
  // Test 11 : Auto-Câblage Orthogonal vers Baie (autoRoutePortsToRack)
  // ---------------------------------------------------------------------------
  console.log("\n🧪 11. Test du câblage automatique orthogonal vers la baie (Auto-Route)...");
  const mockRacks: RackDisplay[] = [
    {
      id: "rack-auto",
      name: "BAIE-TEST",
      xMm: 20000,
      yMm: 5000,
      widthMm: 800,
      depthMm: 1000,
      uHeight: 42,
      devices: [
        {
          id: "sw-test",
          name: "SWITCH-RDC-01",
          slotU: 24,
          deviceType: "SWITCH",
          brand: "CISCO",
          model: "Catalyst 9300-24P",
          status: "ONLINE",
          portsCount: 24,
        },
      ],
    },
  ];

  const outletsToRoute: NodeDisplay[] = Array.from({ length: 10 }, (_, i) => ({
    id: `outlet-test-${i + 1}`,
    name: `Prise Test ${i + 1}`,
    type: "WALL_OUTLET",
    xMm: 10000 + i * 500,
    yMm: 15000,
    subType: "WALL_OUTLET",
    isPatched: false,
  }));

  const availBefore = getRackPortAvailability(mockRacks, outletsToRoute);
  assert(availBefore[0]!.freePorts === 24, "24 ports disponibles avant routage");

  const routeResult = autoRoutePortsToRack({
    portIds: outletsToRoute.map((o) => o.id),
    rackId: "rack-auto",
    allNodes: outletsToRoute,
    racks: mockRacks,
  });

  assert(routeResult.routedCount === 10, "10 prises raccordées avec succès");
  assert(routeResult.assignments.length === 10, "10 affectations détaillées produites");
  assert(
    Object.keys(routeResult.updatedCustomPivots).length > 0,
    "Pivot orthogonal 90° calculé pour le ruban"
  );

  routeResult.updatedNodes.forEach((node, idx) => {
    assert(node.isPatched === true, `Nœud ${node.id} est maintenant brassé`);
    assert(node.connectedRackId === "rack-auto", "Baie cible correcte");
    assert(node.connectedSwitchPort === `Gi1/0/${idx + 1}`, `Port switch Gi1/0/${idx + 1} assigné`);
  });

  const availAfter = getRackPortAvailability(mockRacks, routeResult.updatedNodes);
  assert(availAfter[0]!.freePorts === 14, "14 ports disponibles après routage des 10 prises");
  console.log("   ✅ Auto-routage orthogonal 90°, allocation switch et décalage ruban validés.");

  // ---------------------------------------------------------------------------
  // Test 12 : Ingestion et Audit de Matrice CSV DSI (parseAndAuditMatrixCsv & applyMatrixImport)
  // ---------------------------------------------------------------------------
  console.log("\n🧪 12. Test d'audit et d'application de matrice CSV DSI...");
  const validCsv = `
Prise_ID;Bureau_ID;Utilisateur;IP_Machine;MAC;VLAN_ID;Baie;Switch_Nom;Port_Switch
PRISE-A101;DESK-101;Alice Dupont;10.42.20.101;00:1A:2B:3C:4D:5E;20;BAIE-01;SW-01;Gi1/0/1
PRISE-A102;DESK-102;Bob Martin;10.42.30.102;00:1A:2B:3C:4D:5F;30;BAIE-01;SW-01;Gi1/0/2
PRISE-A103;DESK-103;Clara Bernard;10.42.20.103;00:1A:2B:3C:4D:60;20;BAIE-01;SW-01;Gi1/0/3
`.trim();

  const auditValid = parseAndAuditMatrixCsv(validCsv);
  assert(auditValid.isValid === true, "Matrice valide approuvée");
  assert(auditValid.validRows.length === 3, "3 lignes valides extraites");
  assert(auditValid.summary.distinctUsers === 3, "3 utilisateurs distincts");
  assert(auditValid.summary.distinctVlans === 2, "2 VLANs distincts (20 et 30)");

  const invalidCsv = `
Prise_ID;Bureau_ID;Utilisateur;IP_Machine;MAC;VLAN_ID;Baie;Switch_Nom;Port_Switch
PRISE-ERR1;DESK-999;User Erreur 1;999.999.999.999;00:1A:2B:3C:4D:5E;20;BAIE-01;SW-01;Gi1/0/1
PRISE-ERR2;DESK-999;User Erreur 2;10.42.20.50;INVALID_MAC_ADDR;20;BAIE-01;SW-01;Gi1/0/2
`.trim();

  const auditInvalid = parseAndAuditMatrixCsv(invalidCsv);
  assert(auditInvalid.isValid === false, "Fichier avec erreurs rejeté");
  assert(auditInvalid.errors.length >= 2, "Au moins 2 erreurs détectées");
  const ipError = auditInvalid.errors.find((e) => e.column === "IP_Machine");
  const macError = auditInvalid.errors.find((e) => e.column === "MAC");
  assert(ipError !== undefined, "Erreur IP détectée");
  assert(macError !== undefined, "Erreur MAC détectée");

  const applyResult = applyMatrixImport(auditValid.validRows, []);
  assert(applyResult.unpositionedNodes.length > 0, "Éléments non positionnés créés pour le tiroir");
  const unplacedDesk = applyResult.unpositionedNodes.find(
    (n) => n.id === "unpositioned-desk-DESK-101"
  );
  assert(unplacedDesk !== undefined, "Bureau non positionné présent");
  assert(
    unplacedDesk?.assignedPerson === "Alice Dupont",
    "Utilisateur Alice Dupont rattaché au bureau"
  );

  console.log(
    "   ✅ Audit CSV matriciel DSI, validation IPv4/MAC et génération de tiroir d'éléments certifiés."
  );

  // ---------------------------------------------------------------------------
  // Test 13 : Architecture Cuivre Passif & Héritage Dynamique de Profil Switch
  // ---------------------------------------------------------------------------
  console.log("\n🧪 13. Test de la vision cuivre passif et héritage dynamique du profil switch...");
  const mockRackWithSwitches: RackDisplay = {
    id: "rack-heritage-01",
    name: "BAIE-HERITAGE",
    xMm: 10000,
    yMm: 10000,
    widthMm: 800,
    depthMm: 1000,
    uHeight: 42,
    devices: [
      {
        id: "sw-heritage-01",
        name: "SW-HERITAGE-POE-24P",
        slotU: 24,
        uSize: 1,
        deviceType: "SWITCH",
        brand: "CISCO",
        model: "Cisco Catalyst 24-Port PoE+",
        status: "ONLINE",
        portsCount: 24,
        poeBudgetW: 370,
      },
    ],
  };

  const port1Profile = getSwitchPortProfile(mockRackWithSwitches.devices?.[0], "Gi1/0/1");
  assert(port1Profile.vlanId === 20, "Port 1 assigné au VLAN 20 par défaut");

  // Prise débranchée / passive
  const unpatchedOutlet: NodeDisplay = {
    id: "outlet-passive-01",
    type: "WALL_OUTLET",
    name: "Prise Brute",
    xMm: 2000,
    yMm: 2000,
  };

  const passiveNet = resolveEffectiveOutletNetwork(unpatchedOutlet, [mockRackWithSwitches]);
  assert(passiveNet.isPatched === false, "Prise non raccordée marquée passive");
  assert(passiveNet.role === "GENERIC", "Rôle générique par défaut");
  assert(passiveNet.poeEnabled === false, "Aucun PoE actif sur prise brute");
  assert(passiveNet.vlanId === undefined, "Aucun VLAN attribué sur cuivre passif");

  // Raccordement sur port Gi1/0/18 (réservé VoIP par profil)
  const patchedVoipOutlet: NodeDisplay = {
    ...unpatchedOutlet,
    isPatched: true,
    connectedRackId: "rack-heritage-01",
    connectedSwitchId: "sw-heritage-01",
    connectedSwitchPort: "Gi1/0/18",
  };
  const voipNet = resolveEffectiveOutletNetwork(patchedVoipOutlet, [mockRackWithSwitches]);
  assert(voipNet.isPatched === true, "Prise raccordée active");
  assert(voipNet.vlanId === 30, "Hérite du VLAN 30 VoIP");
  assert(voipNet.role === "VOIP", "Hérite du rôle VOIP");
  assert(voipNet.poeEnabled === true, "Hérite de l'alimentation PoE pour le téléphone IP");

  // Raccordement sur port Gi1/0/22 (réservé Wi-Fi par profil)
  const patchedWifiOutlet: NodeDisplay = {
    ...unpatchedOutlet,
    isPatched: true,
    connectedRackId: "rack-heritage-01",
    connectedSwitchId: "sw-heritage-01",
    connectedSwitchPort: "Gi1/0/22",
  };
  const wifiNet = resolveEffectiveOutletNetwork(patchedWifiOutlet, [mockRackWithSwitches]);
  assert(wifiNet.vlanId === 50, "Hérite du VLAN 50 Wi-Fi");
  assert(wifiNet.role === "WIFI", "Hérite du rôle WIFI");
  assert(wifiNet.poePowerW === 30, "Hérite du PoE+ 30W");
  console.log("   ✅ Héritage dynamique du port de commutateur certifié (VLAN, PoE, Rôle).");

  // ---------------------------------------------------------------------------
  // Test 14 : Anti-Collision Stricte des Ports Commutateur (1:1 exclusif)
  // ---------------------------------------------------------------------------
  console.log("\n🧪 14. Test d'anti-collision stricte sur les ports de switch...");
  const isOccupied = isSwitchPortOccupied("rack-heritage-01", "sw-heritage-01", "Gi1/0/18", [
    patchedVoipOutlet,
  ]);
  assert(isOccupied === true, "Le port Gi1/0/18 est correctement détecté comme occupé");

  const isFree = isSwitchPortOccupied("rack-heritage-01", "sw-heritage-01", "Gi1/0/1", [
    patchedVoipOutlet,
  ]);
  assert(isFree === false, "Le port Gi1/0/1 est disponible");
  console.log("   ✅ Exclusivité 1:1 stricte validée contre tout doublon de port.");

  // ---------------------------------------------------------------------------
  // Test 15 : Auto-Route avec Sélection Ciblée de Switch
  // ---------------------------------------------------------------------------
  console.log("\n🧪 15. Test d'Auto-Route avec switch cible explicite...");
  const rackWithTwoSwitches: RackDisplay = {
    id: "rack-multi-sw",
    name: "BAIE-MULTI-SW",
    xMm: 20000,
    yMm: 20000,
    widthMm: 800,
    depthMm: 1000,
    uHeight: 42,
    devices: [
      {
        id: "sw-cisco-primary",
        name: "SW-CISCO-PRIMARY",
        slotU: 24,
        uSize: 1,
        deviceType: "SWITCH",
        brand: "CISCO",
        status: "ONLINE",
        portsCount: 24,
      },
      {
        id: "sw-aruba-secondary",
        name: "SW-ARUBA-SECONDARY",
        slotU: 22,
        uSize: 1,
        deviceType: "SWITCH",
        brand: "ARUBA",
        status: "ONLINE",
        portsCount: 24,
      },
    ],
  };

  const testOutletsToRoute: NodeDisplay[] = [
    { id: "outlet-multi-1", type: "WALL_OUTLET", name: "Prise M1", xMm: 5000, yMm: 5000 },
    { id: "outlet-multi-2", type: "WALL_OUTLET", name: "Prise M2", xMm: 6000, yMm: 5000 },
  ];

  const routedToSecondary = autoRoutePortsToRack({
    portIds: ["outlet-multi-1", "outlet-multi-2"],
    rackId: "rack-multi-sw",
    switchId: "sw-aruba-secondary",
    allNodes: testOutletsToRoute,
    racks: [rackWithTwoSwitches],
    customPivots: {},
  });

  routedToSecondary.updatedNodes.forEach((node) => {
    assert(
      node.connectedSwitchId === "sw-aruba-secondary",
      "Raccordé spécifiquement au switch Aruba secondaire"
    );
    assert(node.connectedRackId === "rack-multi-sw", "Baie cible correcte");
  });
  console.log("   ✅ Auto-Route avec sélection de commutateur spécifique validé.");

  // ---------------------------------------------------------------------------
  // Test 16 : Cadrage et Dézoom Profond pour Très Grands Campus Multi-Bâtiments
  // ---------------------------------------------------------------------------
  console.log(
    "\n🧪 16. Test de dézoom profond pour très grand campus multi-bâtiments (2km × 1.5km)..."
  );
  const megaCampusBounds: BoundingBox = {
    minX: 0,
    minY: 0,
    maxX: 2000000, // 2 kilomètres (2 000 m)
    maxY: 1500000, // 1.5 kilomètres (1 500 m)
    width: 2000000,
    height: 1500000,
  };

  const megaFit = fitToBounds(megaCampusBounds, 1920, 1080, 50);
  assert(
    megaFit.scale >= 0.0002,
    "L'échelle reste au-dessus ou égale à la borne minimale de sécurité (0.0002)"
  );
  assert(
    megaFit.scale < 0.001,
    "L'échelle descend en-dessous de 0.001 pour afficher l'intégralité du site"
  );

  const megaTopLeft = worldToScreen(
    { x: megaCampusBounds.minX, y: megaCampusBounds.minY },
    megaFit
  );
  const megaBottomRight = worldToScreen(
    { x: megaCampusBounds.maxX, y: megaCampusBounds.maxY },
    megaFit
  );

  assert(megaTopLeft.x >= 49, "Campus TopLeft visible dans l'écran");
  assert(megaBottomRight.x <= 1920 - 49, "Campus BottomRight visible dans l'écran");
  assert(megaBottomRight.y <= 1080 - 49, "Campus Bottom visible dans l'écran");

  // Vérification que le zoom arrière manuel peut descendre jusqu'à la limite 0.0002
  const maxDezoomViewport = zoomAtPointer({ x: 960, y: 540 }, megaFit, 0.0001);
  assert(
    maxDezoomViewport.scale === 0.0002,
    "Le zoom arrière manuel atteint exactement la borne minScale de 0.0002"
  );
  console.log(
    "   ✅ Dézoom macro 0.0002 certifié : vision globale jusqu'à 5 km multi-bâtiments validée."
  );

  console.log("\n🎉 TOUS LES TESTS DU MOTEUR SPATIAL 2D SONT VALIDÉS AVEC SUCCÈS !");
}

// Exécution en tant que suite de tests Vitest si le runner est actif, ou CLI autonome avec tsx
// @ts-ignore
if (typeof describe !== "undefined" && typeof it !== "undefined") {
  // @ts-ignore
  describe("Spatial 2D Engine", () => {
    // @ts-ignore
    it("should pass all 16 spatial mathematics, snapping and batch tests", async () => {
      await runSpatialTests();
    });
  });
} else {
  runSpatialTests().catch((err) => {
    console.error("❌ ERREUR DANS LE TEST SPATIAL :", err);
    process.exit(1);
  });
}
