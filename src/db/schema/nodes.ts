import { pgTable, uuid, varchar, integer, doublePrecision, jsonb, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { floors } from "./floors";
import { racks } from "./racks";

export const nodeTypeEnum = pgEnum("node_type", [
  "WALL_OUTLET",
  "PATCH_PANEL",
  "SWITCH",
  "DESK",
  "ACCESS_POINT",
  "SERVER",
]);

export const nodes = pgTable("nodes", {
  id: uuid("id").defaultRandom().primaryKey(),
  floorId: uuid("floor_id")
    .notNull()
    .references(() => floors.id, { onDelete: "cascade" }),
  rackId: uuid("rack_id").references(() => racks.id, { onDelete: "set null" }),
  rackUPosition: integer("rack_u_position"),
  type: nodeTypeEnum("type").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  model: varchar("model", { length: 100 }),
  xMm: integer("x_mm").notNull().default(0),
  yMm: integer("y_mm").notNull().default(0),
  rotationDeg: doublePrecision("rotation_deg").notNull().default(0),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Node = typeof nodes.$inferSelect;
export type NewNode = typeof nodes.$inferInsert;
