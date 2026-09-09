import { sql } from "drizzle-orm";
import { db } from "../index";
import { z } from "zod";

// Zod contract for each hop in the circuit trace
export const CircuitHopSchema = z.object({
  hopNumber: z.number().int().nonnegative(),
  transitionType: z.enum(["ORIGIN", "CABLE", "INTERNAL_PEER"]),
  cableId: z.string().uuid().nullable(),
  cableType: z.string().nullable(),
  cableCategory: z.string().nullable(),
  cableLengthMm: z.number().int().nonnegative(),
  fromPortId: z.string().uuid(),
  toPortId: z.string().uuid(),
  nodeId: z.string().uuid(),
  nodeName: z.string(),
  nodeType: z.enum(["WALL_OUTLET", "PATCH_PANEL", "SWITCH", "DESK", "ACCESS_POINT", "SERVER"]),
  portLabel: z.string(),
  portDirection: z.enum(["FRONT", "REAR", "BI"]),
  portMode: z.enum(["ACCESS", "TRUNK", "ROUTED", "PASSIVE", "DISABLED"]),
  portConnector: z.string(),
  vlanId: z.string().uuid().nullable(),
  vlanVid: z.number().int().nullable(),
  vlanName: z.string().nullable(),
});

export type CircuitHop = z.infer<typeof CircuitHopSchema>;

export const CircuitTraceResultSchema = z.object({
  startPortId: z.string().uuid(),
  hops: z.array(CircuitHopSchema),
  totalCableLengthMm: z.number().int().nonnegative(),
  totalCableLengthMeters: z.number(),
  isTerminatedAtActiveDevice: z.boolean(),
  terminalNode: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
      type: z.string(),
      portLabel: z.string(),
      portMode: z.string(),
    })
    .nullable(),
  resolvedVlan: z
    .object({
      id: z.string().uuid(),
      vid: z.number().int(),
      name: z.string(),
    })
    .nullable(),
});

export type CircuitTraceResult = z.infer<typeof CircuitTraceResultSchema>;

/**
 * Traces a complete physical and logical circuit from any starting port
 * (e.g. Wall outlet faceplate) through cables and internal patch panel peers
 * up to the active switch port and its associated VLAN.
 *
 * @param startPortId UUID of the originating port
 * @returns Comprehensive trace of all hops, total length, and resolved VLAN
 */
