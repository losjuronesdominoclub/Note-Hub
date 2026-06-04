import { Router, type IRouter } from "express";
import { eq, desc, asc, and, sql } from "drizzle-orm";
import { db, matchesTable, matchPlayersTable, scoreLogTable, playersTable } from "@workspace/db";
import { z } from "zod";
import {
  ListMatchesQueryParams,
  GetMatchParams,
  CreateMatchBody,
  UpdateMatchParams,
  UpdateMatchBody,
  DeleteMatchParams,
  DeleteMatchBody,
  AddScoreParams,
  AddScoreBody,
  FinishMatchParams,
} from "@workspace/api-zod";

const ADMIN_CODE = process.env.ADMIN_CODE ?? "110880";

const router: IRouter = Router();

async function buildMatchDetail(matchId: number) {
  const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
  if (!match) return null;

  const matchPlayers = await db
    .select({
      id: matchPlayersTable.id,
      playerId: matchPlayersTable.playerId,
      team: matchPlayersTable.team,
      playerPoints: matchPlayersTable.playerPoints,
      player: playersTable,
    })
    .from(matchPlayersTable)
    .innerJoin(playersTable, eq(matchPlayersTable.playerId, playersTable.id))
    .where(eq(matchPlayersTable.matchId, matchId));

  const scoreLog = await db
    .select({
      id: scoreLogTable.id,
      playerId: scoreLogTable.playerId,
      team: scoreLogTable.team,
      points: scoreLogTable.points,
      createdAt: scoreLogTable.createdAt,
      playerName: playersTable.name,
    })
    .from(scoreLogTable)
    .innerJoin(playersTable, eq(scoreLogTable.playerId, playersTable.id))
    .where(eq(scoreLogTable.matchId, matchId))
    .orderBy(desc(scoreLogTable.createdAt));

  return { ...match, players: matchPlayers, scoreLog };
}

async function getNextMatchNumber(): Promise<string> {
  const [last] = await db
    .select({ matchNumber: matchesTable.matchNumber })
    .from(matchesTable)
    .orderBy(desc(matchesTable.id))
    .limit(1);

  if (!last) return "001";
  const num = parseInt(last.matchNumber, 10) + 1;
  return num.toString().padStart(3, "0");
}

async function recalculatePlayerStats(playerId: number) {
  // Get all finished matches for this player
  const playerMatches = await db
    .select({
      team: matchPlayersTable.team,
      winnerTeam: matchesTable.winnerTeam,
      playerPoints: matchPlayersTable.playerPoints,
    })
    .from(matchPlayersTable)
    .innerJoin(matchesTable, eq(matchPlayersTable.matchId, matchesTable.id))
    .where(and(eq(matchPlayersTable.playerId, playerId), eq(matchesTable.status, "finished")));

  let wins = 0;
  let losses = 0;
  let totalPoints = 0;
  let streak = 0;
  let lastResult: string | null = null;

  for (const m of playerMatches) {
    totalPoints += m.playerPoints;
    if (m.winnerTeam === m.team) {
      wins++;
    } else if (m.winnerTeam != null) {
      losses++;
    }
  }

  // topPts = highest single scoring entry (ronda) from score_log
  const scoreRows = await db
    .select({ points: scoreLogTable.points })
    .from(scoreLogTable)
    .where(eq(scoreLogTable.playerId, playerId));

  const topPts = scoreRows.reduce((max, r) => (r.points > max ? r.points : max), 0);

  const total = wins + losses;
  const winRate = total > 0 ? wins / total : 0;

  // Simple streak: just use wins - losses as a proxy
  streak = wins - losses;

  await db
    .update(playersTable)
    .set({ wins, losses, totalPoints, winRate, currentStreak: streak, topPts })
    .where(eq(playersTable.id, playerId));
}

// GET /matches/busy-players — must be before /:id
router.get("/matches/busy-players", async (_req, res): Promise<void> => {
  const rows = await db
    .selectDistinct({ playerId: matchPlayersTable.playerId })
    .from(matchPlayersTable)
    .innerJoin(matchesTable, eq(matchPlayersTable.matchId, matchesTable.id))
    .where(eq(matchesTable.status, "active"));

  res.json({ busyPlayerIds: rows.map(r => r.playerId) });
});

