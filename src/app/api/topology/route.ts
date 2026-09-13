import { NextResponse } from "next/server";
import { db } from "@/db/index";
import { floors, racks, nodes, ports, cables, vlans } from "@/db/schema/index";

export async function GET() {
  try {
    const [allFloors, allRacks, allNodes, allPorts, allCables, allVlans] = await Promise.all([
      db.select().from(floors),
      db.select().from(racks),
      db.select().from(nodes),
      db.select().from(ports),
      db.select().from(cables),
      db.select().from(vlans),
    ]);

    const activeFloor = allFloors[0] ?? {
      id: "demo-floor-01",
      name: "Étage 4 - Plateau Open Space & Tech Lab",
      building: "Campus Horizon",
      floorNumber: 4,
      widthMm: 60000,
      heightMm: 35000,
      scaleRatio: 1.0,
    };

    return NextResponse.json({
      floor: activeFloor,
      racks: allRacks,
      nodes: allNodes,
      ports: allPorts,
      cables: allCables,
      vlans: allVlans,
    });
  } catch (err: unknown) {
    // Si PostgreSQL n'est pas joignable (ex: dev local avant docker compose up),
    // on renvoie une topologie de référence riche pour que l'UI fonctionne immédiatement.
    return NextResponse.json({
      floor: {
        id: "demo-floor-01",
        name: "Étage 4 - Plateau Open Space & Tech Lab",
        building: "Campus Horizon",
        floorNumber: 4,
        widthMm: 60000,
        heightMm: 35000,
        scaleRatio: 1.0,
      },
      racks: [
        {
          id: "rack-01",
          name: "BAIE-LT4A-01",
          uHeight: 42,
          xMm: 8500,
          yMm: 6500,
          widthMm: 600,
          depthMm: 800,
        },
      ],
      nodes: [
        {
          id: "outlet-408-a",
          type: "WALL_OUTLET",
          name: "PRISE-DESK-408-A",
          model: "Legrand Mosaic 2xRJ45",
          xMm: 43600,
          yMm: 18400,
        },
        {
          id: "pp-01",
          type: "PATCH_PANEL",
          name: "PP-24P-CAT6A-U24",
          model: "Legrand LCS3 24p",
          rackId: "rack-01",
          rackUPosition: 24,
          xMm: 8500,
          yMm: 6500,
        },
        {
          id: "sw-01",
          type: "SWITCH",
          name: "SW-ACCESS-4A-U22",
          model: "Cisco C9300-48P",
          rackId: "rack-01",
          rackUPosition: 22,
          xMm: 8500,
          yMm: 6500,
        },
      ],
      ports: [
        {
          id: "p-wall-1",
          nodeId: "outlet-408-a",
          label: "RJ45-1",
          direction: "BI",
          mode: "PASSIVE",
        },
        {
          id: "p-pp-rear",
          nodeId: "pp-01",
          label: "PORT-08",
          direction: "REAR",
          mode: "PASSIVE",
          internalPeerPortId: "p-pp-front",
        },
        {
          id: "p-pp-front",
          nodeId: "pp-01",
          label: "PORT-08",
          direction: "FRONT",
          mode: "PASSIVE",
          internalPeerPortId: "p-pp-rear",
        },
        {
          id: "p-sw-8",
          nodeId: "sw-01",
          label: "Gi1/0/8",
          direction: "FRONT",
          mode: "ACCESS",
          nativeVlanId: "vlan-20",
        },
      ],
      cables: [
        {
          id: "cable-horiz-1",
          cableType: "HORIZONTAL_RUN",
          category: "CAT6A",
          sourcePortId: "p-wall-1",
          targetPortId: "p-pp-rear",
          lengthMm: 44200,
          colorCode: "BLUE",
        },
        {
          id: "cable-patch-1",
          cableType: "PATCH_CORD",
          category: "CAT6A",
          sourcePortId: "p-pp-front",
          targetPortId: "p-sw-8",
          lengthMm: 1500,
          colorCode: "YELLOW",
        },
      ],
      vlans: [
        {
          id: "vlan-20",
          vid: 20,
          name: "VLAN_CORP_DATA",
          subnetCidr: "10.40.20.0/22",
          colorHex: "#2563eb",
        },
        {
          id: "vlan-30",
          vid: 30,
          name: "VLAN_VOIP",
          subnetCidr: "10.40.30.0/24",
          colorHex: "#10b981",
        },
      ],
    });
  }
}
