import { pgTable, serial, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import * as z from "zod/v4";

export const tournamentsTable = pgTable("tournaments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  status: text("status").notNull().default("setup"), // setup | active | finished
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

export const tournamentTeamsTable = pgTable("tournament_teams", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id")
    .notNull()
    .references(() => tournamentsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  player1: text("player1").notNull(),
  player2: text("player2").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tournamentMatchesTable = pgTable("tournament_matches", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id")
    .notNull()
    .references(() => tournamentsTable.id, { onDelete: "cascade" }),
  round: integer("round").notNull(), // 1-based
  position: integer("position").notNull(), // 0-based within round
  team1Id: integer("team1_id").references(() => tournamentTeamsTable.id),
  team2Id: integer("team2_id").references(() => tournamentTeamsTable.id),
  winnerId: integer("winner_id").references(() => tournamentTeamsTable.id),
  team1Score: integer("team1_score"),
  team2Score: integer("team2_score"),
  status: text("status").notNull().default("pending"), // pending | finished | bye
  isThirdPlace: boolean("is_third_place").notNull().default(false),
});

export const insertTournamentSchema = createInsertSchema(tournamentsTable).omit({ id: true, createdAt: true, finishedAt: true });
export const insertTournamentTeamSchema = createInsertSchema(tournamentTeamsTable).omit({ id: true, createdAt: true });
export type Tournament = typeof tournamentsTable.$inferSelect;
export type TournamentTeam = typeof tournamentTeamsTable.$inferSelect;
export type TournamentMatch = typeof tournamentMatchesTable.$inferSelect;
