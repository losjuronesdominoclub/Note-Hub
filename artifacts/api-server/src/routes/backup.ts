import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { ALL_GROUPS, BACKUP_GROUPS, createBackup, getConfig, listBackups, restoreBackup } from "../lib/backupService";
import { backupConfigTable, db } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();
const groups = z.array(z.enum(BACKUP_GROUPS)).min(1).transform((value) => [...new Set(value)]);
const admin = z.string().min(1);
const requireAdmin = (code: string) => code === (process.env.ADMIN_CODE ?? "110880");
const headerAdmin = (value: string | undefined) => requireAdmin(value ?? "");

router.get("/backup/config", async (req, res): Promise<void> => {
  if (!headerAdmin(req.header("x-admin-code"))) { res.status(403).json({ error: "Código de administrador inválido." }); return; }
  res.json(await getConfig());
});
router.get("/backup/files", async (req, res): Promise<void> => {
  if (!headerAdmin(req.header("x-admin-code"))) { res.status(403).json({ error: "Código de administrador inválido." }); return; }
  try { res.json(await listBackups()); } catch (err) { req.log.error({ err }, "Unable to list backups"); res.status(502).json({ error: "No se pudo acceder a Google Drive." }); }
});
router.post("/backup/config", async (req, res): Promise<void> => {
  const parsed = z.object({ adminCode: admin, automaticGroups: groups }).safeParse(req.body);
  if (!parsed.success || !requireAdmin(parsed.success ? parsed.data.adminCode : "")) { res.status(403).json({ error: "Código de administrador inválido." }); return; }
  await getConfig();
  const [config] = await db.update(backupConfigTable).set({ automaticGroups: parsed.data.automaticGroups, updatedAt: new Date() }).where(eq(backupConfigTable.id, 1)).returning();
  res.json(config);
});
router.post("/backup/create", async (req, res): Promise<void> => {
  const parsed = z.object({ adminCode: admin, groups }).safeParse(req.body);
  if (!parsed.success || !requireAdmin(parsed.success ? parsed.data.adminCode : "")) { res.status(403).json({ error: "Código de administrador inválido." }); return; }
  try { res.status(201).json(await createBackup(parsed.data.groups)); } catch (err) { req.log.error({ err }, "Backup creation failed"); res.status(502).json({ error: "No se pudo crear el respaldo en Drive." }); }
});
router.post("/backup/restore", async (req, res): Promise<void> => {
  const parsed = z.object({ adminCode: admin, confirmation: z.literal("RESTAURAR LOS JURONES"), fileId: z.string().min(1), groups }).safeParse(req.body);
  if (!parsed.success || !requireAdmin(parsed.success ? parsed.data.adminCode : "")) { res.status(403).json({ error: "Confirmación o código de administrador inválido." }); return; }
  try { res.json(await restoreBackup(parsed.data.fileId, parsed.data.groups)); } catch (err) { req.log.error({ err }, "Backup restore failed"); res.status(400).json({ error: err instanceof Error ? err.message : "No se pudo restaurar el respaldo." }); }
});
export default router;