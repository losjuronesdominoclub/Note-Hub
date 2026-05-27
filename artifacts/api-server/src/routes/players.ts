import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, playersTable } from "@workspace/db";
import {
  GetPlayerParams,
  UpdatePlayerParams,
  DeletePlayerParams,
  CreatePlayerBody,
  UpdatePlayerBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/players", async (req, res): Promise<void> => {
  const players = await db.select().from(playersTable).orderBy(playersTable.name);
  res.json(players);
});

router.post("/players", async (req, res): Promise<void> => {
  const parsed = CreatePlayerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [player] = await db
    .insert(playersTable)
    .values({
      name: parsed.data.name,
      avatarUrl: parsed.data.avatarUrl ?? null,
    })
    .returning();

  res.status(201).json(player);
});

router.get("/players/:id", async (req, res): Promise<void> => {
  const params = GetPlayerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [player] = await db.select().from(playersTable).where(eq(playersTable.id, params.data.id));
  if (!player) {
    res.status(404).json({ error: "Player not found" });
    return;
  }

  res.json(player);
});

router.patch("/players/:id", async (req, res): Promise<void> => {
  const params = UpdatePlayerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdatePlayerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.avatarUrl !== undefined) updateData.avatarUrl = parsed.data.avatarUrl;
  if (parsed.data.wins !== undefined) updateData.wins = parsed.data.wins;
  if (parsed.data.losses !== undefined) updateData.losses = parsed.data.losses;
  if (parsed.data.totalPoints !== undefined) updateData.totalPoints = parsed.data.totalPoints;
  if (parsed.data.currentStreak !== undefined) updateData.currentStreak = parsed.data.currentStreak;

  // Recalculate winRate if wins/losses changed
  const wins = parsed.data.wins;
  const losses = parsed.data.losses;
  if (wins !== undefined && losses !== undefined) {
    const total = wins + losses;
    updateData.winRate = total > 0 ? wins / total : 0;
  }

  const [player] = await db
    .update(playersTable)
    .set(updateData)
    .where(eq(playersTable.id, params.data.id))
    .returning();

  if (!player) {
    res.status(404).json({ error: "Player not found" });
    return;
  }

  res.json(player);
});

router.delete("/players/:id", async (req, res): Promise<void> => {
  const params = DeletePlayerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [player] = await db
    .delete(playersTable)
    .where(eq(playersTable.id, params.data.id))
    .returning();

  if (!player) {
    res.status(404).json({ error: "Player not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
