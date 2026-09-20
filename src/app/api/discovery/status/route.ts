import { NextResponse } from "next/server";
import { getDb } from "@/db";
import {
  discoveryJobs,
  discoveredDevices,
  discoveredConnections,
  discoveryLogs,
} from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get("jobId");

    const db = await getDb();

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

    // 2. Récupérer le job spécifique
    const [job] = await db.select().from(discoveryJobs).where(eq(discoveryJobs.id, jobId));

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
      .where(eq(discoveryLogs.jobId, jobId))
      .orderBy(discoveryLogs.createdAt);

    // 4. Récupérer les équipements découverts
    const devices = await db
      .select()
      .from(discoveredDevices)
      .where(eq(discoveredDevices.jobId, jobId));

    // 5. Récupérer les connexions L2 découvertes
    const connections = await db
      .select()
      .from(discoveredConnections)
      .where(eq(discoveredConnections.jobId, jobId));

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
        diffsCount: job.diffsCount,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        error: job.error,
      },
      summary: {
        devicesCount: devices.length,
        switchesCount: devices.filter((d) => d.isManagedSwitch).length,
        connectionsCount: connections.length,
        logsCount: logs.length,
      },
      devices,
      connections,
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