export async function traceCircuitPath(startPortId: string): Promise<CircuitTraceResult> {
  const query = sql`
    WITH RECURSIVE circuit_path AS (
      -- 1. ANCHOR: Starting port
      SELECT
        0 AS hop_number,
        'ORIGIN'::text AS transition_type,
        NULL::uuid AS cable_id,
        NULL::text AS cable_type,
        NULL::text AS cable_category,
        0 AS cable_length_mm,
        p.id AS from_port_id,
        p.id AS to_port_id,
        n.id AS node_id,
        n.name AS node_name,
        n.type::text AS node_type,
        p.label AS port_label,
        p.direction::text AS port_direction,
        p.mode::text AS port_mode,
        p.connector_type::text AS port_connector,
        p.native_vlan_id AS vlan_id,
        v.vid AS vlan_vid,
        v.name AS vlan_name,
        ARRAY[p.id]::uuid[] AS visited_port_ids
      FROM ports p
      JOIN nodes n ON n.id = p.node_id
      LEFT JOIN vlans v ON v.id = p.native_vlan_id
      WHERE p.id = ${startPortId}::uuid

      UNION ALL

      -- 2. RECURSIVE: Follow cables or internal patch panel peer continuities
      SELECT
        cp.hop_number + 1,
        step.transition_type,
        step.cable_id,
        step.cable_type,
        step.cable_category,
        step.cable_length_mm,
        cp.to_port_id AS from_port_id,
        step.next_port_id AS to_port_id,
        n.id AS node_id,
        n.name AS node_name,
        n.type::text AS node_type,
        p.label AS port_label,
        p.direction::text AS port_direction,
        p.mode::text AS port_mode,
        p.connector_type::text AS port_connector,
        p.native_vlan_id AS vlan_id,
        v.vid AS vlan_vid,
        v.name AS vlan_name,
        cp.visited_port_ids || step.next_port_id
      FROM circuit_path cp
      CROSS JOIN LATERAL (
        -- Path A: Traverse a physical cable
        SELECT
          'CABLE'::text AS transition_type,
          c.id AS cable_id,
          c.cable_type::text AS cable_type,
          c.category::text AS cable_category,
          c.length_mm AS cable_length_mm,
          CASE
            WHEN c.source_port_id = cp.to_port_id THEN c.target_port_id
            ELSE c.source_port_id
          END AS next_port_id
        FROM cables c
        WHERE (c.source_port_id = cp.to_port_id OR c.target_port_id = cp.to_port_id)
          AND cp.transition_type != 'CABLE'

        UNION ALL

        -- Path B: Traverse internal hardware continuity (Patch Panel rear punchdown <-> front RJ45)
        SELECT
          'INTERNAL_PEER'::text AS transition_type,
          NULL::uuid AS cable_id,
          NULL::text AS cable_type,
          NULL::text AS cable_category,
          0 AS cable_length_mm,
          CASE
            WHEN p_curr.internal_peer_port_id IS NOT NULL THEN p_curr.internal_peer_port_id
            ELSE peer_back.id
          END AS next_port_id
        FROM ports p_curr
        LEFT JOIN ports peer_back ON peer_back.internal_peer_port_id = p_curr.id
        WHERE p_curr.id = cp.to_port_id
          AND (p_curr.internal_peer_port_id IS NOT NULL OR peer_back.id IS NOT NULL)
          AND cp.transition_type = 'CABLE'
      ) step
      JOIN ports p ON p.id = step.next_port_id
      JOIN nodes n ON n.id = p.node_id
      LEFT JOIN vlans v ON v.id = p.native_vlan_id
      WHERE NOT (step.next_port_id = ANY(cp.visited_port_ids))
        AND cp.hop_number < 25
    )
    SELECT
      hop_number AS "hopNumber",
      transition_type AS "transitionType",
      cable_id AS "cableId",
      cable_type AS "cableType",
      cable_category AS "cableCategory",
      cable_length_mm AS "cableLengthMm",
      from_port_id AS "fromPortId",
      to_port_id AS "toPortId",
      node_id AS "nodeId",
      node_name AS "nodeName",
      node_type AS "nodeType",
      port_label AS "portLabel",
      port_direction AS "portDirection",
      port_mode AS "portMode",
      port_connector AS "portConnector",
      vlan_id AS "vlanId",
      vlan_vid AS "vlanVid",
      vlan_name AS "vlanName"
    FROM circuit_path
    ORDER BY hop_number ASC;
  `;

  const result = await db.execute(query);
  const rawHops = Array.isArray(result)
    ? result
    : ((result as unknown as { rows?: unknown[] }).rows ?? []);
  const hops = z.array(CircuitHopSchema).parse(rawHops);

  const totalCableLengthMm = hops.reduce((acc, hop) => acc + hop.cableLengthMm, 0);
  const lastHop = hops[hops.length - 1];

  let terminalNode = null;
  let resolvedVlan = null;
  let isTerminatedAtActiveDevice = false;

  if (lastHop) {
    terminalNode = {
      id: lastHop.nodeId,
      name: lastHop.nodeName,
      type: lastHop.nodeType,
      portLabel: lastHop.portLabel,
      portMode: lastHop.portMode,
    };

    if (lastHop.nodeType === "SWITCH") {
      isTerminatedAtActiveDevice = true;
      if (lastHop.vlanId && lastHop.vlanVid && lastHop.vlanName) {
        resolvedVlan = {
          id: lastHop.vlanId,
          vid: lastHop.vlanVid,
          name: lastHop.vlanName,
        };
      }
    }
  }

  return {
    startPortId,
    hops,
    totalCableLengthMm,
    totalCableLengthMeters: Number((totalCableLengthMm / 1000).toFixed(2)),
    isTerminatedAtActiveDevice,
    terminalNode,
    resolvedVlan,
  };
}
