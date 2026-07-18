import { pgTable, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { playersTable } from "./players";

export const turnosTable = pgTable("turnos", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull().references(() => playersTable.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  arrivedAt: timestamp("arrived_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Turno = typeof turnosTable.$inferSelect;
