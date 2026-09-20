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
} from "drizzle-orm/pg-core";
import { nodes } from "./nodes";
import { cables } from "./cables";

export const discoveryJobStatusEnum = pgEnum("discovery_job_status", [
  "PENDING",
  "RUNNING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
]);

export const discoveredDeviceTypeEnum = pgEnum("discovered_device_type", [
  "SWITCH",
  "ROUTER",
  "ACCESS_POINT",
  "WORKSTATION",
  "PHONE_VOIP",
  "PRINTER",
  "SERVER",
  "UNMANAGED_SWITCH",
  "UNKNOWN",
]);

export const connectionTypeEnum = pgEnum("connection_type", [
  "LLDP_BACKBONE",
  "CDP_BACKBONE",
  "FDB_ACCESS",
  "VOIP_CASCADED",
  "WIFI_CLIENT",
  "CLOUD_MANAGED",
  "MANUAL_OVERRIDE",
]);

export const driftStatusEnum = pgEnum("drift_status", [
  "SYNCED",
  "NEW_DEVICE",
  "PORT_MIGRATED",
  "NEW_CONNECTION",
  "DEVICE_OFFLINE",
  "IP_CONFLICT",
]);

/**
 * 1. Table des jobs de découverte réseau asynchrones
 */
export const discoveryJobs = pgTable("discovery_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  subnetCidr: varchar("subnet_cidr", { length: 50 }).notNull(),
  snmpVersion: varchar("snmp_version", { length: 10 }).notNull().default("v2c"),
  status: discoveryJobStatusEnum("status").notNull().default("PENDING"),
  currentPass: integer("current_pass").notNull().default(1),
  totalPasses: integer("total_passes").notNull().default(4),
  devicesDiscoveredCount: integer("devices_discovered_count").notNull().default(0),
  connectionsDiscoveredCount: integer("connections_discovered_count").notNull().default(0),
  diffsCount: integer("diffs_count").notNull().default(0),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  error: varchar("error", { length: 500 }),
  options: jsonb("options")
    .$type<{
      snmpCommunity?: string | undefined;
      v3User?: string | undefined;
      v3AuthPass?: string | undefined;
      v3PrivPass?: string | undefined;
      includeCloud?: boolean | undefined;
      pingTimeoutMs?: number | undefined;
      targetHostsCount?: number | undefined;
    }>()
    .default({}),
});

export type DiscoveryJob = typeof discoveryJobs.$inferSelect;
export type NewDiscoveryJob = typeof discoveryJobs.$inferInsert;

/**
 * 2. Table des équipements découverts par le pipeline
 */
export const discoveredDevices = pgTable(
  "discovered_devices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => discoveryJobs.id, { onDelete: "cascade" }),
    ipAddress: varchar("ip_address", { length: 45 }).notNull(),
    macAddress: varchar("mac_address", { length: 17 }).notNull(),
    hostname: varchar("hostname", { length: 150 }),
    manufacturer: varchar("manufacturer", { length: 100 }),
    model: varchar("model", { length: 100 }),
    deviceType: discoveredDeviceTypeEnum("device_type").notNull().default("UNKNOWN"),
    sysDescr: varchar("sys_descr", { length: 500 }),
    osVersion: varchar("os_version", { length: 100 }),
    vlanId: integer("vlan_id"),
    isManagedSwitch: boolean("is_managed_switch").default(false).notNull(),
    matchedNodeId: uuid("matched_node_id").references(() => nodes.id, { onDelete: "set null" }),
    isManualOverride: boolean("is_manual_override").default(false).notNull(),
    isLocked: boolean("is_locked").default(false).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  },
  (table) => [uniqueIndex("discovered_devices_job_mac_idx").on(table.jobId, table.macAddress)]
);

export type DiscoveredDevice = typeof discoveredDevices.$inferSelect;
export type NewDiscoveredDevice = typeof discoveredDevices.$inferInsert;

/**
 * 3. Table des liaisons L2 (Backbone LLDP/CDP et Attachement FDB)
 */
export const discoveredConnections = pgTable("discovered_connections", {
  id: uuid("id").defaultRandom().primaryKey(),
  jobId: uuid("job_id")
    .notNull()
    .references(() => discoveryJobs.id, { onDelete: "cascade" }),
  sourceDeviceId: uuid("source_device_id")
    .notNull()
    .references(() => discoveredDevices.id, { onDelete: "cascade" }),
  sourcePortName: varchar("source_port_name", { length: 50 }).notNull(),
  targetDeviceId: uuid("target_device_id")
    .notNull()
    .references(() => discoveredDevices.id, { onDelete: "cascade" }),
  targetPortName: varchar("target_port_name", { length: 50 }),
  connectionType: connectionTypeEnum("connection_type").notNull(),
  vlanId: integer("vlan_id"),
  confidenceScore: integer("confidence_score").notNull().default(100),
  driftStatus: driftStatusEnum("drift_status").notNull().default("SYNCED"),
  driftDetails: varchar("drift_details", { length: 300 }),
  matchedCableId: uuid("matched_cable_id").references(() => cables.id, { onDelete: "set null" }),
  isLocked: boolean("is_locked").default(false).notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type DiscoveredConnection = typeof discoveredConnections.$inferSelect;
export type NewDiscoveredConnection = typeof discoveredConnections.$inferInsert;

/**
 * 4. Table des logs d'audit et de traçabilité du scan
 */
export const discoveryLogs = pgTable("discovery_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  jobId: uuid("job_id")
    .notNull()
    .references(() => discoveryJobs.id, { onDelete: "cascade" }),
  level: varchar("level", { length: 10 }).notNull().default("INFO"), // INFO, WARN, ERROR
  pass: integer("pass"),
  message: varchar("message", { length: 500 }).notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type DiscoveryLog = typeof discoveryLogs.$inferSelect;
export type NewDiscoveryLog = typeof discoveryLogs.$inferInsert;
