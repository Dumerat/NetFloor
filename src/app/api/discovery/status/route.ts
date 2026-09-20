import { NextResponse } from "next/server";
import { getDb } from "@/db";
import {
  discoveryJobs,
  discoveredDevices,
  discoveredConnections,
  discoveryLogs,
  nodes,
} from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { detectTopologyDrift } from "@/engine/discovery/drift-detector";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get("jobId");

    const db = await getDb();

    // 0. Récupérer l'ensemble des équipements découverts pour le catalogue d'infrastructure
    if (searchParams.get("allDevices") === "true") {
      const allDevs = await db
        .select()
        .from(discoveredDevices)
        .orderBy(desc(discoveredDevices.lastSeenAt))
        .limit(100);

      return NextResponse.json({
        success: true,
        devices: allDevs,
      });
    }

    // 1. Si aucun jobId spécifié, renvoyer les 10 derniers scans
    if (!jobId) {
      const recentJobs = await db
        .select()
        .from(discoveryJobs)
        .orderBy(desc(discoveryJobs.startedAt))
        .limit(10);

      return NextResponse.json({
        success: true,
        jobs: recentJobs,
      });
    }

    // 2. Récupérer le job spécifique (ou le plus récent si jobId="latest")
    let targetJobId = jobId;
    if (jobId === "latest") {
      const [latestJob] = await db
        .select()
        .from(discoveryJobs)
        .orderBy(desc(discoveryJobs.startedAt))
        .limit(1);
      if (!latestJob) {
        return NextResponse.json({
          success: true,
          job: null,
          devices: [],
          connections: [],
          diffs: [],
        });
      }
      targetJobId = latestJob.id;
    }

    const [job] = await db.select().from(discoveryJobs).where(eq(discoveryJobs.id, targetJobId));

    if (!job) {
      return NextResponse.json(
        { success: false, error: "Job de découverte introuvable" },
        { status: 404 }
      );
    }

    // 3. Récupérer les logs associés au job
    const logs = await db
      .select()
      .from(discoveryLogs)
      .where(eq(discoveryLogs.jobId, targetJobId))
      .orderBy(discoveryLogs.createdAt);

    // 4. Récupérer les équipements découverts
    const devices = await db
      .select()
      .from(discoveredDevices)
      .where(eq(discoveredDevices.jobId, targetJobId));

    // 5. Récupérer les connexions L2 découvertes
    const connections = await db
      .select()
      .from(discoveredConnections)
      .where(eq(discoveredConnections.jobId, targetJobId));

    // 6. Détection de dérive (diffs) avec les nœuds actuels
    const dbNodes = await db.select().from(nodes);
    const existingNodeSummaries = dbNodes.map((n) => {
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

    const diffs = detectTopologyDrift(
      devices.map((d) => ({
        ip: d.ipAddress,
        mac: d.macAddress,
        hostname: d.hostname || undefined,
        isAlive: true,
        responseTimeMs: 2,
        openPorts: [],
        source: "ARP_LOCAL" as const,
        deviceType: d.deviceType as any,
      })),
      connections.map((c) => ({
        id: c.id,
        sourceDeviceId: c.sourceDeviceId,
        sourceDeviceName: "Switch",
        sourcePortName: c.sourcePortName,
        targetDeviceId: c.targetDeviceId,
        targetDeviceName: "Device",
        targetPortName: c.targetPortName || undefined,
        connectionType: c.connectionType,
        confidenceScore: c.confidenceScore,
        vlanId: c.vlanId || undefined,
      })),
      existingNodeSummaries,
      []
    );

    const passNames: Record<number, string> = {
      1: "Passe 1 : Balayage CIDR & Découverte L3 (Hôtes actifs)",
      2: "Passe 2 : Topologie Dorsale LLDP / CDP / LAG",
      3: "Passe 3 : Corrélation FDB (Switch Port Mapper)",
      4: "Passe 4 : Détection de Dérive & Réconciliation",
    };

    return NextResponse.json({
      success: true,
      job: {
        id: job.id,
        subnetCidr: job.subnetCidr,
        status: job.status,
        currentPass: job.currentPass,
        totalPasses: job.totalPasses,
        passName: passNames[job.currentPass] || "Finalisation",
        devicesDiscoveredCount: job.devicesDiscoveredCount,
        connectionsDiscoveredCount: job.connectionsDiscoveredCount,
        diffsCount: diffs.length || job.diffsCount,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        error: job.error,
      },
      summary: {
        devicesCount: devices.length,
        switchesCount: devices.filter((d) => d.isManagedSwitch).length,
        connectionsCount: connections.length,
        diffsCount: diffs.length,
        logsCount: logs.length,
      },
      devices,
      connections,
      diffs,
      logs: logs.map((l) => ({
        level: l.level,
        pass: l.pass,
        message: l.message,
        timestamp: l.createdAt,
      })),
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Erreur interne du serveur",
      },
      { status: 500 }
    );
  }
}