// GET /matches
router.get("/matches", async (req, res): Promise<void> => {
  const queryParams = ListMatchesQueryParams.safeParse(req.query);
  const query = db.select().from(matchesTable).orderBy(desc(matchesTable.createdAt));

  let matches;
  if (queryParams.success && queryParams.data.status) {
    matches = await db
      .select()
      .from(matchesTable)
      .where(eq(matchesTable.status, queryParams.data.status))
      .orderBy(desc(matchesTable.createdAt));
  } else {
    matches = await db.select().from(matchesTable).orderBy(desc(matchesTable.createdAt));
  }

  res.json(matches);
});

// POST /matches
router.post("/matches", async (req, res): Promise<void> => {
  const parsed = CreateMatchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const matchNumber = await getNextMatchNumber();

  const [match] = await db
    .insert(matchesTable)
    .values({ matchNumber, status: "active", shortosScore: 0, largosScore: 0 })
    .returning();

  // Insert match players
  const playerValues = [
    ...parsed.data.cortos.map((pid: number) => ({ matchId: match.id, playerId: pid, team: "cortos" as const, playerPoints: 0 })),
    ...parsed.data.largos.map((pid: number) => ({ matchId: match.id, playerId: pid, team: "largos" as const, playerPoints: 0 })),
  ];

  await db.insert(matchPlayersTable).values(playerValues);

  const detail = await buildMatchDetail(match.id);
  res.status(201).json(detail);
});

// POST /matches/import — must be before /:id routes
// Accepts three formats:
// Format A: equipo1: { jugador1, jugador2, puntos }, optional ganador
// Format B: equipo1: [string, string], puntuacion1: number
// Format C: equipo1: { jugadores: [string, ...], puntos: number }
const TeamObjSchema = z.object({ jugadores: z.array(z.string()), puntos: z.number().int().min(0) });

const ImportPartidaSchema = z.union([
  // Format C (jugadores array inside object)
  z.object({
    fecha: z.string(),
    hora: z.string(),
    equipo1: TeamObjSchema,
    equipo2: TeamObjSchema,
    ganador: z.enum(["equipo1", "equipo2"]).optional(),
    lisa: z.boolean().optional(),
  }),
  // Format B (flat arrays + puntuacion1/2)
  z.object({
    fecha: z.string(),
    hora: z.string(),
    equipo1: z.array(z.string()).min(2).max(2),
    puntuacion1: z.number().int().min(0),
    equipo2: z.array(z.string()).min(2).max(2),
    puntuacion2: z.number().int().min(0),
    lisa: z.boolean().optional(),
  }),
  // Format A (jugador1/jugador2 keys)
  z.object({
    fecha: z.string(),
    hora: z.string(),
    equipo1: z.object({ jugador1: z.string().min(1), jugador2: z.string().min(1), puntos: z.number().int().min(0) }),
    equipo2: z.object({ jugador1: z.string().min(1), jugador2: z.string().min(1), puntos: z.number().int().min(0) }),
    ganador: z.enum(["equipo1", "equipo2"]).optional(),
    lisa: z.boolean().optional(),
  }),
]);

const ImportBodySchema = z.object({
  adminCode: z.string(),
  partidas: z.array(ImportPartidaSchema).min(1),
});

