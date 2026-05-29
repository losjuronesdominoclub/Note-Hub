import { Router, type IRouter } from "express";
import { db, matchesTable, playersTable } from "@workspace/db";
import { z } from "zod";

const ADMIN_CODE = process.env.ADMIN_CODE ?? "110880";

const router: IRouter = Router();

const resetSchema = z.object({
  adminCode: z.string(),
});

// POST /reset — wipe all match history and reset all player stats to 0
router.post("/reset", async (req, res): Promise<void> => {
  const parsed = resetSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Formato inválido" });
    return;
  }
  if (parsed.data.adminCode !== ADMIN_CODE) {
    res.status(403).json({ error: "Código de administrador incorrecto" });
    return;
  }

  // Delete all matches (score_log and match_players cascade via FK)
  await db.delete(matchesTable);

  // Reset all player stats to 0, keep name and avatarUrl
  await db.update(playersTable).set({
    wins: 0,
    losses: 0,
    totalPoints: 0,
    winRate: 0,
    currentStreak: 0,
    extraLisas: 0,
  });

  res.json({ ok: true });
});

export default router;
