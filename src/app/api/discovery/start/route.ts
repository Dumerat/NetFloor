import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { discoveryJobs } from "@/db/schema";
import { runDiscoveryPipeline } from "@/engine/discovery/discovery-pipeline";

const startDiscoverySchema = z.object({
  subnetCidr: z
    .string()
    .min(1, "Le CIDR ou l'IP cible est requis")
    .regex(
      /^([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}(\/([0-9]|[1-2][0-9]|3[0-2]))?|localhost)$/,
      "Format CIDR IPv4 invalide (ex: 192.168.1.0/24 ou 10.42.0.1)"
    ),
  snmpVersion: z.enum(["v1", "v2c", "v3"]).default("v2c"),
  snmpCommunity: z.string().default("public"),
  snmpPort: z.number().int().min(1).max(65535).default(161),
  v3User: z.string().optional(),
  v3AuthPass: z.string().optional(),
  v3PrivPass: z.string().optional(),
  pingTimeoutMs: z.number().int().min(100).max(5000).default(400),
  concurrency: z.number().int().min(1).max(128).default(32),
  includeCloud: z.boolean().default(false),
});

export async function POST(req: Request) {
  try {
    const rawBody = await req.json().catch(() => ({}));
    const validated = startDiscoverySchema.safeParse(rawBody);

    if (!validated.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Paramètres de scan invalides",
          details: validated.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const {
      subnetCidr,
      snmpVersion,
      snmpCommunity,
      snmpPort,
      v3User,
      v3AuthPass,
      v3PrivPass,
      pingTimeoutMs,
      concurrency,
      includeCloud,
    } = validated.data;

    const db = await getDb();

    // 1. Enregistrer le job de découverte en base
    const [job] = await db
      .insert(discoveryJobs)
      .values({
        subnetCidr,
        snmpVersion,
        status: "PENDING",
        currentPass: 1,
        totalPasses: 4,
        options: {
          snmpCommunity,
          v3User,
          v3AuthPass,
          v3PrivPass,
          pingTimeoutMs,
          includeCloud,
        },
      })
      .returning();

    if (!job) {
      return NextResponse.json(
        { success: false, error: "Impossible de créer le job de découverte" },
        { status: 500 }
      );
    }

    // 2. Déclencher le pipeline multi-passes en tâche de fond (asynchrone non-bloquant)
    runDiscoveryPipeline(job.id, {
      subnetCidr,
      snmpVersion,
      snmpCommunity,
      snmpPort,
      v3User,
      v3AuthPass,
      v3PrivPass,
      pingTimeoutMs,
      concurrency,
      includeCloud,
    }).catch((err) => {
      console.error(`[Discovery Pipeline] Échec sur le job ${job.id} :`, err);
    });

    // 3. Réponse immédiate avec le Job ID pour le suivi en temps réel
    return NextResponse.json({
      success: true,
      jobId: job.id,
      status: "RUNNING",
      subnetCidr,
      startedAt: job.startedAt,
      message: `Job de découverte réseau #${job.id.slice(0, 8)} initialisé avec succès`,
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
