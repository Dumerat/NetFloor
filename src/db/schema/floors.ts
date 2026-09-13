import {
  pgTable,
  uuid,
  varchar,
  integer,
  doublePrecision,
  text,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";

export const floors = pgTable("floors", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  building: varchar("building", { length: 100 }).notNull(),
  floorNumber: integer("floor_number").notNull().default(0),
  widthMm: integer("width_mm").notNull(),
  heightMm: integer("height_mm").notNull(),
  scaleRatio: doublePrecision("scale_ratio").notNull().default(1.0),
  backgroundPlanUrl: text("background_plan_url"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Floor = typeof floors.$inferSelect;
export type NewFloor = typeof floors.$inferInsert;
