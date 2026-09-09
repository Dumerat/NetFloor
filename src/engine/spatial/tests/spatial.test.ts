import {
  screenToWorld,
  worldToScreen,
  zoomAtPointer,
  getVisibleWorldBounds,
  fitToBounds,
  distanceBetween,
} from "../matrix";
import { snapToGrid, snapToPort, snapToNodeAlignments } from "../snapping";
import { useCameraStore } from "../useCameraStore";
import { Viewport, BoundingBox } from "../types";

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
  const zoomedInViewport = zoomAtPointer(cursorScreenPos, initialViewport, initialViewport.scale * 2.5);
  const worldPointAfterZoomIn = screenToWorld(cursorScreenPos, zoomedInViewport);

  assertClose(worldPointBefore.x, worldPointAfterZoomIn.x, 1e-6, "Zoom In invariant X");
  assertClose(worldPointBefore.y, worldPointAfterZoomIn.y, 1e-6, "Zoom In invariant Y");

  // Zoom arrière (facteur 0.4x)
  const zoomedOutViewport = zoomAtPointer(cursorScreenPos, zoomedInViewport, zoomedInViewport.scale * 0.4);
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
    maxX: 80000,  // 80 mètres
    maxY: 40000,  // 40 mètres
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
  assert(visibleBounds.width > 0 && visibleBounds.height > 0, "Dimensions du monde visible positives");
  assert(visibleBounds.minX <= floorBounds.minX, "MinX visible englobe l'étage");
  assert(visibleBounds.maxX >= floorBounds.maxX, "MaxX visible englobe l'étage");

  // Test de distance euclidienne
  const d1 = distanceBetween({ x: 0, y: 0 }, { x: 3000, y: 4000 });
  assertClose(d1, 5000, 1e-6, "Distance 3-4-5 Pythagore exacte (5000mm)");
  console.log(`   ✅ Cadrage parfait : échelle ${fitted.scale.toFixed(6)} px/mm, centrage écran exact, limites visibles validées.`);

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

  console.log("\n🎉 TOUS LES TESTS DU MOTEUR SPATIAL 2D SONT VALIDÉS AVEC SUCCÈS !");
}

runSpatialTests().catch((err) => {
  console.error("❌ ERREUR DANS LE TEST SPATIAL :", err);
  process.exit(1);
});
