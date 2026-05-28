import { Router, type IRouter } from "express";
import { and, eq, or } from "drizzle-orm";
import { db, matchesTable, matchPlayersTable, playersTable } from "@workspace/db";
import { z } from "zod";

const router: IRouter = Router();

const ADMIN_CODE = "110880";

// GET /lisas — ranking of players by number of "lisa" wins (200-0) + manually imported lisas
router.get("/lisas", async (req, res): Promise<void> => {
  const lisaMatches = await db
    .select()
    .from(matchesTable)
    .where(
      and(
        eq(matchesTable.status, "finished"),
        or(
          and(eq(matchesTable.shortosScore, 200), eq(matchesTable.largosScore, 0)),
          and(eq(matchesTable.largosScore, 200), eq(matchesTable.shortosScore, 0))
        )
      )
    );

  const lisaCountMap: Record<number, number> = {};

  for (const match of lisaMatches) {
    const winningTeam = match.winnerTeam;
    const players = await db
      .select({ playerId: matchPlayersTable.playerId, team: matchPlayersTable.team })
      .from(matchPlayersTable)
      .where(and(eq(matchPlayersTable.matchId, match.id), eq(matchPlayersTable.team, winningTeam as "cortos" | "largos")));

    for (const p of players) {
      lisaCountMap[p.playerId] = (lisaCountMap[p.playerId] ?? 0) + 1;
    }
  }

  // Fetch all players and merge extraLisas
  const allPlayers = await db.select().from(playersTable);
  const playerMap = new Map(allPlayers.map((p) => [p.id, p]));

  // Combine computed + manual lisas
  const combinedMap: Record<number, number> = {};
  for (const p of allPlayers) {
    const computed = lisaCountMap[p.id] ?? 0;
    const extra = p.extraLisas ?? 0;
    if (computed + extra > 0) {
      combinedMap[p.id] = computed + extra;
    }
  }

  if (Object.keys(combinedMap).length === 0) {
    res.json([]);
    return;
  }

  const ranking = Object.keys(combinedMap)
    .map(Number)
    .filter((id) => playerMap.has(id))
    .map((id) => ({
      player: playerMap.get(id)!,
      lisas: combinedMap[id],
    }))
    .sort((a, b) => b.lisas - a.lisas || a.player.name.localeCompare(b.player.name));

  res.json(ranking);
});

// POST /lisas/import — import lisas ranking (admin only)
const importSchema = z.object({
  adminCode: z.string(),
  data: z.array(
    z.object({
      playerName: z.string(),
      lisas: z.number().int().min(0),
    })
  ),
});

router.post("/lisas/import", async (req, res): Promise<void> => {
  const parsed = importSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Formato inválido" });
    return;
  }
  if (parsed.data.adminCode !== ADMIN_CODE) {
    res.status(403).json({ error: "Código de administrador incorrecto" });
    return;
  }

  const allPlayers = await db.select().from(playersTable);
  const playerByName = new Map(allPlayers.map((p) => [p.name.toLowerCase(), p]));

  const results: { name: string; status: string }[] = [];

  for (const entry of parsed.data.data) {
    const player = playerByName.get(entry.playerName.toLowerCase());
    if (!player) {
      results.push({ name: entry.playerName, status: "no encontrado" });
      continue;
    }
    await db
      .update(playersTable)
      .set({ extraLisas: entry.lisas })
      .where(eq(playersTable.id, player.id));
    results.push({ name: entry.playerName, status: "actualizado" });
  }

  res.json({ ok: true, results });
});

// PATCH /lisas/:playerId — set total lisa count for a player (admin only)
const patchSchema = z.object({
  adminCode: z.string(),
  lisas: z.number().int().min(0),
});

router.patch("/lisas/:playerId", async (req, res): Promise<void> => {
  const playerId = parseInt(req.params.playerId);
  if (isNaN(playerId)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }

  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Formato inválido" });
    return;
  }
  if (parsed.data.adminCode !== ADMIN_CODE) {
    res.status(403).json({ error: "Código de administrador incorrecto" });
    return;
  }

  // Compute match-derived lisa count for this player
  const lisaMatches = await db
    .select()
    .from(matchesTable)
    .where(
      and(
        eq(matchesTable.status, "finished"),
        or(
          and(eq(matchesTable.shortosScore, 200), eq(matchesTable.largosScore, 0)),
          and(eq(matchesTable.largosScore, 200), eq(matchesTable.shortosScore, 0))
        )
      )
    );

  let matchDerived = 0;
  for (const match of lisaMatches) {
    const players = await db
      .select({ playerId: matchPlayersTable.playerId })
      .from(matchPlayersTable)
      .where(
        and(
          eq(matchPlayersTable.matchId, match.id),
          eq(matchPlayersTable.team, match.winnerTeam as "cortos" | "largos"),
          eq(matchPlayersTable.playerId, playerId)
        )
      );
    matchDerived += players.length;
  }

  const extraLisas = Math.max(0, parsed.data.lisas - matchDerived);

  const [updated] = await db
    .update(playersTable)
    .set({ extraLisas })
    .where(eq(playersTable.id, playerId))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Jugador no encontrado" });
    return;
  }

  res.json({ ok: true, extraLisas, total: matchDerived + extraLisas });
});

export default router;
