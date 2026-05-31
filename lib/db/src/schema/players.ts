import { pgTable, text, serial, timestamp, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const playersTable = pgTable("players", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  avatarUrl: text("avatar_url"),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  totalPoints: integer("total_points").notNull().default(0),
  winRate: real("win_rate").notNull().default(0),
  currentStreak: integer("current_streak").notNull().default(0),
  extraLisas: integer("extra_lisas").notNull().default(0),
  extraLisasRecibidas: integer("extra_lisas_recibidas").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPlayerSchema = createInsertSchema(playersTable).omit({ id: true, createdAt: true });
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
export type Player = typeof playersTable.$inferSelect;
