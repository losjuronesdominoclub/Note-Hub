import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { playersTable } from "./players";

export const matchesTable = pgTable("matches", {
  id: serial("id").primaryKey(),
  matchNumber: text("match_number").notNull(),
  status: text("status").notNull().default("active"), // active | finished
  shortosScore: integer("shortos_score").notNull().default(0),
  largosScore: integer("largos_score").notNull().default(0),
  winnerTeam: text("winner_team"), // cortos | largos | null
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

export const matchPlayersTable = pgTable("match_players", {
  id: serial("id").primaryKey(),
  matchId: integer("match_id").notNull().references(() => matchesTable.id, { onDelete: "cascade" }),
  playerId: integer("player_id").notNull().references(() => playersTable.id, { onDelete: "cascade" }),
  team: text("team").notNull(), // cortos | largos
  playerPoints: integer("player_points").notNull().default(0),
});

export const scoreLogTable = pgTable("score_log", {
  id: serial("id").primaryKey(),
  matchId: integer("match_id").notNull().references(() => matchesTable.id, { onDelete: "cascade" }),
  playerId: integer("player_id").notNull().references(() => playersTable.id, { onDelete: "cascade" }),
  team: text("team").notNull(), // cortos | largos
  points: integer("points").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMatchSchema = createInsertSchema(matchesTable).omit({ id: true, createdAt: true });
export const insertMatchPlayerSchema = createInsertSchema(matchPlayersTable).omit({ id: true });
export const insertScoreLogSchema = createInsertSchema(scoreLogTable).omit({ id: true, createdAt: true });

export type InsertMatch = z.infer<typeof insertMatchSchema>;
export type Match = typeof matchesTable.$inferSelect;
export type MatchPlayer = typeof matchPlayersTable.$inferSelect;
export type ScoreLog = typeof scoreLogTable.$inferSelect;
