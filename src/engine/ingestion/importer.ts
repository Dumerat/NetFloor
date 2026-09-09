import { eq } from "drizzle-orm";
import { Database } from "../../db/index";
import {
  floors,
  racks,
  nodes,
  ports,
  cables,
  vlans,
  Floor,
  Rack,
  Vlan,
  Node,
} from "../../db/schema/index";
import { CablingRow } from "./schemas";
import { ImportResult } from "./types";

/**
 * Importateur transactionnel de carnet de câblage
 * Insère de façon atomique la topologie complète (étages, baies, équipements, ports, câbles, VLANs).
 */
export async function importCablingLedger(
  database: Database,
  validRecords: readonly CablingRow[]
): Promise<ImportResult> {
  if (validRecords.length === 0) {
    return {
      success: true,
      insertedCounts: { floors: 0, racks: 0, nodes: 0, ports: 0, cables: 0, vlans: 0 },
    };
  }

  return await database.transaction(async (tx) => {
    // 1. Résolution / Création des Étages
    const floorMap = new Map<string, Floor>();
    for (const record of validRecords) {
      if (!floorMap.has(record.floorName)) {
        const [existing] = await tx
          .select()
          .from(floors)
          .where(eq(floors.name, record.floorName));

        if (existing) {
          floorMap.set(record.floorName, existing);
        } else {
          const [created] = await tx
            .insert(floors)
            .values({
              name: record.floorName,
              building: "Bâtiment Principal",
              floorNumber: 1,
              widthMm: 80000,
              heightMm: 40000,
              scaleRatio: 1.0,
            })
            .returning();
          if (created) floorMap.set(record.floorName, created);
        }
      }
    }

    // 2. Résolution / Création des Baies
    const rackMap = new Map<string, Rack>();
    for (const record of validRecords) {
      const floor = floorMap.get(record.floorName);
      if (!floor) continue;

      const rackKey = `${floor.id}::${record.rackName}`;
      if (!rackMap.has(rackKey)) {
        const [existing] = await tx
          .select()
          .from(racks)
          .where(eq(racks.name, record.rackName));

        if (existing) {
          rackMap.set(rackKey, existing);
        } else {
          const [created] = await tx
            .insert(racks)
            .values({
              floorId: floor.id,
              name: record.rackName,
              uHeight: 42,
              xMm: 10000,
              yMm: 5000,
            })
            .returning();
          if (created) rackMap.set(rackKey, created);
        }
      }
    }

    // 3. Résolution / Création des VLANs
    const vlanMap = new Map<number, Vlan>();
    for (const record of validRecords) {
      if (!vlanMap.has(record.vlanVid)) {
        const [existing] = await tx
          .select()
          .from(vlans)
          .where(eq(vlans.vid, record.vlanVid));

        if (existing) {
          vlanMap.set(record.vlanVid, existing);
        } else {
          const [created] = await tx
            .insert(vlans)
            .values({
              vid: record.vlanVid,
              name: record.resolvedVlanName,
              subnetCidr: `10.${record.vlanVid}.0.0/24`,
              gatewayIp: `10.${record.vlanVid}.0.1`,
            })
            .returning();
          if (created) vlanMap.set(record.vlanVid, created);
        }
      }
    }

    // 4. Résolution / Création des Nœuds (Prises, Patch Panels, Switches)
    const nodeMap = new Map<string, Node>();
    for (const record of validRecords) {
      const floor = floorMap.get(record.floorName);
      const rackKey = floor ? `${floor.id}::${record.rackName}` : "";
      const rack = rackMap.get(rackKey);

      if (!floor) continue;

      // A. Prise Murale
      const outletKey = `OUTLET::${floor.id}::${record.outletName}`;
      if (!nodeMap.has(outletKey)) {
        const [outlet] = await tx
          .insert(nodes)
          .values({
            floorId: floor.id,
            type: "WALL_OUTLET",
            name: record.outletName,
            metadata: { deskNumber: record.deskNumber },
          })
          .returning();
        if (outlet) nodeMap.set(outletKey, outlet);
      }

      // B. Patch Panel
      const ppKey = `PP::${floor.id}::${record.patchPanelName}`;
      if (!nodeMap.has(ppKey)) {
        const [pp] = await tx
          .insert(nodes)
          .values({
            floorId: floor.id,
            rackId: rack?.id,
            type: "PATCH_PANEL",
            name: record.patchPanelName,
            model: "Patch Panel 24xRJ45 Cat6A",
          })
          .returning();
        if (pp) nodeMap.set(ppKey, pp);
      }

      // C. Switch
      const swKey = `SW::${floor.id}::${record.switchName}`;
      if (!nodeMap.has(swKey)) {
        const [sw] = await tx
          .insert(nodes)
          .values({
            floorId: floor.id,
            rackId: rack?.id,
            type: "SWITCH",
            name: record.switchName,
            model: "Enterprise Managed L2/L3 Switch",
          })
          .returning();
        if (sw) nodeMap.set(swKey, sw);
      }
    }

    // 5. Création des Ports et Câbles
    let portCount = 0;
    let cableCount = 0;

    for (const record of validRecords) {
      const floor = floorMap.get(record.floorName);
      if (!floor) continue;

      const outletNode = nodeMap.get(`OUTLET::${floor.id}::${record.outletName}`);
      const patchNode = nodeMap.get(`PP::${floor.id}::${record.patchPanelName}`);
      const switchNode = nodeMap.get(`SW::${floor.id}::${record.switchName}`);
      const vlan = vlanMap.get(record.vlanVid);

      if (!outletNode || !patchNode || !switchNode) continue;

      // Port Prise Murale
      const [wallPort] = await tx
        .insert(ports)
        .values({
          nodeId: outletNode.id,
          label: record.outletPort,
          connectorType: "RJ45",
          direction: "BI",
          mode: "PASSIVE",
        })
        .returning();

      // Port Avant Patch Panel
      const [ppPortFront] = await tx
        .insert(ports)
        .values({
          nodeId: patchNode.id,
          label: record.patchPanelPort,
          connectorType: "RJ45",
          direction: "FRONT",
          mode: "PASSIVE",
        })
        .returning();

      // Port Arrière Patch Panel (avec liaison interne vers Port Avant)
      const [ppPortRear] = await tx
        .insert(ports)
        .values({
          nodeId: patchNode.id,
          label: record.patchPanelPort,
          connectorType: "PUNCHDOWN_110",
          direction: "REAR",
          mode: "PASSIVE",
          internalPeerPortId: ppPortFront?.id,
        })
        .returning();

      if (ppPortFront && ppPortRear) {
        await tx
          .update(ports)
          .set({ internalPeerPortId: ppPortRear.id })
          .where(eq(ports.id, ppPortFront.id));
      }

      // Port Switch
      const [switchPort] = await tx
        .insert(ports)
        .values({
          nodeId: switchNode.id,
          label: record.switchPort,
          connectorType: "RJ45",
          direction: "FRONT",
          mode: "ACCESS",
          nativeVlanId: vlan?.id,
          speedMbps: 1000,
        })
        .returning();

      portCount += 4; // 1 wall + 2 patch + 1 switch

      // Câble 1 : Horizontal Run (Prise murale -> Port Arrière Patch Panel)
      if (wallPort && ppPortRear) {
        await tx.insert(cables).values({
          cableType: "HORIZONTAL_RUN",
          category: record.cableCategory,
          sourcePortId: wallPort.id,
          targetPortId: ppPortRear.id,
          lengthMm: record.lengthMm,
          colorCode: "BLUE",
          status: "ACTIVE",
        });
        cableCount++;
      }

      // Câble 2 : Cordon de Brassage (Port Avant Patch Panel -> Port Switch)
      if (ppPortFront && switchPort) {
        await tx.insert(cables).values({
          cableType: "PATCH_CORD",
          category: record.cableCategory,
          sourcePortId: ppPortFront.id,
          targetPortId: switchPort.id,
          lengthMm: 1500, // 1.5m standard patch cord
          colorCode: "YELLOW",
          status: "ACTIVE",
        });
        cableCount++;
      }
    }

    return {
      success: true,
      insertedCounts: {
        floors: floorMap.size,
        racks: rackMap.size,
        nodes: nodeMap.size,
        ports: portCount,
        cables: cableCount,
        vlans: vlanMap.size,
      },
    };
  });
}
