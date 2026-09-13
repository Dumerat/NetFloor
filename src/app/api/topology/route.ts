import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/index";
import { floors, racks, nodes, vlans } from "@/db/schema/index";
import { eq } from "drizzle-orm";
import crypto from "crypto";

export function toValidUuid(id: string): string {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return id.toLowerCase();
  }
  const hash = crypto.createHash("md5").update(id).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

export async function GET() {
  try {
    const allFloors = await db.select().from(floors);

    if (allFloors.length === 0) {
      return NextResponse.json({
        success: true,
        isEmpty: true,
        floor: {
          id: "default-floor-01",
          name: "Plateau Principal - RDC",
          building: "Bâtiment Principal",
          floorNumber: 1,
          widthMm: 60000,
          heightMm: 35000,
          scaleRatio: 1.0,
        },
        racks: [],
        nodes: [],
        cables: [],
        zones: [],
        sites: [],
        customPivots: {},
      });
    }

    const activeFloor = allFloors[0]!;
    const floorId = activeFloor.id;

    const [allRacks, allNodes, allVlans] = await Promise.all([
      db.select().from(racks).where(eq(racks.floorId, floorId)),
      db.select().from(nodes).where(eq(nodes.floorId, floorId)),
      db.select().from(vlans),
    ]);

    const floorMeta = (activeFloor.metadata as Record<string, unknown>) || {};
    const zones = (floorMeta.zones as unknown[]) || [];
    const sites = (floorMeta.sites as unknown[]) || [];
    const customPivots = (floorMeta.customPivots as Record<string, unknown>) || {};

    const mappedRacks = allRacks.map((r) => {
      const meta = (r.metadata as Record<string, unknown>) || {};
      return {
        id: (meta.originalId as string) || r.id,
        name: r.name,
        xMm: r.xMm,
        yMm: r.yMm,
        widthMm: r.widthMm,
        depthMm: r.depthMm,
        uHeight: r.uHeight,
        rotationDeg: r.rotationDeg,
        devices: (meta.devices as unknown[]) || [],
        siteId: (meta.siteId as string) || undefined,
      };
    });

    const mappedNodes = allNodes.map((n) => {
      const meta = (n.metadata as Record<string, unknown>) || {};
      return {
        id: (meta.originalId as string) || n.id,
        type: n.type,
        name: n.name,
        model: n.model || undefined,
        xMm: n.xMm,
        yMm: n.yMm,
        rotationDeg: n.rotationDeg,
        subType: meta.subType,
        outletRole: meta.outletRole,
        assignedPerson: meta.assignedPerson,
        assignedUserId: meta.assignedUserId,
        department: meta.department,
        description: meta.description,
        chairPosition: meta.chairPosition,
        seats: meta.seats,
        attachedSeatIndex: meta.attachedSeatIndex,
        attachedToDeskId: meta.attachedToDeskId,
        ipAddress: meta.ipAddress,
        macAddress: meta.macAddress,
        pingStatus: meta.pingStatus,
        pingLatencyMs: meta.pingLatencyMs,
        stackedPorts: meta.stackedPorts,
        vlanId: meta.vlanId,
        poeMode: meta.poeMode,
        customEmote: meta.customEmote,
        portCount: meta.portCount,
        labelPosition: meta.labelPosition,
        isPatched: meta.isPatched,
        connectedRackId: meta.connectedRackId,
        connectedSwitchId: meta.connectedSwitchId,
        connectedSwitchPort: meta.connectedSwitchPort,
        devices: meta.devices,
        uHeight: meta.uHeight,
        siteId: meta.siteId,
      };
    });

    return NextResponse.json({
      success: true,
      isEmpty: mappedRacks.length === 0 && mappedNodes.length === 0,
      floor: {
        id: (floorMeta.originalId as string) || activeFloor.id,
        name: activeFloor.name,
        building: activeFloor.building,
        floorNumber: activeFloor.floorNumber,
        widthMm: activeFloor.widthMm,
        heightMm: activeFloor.heightMm,
        scaleRatio: activeFloor.scaleRatio,
      },
      racks: mappedRacks,
      nodes: mappedNodes,
      cables: [],
      zones,
      sites,
      customPivots,
      vlans: allVlans,
    });
  } catch (err: unknown) {
    console.error("Erreur lors de la lecture de la topologie en BDD :", err);
    return NextResponse.json(
      {
        success: false,
        isOffline: true,
        error: "Impossible de joindre la base de données PostgreSQL.",
      },
      { status: 503 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const {
      floor,
      racks: incomingRacks,
      nodes: incomingNodes,
      zones,
      sites,
      customPivots,
    } = payload;

    const floorId = toValidUuid(floor?.id || "default-floor-01");
    const floorName = floor?.name || "Plateau Principal - RDC";
    const building = floor?.building || "Campus Principal";
    const floorNumber = floor?.floorNumber ?? 1;
    const widthMm = Math.round(floor?.widthMm || 60000);
    const heightMm = Math.round(floor?.heightMm || 35000);
    const scaleRatio = floor?.scaleRatio ?? 1.0;

    await db.transaction(async (tx) => {
      // 1. Upsert de l'étage
      await tx
        .insert(floors)
        .values({
          id: floorId,
          name: floorName,
          building,
          floorNumber,
          widthMm,
          heightMm,
          scaleRatio,
          metadata: {
            originalId: floor?.id || "default-floor-01",
            zones: zones || [],
            sites: sites || [],
            customPivots: customPivots || {},
          },
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: floors.id,
          set: {
            name: floorName,
            building,
            floorNumber,
            widthMm,
            heightMm,
            scaleRatio,
            metadata: {
              originalId: floor?.id || "default-floor-01",
              zones: zones || [],
              sites: sites || [],
              customPivots: customPivots || {},
            },
            updatedAt: new Date(),
          },
        });

      // 2. Synchronisation atomique des baies
      await tx.delete(racks).where(eq(racks.floorId, floorId));
      if (Array.isArray(incomingRacks) && incomingRacks.length > 0) {
        const rackRows = incomingRacks.map((r: Record<string, unknown>) => ({
          id: toValidUuid(String(r.id || crypto.randomUUID())),
          floorId,
          name: String(r.name || "BAIE"),
          uHeight: Number(r.uHeight) || 42,
          xMm: Math.round(Number(r.xMm) || 0),
          yMm: Math.round(Number(r.yMm) || 0),
          widthMm: Math.round(Number(r.widthMm) || 800),
          depthMm: Math.round(Number(r.depthMm) || 800),
          rotationDeg: Number(r.rotationDeg) || 0,
          metadata: {
            originalId: r.id,
            devices: r.devices || [],
            siteId: r.siteId,
          },
        }));

        for (let i = 0; i < rackRows.length; i += 50) {
          await tx.insert(racks).values(rackRows.slice(i, i + 50));
        }
      }

      // 3. Synchronisation atomique des nœuds
      await tx.delete(nodes).where(eq(nodes.floorId, floorId));
      if (Array.isArray(incomingNodes) && incomingNodes.length > 0) {
        const nodeRows = incomingNodes.map((n: Record<string, unknown>) => {
          const rawType = String(n.type || "WALL_OUTLET");
          const validType =
            rawType === "DESK" ||
            rawType === "WALL_OUTLET" ||
            rawType === "PATCH_PANEL" ||
            rawType === "SWITCH" ||
            rawType === "ACCESS_POINT" ||
            rawType === "SERVER"
              ? (rawType as
                  "DESK" | "WALL_OUTLET" | "PATCH_PANEL" | "SWITCH" | "ACCESS_POINT" | "SERVER")
              : "WALL_OUTLET";

          return {
            id: toValidUuid(String(n.id || crypto.randomUUID())),
            floorId,
            rackId: n.rackId ? toValidUuid(String(n.rackId)) : null,
            rackUPosition: n.rackUPosition ? Number(n.rackUPosition) : null,
            type: validType,
            name: String(n.name || "Équipement"),
            model: n.model ? String(n.model) : null,
            xMm: Math.round(Number(n.xMm) || 0),
            yMm: Math.round(Number(n.yMm) || 0),
            rotationDeg: Number(n.rotationDeg) || 0,
            metadata: {
              originalId: n.id,
              subType: n.subType,
              outletRole: n.outletRole,
              assignedPerson: n.assignedPerson,
              assignedUserId: n.assignedUserId,
              department: n.department,
              description: n.description,
              chairPosition: n.chairPosition,
              seats: n.seats,
              attachedSeatIndex: n.attachedSeatIndex,
              attachedToDeskId: n.attachedToDeskId,
              ipAddress: n.ipAddress,
              macAddress: n.macAddress,
              pingStatus: n.pingStatus,
              pingLatencyMs: n.pingLatencyMs,
              stackedPorts: n.stackedPorts,
              vlanId: n.vlanId,
              poeMode: n.poeMode,
              customEmote: n.customEmote,
              portCount: n.portCount,
              labelPosition: n.labelPosition,
              isPatched: n.isPatched,
              connectedRackId: n.connectedRackId,
              connectedSwitchId: n.connectedSwitchId,
              connectedSwitchPort: n.connectedSwitchPort,
              devices: n.devices,
              uHeight: n.uHeight,
              siteId: n.siteId,
            },
          };
        });

        for (let i = 0; i < nodeRows.length; i += 50) {
          await tx.insert(nodes).values(nodeRows.slice(i, i + 50));
        }
      }
    });

    return NextResponse.json({
      success: true,
      savedAt: new Date().toISOString(),
      counts: {
        racks: incomingRacks?.length || 0,
        nodes: incomingNodes?.length || 0,
        zones: zones?.length || 0,
      },
    });
  } catch (err: unknown) {
    console.error("Erreur lors de la sauvegarde en BDD :", err);
    const message = err instanceof Error ? err.message : "Erreur inconnue de persistance";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const allFloors = await db.select().from(floors);
    if (allFloors.length > 0) {
      const floorId = allFloors[0]!.id;
      await db.transaction(async (tx) => {
        await tx.delete(nodes).where(eq(nodes.floorId, floorId));
        await tx.delete(racks).where(eq(racks.floorId, floorId));
        await tx
          .update(floors)
          .set({
            metadata: {
              zones: [],
              sites: [],
              customPivots: {},
            },
            updatedAt: new Date(),
          })
          .where(eq(floors.id, floorId));
      });
    }

    return NextResponse.json({
      success: true,
      message: "Le plateau a été entièrement vidé en base de données.",
    });
  } catch (err: unknown) {
    console.error("Erreur lors de la réinitialisation :", err);
    const message = err instanceof Error ? err.message : "Erreur de réinitialisation";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
