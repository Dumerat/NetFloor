import { db, queryClient } from "./index";
import { floors, racks, nodes, ports, cables, vlans } from "./schema/index";
import { eq } from "drizzle-orm";

export async function seedTopology() {
  console.log("🌱 NetFloor Architect: Ingestion de la topologie de référence...");

  // Nettoyage préalable (ordre inverse des FKs)
  await db.delete(cables);
  await db.delete(ports);
  await db.delete(nodes);
  await db.delete(racks);
  await db.delete(floors);
  await db.delete(vlans);

  // 1. Étage & Bâtiment (Coordonnées métriques 60m x 35m)
  const [floor] = await db
    .insert(floors)
    .values({
      name: "Étage 4 - Plateau Open Space & Tech Lab",
      building: "Campus Horizon",
      floorNumber: 4,
      widthMm: 60000,
      heightMm: 35000,
      scaleRatio: 1.0,
      metadata: { siteCode: "PAR-HZ-04", capacityDesks: 120 },
    })
    .returning();

  if (!floor) throw new Error("Erreur lors de l'insertion de l'étage");

  // 2. Baie Serveur / Brassage (Local Technique 4A)
  const [rack] = await db
    .insert(racks)
    .values({
      floorId: floor.id,
      name: "BAIE-LT4A-01",
      uHeight: 42,
      xMm: 8500,
      yMm: 4200,
      widthMm: 600,
      depthMm: 1000,
      rotationDeg: 0,
    })
    .returning();

  if (!rack) throw new Error("Erreur lors de l'insertion de la baie");

  // 3. Couche Logique : VLANs d'entreprise
  const [vlanMgmt, vlanData, vlanVoip] = await db
    .insert(vlans)
    .values([
      {
        vid: 10,
        name: "VLAN_INFRA_MGMT",
        description: "Gestion des commutateurs et PDU",
        subnetCidr: "10.40.10.0/24",
        gatewayIp: "10.40.10.1",
        colorHex: "#64748b",
      },
      {
        vid: 20,
        name: "VLAN_CORP_DATA",
        description: "Postes de travail collaborateurs et docking stations",
        subnetCidr: "10.40.20.0/22",
        gatewayIp: "10.40.20.1",
        colorHex: "#2563eb",
      },
      {
        vid: 30,
        name: "VLAN_VOIP",
        description: "Téléphonie IP et visioconférence",
        subnetCidr: "10.40.30.0/24",
        gatewayIp: "10.40.30.1",
        colorHex: "#10b981",
      },
    ])
    .returning();

  if (!vlanData || !vlanMgmt || !vlanVoip) throw new Error("Erreur lors de l'insertion des VLANs");

  // 4. Nœuds Physiques
  // A. Prise Murale RJ45 (Bureau Tech Lead)
  const [wallOutlet] = await db
    .insert(nodes)
    .values({
      floorId: floor.id,
      type: "WALL_OUTLET",
      name: "PRISE-DESK-408-A",
      model: "Legrand Mosaic Plastron 2xRJ45",
      xMm: 42500,
      yMm: 18200,
      rotationDeg: 90,
      metadata: { deskZone: "Core-Engineers", deskNumber: 408 },
    })
    .returning();

  // B. Panneau de Brassage en Baie (U24)
  const [patchPanel] = await db
    .insert(nodes)
    .values({
      floorId: floor.id,
      rackId: rack.id,
      rackUPosition: 24,
      type: "PATCH_PANEL",
      name: "PP-24P-CAT6A-U24",
      model: "Legrand LCS3 24xRJ45 Cat6A STP",
      xMm: rack.xMm,
      yMm: rack.yMm,
      rotationDeg: 0,
    })
    .returning();

  // C. Switch d'Accès L2/L3 en Baie (U22)
  const [switchNode] = await db
    .insert(nodes)
    .values({
      floorId: floor.id,
      rackId: rack.id,
      rackUPosition: 22,
      type: "SWITCH",
      name: "SW-ACCESS-4A-U22",
      model: "Cisco Catalyst C9300-48P",
      xMm: rack.xMm,
      yMm: rack.yMm,
      rotationDeg: 0,
      metadata: { mgmtIp: "10.40.10.12", serial: "FOC2419X01Z" },
    })
    .returning();

  if (!wallOutlet || !patchPanel || !switchNode) {
    throw new Error("Erreur lors de l'insertion des nœuds d'équipement");
  }

  // 5. Ports et Continuités Internes
  // A. Port Prise Murale
  const [wallPort] = await db
    .insert(ports)
    .values({
      nodeId: wallOutlet.id,
      label: "RJ45-1",
      connectorType: "RJ45",
      direction: "BI",
      mode: "PASSIVE",
    })
    .returning();

  // B. Ports Patch Panel (Face Arrière Punchdown & Face Avant RJ45)
  const [ppPortFront] = await db
    .insert(ports)
    .values({
      nodeId: patchPanel.id,
      label: "PORT-08",
      connectorType: "RJ45",
      direction: "FRONT",
      mode: "PASSIVE",
    })
    .returning();

  if (!ppPortFront) throw new Error("Erreur création port avant patch panel");

  const [ppPortRear] = await db
    .insert(ports)
    .values({
      nodeId: patchPanel.id,
      label: "PORT-08",
      connectorType: "PUNCHDOWN_110",
      direction: "REAR",
      mode: "PASSIVE",
      internalPeerPortId: ppPortFront.id, // Continuité interne matérielle
    })
    .returning();

  if (!ppPortRear) throw new Error("Erreur création port arrière patch panel");

  // Réciprocité de la liaison interne
  await db
    .update(ports)
    .set({ internalPeerPortId: ppPortRear.id })
    .where(eq(ports.id, ppPortFront.id));

  // C. Port Switch Cisco (Configuré en Access VLAN 20 DATA_CORP)
  const [switchPort] = await db
    .insert(ports)
    .values({
      nodeId: switchNode.id,
      label: "GigabitEthernet1/0/8",
      connectorType: "RJ45",
      direction: "FRONT",
      mode: "ACCESS",
      nativeVlanId: vlanData.id,
      speedMbps: 1000,
      poeEnabled: true,
      poeStandard: "802.3at",
    })
    .returning();

  if (!wallPort || !switchPort) throw new Error("Erreur création ports switch/prise");

  // 6. Câbles Physiques (Liaisons du graphe)
  // Câble 1 : Câble horizontal rigide Cat6A (Prise Murale -> Port Arrière Patch Panel)
  const [horizontalCable] = await db
    .insert(cables)
    .values({
      cableType: "HORIZONTAL_RUN",
      category: "CAT6A",
      sourcePortId: wallPort.id,
      targetPortId: ppPortRear.id,
      lengthMm: 44200, // 44.20 mètres de tirage dans le faux-plafond
      colorCode: "BLUE",
      status: "ACTIVE",
      metadata: { conduit: "Goulotte-Sud-A4", testedIso11801: true },
    })
    .returning();

  // Câble 2 : Cordon de brassage souple Cat6A en baie (Port Avant Patch Panel -> Port Switch)
  const [patchCord] = await db
    .insert(cables)
    .values({
      cableType: "PATCH_CORD",
      category: "CAT6A",
      sourcePortId: ppPortFront.id,
      targetPortId: switchPort.id,
      lengthMm: 1500, // 1.50 mètre
      colorCode: "YELLOW",
      status: "ACTIVE",
    })
    .returning();

  console.log("✅ Topologie de référence déployée avec succès :");
  console.log(`   - Étage : ${floor.name} (${floor.widthMm / 1000}m x ${floor.heightMm / 1000}m)`);
  console.log(`   - Prise Murale : ${wallOutlet.name} -> Port ${wallPort.label}`);
  console.log(
    `   - Câble Horizontal : ${horizontalCable?.lengthMm ? horizontalCable.lengthMm / 1000 : 0}m (${horizontalCable?.category})`
  );
  console.log(`   - Patch Panel : ${patchPanel.name} (Port Arrière <-> Port Avant couplés)`);
  console.log(`   - Cordon de Brassage : ${patchCord?.lengthMm ? patchCord.lengthMm / 1000 : 0}m`);
  console.log(
    `   - Switch Actif : ${switchNode.name} [${switchPort.label}] -> VLAN ${vlanData.vid} (${vlanData.name})`
  );

  return {
    floor,
    rack,
    vlans: { vlanMgmt, vlanData, vlanVoip },
    nodes: { wallOutlet, patchPanel, switchNode },
    ports: { wallPort, ppPortRear, ppPortFront, switchPort },
    cables: { horizontalCable, patchCord },
  };
}

// Si exécuté directement via CLI
if (process.argv[1]?.endsWith("seed.ts")) {
  seedTopology()
    .then(async () => {
      await queryClient.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error("❌ Erreur pendant le seed :", err);
      await queryClient.end();
      process.exit(1);
    });
}
