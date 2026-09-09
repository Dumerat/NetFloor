import {
  pgTable,
  uuid,
  varchar,
  integer,
  boolean,
  jsonb,
  timestamp,
  pgEnum,
  uniqueIndex,
  primaryKey,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { nodes } from "./nodes";
import { vlans } from "./vlans";

export const connectorTypeEnum = pgEnum("connector_type", [
  "RJ45",
  "SFP_PLUS",
  "FIBER_LC",
  "PUNCHDOWN_110",
]);

export const portDirectionEnum = pgEnum("port_direction", [
  "FRONT", // Front-facing port (RJ45 patch, switch front, etc.)
  "REAR",  // Rear-facing port (Punchdown block 110/Krone on patch panel)
  "BI",    // Bidirectional / Wall jack outlet faceplate
]);

export const portModeEnum = pgEnum("port_mode", [
  "ACCESS",      // Single untagged VLAN
  "TRUNK",       // Native VLAN + 802.1Q tagged VLANs
  "ROUTED",      // Direct IP layer 3 port
  "PASSIVE",     // Passive physical pass-through (Wall outlet, patch panel)
  "DISABLED",    // Administratively down
]);

export const ports = pgTable(
  "ports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    nodeId: uuid("node_id")
      .notNull()
      .references(() => nodes.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 50 }).notNull(), // e.g. "01", "Gi1/0/24", "Port-A"
    connectorType: connectorTypeEnum("connector_type").notNull().default("RJ45"),
    direction: portDirectionEnum("direction").notNull().default("FRONT"),
    mode: portModeEnum("mode").notNull().default("PASSIVE"),
    nativeVlanId: uuid("native_vlan_id").references(() => vlans.id, { onDelete: "set null" }),
    // Internal hardware continuity (e.g. Patch Panel Rear Punchdown <-> Front RJ45)
    internalPeerPortId: uuid("internal_peer_port_id").references((): AnyPgColumn => ports.id, {
      onDelete: "set null",
    }),
    speedMbps: integer("speed_mbps").default(1000), // 1000 = 1G, 10000 = 10G
    poeEnabled: boolean("poe_enabled").default(false).notNull(),
    poeStandard: varchar("poe_standard", { length: 20 }), // "802.3af", "802.3at", "802.3bt"
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("ports_node_label_direction_idx").on(table.nodeId, table.label, table.direction),
  ]
);

export type Port = typeof ports.$inferSelect;
export type NewPort = typeof ports.$inferInsert;

export const portVlans = pgTable(
  "port_vlans",
  {
    portId: uuid("port_id")
      .notNull()
      .references(() => ports.id, { onDelete: "cascade" }),
    vlanId: uuid("vlan_id")
      .notNull()
      .references(() => vlans.id, { onDelete: "cascade" }),
    tagged: boolean("tagged").notNull().default(true),
  },
  (table) => [
    primaryKey({ columns: [table.portId, table.vlanId] }),
  ]
);

export type PortVlan = typeof portVlans.$inferSelect;
export type NewPortVlan = typeof portVlans.$inferInsert;
