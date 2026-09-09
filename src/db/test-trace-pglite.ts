import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "./schema/index";
import fs from "node:fs";
import path from "node:path";
import { sql, eq } from "drizzle-orm";
import { z } from "zod";
import { CircuitHopSchema, CircuitTraceResult } from "./queries/trace-link";

async function runStandaloneTraceValidation() {
  console.log("================================================================================");
  console.log("🚀 NetFloor Architect : Banc d'Essai Embarqué (PostgreSQL 16 Engine)");
  console.log("================================================================================\n");

  console.log("📦 1. Initialisation du moteur PostgreSQL 16 WASM...");
  const client = new PGlite();
  const db = drizzle(client, { schema });

  console.log("📜 2. Application de la migration DDL (drizzle/0000_conscious_naoko.sql)...");
  const migrationPath = path.resolve(process.cwd(), "drizzle", "0000_conscious_naoko.sql");
  const migrationRaw = fs.readFileSync(migrationPath, "utf-8");
  
  // Exécution des déclarations séparées par --> statement-breakpoint
  const statements = migrationRaw
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const stmt of statements) {
    await client.exec(stmt);
  }
  console.log(`   ✅ ${statements.length} déclarations DDL exécutées avec succès (Types, Tables, FKs, Indexes).`);

  // 3. Déploiement de la topologie
  console.log("\n🌱 3. Déploiement de la topologie de référence (Entreprise 800+ collaborateurs)...");
  
  // Étage
  const [floor] = await db
    .insert(schema.floors)
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

  if (!floor) throw new Error("Échec insertion étage");

  // Baie
  const [rack] = await db
    .insert(schema.racks)
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

  if (!rack) throw new Error("Échec insertion baie");

  // VLANs
  const [vlanMgmt, vlanData, vlanVoip] = await db
    .insert(schema.vlans)
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

  if (!vlanData || !vlanMgmt || !vlanVoip) throw new Error("Échec insertion VLANs");

  // Nœuds
  const [wallOutlet] = await db
    .insert(schema.nodes)
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

  const [patchPanel] = await db
    .insert(schema.nodes)
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

  const [switchNode] = await db
    .insert(schema.nodes)
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

  if (!wallOutlet || !patchPanel || !switchNode) throw new Error("Échec insertion nœuds");

  // Ports
  const [wallPort] = await db
    .insert(schema.ports)
    .values({
      nodeId: wallOutlet.id,
      label: "RJ45-1",
      connectorType: "RJ45",
      direction: "BI",
      mode: "PASSIVE",
    })
    .returning();

  const [ppPortFront] = await db
    .insert(schema.ports)
    .values({
      nodeId: patchPanel.id,
      label: "PORT-08",
      connectorType: "RJ45",
      direction: "FRONT",
      mode: "PASSIVE",
    })
    .returning();

  if (!ppPortFront) throw new Error("Échec port avant patch panel");

  const [ppPortRear] = await db
    .insert(schema.ports)
    .values({
      nodeId: patchPanel.id,
      label: "PORT-08",
      connectorType: "PUNCHDOWN_110",
      direction: "REAR",
      mode: "PASSIVE",
      internalPeerPortId: ppPortFront.id,
    })
    .returning();

  if (!ppPortRear) throw new Error("Échec port arrière patch panel");

  await db
    .update(schema.ports)
    .set({ internalPeerPortId: ppPortRear.id })
    .where(eq(schema.ports.id, ppPortFront.id));

  const [switchPort] = await db
    .insert(schema.ports)
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

  if (!wallPort || !switchPort) throw new Error("Échec ports terminaux");

  // Câbles
  const [horizontalCable] = await db
    .insert(schema.cables)
    .values({
      cableType: "HORIZONTAL_RUN",
      category: "CAT6A",
      sourcePortId: wallPort.id,
      targetPortId: ppPortRear.id,
      lengthMm: 44200,
      colorCode: "BLUE",
      status: "ACTIVE",
    })
    .returning();

  const [patchCord] = await db
    .insert(schema.cables)
    .values({
      cableType: "PATCH_CORD",
      category: "CAT6A",
      sourcePortId: ppPortFront.id,
      targetPortId: switchPort.id,
      lengthMm: 1500,
      colorCode: "YELLOW",
      status: "ACTIVE",
    })
    .returning();

  if (!horizontalCable || !patchCord) throw new Error("Échec câblage");

  console.log("   ✅ Topologie insérée.");

  // 4. Exécution de la CTE récursive
  console.log("\n🔍 4. Exécution de la CTE récursive de traçage de bout en bout...");
  const startPortId = wallPort.id;

  const query = sql`
    WITH RECURSIVE circuit_path AS (
      SELECT
        0 AS hop_number,
        'ORIGIN'::text AS transition_type,
        NULL::uuid AS cable_id,
        NULL::text AS cable_type,
        NULL::text AS cable_category,
        0 AS cable_length_mm,
        p.id AS from_port_id,
        p.id AS to_port_id,
        n.id AS node_id,
        n.name AS node_name,
        n.type::text AS node_type,
        p.label AS port_label,
        p.direction::text AS port_direction,
        p.mode::text AS port_mode,
        p.connector_type::text AS port_connector,
        p.native_vlan_id AS vlan_id,
        v.vid AS vlan_vid,
        v.name AS vlan_name,
        ARRAY[p.id]::uuid[] AS visited_port_ids
      FROM ports p
      JOIN nodes n ON n.id = p.node_id
      LEFT JOIN vlans v ON v.id = p.native_vlan_id
      WHERE p.id = ${startPortId}::uuid

      UNION ALL

      SELECT
        cp.hop_number + 1,
        step.transition_type,
        step.cable_id,
        step.cable_type,
        step.cable_category,
        step.cable_length_mm,
        cp.to_port_id AS from_port_id,
        step.next_port_id AS to_port_id,
        n.id AS node_id,
        n.name AS node_name,
        n.type::text AS node_type,
        p.label AS port_label,
        p.direction::text AS port_direction,
        p.mode::text AS port_mode,
        p.connector_type::text AS port_connector,
        p.native_vlan_id AS vlan_id,
        v.vid AS vlan_vid,
        v.name AS vlan_name,
        cp.visited_port_ids || step.next_port_id
      FROM circuit_path cp
      CROSS JOIN LATERAL (
        SELECT
          'CABLE'::text AS transition_type,
          c.id AS cable_id,
          c.cable_type::text AS cable_type,
          c.category::text AS cable_category,
          c.length_mm AS cable_length_mm,
          CASE
            WHEN c.source_port_id = cp.to_port_id THEN c.target_port_id
            ELSE c.source_port_id
          END AS next_port_id
        FROM cables c
        WHERE (c.source_port_id = cp.to_port_id OR c.target_port_id = cp.to_port_id)
          AND cp.transition_type != 'CABLE'

        UNION ALL

        SELECT
          'INTERNAL_PEER'::text AS transition_type,
          NULL::uuid AS cable_id,
          NULL::text AS cable_type,
          NULL::text AS cable_category,
          0 AS cable_length_mm,
          CASE
            WHEN p_curr.internal_peer_port_id IS NOT NULL THEN p_curr.internal_peer_port_id
            ELSE peer_back.id
          END AS next_port_id
        FROM ports p_curr
        LEFT JOIN ports peer_back ON peer_back.internal_peer_port_id = p_curr.id
        WHERE p_curr.id = cp.to_port_id
          AND (p_curr.internal_peer_port_id IS NOT NULL OR peer_back.id IS NOT NULL)
          AND cp.transition_type = 'CABLE'
      ) step
      JOIN ports p ON p.id = step.next_port_id
      JOIN nodes n ON n.id = p.node_id
      LEFT JOIN vlans v ON v.id = p.native_vlan_id
      WHERE NOT (step.next_port_id = ANY(cp.visited_port_ids))
        AND cp.hop_number < 25
    )
    SELECT
      hop_number AS "hopNumber",
      transition_type AS "transitionType",
      cable_id AS "cableId",
      cable_type AS "cableType",
      cable_category AS "cableCategory",
      cable_length_mm AS "cableLengthMm",
      from_port_id AS "fromPortId",
      to_port_id AS "toPortId",
      node_id AS "nodeId",
      node_name AS "nodeName",
      node_type AS "nodeType",
      port_label AS "portLabel",
      port_direction AS "portDirection",
      port_mode AS "portMode",
      port_connector AS "portConnector",
      vlan_id AS "vlanId",
      vlan_vid AS "vlanVid",
      vlan_name AS "vlanName"
    FROM circuit_path
    ORDER BY hop_number ASC;
  `;

  const queryResult = await db.execute(query);
  const rawHops = Array.isArray(queryResult)
    ? queryResult
    : ((queryResult as unknown as { rows?: unknown[] }).rows ?? []);
  const hops = z.array(CircuitHopSchema).parse(rawHops);

  const totalCableLengthMm = hops.reduce((acc, hop) => acc + hop.cableLengthMm, 0);
  const lastHop = hops[hops.length - 1];

  const traceResult: CircuitTraceResult = {
    startPortId,
    hops,
    totalCableLengthMm,
    totalCableLengthMeters: Number((totalCableLengthMm / 1000).toFixed(2)),
    isTerminatedAtActiveDevice: lastHop?.nodeType === "SWITCH",
    terminalNode: lastHop
      ? {
          id: lastHop.nodeId,
          name: lastHop.nodeName,
          type: lastHop.nodeType,
          portLabel: lastHop.portLabel,
          portMode: lastHop.portMode,
        }
      : null,
    resolvedVlan:
      lastHop?.vlanId && lastHop.vlanVid && lastHop.vlanName
        ? {
            id: lastHop.vlanId,
            vid: lastHop.vlanVid,
            name: lastHop.vlanName,
          }
        : null,
  };

  console.log("\n📊 RÉSULTAT DU TRAÇAGE :");
  console.log(`   Nombre total de sauts : ${traceResult.hops.length}`);
  console.log(`   Longueur totale de câble : ${traceResult.totalCableLengthMeters} m (${traceResult.totalCableLengthMm} mm)`);
  console.log(`   Terminé sur équipement actif : ${traceResult.isTerminatedAtActiveDevice ? "OUI" : "NON"}`);
  console.log(`   Équipement terminal : ${traceResult.terminalNode?.name} (${traceResult.terminalNode?.type})`);
  console.log(`   Port d'arrivée : ${traceResult.terminalNode?.portLabel}`);
  console.log(`   VLAN Actif Résolu : VID ${traceResult.resolvedVlan?.vid} — "${traceResult.resolvedVlan?.name}"`);

  console.log("\n📋 DÉTAIL DES ÉTAPES TRAVERSÉES :");
  traceResult.hops.forEach((h) => {
    const len = h.cableLengthMm > 0 ? ` [${h.cableLengthMm / 1000}m ${h.cableCategory ?? ""}]` : "";
    console.log(
      `   [Hop ${h.hopNumber}] ${h.transitionType.padEnd(13)} ➜ ${h.nodeName.padEnd(20)} | Port ${h.portLabel.padEnd(22)} (${h.portDirection})${len}`
    );
  });

  // Assertions
  console.log("\n🧪 5. Validation formelle des invariants :");
  if (traceResult.hops.length !== 4) throw new Error("Nombre de sauts invalide");
  console.log("   ✅ 4 sauts certifiés");

  if (traceResult.totalCableLengthMm !== 45700) throw new Error("Longueur physique erronée");
  console.log("   ✅ Longueur physique exacte : 45.7 mètres (44.2m horizontal + 1.5m patch)");

  if (traceResult.resolvedVlan?.vid !== 20) throw new Error("VLAN non résolu");
  console.log("   ✅ Résolution logique exacte : VLAN 20 (VLAN_CORP_DATA)");

  console.log("\n🏆 SUCCÈS TOTAL : La CTE récursive et le schéma relationnel sont validés sans dette technique !");
}

runStandaloneTraceValidation().catch((err) => {
  console.error("❌ ERREUR :", err);
  process.exit(1);
});
