import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/** Singleton row (id=1) for the Drive destination and automatic-run state. */
export const backupConfigTable = pgTable("backup_config", {
  id: serial("id").primaryKey(),
  driveFolderId: text("drive_folder_id"),
  automaticGroups: text("automatic_groups").array().notNull().default([]),
  lastAutomaticDate: text("last_automatic_date"),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  lastStatus: text("last_status"),
  lastError: text("last_error"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBackupConfigSchema = createInsertSchema(backupConfigTable).omit({
  id: true,
  updatedAt: true,
});
export type BackupConfig = typeof backupConfigTable.$inferSelect;
export type InsertBackupConfig = z.infer<typeof insertBackupConfigSchema>;