router.post("/matches/import", async (req, res): Promise<void> => {
  const parsed = ImportBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Formato JSON inválido", details: parsed.error.issues.map((i) => i.message) });
    return;
  }

  const { adminCode, partidas } = parsed.data;

  if (adminCode !== ADMIN_CODE) {
    res.status(403).json({ error: "Código de administrador inválido" });
    return;
  }

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];
  const affectedPlayerIds = new Set<number>();

  for (const partida of partidas) {
    try {
      const finishedAt = new Date(`${partida.fecha}T${partida.hora}:00`);
      if (isNaN(finishedAt.getTime())) {
        errors.push(`Fecha/hora inválida: ${partida.fecha} ${partida.hora}`);
        continue;
      }

      let e1Names: string[], e2Names: string[], e1Pts: number, e2Pts: number;
      const eq1 = partida.equipo1 as any;
      const eq2 = partida.equipo2 as any;

      if (Array.isArray(eq1)) {
        // Format B: equipo1 is a flat array
        e1Names = eq1 as string[];
        e2Names = eq2 as string[];
        e1Pts = (partida as any).puntuacion1 as number;
        e2Pts = (partida as any).puntuacion2 as number;
      } else if (Array.isArray(eq1.jugadores)) {
        // Format C: equipo1: { jugadores: [...], puntos }
        e1Names = (eq1.jugadores as string[]).filter((n: string) => n.trim().length > 0);
        e2Names = (eq2.jugadores as string[]).filter((n: string) => n.trim().length > 0);
        e1Pts = eq1.puntos as number;
        e2Pts = eq2.puntos as number;
      } else {
        // Format A: equipo1: { jugador1, jugador2, puntos }
        e1Names = [eq1.jugador1, eq1.jugador2];
        e2Names = [eq2.jugador1, eq2.jugador2];
        e1Pts = eq1.puntos;
        e2Pts = eq2.puntos;
      }

      // Need at least 1 player per team to create a meaningful record
      if (e1Names.length === 0 && e2Names.length === 0) {
        errors.push(`Partida ${partida.fecha} ${partida.hora}: ambos equipos sin jugadores, omitida.`);
        continue;
      }

      let winnerTeam: "cortos" | "largos";
      const ganador = (partida as any).ganador as string | undefined;
      if (ganador === "equipo1") winnerTeam = "cortos";
      else if (ganador === "equipo2") winnerTeam = "largos";
      else winnerTeam = e1Pts >= e2Pts ? "cortos" : "largos";

      const allNames = [...e1Names, ...e2Names];
      const playerIds: Record<string, number> = {};
      for (const name of allNames) {
        const [existing] = await db
          .select()
          .from(playersTable)
          .where(sql`lower(${playersTable.name}) = lower(${name})`);
        if (existing) {
          playerIds[name] = existing.id;
        } else {
          const [created] = await db.insert(playersTable).values({ name }).returning();
          playerIds[name] = created.id;
        }
      }

      const sameTimeMatches = await db
        .select({ id: matchesTable.id })
        .from(matchesTable)
        .where(and(eq(matchesTable.status, "finished"), eq(matchesTable.finishedAt, finishedAt)));

      let isDuplicate = false;
      const importPids = new Set(Object.values(playerIds));
      for (const em of sameTimeMatches) {
        const emPlayers = await db
          .select({ playerId: matchPlayersTable.playerId })
          .from(matchPlayersTable)
          .where(eq(matchPlayersTable.matchId, em.id));
        const emPids = new Set(emPlayers.map((p) => p.playerId));
        if (emPids.size === importPids.size && [...importPids].every((id) => emPids.has(id))) {
          isDuplicate = true;
          break;
        }
      }

      if (isDuplicate) {
        skipped++;
        continue;
      }

      const matchNumber = await getNextMatchNumber();
      const [match] = await db
        .insert(matchesTable)
        .values({ matchNumber, status: "finished", shortosScore: e1Pts, largosScore: e2Pts, winnerTeam, createdAt: finishedAt, finishedAt })
        .returning();

      const teamAssignments = [
        ...e1Names.map((name) => ({ name, team: "cortos" as const, points: e1Pts })),
        ...e2Names.map((name) => ({ name, team: "largos" as const, points: e2Pts })),
      ];

      for (const ta of teamAssignments) {
        const pid = playerIds[ta.name];
        if (!pid) continue;
        await db.insert(matchPlayersTable).values({ matchId: match.id, playerId: pid, team: ta.team, playerPoints: ta.points });
        await db.insert(scoreLogTable).values({ matchId: match.id, playerId: pid, team: ta.team, points: ta.points, createdAt: finishedAt });
        affectedPlayerIds.add(pid);
      }

      imported++;
    } catch (err) {
      errors.push(`Error en partida ${partida.fecha} ${partida.hora}: ${String(err)}`);
    }
  }

  for (const pid of affectedPlayerIds) {
    await recalculatePlayerStats(pid);
  }

  res.json({ imported, skipped, errors });
});

// GET /matches/:id
router.get("/matches/:id", async (req, res): Promise<void> => {
  const params = GetMatchParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const detail = await buildMatchDetail(params.data.id);
  if (!detail) {
    res.status(404).json({ error: "Match not found" });
    return;
  }

  res.json(detail);
});

