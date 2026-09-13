import {
  pgTable,
  uuid,
  varchar,
  integer,
  doublePrecision,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";
import { floors } from "./floors";

export const racks = pgTable("racks", {
  id: uuid("id").defaultRandom().primaryKey(),
  floorId: uuid("floor_id")
    .notNull()
    .references(() => floors.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 50 }).notNull(),
  uHeight: integer("u_height").notNull().default(42),
  xMm: integer("x_mm").notNull().default(0),
  yMm: integer("y_mm").notNull().default(0),
  widthMm: integer("width_mm").notNull().default(600), // Standard 19" rack outer width: 600mm
  depthMm: integer("depth_mm").notNull().default(800), // Standard depth: 800mm or 1000mm
  rotationDeg: doublePrecision("rotation_deg").notNull().default(0),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Rack = typeof racks.$inferSelect;
export type NewRack = typeof racks.$inferInsert;
