import { Router, type IRouter } from "express";
import { and, eq, or, gte } from "drizzle-orm";
import { db, matchesTable, matchPlayersTable, playersTable } from "@workspace/db";
import { z } from "zod";

const router: IRouter = Router();

const ADMIN_CODE = "110880";

// GET /lisas-recibidas — ranking of players by number of 200-0 defeats
router.get("/lisas-recibidas", async (req, res): Promise<void> => {
  const lisaMatches = await db
    .select()
    .from(matchesTable)
    .where(
      and(
        eq(matchesTable.status, "finished"),
        or(
          and(gte(matchesTable.shortosScore, 200), eq(matchesTable.largosScore, 0)),
          and(gte(matchesTable.largosScore, 200), eq(matchesTable.shortosScore, 0))
        )
      )
    );

  const countMap: Record<number, number> = {};

  for (const match of lisaMatches) {
    const winningTeam = match.winnerTeam;
    if (!winningTeam) continue;

    // The LOSING team is the opposite of winnerTeam
    const losingTeam = winningTeam === "cortos" ? "largos" : "cortos";

    const players = await db
      .select({ playerId: matchPlayersTable.playerId })
      .from(matchPlayersTable)
      .where(
        and(
          eq(matchPlayersTable.matchId, match.id),
          eq(matchPlayersTable.team, losingTeam as "cortos" | "largos")
        )
      );

    for (const p of players) {
      countMap[p.playerId] = (countMap[p.playerId] ?? 0) + 1;
    }
  }

  const allPlayers = await db.select().from(playersTable);

  const ranking = allPlayers
    .map((p) => ({
      player: p,
      lisasRecibidas: (countMap[p.id] ?? 0) + (p.extraLisasRecibidas ?? 0),
    }))
    .sort(
      (a, b) =>
        b.lisasRecibidas - a.lisasRecibidas ||
        a.player.name.localeCompare(b.player.name)
    );

  res.json(ranking);
});

// PATCH /lisas-recibidas/:playerId — manually set total for a player (admin only)
const patchSchema = z.object({
  adminCode: z.string(),
  lisasRecibidas: z.number().int().min(0),
});

router.patch("/lisas-recibidas/:playerId", async (req, res): Promise<void> => {
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

  // Compute match-derived count for this player
  const lisaMatches = await db
    .select()
    .from(matchesTable)
    .where(
      and(
        eq(matchesTable.status, "finished"),
        or(
          and(gte(matchesTable.shortosScore, 200), eq(matchesTable.largosScore, 0)),
          and(gte(matchesTable.largosScore, 200), eq(matchesTable.shortosScore, 0))
        )
      )
    );

  let matchDerived = 0;
  for (const match of lisaMatches) {
    if (!match.winnerTeam) continue;
    const losingTeam = match.winnerTeam === "cortos" ? "largos" : "cortos";
    const players = await db
      .select({ playerId: matchPlayersTable.playerId })
      .from(matchPlayersTable)
      .where(
        and(
          eq(matchPlayersTable.matchId, match.id),
          eq(matchPlayersTable.team, losingTeam as "cortos" | "largos"),
          eq(matchPlayersTable.playerId, playerId)
        )
      );
    matchDerived += players.length;
  }

  const extra = Math.max(0, parsed.data.lisasRecibidas - matchDerived);

  const [updated] = await db
    .update(playersTable)
    .set({ extraLisasRecibidas: extra })
    .where(eq(playersTable.id, playerId))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Jugador no encontrado" });
    return;
  }

  res.json({ ok: true, extraLisasRecibidas: extra, total: matchDerived + extra });
});

// POST /lisas-recibidas/import — bulk import (admin only)
const importSchema = z.object({
  adminCode: z.string(),
  data: z.array(
    z.object({
      playerName: z.string(),
      lisasRecibidas: z.number().int().min(0),
    })
  ),
});

router.post("/lisas-recibidas/import", async (req, res): Promise<void> => {
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
      .set({ extraLisasRecibidas: entry.lisasRecibidas })
      .where(eq(playersTable.id, player.id));
    results.push({ name: entry.playerName, status: "actualizado" });
  }

  res.json({ ok: true, results });
});

export default router;
