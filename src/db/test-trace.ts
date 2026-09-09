import { queryClient } from "./index";
import { seedTopology } from "./seed";
import { traceCircuitPath } from "./queries/trace-link";

async function runTest() {
  console.log("================================================================================");
  console.log("🚀 NetFloor Architect : Test de Validation de la CTE Récursive de Traçage");
  console.log("================================================================================\n");

  // 1. Déploiement de la fixture
  const topology = await seedTopology();
  const startPortId = topology.ports.wallPort.id;

  console.log("\n🔍 Lancement du traçage récursif depuis la prise murale :");
  console.log(`   Port de départ : ${topology.nodes.wallOutlet.name} [${topology.ports.wallPort.label}] (${startPortId})`);

  // 2. Exécution de la CTE récursive
  const result = await traceCircuitPath(startPortId);

  console.log("\n📊 RÉSULTAT DU TRAÇAGE :");
  console.log(`   Nombre total de sauts : ${result.hops.length}`);
  console.log(`   Longueur totale de câble cumulée : ${result.totalCableLengthMeters} m (${result.totalCableLengthMm} mm)`);
  console.log(`   Terminaison sur équipement actif : ${result.isTerminatedAtActiveDevice ? "OUI" : "NON"}`);

  if (result.terminalNode) {
    console.log(`   Équipement terminal : ${result.terminalNode.name} (${result.terminalNode.type})`);
    console.log(`   Port d'arrivée : ${result.terminalNode.portLabel} [Mode: ${result.terminalNode.portMode}]`);
  }

  if (result.resolvedVlan) {
    console.log(`   VLAN Actif Résolu : VID ${result.resolvedVlan.vid} — "${result.resolvedVlan.name}"`);
  }

  console.log("\n📋 DÉTAIL DES SAUTS DU CIRCUIT :");
  result.hops.forEach((hop) => {
    const lenStr = hop.cableLengthMm > 0 ? ` [${hop.cableLengthMm / 1000}m ${hop.cableCategory ?? ""}]` : "";
    console.log(
      `   Hop #${hop.hopNumber} | [${hop.transitionType.padEnd(13)}] -> ${hop.nodeName.padEnd(20)} | Port: ${hop.portLabel.padEnd(24)} (${hop.portDirection}) ${lenStr}`
    );
  });

  // 3. Assertions strictes de conformité
  console.log("\n🧪 VÉRIFICATION DES ASSERTIONS :");

  if (result.hops.length !== 4) {
    throw new Error(`Échec : Attendu 4 sauts (Origine + 3 transitions), reçu ${result.hops.length}`);
  }
  console.log("   ✅ Nombre de sauts exact (4 étapes)");

  const [hop0, hop1, hop2, hop3] = result.hops;
  if (!hop0 || !hop1 || !hop2 || !hop3) {
    throw new Error("Sauts incomplets");
  }

  if (hop0.nodeType !== "WALL_OUTLET" || hop0.portLabel !== "RJ45-1") {
    throw new Error("Échec : Le saut 0 doit correspondre à la prise murale");
  }
  console.log("   ✅ Hop 0 : Origine Prise murale conforme");

  if (hop1.transitionType !== "CABLE" || hop1.portDirection !== "REAR" || hop1.cableLengthMm !== 44200) {
    throw new Error("Échec : Le saut 1 doit traverser le câble horizontal vers le port arrière du patch panel");
  }
  console.log("   ✅ Hop 1 : Traversée Câble Horizontal (44.2m) -> Patch Panel Rear conforme");

  if (hop2.transitionType !== "INTERNAL_PEER" || hop2.portDirection !== "FRONT") {
    throw new Error("Échec : Le saut 2 doit franchir la continuité interne vers le port avant");
  }
  console.log("   ✅ Hop 2 : Traversée Continuité Interne Patch Panel (Rear -> Front) conforme");

  if (hop3.transitionType !== "CABLE" || hop3.nodeType !== "SWITCH" || hop3.cableLengthMm !== 1500) {
    throw new Error("Échec : Le saut 3 doit traverser le cordon de brassage vers le switch");
  }
  console.log("   ✅ Hop 3 : Traversée Cordon de Brassage (1.5m) -> Port Switch conforme");

  if (result.resolvedVlan?.vid !== 20 || result.resolvedVlan.name !== "VLAN_CORP_DATA") {
    throw new Error(`Échec : VLAN attendu VID 20 (VLAN_CORP_DATA), reçu VID ${result.resolvedVlan?.vid}`);
  }
  console.log("   ✅ Résolution logique VLAN 20 (VLAN_CORP_DATA) conforme");

  console.log("\n🎉 TOUS LES CONTRATS DE TOPOLOGIE ET DE TRAÇAGE SONT VALIDÉS SANS DETTE TECHNIQUE !");
}

runTest()
  .then(async () => {
    await queryClient.end();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("\n❌ ÉCHEC DU TEST :", err);
    await queryClient.end();
    process.exit(1);
  });
