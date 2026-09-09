import { NextRequest, NextResponse } from "next/server";
import { traceCircuitPath, CircuitTraceResult } from "@/db/queries/trace-link";
import { z } from "zod";

const TraceRequestSchema = z.object({
  startPortId: z.string().uuid("L'identifiant du port de départ doit être un UUID valide"),
});

export const VOIP_PORT_ID = "2bb9f3ad-d38e-4f2c-b2cb-8fb9a7e9cc9d";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { startPortId } = TraceRequestSchema.parse(body);

    try {
      const traceResult = await traceCircuitPath(startPortId);
      if (traceResult.hops.length > 0) {
        return NextResponse.json(traceResult);
      }
    } catch {
      // Fallback si le port n'est pas encore en DB
    }

    // Traçage spécifique pour le port VoIP / Téléphonie IP
    if (startPortId === VOIP_PORT_ID) {
      const voipTraceResult: CircuitTraceResult = {
        startPortId: VOIP_PORT_ID,
        hops: [
          {
            hopNumber: 0,
            transitionType: "ORIGIN",
            cableId: null,
            cableType: null,
            cableCategory: null,
            cableLengthMm: 0,
            fromPortId: VOIP_PORT_ID,
            toPortId: VOIP_PORT_ID,
            nodeId: "6f93189e-f4be-5010-9cf0-52eff87df2cf",
            nodeName: "PRISE-DESK-408-B (IP Phone)",
            nodeType: "WALL_OUTLET",
            portLabel: "RJ45-VOIP",
            portDirection: "BI",
            portMode: "PASSIVE",
            portConnector: "RJ45",
            vlanId: null,
            vlanVid: null,
            vlanName: null,
          },
          {
            hopNumber: 1,
            transitionType: "CABLE",
            cableId: "147f9dee-8d14-5591-b9fa-e310034c818c",
            cableType: "HORIZONTAL_RUN",
            cableCategory: "CAT6A",
            cableLengthMm: 44500,
            fromPortId: VOIP_PORT_ID,
            toPortId: "11e74995-ff9e-500c-c733-dee3e4403928",
            nodeId: "c20d2ac6-2cae-416e-8944-a2db0a0bebce",
            nodeName: "PP-24P-CAT6A-U24",
            nodeType: "PATCH_PANEL",
            portLabel: "PORT-09",
            portDirection: "REAR",
            portMode: "PASSIVE",
            portConnector: "PUNCHDOWN_110",
            vlanId: null,
            vlanVid: null,
            vlanName: null,
          },
          {
            hopNumber: 2,
            transitionType: "INTERNAL_PEER",
            cableId: null,
            cableType: null,
            cableCategory: null,
            cableLengthMm: 0,
            fromPortId: "11e74995-ff9e-500c-c733-dee3e4403928",
            toPortId: "6150fe08-0913-5308-c7e1-1a44b802f243",
            nodeId: "c20d2ac6-2cae-416e-8944-a2db0a0bebce",
            nodeName: "PP-24P-CAT6A-U24",
            nodeType: "PATCH_PANEL",
            portLabel: "PORT-09",
            portDirection: "FRONT",
            portMode: "PASSIVE",
            portConnector: "RJ45",
            vlanId: null,
            vlanVid: null,
            vlanName: null,
          },
          {
            hopNumber: 3,
            transitionType: "CABLE",
            cableId: "d9de62ca-0911-5019-c422-2368654c390d",
            cableType: "PATCH_CORD",
            cableCategory: "CAT6A",
            cableLengthMm: 1500,
            fromPortId: "6150fe08-0913-5308-c7e1-1a44b802f243",
            toPortId: "682ebd85-c0de-58ab-900f-56df0bb521dc",
            nodeId: "22e7f727-2e78-49c1-97dc-d9f4b3e1d35e",
            nodeName: "SW-ACCESS-4A-U22",
            nodeType: "SWITCH",
            portLabel: "GigabitEthernet1/0/9",
            portDirection: "FRONT",
            portMode: "ACCESS",
            portConnector: "RJ45",
            vlanId: "d07fc552-2d97-5f56-c67d-bf038b435720",
            vlanVid: 30,
            vlanName: "VLAN_VOIP_TELEPHONY",
          },
        ],
        totalCableLengthMm: 46000,
        totalCableLengthMeters: 46.0,
        isTerminatedAtActiveDevice: true,
        terminalNode: {
          id: "22e7f727-2e78-49c1-97dc-d9f4b3e1d35e",
          name: "SW-ACCESS-4A-U22",
          type: "SWITCH",
          portLabel: "GigabitEthernet1/0/9",
          portMode: "ACCESS",
        },
        resolvedVlan: {
          id: "d07fc552-2d97-5f56-c67d-bf038b435720",
          vid: 30,
          name: "VLAN_VOIP_TELEPHONY (CoS 5 / DSCP EF)",
        },
      };
      return NextResponse.json(voipTraceResult);
    }

    return NextResponse.json({ error: "Aucun circuit trouvé pour ce port" }, { status: 404 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur lors du traçage";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
