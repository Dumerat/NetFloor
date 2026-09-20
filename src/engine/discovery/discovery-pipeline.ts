import { getDb } from "@/db";
import {
  discoveryJobs,
  discoveredDevices,
  discoveredConnections,
  discoveryLogs,
  nodes,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { ScanOptions, DiscoveredSwitch, TopologyLink, TopologyDiffItem } from "./types";
import { executePingSweep } from "./ping-sweep";
import { crawlSwitchLldpCdp } from "./snmp-crawler";
import { extractSwitchFdb, resolveAttachmentPoints } from "./fdb-resolver";
import { detectTopologyDrift, DatabaseNodeSummary } from "./drift-detector";
import { lookupOui } from "./oui-database";

export interface PipelineExecutionResult {
  jobId: string;
  success: boolean;
  devicesCount: number;
  connectionsCount: number;
  diffsCount: number;
  diffs: TopologyDiffItem[];
  durationMs: number;
}

/**
 * Journalise une étape d'exécution dans la table discovery_logs
 */
async function logPass(
  jobId: string,
  pass: number,
  message: string,
  level: "INFO" | "WARN" | "ERROR" = "INFO",
  metadata: Record<string, unknown> = {}
) {
  try {
    const db = await getDb();
    await db.insert(discoveryLogs).values({
      jobId,
      pass,
      level,
      message,
      metadata,
    });
  } catch {
    // Non-bloquant
  }
}

/**
 * Orchestrateur du pipeline de découverte réseau multi-passes (1 à 4).
 */
export async function runDiscoveryPipeline(
  jobId: string,
  options: ScanOptions
): Promise<PipelineExecutionResult> {
  const startTime = Date.now();
  const db = await getDb();

  try {
    // Marquer le job comme EN COURS
    await db
      .update(discoveryJobs)
      .set({
        status: "RUNNING",
        currentPass: 1,
        startedAt: new Date(),
      })
      .where(eq(discoveryJobs.id, jobId));

    // =========================================================================
    // PASSE 1 : Cartographie L3 & Hôtes actifs (ARP & Sweep)
    // =========================================================================
    await logPass(
      jobId,
      1,
      `Démarrage de la Passe 1 : Balayage CIDR & Découverte L3 sur ${options.subnetCidr}`
    );

    const probedHosts = await executePingSweep(options.subnetCidr, {
      timeoutMs: options.pingTimeoutMs || 350,
      concurrency: options.concurrency || 32,
    });

    await logPass(
      jobId,
      1,
      `Passe 1 achevée : ${probedHosts.length} hôtes actifs identifiés sur le réseau`
    );

    await db
      .update(discoveryJobs)
      .set({
        currentPass: 2,
        devicesDiscoveredCount: probedHosts.length,
      })
      .where(eq(discoveryJobs.id, jobId));

    // =========================================================================
    // PASSE 2 : Topologie L2 & Dorsale (LLDP / CDP / LAG)
    // =========================================================================
    await logPass(
      jobId,
      2,
      "Démarrage de la Passe 2 : Interrogation SNMP ciblée et cartographie dorsale LLDP/CDP"
    );

    // Identifier les commutateurs candidats (hôtes ayant répondu sur le port 161 ou vendor Switch)
    const switchCandidates = probedHosts.filter((h) => {
      const isSnmpOpen = h.openPorts.includes(161);
      const { defaultType } = h.mac ? lookupOui(h.mac) : { defaultType: "UNKNOWN" };
      return isSnmpOpen || defaultType === "SWITCH" || h.ip.endsWith(".1") || h.ip.endsWith(".254");
    });

    const discoveredSwitches: DiscoveredSwitch[] = [];
    const backboneLinks: TopologyLink[] = [];

    for (const cand of switchCandidates) {
      const sw = await crawlSwitchLldpCdp(cand.ip, options);
      if (sw) {
        discoveredSwitches.push(sw);

        // Convertir les voisins LLDP en liens de topologie dorsale
        for (const lldp of sw.lldpNeighbors) {
          backboneLinks.push({
            id: `link-lldp-${sw.id}-${lldp.localPortName}`,
            sourceDeviceId: sw.id,
            sourceDeviceName: sw.sysName,
            sourcePortName: lldp.localPortName,
            targetDeviceId: `sw-${lldp.remoteSysName.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
            targetDeviceName: lldp.remoteSysName,
            targetPortName: lldp.remotePortId,
            connectionType: "LLDP_BACKBONE",
            confidenceScore: 100,
            details: `Liaison d'interconnexion commutateurs détectée via 802.1AB LLDP`,
          });
        }

        // Convertir les voisins CDP en liens de topologie dorsale
        for (const cdp of sw.cdpNeighbors) {
          backboneLinks.push({
            id: `link-cdp-${sw.id}-${cdp.localPortName}`,
            sourceDeviceId: sw.id,
            sourceDeviceName: sw.sysName,
            sourcePortName: cdp.localPortName,
            targetDeviceId: `sw-${cdp.remoteDeviceId.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
            targetDeviceName: cdp.remoteDeviceId,
            targetPortName: cdp.remoteDevicePort,
            connectionType: "CDP_BACKBONE",
            confidenceScore: 95,
            details: `Liaison d'interconnexion commutateurs détectée via Cisco CDP`,
          });
        }
      }
    }

    await logPass(
      jobId,
      2,
      `Passe 2 achevée : ${discoveredSwitches.length} commutateur(s) administrable(s) et ${backboneLinks.length} liaison(s) dorsale(s) identifiée(s)`
    );

    await db
      .update(discoveryJobs)
      .set({
        currentPass: 3,
        connectionsDiscoveredCount: backboneLinks.length,
      })
      .where(eq(discoveryJobs.id, jobId));

    // =========================================================================
    // PASSE 3 : Corrélation d'extrémités (Switch Port Mapper / FDB)
    // =========================================================================
    await logPass(
      jobId,
      3,
      "Démarrage de la Passe 3 : Extraction des tables d'adresses MAC FDB et corrélation de ports"
    );

    // Pour chaque commutateur, extraire sa table FDB
    for (const sw of discoveredSwitches) {
      const fdb = await extractSwitchFdb(sw.ip, options);
      sw.fdbEntries = fdb;
    }

    // Résoudre les attachements directs, cas VoIP en cascade, et bornes Wi-Fi
    const { links: accessLinks, updatedHosts } = resolveAttachmentPoints(
      discoveredSwitches,
      probedHosts
    );

    const allDiscoveredLinks = [...backboneLinks, ...accessLinks];

    await logPass(
      jobId,
      3,
      `Passe 3 achevée : ${accessLinks.length} liaison(s) d'accès attribuée(s) aux terminaux`
    );

    await db
      .update(discoveryJobs)
      .set({
        currentPass: 4,
        connectionsDiscoveredCount: allDiscoveredLinks.length,
      })
      .where(eq(discoveryJobs.id, jobId));

    // =========================================================================
    // PASSE 4 : Détection de Dérive & Préparation de la Réconciliation
    // =========================================================================
    await logPass(
      jobId,
      4,
      "Démarrage de la Passe 4 : Analyse de dérive par rapport au jumeau numérique NetFloor"
    );

    // Récupérer les nœuds existants en base
    const dbNodes = await db.select().from(nodes);
    const existingNodeSummaries: DatabaseNodeSummary[] = dbNodes.map((n) => {
      const meta = (n.metadata || {}) as Record<string, unknown>;
      return {
        id: n.id,
        name: n.name,
        type: n.type,
        ipAddress: meta.ipAddress as string | undefined,
        macAddress: meta.macAddress as string | undefined,
        connectedSwitchId: meta.connectedSwitchId as string | undefined,
        connectedSwitchPort: meta.connectedSwitchPort as string | undefined,
        isLocked: Boolean(meta.isLocked),
      };
    });

    const diffs = detectTopologyDrift(updatedHosts, allDiscoveredLinks, existingNodeSummaries, []);

    await logPass(
      jobId,
      4,
      `Passe 4 achevée : ${diffs.length} proposition(s) de réconciliation formulée(s)`
    );

    // =========================================================================
    // PERSISTANCE DES RÉSULTATS DANS LA BASE DE DONNÉES
    // =========================================================================
    // 1. Sauvegarder les équipements découverts
    const deviceIdMap = new Map<string, string>();

    // Commutateurs
    for (const sw of discoveredSwitches) {
      const [inserted] = await db
        .insert(discoveredDevices)
        .values({
          jobId,
          ipAddress: sw.ip,
          macAddress: sw.mac,
          hostname: sw.sysName,
          manufacturer: sw.vendor,
          model: sw.model,
          deviceType: "SWITCH",
          sysDescr: sw.sysDescr,
          isManagedSwitch: true,
          metadata: { portsCount: sw.ports.length },
        })
        .returning();

      if (inserted) {
        deviceIdMap.set(sw.id, inserted.id);
      }
    }

    // Terminaux et hôtes
    for (const h of updatedHosts) {
      if (!h.mac) continue;
      const { vendor } = lookupOui(h.mac);
      const [inserted] = await db
        .insert(discoveredDevices)
        .values({
          jobId,
          ipAddress: h.ip,
          macAddress: h.mac,
          hostname: h.hostname,
          manufacturer: h.vendor || vendor,
          deviceType: h.deviceType || "UNKNOWN",
          metadata: { openPorts: h.openPorts, latencyMs: h.responseTimeMs },
        })
        .onConflictDoNothing()
        .returning();

      if (inserted) {
        deviceIdMap.set(`dev-${h.mac.replace(/:/g, "")}`, inserted.id);
      }
    }

    // 2. Sauvegarder les liaisons L2 découvertes
    for (const link of allDiscoveredLinks) {
      const srcDbId = deviceIdMap.get(link.sourceDeviceId);
      const tgtDbId = deviceIdMap.get(link.targetDeviceId);

      if (srcDbId && tgtDbId) {
        await db.insert(discoveredConnections).values({
          jobId,
          sourceDeviceId: srcDbId,
          sourcePortName: link.sourcePortName,
          targetDeviceId: tgtDbId,
          targetPortName: link.targetPortName,
          connectionType: link.connectionType,
          vlanId: link.vlanId,
          confidenceScore: link.confidenceScore,
          driftStatus: "SYNCED",
          driftDetails: link.details,
        });
      }
    }

    // 3. Finaliser le job
    const durationMs = Date.now() - startTime;
    await db
      .update(discoveryJobs)
      .set({
        status: "COMPLETED",
        completedAt: new Date(),
        devicesDiscoveredCount: updatedHosts.length + discoveredSwitches.length,
        connectionsDiscoveredCount: allDiscoveredLinks.length,
        diffsCount: diffs.length,
      })
      .where(eq(discoveryJobs.id, jobId));

    return {
      jobId,
      success: true,
      devicesCount: updatedHosts.length + discoveredSwitches.length,
      connectionsCount: allDiscoveredLinks.length,
      diffsCount: diffs.length,
      diffs,
      durationMs,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Erreur inattendue du pipeline";
    await logPass(jobId, 0, `Échec critique du pipeline : ${errorMsg}`, "ERROR");

    await db
      .update(discoveryJobs)
      .set({
        status: "FAILED",
        error: errorMsg,
        completedAt: new Date(),
      })
      .where(eq(discoveryJobs.id, jobId));

    return {
      jobId,
      success: false,
      devicesCount: 0,
      connectionsCount: 0,
      diffsCount: 0,
      diffs: [],
      durationMs: Date.now() - startTime,
    };
  }
}
