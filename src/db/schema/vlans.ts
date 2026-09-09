import { pgTable, uuid, varchar, integer, text, timestamp } from "drizzle-orm/pg-core";

export const vlans = pgTable("vlans", {
  id: uuid("id").defaultRandom().primaryKey(),
  vid: integer("vid").notNull().unique(), // 1 - 4094
  name: varchar("name", { length: 64 }).notNull(),
  description: text("description"),
  subnetCidr: varchar("subnet_cidr", { length: 45 }), // e.g. "10.100.20.0/24"
  gatewayIp: varchar("gateway_ip", { length: 45 }), // e.g. "10.100.20.1"
  colorHex: varchar("color_hex", { length: 7 }).notNull().default("#3b82f6"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Vlan = typeof vlans.$inferSelect;
export type NewVlan = typeof vlans.$inferInsert;
