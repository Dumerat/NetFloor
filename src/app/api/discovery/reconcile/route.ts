import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { discoveredDevices, discoveredConnections, nodes } from "@/db/schema";
import { eq } from "drizzle-orm";

const reconcileActionSchema = z.object({
  jobId: z.string().uuid("ID de job invalide"),
  floorId: z.string().uuid("ID d'étage cible requis"),
  acceptAll: z.boolean().default(false),
  selectedDeviceIds: z.array(z.string().uuid()).optional(),
  targetRacks: z.record(z.string(), z.string().uuid()).optional(), // deviceId -> rackId
});

export async function POST(req: Request) {
  try {
    const rawBody = await req.json().catch(() => ({}));
    const validated = reconcileActionSchema.safeParse(rawBody);

    if (!validated.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Paramètres de réconciliation invalides",
          details: validated.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { jobId, floorId, acceptAll, selectedDeviceIds } = validated.data;
    const db = await getDb();

    // 1. Récupérer tous les équipements découverts pour ce job
    const devices = await db
      .select()
      .from(discoveredDevices)
      .where(eq(discoveredDevices.jobId, jobId));

    if (devices.length === 0) {
      return NextResponse.json(
        { success: false, error: "Aucun équipement à réconcilier pour ce job" },
        { status: 404 }
      );
    }

    // Récupérer les liaisons découvertes
    const connections = await db
      .select()
      .from(discoveredConnections)
      .where(eq(discoveredConnections.jobId, jobId));

    // Récupérer les nœuds existants sur cet étage
    const existingFloorNodes = await db.select().from(nodes).where(eq(nodes.floorId, floorId));

    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    // Déterminer la liste des équipements ciblés pour l'acceptation
    const targetDevices = acceptAll
      ? devices
      : devices.filter((d) => selectedDeviceIds?.includes(d.id));

    // Coordonnées de placement décalées pour les nouveaux équipements (en grille régulière)
    let offsetX = 1000;
    let offsetY = 1000;

    for (const dev of targetDevices) {
      // Trouver la liaison correspondante pour ce device
      const conn = connections.find((c) => c.targetDeviceId === dev.id);

      // Vérifier si un nœud sur l'étage a déjà cette adresse MAC ou IP
      const matchedNode = existingFloorNodes.find((n) => {
        const meta = (n.metadata || {}) as Record<string, unknown>;
        return (
          meta.macAddress === dev.macAddress || (meta.ipAddress && meta.ipAddress === dev.ipAddress)
        );
      });

      if (matchedNode) {
        // Mise à jour de l'équipement existant (IP, MAC, switch raccordé)
        const updatedMeta = {
          ...((matchedNode.metadata || {}) as Record<string, unknown>),
          ipAddress: dev.ipAddress,
          macAddress: dev.macAddress,
          manufacturer: dev.manufacturer,
          model: dev.model,
          connectedSwitchId: conn?.sourceDeviceId,
          connectedSwitchPort: conn?.sourcePortName,
          lastDiscoveryAt: new Date().toISOString(),
        };

        await db
          .update(nodes)
          .set({
            metadata: updatedMeta,
            updatedAt: new Date(),
          })
          .where(eq(nodes.id, matchedNode.id));

        await db
          .update(discoveredDevices)
          .set({ matchedNodeId: matchedNode.id })
          .where(eq(discoveredDevices.id, dev.id));

        updatedCount++;
      } else {
        // Création d'un nouvel équipement sur le plan
        let nodeType: "SWITCH" | "ACCESS_POINT" | "SERVER" | "WALL_OUTLET" = "WALL_OUTLET";
        if (dev.deviceType === "SWITCH") nodeType = "SWITCH";
        else if (dev.deviceType === "ACCESS_POINT") nodeType = "ACCESS_POINT";
        else if (dev.deviceType === "SERVER") nodeType = "SERVER";

        const nodeName =
          dev.hostname || `${dev.manufacturer || "DEVICE"}-${dev.ipAddress.replace(/\./g, "-")}`;

        const [createdNode] = await db
          .insert(nodes)
          .values({
            floorId,
            type: nodeType,
            name: nodeName,
            model: dev.model || dev.sysDescr?.slice(0, 50),
            xMm: offsetX,
            yMm: offsetY,
            rotationDeg: 0,
            metadata: {
              ipAddress: dev.ipAddress,
              macAddress: dev.macAddress,
              manufacturer: dev.manufacturer,
              deviceType: dev.deviceType,
              connectedSwitchPort: conn?.sourcePortName,
              vlanId: dev.vlanId,
              autoImportedFromDiscovery: true,
              lastDiscoveryAt: new Date().toISOString(),
            },
          })
          .returning();

        if (createdNode) {
          await db
            .update(discoveredDevices)
            .set({ matchedNodeId: createdNode.id })
            .where(eq(discoveredDevices.id, dev.id));
          createdCount++;
        }

        // Avancer sur la grille
        offsetX += 600;
        if (offsetX > 6000) {
          offsetX = 1000;
          offsetY += 600;
        }
      }
    }

    skippedCount = devices.length - (createdCount + updatedCount);

    return NextResponse.json({
      success: true,
      jobId,
      floorId,
      summary: {
        totalDiscovered: devices.length,
        createdCount,
        updatedCount,
        skippedCount,
      },
      message: `Réconciliation effectuée : ${createdCount} équipement(s) créé(s), ${updatedCount} mis à jour.`,
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
