import { parseCsvContent } from "../parser";
import { validateCablingLedger } from "../validator";
import { importCablingLedger } from "../importer";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "../../../db/schema/index";
import fs from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { CircuitHopSchema } from "../../../db/queries/trace-link";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`❌ Échec : ${message}`);
}

async function runIngestionTests() {
  console.log("================================================================================");
  console.log("🏭 NetFloor Architect : Banc d'Essai d'Ingestion de Masse (800+ Liens)");
  console.log("================================================================================\n");

  // ---------------------------------------------------------------------------
  // Test 1 : Détection des erreurs et rejets de carnet corrompu
  // ---------------------------------------------------------------------------
  console.log("🧪 1. Test de détection des anomalies et conflits topologiques...");

  const corruptCsv = `
# Carnet de câblage avec erreurs délibérées
prise_murale;port_prise;etage;baie;panneau;port_patch;categorie;longueur_m;commutateur;port_switch;vid;nom_vlan
PRISE-A01;RJ45-1;Étage 1;BAIE-01;PP-01;01;CAT6A;35.5;SW-CORE;Gi1/0/1;20;DATA
PRISE-A02;RJ45-1;Étage 1;BAIE-01;PP-01;02;CAT6A;32.0;SW-CORE;Gi1/0/2;20;DATA
# Erreur 1 : Double-booking du port de patch 01
PRISE-A03;RJ45-1;Étage 1;BAIE-01;PP-01;01;CAT6A;28.0;SW-CORE;Gi1/0/3;20;DATA
# Erreur 2 : Conflit de port switch Gi1/0/2 + conflit VLAN (30 vs 20)
PRISE-A04;RJ45-1;Étage 1;BAIE-01;PP-01;04;CAT6A;15.0;SW-CORE;Gi1/0/2;30;VOIP
# Erreur 3 : VLAN ID invalide (9999 > 4094)
PRISE-A05;RJ45-1;Étage 1;BAIE-01;PP-01;05;CAT6A;10.0;SW-CORE;Gi1/0/5;9999;INVALID
# Erreur 4 : Doublon de prise murale PRISE-A01
PRISE-A01;RJ45-1;Étage 1;BAIE-01;PP-01;06;CAT6A;12.0;SW-CORE;Gi1/0/6;20;DATA
`.trim();

  const parsedCorrupt = parseCsvContent(corruptCsv);
  assert(parsedCorrupt.length === 6, "6 lignes brutes parsées");

  const validationCorrupt = validateCablingLedger(parsedCorrupt);
  assert(!validationCorrupt.isValid, "Le fichier corrompu doit être invalidé");
  assert(validationCorrupt.errors.length >= 4, "Au moins 4 anomalies détectées");

  console.log(`   ✅ Rejet validé : ${validationCorrupt.errors.length} anomalies interceptées avec précision.`);
  validationCorrupt.errors.forEach((e) => {
    console.log(`      • [Ligne ${e.row}] [${e.code}] : ${e.message}`);
  });

  // ---------------------------------------------------------------------------
  // Test 2 : Génération et validation d'un carnet de 800 liaisons d'entreprise
  // ---------------------------------------------------------------------------
  console.log("\n🧪 2. Génération synthétique d'un carnet de 800 liaisons d'entreprise...");

  const totalLines = 800;
  const csvLines: string[] = [
    "outlet_name,outlet_port,desk_number,floor_name,rack_name,patch_panel_name,patch_panel_port,cable_category,cable_length_m,switch_name,switch_port,vlan_vid,vlan_name",
  ];

  for (let i = 1; i <= totalLines; i++) {
    const floorNum = Math.ceil(i / 200); // 4 étages (200 postes par étage)
    const floorName = `Étage ${floorNum} - Plateau`;
    const rackIndex = Math.floor((i - 1) / 100); // 8 baies (100 postes par baie, index 0 à 7)
    const rackName = `BAIE-LT-0${rackIndex + 1}`;
    const posInRack = (i - 1) % 100; // 0 à 99 dans la baie

    const ppInRack = Math.floor(posInRack / 24) + 1; // 5 patch panels par baie (1 à 5)
    const patchPanelName = `PP-R0${rackIndex + 1}-0${ppInRack}`;
    const patchPortNum = (posInRack % 24) + 1;
    const patchPort = String(patchPortNum).padStart(2, "0");

    const swInRack = Math.floor(posInRack / 48) + 1; // 3 switches 48p par baie (1 à 3)
    const switchName = `SW-R0${rackIndex + 1}-0${swInRack}`;
    const swPortNum = (posInRack % 48) + 1;
    const switchPort = `Gi1/0/${swPortNum}`;

    const vlanVid = (i % 3) === 0 ? 30 : 20; // Alternance DATA (20) / VOIP (30)
    const vlanName = vlanVid === 30 ? "VLAN_VOIP" : "VLAN_CORP_DATA";

    const lengthM = (15 + (i % 35) * 1.2).toFixed(1);

    csvLines.push(
      `PRISE-DESK-${String(i).padStart(4, "0")},RJ45-1,B-${i},${floorName},${rackName},${patchPanelName},${patchPort},CAT6A,${lengthM},${switchName},${switchPort},${vlanVid},${vlanName}`
    );
  }

  const generatedCsv = csvLines.join("\n");
  console.log(`   ✅ Carnet généré : ${totalLines} liaisons structurées complètes.`);

  // ---------------------------------------------------------------------------
  // Test 3 : Parsing et Validation Haute Performance
  // ---------------------------------------------------------------------------
  console.log("\n🧪 3. Analyse et validation d'intégrité du carnet de 800 lignes...");
  const t0 = performance.now();
  const parsedRows = parseCsvContent(generatedCsv);
  const dryRun = validateCablingLedger(parsedRows);
  const t1 = performance.now();

  assert(dryRun.isValid, "Le carnet généré doit être 100% valide");
  assert(dryRun.summary.validRows === 800, "800 lignes certifiées conformes");
  assert(dryRun.summary.distinctFloors === 4, "4 étages identifiés");
  assert(dryRun.summary.distinctRacks === 8, "8 baies informatiques identifiées");
  assert(dryRun.summary.distinctPatchPanels === 40, "40 bandeaux de brassage");
  assert(dryRun.summary.distinctSwitches === 24, "24 commutateurs d'accès");
  assert(dryRun.summary.distinctVlans === 2, "2 VLANs (20 et 30)");

  console.log(`   ✅ Validation achevée en ${(t1 - t0).toFixed(2)} ms.`);
  console.log(`   📊 Résumé de l'analyse :`);
  console.log(`      • Lignes traitées : ${dryRun.summary.validRows} / ${dryRun.summary.totalRows}`);
  console.log(`      • Étages : ${dryRun.summary.distinctFloors}`);
  console.log(`      • Baies : ${dryRun.summary.distinctRacks}`);
  console.log(`      • Patch Panels : ${dryRun.summary.distinctPatchPanels}`);
  console.log(`      • Commutateurs : ${dryRun.summary.distinctSwitches}`);
  console.log(`      • VLANs : ${dryRun.summary.distinctVlans}`);

  // ---------------------------------------------------------------------------
  // Test 4 : Import Transactionnel dans PostgreSQL 16 (PGlite)
  // ---------------------------------------------------------------------------
  console.log("\n🧪 4. Importation atomique dans le moteur PostgreSQL 16...");
  const client = new PGlite();
  const db = drizzle(client, { schema });

  // Application DDL
  const migrationPath = path.resolve(process.cwd(), "drizzle", "0000_conscious_naoko.sql");
  const migrationRaw = fs.readFileSync(migrationPath, "utf-8");
  const statements = migrationRaw
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const stmt of statements) {
    await client.exec(stmt);
  }

  // Échantillon de test d'ingestion (50 premières lignes pour test d'intégration rapide)
  const sampleRecords = dryRun.validRecords.slice(0, 50);
  const importResult = await importCablingLedger(db as any, sampleRecords);

  assert(importResult.success, "L'import transactionnel doit réussir");
  console.log("   ✅ Insertion transactionnelle réussie :");
  console.log(`      • Étages créés : ${importResult.insertedCounts.floors}`);
  console.log(`      • Baies créées : ${importResult.insertedCounts.racks}`);
  console.log(`      • Nœuds physiques créés : ${importResult.insertedCounts.nodes}`);
  console.log(`      • Ports créés : ${importResult.insertedCounts.ports}`);
  console.log(`      • Câbles physiques insérés : ${importResult.insertedCounts.cables}`);
  console.log(`      • VLANs configurés : ${importResult.insertedCounts.vlans}`);

  // ---------------------------------------------------------------------------
  // Test 5 : Traçage Récursif CTE sur les Données Importées (Chaîne Complète)
  // ---------------------------------------------------------------------------
  console.log("\n🧪 5. Validation de la CTE récursive sur une prise importée...");

  // Récupérer le premier port de prise murale inséré
  const targetWallPortResult = await db.execute(sql`
    SELECT p.id, p.label, n.name AS node_name
    FROM ports p
    JOIN nodes n ON n.id = p.node_id
    WHERE n.type = 'WALL_OUTLET' AND n.name = 'PRISE-DESK-0001'
    LIMIT 1;
  `);

  const wallPortRow = (
    Array.isArray(targetWallPortResult)
      ? targetWallPortResult[0]
      : (targetWallPortResult as { rows: any[] }).rows[0]
  ) as { id: string; label: string; node_name: string };

  assert(wallPortRow !== undefined, "Prise importée trouvée");

  // Exécution de la CTE récursive de traçage de bout en bout
  const traceQuery = sql`
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
      WHERE p.id = ${wallPortRow.id}::uuid

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

  const traceRaw = await db.execute(traceQuery);
  const rawHops = Array.isArray(traceRaw) ? traceRaw : (traceRaw as { rows: any[] }).rows;
  const hops = z.array(CircuitHopSchema).parse(rawHops);

  assert(hops.length === 4, "4 sauts complets attendus");
  const lastHop = hops[hops.length - 1];
  assert(lastHop?.nodeType === "SWITCH", "Terminaison sur commutateur actif");
  assert(lastHop?.vlanVid === 20, "VLAN 20 résolu");

  console.log(`   ✅ Traçage complet réussi pour ${wallPortRow.node_name} :`);
  hops.forEach((h) => {
    const len = h.cableLengthMm > 0 ? ` (${h.cableLengthMm / 1000}m)` : "";
    console.log(`      [Hop ${h.hopNumber}] [${h.transitionType}] -> ${h.nodeName} [Port: ${h.portLabel}]${len}`);
  });
  console.log(`   🎯 Terminé sur : ${lastHop?.nodeName} -> VLAN VID ${lastHop?.vlanVid} (${lastHop?.vlanName})`);

  console.log("\n🎉 LES 3 PILIERS DE NETFLOOR ARCHITECT SONT VERROUILLÉS ET TESTÉS DE BOUT EN BOUT !");
}

// Exécution en tant que suite de tests Vitest si le runner est actif, ou CLI autonome avec tsx
// @ts-ignore
if (typeof describe !== "undefined" && typeof it !== "undefined") {
  // @ts-ignore
  describe("Ingestion & Cabling Ledger Engine", () => {
    // @ts-ignore
    it("should validate topology anomalies and mass enterprise cabling ledger", async () => {
      await runIngestionTests();
    });
  });
} else {
  runIngestionTests().catch((err) => {
    console.error("❌ ERREUR LORS DU TEST D'INGESTION :", err);
    process.exit(1);
  });
}
