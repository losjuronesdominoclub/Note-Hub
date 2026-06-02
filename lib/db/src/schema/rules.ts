import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";

export const rulesConfigTable = pgTable("rules_config", {
  key: text("key").primaryKey(),
  segments: jsonb("segments").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type RulesConfig = typeof rulesConfigTable.$inferSelect;
