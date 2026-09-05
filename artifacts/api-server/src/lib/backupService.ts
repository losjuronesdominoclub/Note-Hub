import { ReplitConnectors } from "@replit/connectors-sdk";
import {
  backupConfigTable, db, eventsTable, matchPlayersTable, matchesTable, playersTable,
  rulesConfigTable, scoreLogTable, tournamentMatchesTable, tournamentsTable,
  tournamentTeamsTable, turnosTable,
} from "@workspace/db";
import { eq, sql } from "drizzle-orm";

export const BACKUP_GROUPS = ["players", "matches", "events", "rules", "tournaments"] as const;
export type BackupGroup = (typeof BACKUP_GROUPS)[number];
export const ALL_GROUPS = [...BACKUP_GROUPS];
const FOLDER_NAME = "losjuronesbackup";
const OWNER_EMAIL = "osjuronesdominoclub@gmail.com";
const DRIVE = "/drive/v3";
const UPLOAD = "/upload/drive/v3";

type Manifest = {
  version: 1; createdAt: string; owner: string; groups: BackupGroup[];
  data: Record<string, unknown[]>;
};

function escapeDrive(value: string) {
  return value.replace(/'/g, "\\'");
}
async function drive(path: string, options?: { method?: string; body?: unknown; headers?: Record<string, string> }) {
  const response = await new ReplitConnectors().proxy("google-drive", path, options);
  if (!response.ok) throw new Error(`Google Drive respondió ${response.status}`);
  return response;
}

export async function getConfig() {
  const [config] = await db.select().from(backupConfigTable).where(eq(backupConfigTable.id, 1));
  if (config) return config;
  const [created] = await db.insert(backupConfigTable).values({ id: 1, automaticGroups: ALL_GROUPS }).returning();
  return created;
}

async function folderId() {
  const config = await getConfig();
  if (config.driveFolderId) return config.driveFolderId;
  const query = encodeURIComponent(`name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const found = await (await drive(`${DRIVE}/files?q=${query}&fields=files(id,name)`)).json() as { files?: { id: string }[] };
  const id = found.files?.[0]?.id;
  if (id) {
    await db.update(backupConfigTable).set({ driveFolderId: id, updatedAt: new Date() }).where(eq(backupConfigTable.id, 1));
    return id;
  }
  const created = await (await drive(`${DRIVE}/files?fields=id`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: "application/vnd.google-apps.folder", description: `Los Jurones backup folder (${OWNER_EMAIL})` }),
  })).json() as { id: string };
  await db.update(backupConfigTable).set({ driveFolderId: created.id, updatedAt: new Date() }).where(eq(backupConfigTable.id, 1));
  return created.id;
}

export async function createBackup(groups: BackupGroup[]) {
  const data: Record<string, unknown[]> = {};
  if (groups.includes("players")) data.players = await db.select().from(playersTable), data.turnos = await db.select().from(turnosTable);
  if (groups.includes("matches")) {
    data.matches = await db.select().from(matchesTable);
    data.match_players = await db.select().from(matchPlayersTable);
    data.score_log = await db.select().from(scoreLogTable);
  }
  if (groups.includes("events")) data.events = await db.select().from(eventsTable);
  if (groups.includes("rules")) data.rules_config = await db.select().from(rulesConfigTable);
  if (groups.includes("tournaments")) {
    data.tournaments = await db.select().from(tournamentsTable);
    data.tournament_teams = await db.select().from(tournamentTeamsTable);
    data.tournament_matches = await db.select().from(tournamentMatchesTable);
  }
  const manifest: Manifest = { version: 1, createdAt: new Date().toISOString(), owner: OWNER_EMAIL, groups, data };
  const folder = await folderId();
  const filename = `losjurones-${manifest.createdAt.replace(/[:.]/g, "-")}.json`;
  const multipart = new FormData();
  multipart.append("metadata", new Blob([JSON.stringify({ name: filename, parents: [folder], mimeType: "application/json" })], { type: "application/json" }));
  multipart.append("file", new Blob([JSON.stringify(manifest)], { type: "application/json" }), filename);
  const file = await (await drive(`${UPLOAD}/files?uploadType=multipart&fields=id,name,createdTime,size`, { method: "POST", body: multipart })).json();
  await db.update(backupConfigTable).set({ lastRunAt: new Date(), lastStatus: "success", lastError: null, updatedAt: new Date() }).where(eq(backupConfigTable.id, 1));
  return file;
}

export async function listBackups() {
  const folder = await folderId();
  const query = encodeURIComponent(`'${escapeDrive(folder)}' in parents and mimeType='application/json' and trashed=false`);
  const result = await (await drive(`${DRIVE}/files?q=${query}&orderBy=createdTime desc&fields=files(id,name,createdTime,size,description)`)).json() as { files?: unknown[] };
  return Promise.all((result.files ?? []).map(async (file) => {
    const item = file as { id: string };
    return { ...item, manifest: await readBackup(item.id) };
  }));
}

export async function readBackup(fileId: string): Promise<Manifest> {
  const result = await drive(`${DRIVE}/files/${encodeURIComponent(fileId)}?alt=media`);
  const parsed = await result.json() as Manifest;
  if (parsed.version !== 1 || !Array.isArray(parsed.groups) || !parsed.data) throw new Error("El archivo no es un respaldo válido de Los Jurones.");
  return parsed;
}

const groupTables: Record<BackupGroup, string[]> = {
  players: ["players", "turnos"], matches: ["matches", "match_players", "score_log"],
  events: ["events"], rules: ["rules_config"], tournaments: ["tournaments", "tournament_teams", "tournament_matches"],
};
const deleteOrder = ["score_log", "match_players", "tournament_matches", "tournament_teams", "matches", "turnos", "players", "events", "rules_config", "tournaments"];
const insertOrder = ["players", "turnos", "matches", "match_players", "score_log", "events", "rules_config", "tournaments", "tournament_teams", "tournament_matches"];

export async function restoreBackup(fileId: string, groups: BackupGroup[]) {
  const backup = await readBackup(fileId);
  for (const group of groups) {
    if (!backup.groups.includes(group) || groupTables[group].some((table) => !Array.isArray(backup.data[table]))) {
      throw new Error(`El respaldo no contiene el grupo requerido: ${group}.`);
    }
  }
  const selectedTables = new Set(groups.flatMap((group) => groupTables[group]));
  await db.transaction(async (tx) => {
    for (const table of deleteOrder) if (selectedTables.has(table)) await tx.execute(sql.raw(`DELETE FROM "${table}"`));
    for (const table of insertOrder) {
      if (!selectedTables.has(table)) continue;
      const rows = backup.data[table] as Record<string, unknown>[];
      if (rows.length) {
        const fields = Object.keys(rows[0]);
        await tx.execute(sql`INSERT INTO ${sql.identifier(table)} (${sql.join(fields.map(sql.identifier), sql`, `)}) VALUES ${sql.join(rows.map((row) => sql`(${sql.join(fields.map((field) => sql`${row[field]}`), sql`, `)})`), sql`, `)}`);
      }
    }
    for (const table of selectedTables) {
      if (table === "rules_config") continue;
      await tx.execute(sql.raw(`SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 1), (SELECT COUNT(*) > 0 FROM "${table}"))`));
    }
  });
  return { restoredGroups: groups, createdAt: backup.createdAt };
}

export async function markAutomaticResult(localDate: string, error?: unknown) {
  await db.update(backupConfigTable).set({
    lastAutomaticDate: localDate, lastRunAt: new Date(), lastStatus: error ? "error" : "success",
    lastError: error instanceof Error ? error.message : error ? "Error desconocido" : null, updatedAt: new Date(),
  }).where(eq(backupConfigTable.id, 1));
}

/** Atomically reserves a local calendar day for one scheduler instance. */
export async function claimAutomaticRun(localDate: string) {
  await getConfig();
  const claimed = await db.update(backupConfigTable).set({
    lastAutomaticDate: localDate, lastStatus: "running", lastError: null, updatedAt: new Date(),
  }).where(sql`${backupConfigTable.id} = 1 AND ${backupConfigTable.lastAutomaticDate} IS DISTINCT FROM ${localDate}`).returning();
  return claimed.length === 1;
}