// PATCH /matches/:id (admin)
router.patch("/matches/:id", async (req, res): Promise<void> => {
  const params = UpdateMatchParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateMatchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (parsed.data.adminCode && parsed.data.adminCode !== ADMIN_CODE) {
    res.status(401).json({ error: "Invalid admin code" });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.shortosScore !== undefined) updateData.shortosScore = parsed.data.shortosScore;
  if (parsed.data.largosScore !== undefined) updateData.largosScore = parsed.data.largosScore;
  if (parsed.data.winnerTeam !== undefined) updateData.winnerTeam = parsed.data.winnerTeam;
  if (parsed.data.status !== undefined) updateData.status = parsed.data.status;

  const [match] = await db
    .update(matchesTable)
    .set(updateData)
    .where(eq(matchesTable.id, params.data.id))
    .returning();

  if (!match) {
    res.status(404).json({ error: "Match not found" });
    return;
  }

  // Handle team reassignment if provided
  if (parsed.data.cortos || parsed.data.largos) {
    await db.delete(matchPlayersTable).where(eq(matchPlayersTable.matchId, params.data.id));
    const playerValues = [];
    if (parsed.data.cortos) {
      for (const pid of parsed.data.cortos) {
        playerValues.push({ matchId: params.data.id, playerId: pid, team: "cortos" as const, playerPoints: 0 });
      }
    }
    if (parsed.data.largos) {
      for (const pid of parsed.data.largos) {
        playerValues.push({ matchId: params.data.id, playerId: pid, team: "largos" as const, playerPoints: 0 });
      }
    }
    if (playerValues.length > 0) {
      await db.insert(matchPlayersTable).values(playerValues);
    }
  }

  const detail = await buildMatchDetail(params.data.id);
  res.json(detail);
});

// DELETE /matches/:id (admin)
router.delete("/matches/:id", async (req, res): Promise<void> => {
  const params = DeleteMatchParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = DeleteMatchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (parsed.data.adminCode !== ADMIN_CODE) {
    res.status(401).json({ error: "Invalid admin code" });
    return;
  }

  const [match] = await db
    .delete(matchesTable)
    .where(eq(matchesTable.id, params.data.id))
    .returning();

  if (!match) {
    res.status(404).json({ error: "Match not found" });
    return;
  }

  res.sendStatus(204);
});

// POST /matches/:id/score
router.post("/matches/:id/score", async (req, res): Promise<void> => {
  const params = AddScoreParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = AddScoreBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, params.data.id));
  if (!match) {
    res.status(404).json({ error: "Match not found" });
    return;
  }

  if (match.status === "finished") {
    res.status(400).json({ error: "Match is already finished" });
    return;
  }

  const { playerId, team, points, isQuickThirty } = parsed.data;

  // Calculate new team score
  const currentTeamScore = team === "cortos" ? match.shortosScore : match.largosScore;
  let actualPoints = points;

  // Apply quick-thirty cap: if total would reach 200, cap at 199 for quick-30
  if (isQuickThirty) {
    const projected = currentTeamScore + 30;
    if (projected >= 200) {
      // Cap to 199
      actualPoints = Math.max(0, 199 - currentTeamScore);
    }
  }

  const newTeamScore = currentTeamScore + actualPoints;

  // Insert score log
  await db.insert(scoreLogTable).values({ matchId: params.data.id, playerId, team, points: actualPoints });

  // Update player points in match
  const [mp] = await db
    .select()
    .from(matchPlayersTable)
    .where(and(eq(matchPlayersTable.matchId, params.data.id), eq(matchPlayersTable.playerId, playerId)));

  if (mp) {
    await db
      .update(matchPlayersTable)
      .set({ playerPoints: mp.playerPoints + actualPoints })
      .where(eq(matchPlayersTable.id, mp.id));
  }

  // Update match team score
  const matchUpdate: Record<string, unknown> = {};
  if (team === "cortos") {
    matchUpdate.shortosScore = newTeamScore;
  } else {
    matchUpdate.largosScore = newTeamScore;
  }

  // Check win condition
  if (newTeamScore >= 200) {
    matchUpdate.status = "finished";
    matchUpdate.winnerTeam = team;
    matchUpdate.finishedAt = new Date();
  }

  await db.update(matchesTable).set(matchUpdate).where(eq(matchesTable.id, params.data.id));

  // If match finished, update all player stats
  if (newTeamScore >= 200) {
    const allPlayers = await db
      .select({ playerId: matchPlayersTable.playerId })
      .from(matchPlayersTable)
      .where(eq(matchPlayersTable.matchId, params.data.id));

    for (const p of allPlayers) {
      await recalculatePlayerStats(p.playerId);
    }
  }

  const detail = await buildMatchDetail(params.data.id);
  res.json(detail);
});

