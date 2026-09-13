import {
  pgTable,
  uuid,
  varchar,
  integer,
  jsonb,
  timestamp,
  pgEnum,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { ports } from "./ports";

export const cableTypeEnum = pgEnum("cable_type", [
  "HORIZONTAL_RUN", // Rigid structural cabling (Plenum/Wall/Ceiling Cat6A)
  "PATCH_CORD", // Flexible cord (Bay to switch, desk to wall jack)
  "BACKBONE_TRUNK", // High-capacity backbone trunk (Fiber or 10G copper)
]);

export const cableCategoryEnum = pgEnum("cable_category", [
  "CAT5E",
  "CAT6",
  "CAT6A",
  "CAT7",
  "SM_FIBER_OS2",
  "MM_FIBER_OM4",
  "DAC",
]);

export const cableStatusEnum = pgEnum("cable_status", [
  "ACTIVE",
  "DEFECTIVE",
  "RESERVED",
  "DISCONNECTED",
]);

export const cables = pgTable(
  "cables",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    cableType: cableTypeEnum("cable_type").notNull(),
    category: cableCategoryEnum("category").notNull().default("CAT6A"),
    sourcePortId: uuid("source_port_id")
      .notNull()
      .references(() => ports.id, { onDelete: "cascade" }),
    targetPortId: uuid("target_port_id")
      .notNull()
      .references(() => ports.id, { onDelete: "cascade" }),
    lengthMm: integer("length_mm").notNull().default(0), // Physical length in millimeters
    colorCode: varchar("color_code", { length: 20 }).default("BLUE"), // e.g. "BLUE", "YELLOW", "ORANGE", "GREEN"
    status: cableStatusEnum("status").notNull().default("ACTIVE"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // A port can only be connected to one cable endpoint at a time
    uniqueIndex("cables_source_port_idx").on(table.sourcePortId),
    uniqueIndex("cables_target_port_idx").on(table.targetPortId),
    // Prevent loopback to the exact same physical port
    check("cables_no_self_loop", sql`${table.sourcePortId} != ${table.targetPortId}`),
  ]
);

export type Cable = typeof cables.$inferSelect;
export type NewCable = typeof cables.$inferInsert;
