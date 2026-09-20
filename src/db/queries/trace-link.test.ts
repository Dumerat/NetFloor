import { describe, it, expect, beforeAll } from "vitest";
import { getDb, ensureDiscoveryTables } from "../index";
import * as schema from "../schema/index";
import { traceCircuitPath } from "./trace-link";

describe("Circuit Trace Engine (traceCircuitPath)", () => {
  let originPortId: string;

  beforeAll(async () => {
    const db = await getDb();
    await ensureDiscoveryTables();

    // 1. Déploiement d'une topologie minimale pour tester le traçage CTE récursif
    const [floor] = await db
      .insert(schema.floors)
      .values({
        name: "Étage Test Trace",
        building: "Bâtiment A",
        floorNumber: 1,
        widthMm: 20000,
        heightMm: 15000,
        scaleRatio: 1.0,
      })
      .returning();

    const [vlan] = await db
      .insert(schema.vlans)
      .values({
        vid: 100,
        name: "VLAN_CORP_TEST",
        colorHex: "#3b82f6",
        description: "VLAN d'entreprise de test",
      })
      .onConflictDoUpdate({
        target: schema.vlans.vid,
        set: { name: "VLAN_CORP_TEST", colorHex: "#3b82f6" },
      })
      .returning();

    const [rack] = await db
      .insert(schema.racks)
      .values({
        floorId: floor!.id,
        name: "BAIE-TRACE-01",
        xMm: 1000,
        yMm: 1000,
        uHeight: 42,
      })
      .returning();

    // Prise murale (nœud de départ)
    const [wallNode] = await db
      .insert(schema.nodes)
      .values({
        floorId: floor!.id,
        name: "PRISE-TEST-01",
        type: "WALL_OUTLET",
        xMm: 5000,
        yMm: 5000,
      })
      .returning();

    const [wallPort] = await db
      .insert(schema.ports)
      .values({
        nodeId: wallNode!.id,
        label: "RJ45-1",
        direction: "FRONT",
        mode: "PASSIVE",
        connectorType: "RJ45",
      })
      .returning();

    originPortId = wallPort!.id;

    // Panneau de brassage
    const [patchNode] = await db
      .insert(schema.nodes)
      .values({
        floorId: floor!.id,
        rackId: rack!.id,
        name: "PP-TRACE-01",
        type: "PATCH_PANEL",
        xMm: 1000,
        yMm: 1000,
      })
      .returning();

    const [patchFrontPort] = await db
      .insert(schema.ports)
      .values({
        nodeId: patchNode!.id,
        label: "01",
        direction: "FRONT",
        mode: "PASSIVE",
        connectorType: "RJ45",
      })
      .returning();

    const [patchRearPort] = await db
      .insert(schema.ports)
      .values({
        nodeId: patchNode!.id,
        label: "01",
        direction: "REAR",
        mode: "PASSIVE",
        connectorType: "PUNCHDOWN_110",
        internalPeerPortId: patchFrontPort!.id,
      })
      .returning();

    // Commutateur actif
    const [switchNode] = await db
      .insert(schema.nodes)
      .values({
        floorId: floor!.id,
        rackId: rack!.id,
        name: "SW-TRACE-01",
        type: "SWITCH",
        xMm: 1000,
        yMm: 1000,
      })
      .returning();

    const [switchPort] = await db
      .insert(schema.ports)
      .values({
        nodeId: switchNode!.id,
        label: "Gi1/0/1",
        direction: "FRONT",
        mode: "ACCESS",
        connectorType: "RJ45",
        nativeVlanId: vlan!.id,
      })
      .returning();

    // Câble 1 : Prise murale -> Panneau de brassage (Arrière)
    await db.insert(schema.cables).values({
      cableType: "HORIZONTAL_RUN",
      category: "CAT6A",
      sourcePortId: wallPort!.id,
      targetPortId: patchRearPort!.id,
      lengthMm: 15000,
    });

    // Câble 2 : Jarretière Panneau de brassage (Avant) -> Switch
    await db.insert(schema.cables).values({
      cableType: "PATCH_CORD",
      category: "CAT6A",
      sourcePortId: patchFrontPort!.id,
      targetPortId: switchPort!.id,
      lengthMm: 1500,
    });
  }, 20000);

  it("retrace de bout en bout le circuit depuis la prise murale jusqu'au commutateur", async () => {
    const result = await traceCircuitPath(originPortId);

    expect(result).toBeDefined();
    expect(result.startPortId).toBe(originPortId);
    expect(result.isTerminatedAtActiveDevice).toBe(true);
    expect(result.terminalNode?.name).toBe("SW-TRACE-01");
    expect(result.terminalNode?.portLabel).toBe("Gi1/0/1");
    expect(result.resolvedVlan?.vid).toBe(100);
    expect(result.resolvedVlan?.name).toBe("VLAN_CORP_TEST");
    expect(result.hops.length).toBe(4);
    expect(result.totalCableLengthMm).toBe(16500);
    expect(result.totalCableLengthMeters).toBe(16.5);
  }, 15000);

  it("gère un port non connecté sans terminaison active", async () => {
    const db = await getDb();
    const [floor] = await db.select().from(schema.floors).limit(1);
    const [isolatedNode] = await db
      .insert(schema.nodes)
      .values({
        floorId: floor!.id,
        name: "PRISE-ISOLEE",
        type: "WALL_OUTLET",
        xMm: 8000,
        yMm: 8000,
      })
      .returning();

    const [isolatedPort] = await db
      .insert(schema.ports)
      .values({
        nodeId: isolatedNode!.id,
        label: "RJ45-ISOLE",
        direction: "FRONT",
        mode: "PASSIVE",
        connectorType: "RJ45",
      })
      .returning();

    const result = await traceCircuitPath(isolatedPort!.id);

    expect(result.startPortId).toBe(isolatedPort!.id);
    expect(result.hops.length).toBe(1);
    expect(result.isTerminatedAtActiveDevice).toBe(false);
    expect(result.terminalNode?.name).toBe("PRISE-ISOLEE");
    expect(result.resolvedVlan).toBeNull();
    expect(result.totalCableLengthMm).toBe(0);
  }, 15000);
});