// POST /matches/:id/finish
router.post("/matches/:id/finish", async (req, res): Promise<void> => {
  const params = FinishMatchParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, params.data.id));
  if (!match) {
    res.status(404).json({ error: "Match not found" });
    return;
  }

  // Determine winner
  const winnerTeam = match.shortosScore >= match.largosScore ? "cortos" : "largos";

  await db
    .update(matchesTable)
    .set({ status: "finished", winnerTeam, finishedAt: new Date() })
    .where(eq(matchesTable.id, params.data.id));

  // Update all player stats
  const allPlayers = await db
    .select({ playerId: matchPlayersTable.playerId })
    .from(matchPlayersTable)
    .where(eq(matchPlayersTable.matchId, params.data.id));

  for (const p of allPlayers) {
    await recalculatePlayerStats(p.playerId);
  }

  const detail = await buildMatchDetail(params.data.id);
  res.json(detail);
});

// POST /matches/:id/undo-score — remove last score log entry and recalculate totals
router.post("/matches/:id/undo-score", async (req, res): Promise<void> => {
  const params = FinishMatchParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, params.data.id));
  if (!match) {
    res.status(404).json({ error: "Match not found" });
    return;
  }

  if (match.status === "finished") {
    res.status(400).json({ error: "Cannot undo score on a finished match" });
    return;
  }

  // Find the most recent score log entry
  const logs = await db
    .select()
    .from(scoreLogTable)
    .where(eq(scoreLogTable.matchId, params.data.id))
    .orderBy(desc(scoreLogTable.createdAt));

  if (logs.length === 0) {
    res.status(400).json({ error: "No scores to undo" });
    return;
  }

  const lastLog = logs[0];

  // Delete that entry
  await db.delete(scoreLogTable).where(eq(scoreLogTable.id, lastLog.id));

  // Recalculate team scores from remaining log entries
  const remaining = await db
    .select()
    .from(scoreLogTable)
    .where(eq(scoreLogTable.matchId, params.data.id));

  const shortosScore = remaining.filter(l => l.team === "cortos").reduce((sum, l) => sum + l.points, 0);
  const largosScore = remaining.filter(l => l.team === "largos").reduce((sum, l) => sum + l.points, 0);

  await db
    .update(matchesTable)
    .set({ shortosScore, largosScore })
    .where(eq(matchesTable.id, params.data.id));

  // Recalculate player points from remaining log
  await db
    .update(matchPlayersTable)
    .set({ playerPoints: 0 })
    .where(eq(matchPlayersTable.matchId, params.data.id));

  for (const log of remaining) {
    const [mp] = await db
      .select()
      .from(matchPlayersTable)
      .where(and(eq(matchPlayersTable.matchId, params.data.id), eq(matchPlayersTable.playerId, log.playerId)));
    if (mp) {
      await db
        .update(matchPlayersTable)
        .set({ playerPoints: mp.playerPoints + log.points })
        .where(eq(matchPlayersTable.id, mp.id));
    }
  }

  const detail = await buildMatchDetail(params.data.id);
  res.json(detail);
});

// POST /matches/:id/reset — wipe scores and score_log, reactivate the match
router.post("/matches/:id/reset", async (req, res): Promise<void> => {
  const params = FinishMatchParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, params.data.id));
  if (!match) {
    res.status(404).json({ error: "Match not found" });
    return;
  }

  if (match.status === "finished") {
    res.status(400).json({ error: "Cannot reset a finished match" });
    return;
  }

  // Delete all score log entries for this match
  await db.delete(scoreLogTable).where(eq(scoreLogTable.matchId, params.data.id));

  // Reset scores and player points
  await db
    .update(matchesTable)
    .set({ shortosScore: 0, largosScore: 0, status: "active", winnerTeam: null, finishedAt: null })
    .where(eq(matchesTable.id, params.data.id));

  await db
    .update(matchPlayersTable)
    .set({ playerPoints: 0 })
    .where(eq(matchPlayersTable.matchId, params.data.id));

  const detail = await buildMatchDetail(params.data.id);
  res.json(detail);
});

// GET /history (finished matches)
router.get("/history", async (_req, res): Promise<void> => {
  const finishedMatches = await db
    .select()
    .from(matchesTable)
    .where(eq(matchesTable.status, "finished"))
    .orderBy(desc(matchesTable.finishedAt));

  const results = await Promise.all(finishedMatches.map((m) => buildMatchDetail(m.id)));
  res.json(results.filter(Boolean));
});

// GET /ranking
router.get("/ranking", async (_req, res): Promise<void> => {
  const players = await db
    .select()
    .from(playersTable)
    .orderBy(
      desc(playersTable.wins),
      asc(playersTable.losses),
      desc(playersTable.totalPoints),
      desc(playersTable.winRate),
      desc(playersTable.currentStreak),
    );

  const ranked = players.map((player, idx) => ({ position: idx + 1, player }));
  res.json(ranked);
});

export default router;
