import { Router, type IRouter } from "express";
import { and, eq, gte, or } from "drizzle-orm";
import { db, matchesTable, matchPlayersTable, playersTable } from "@workspace/db";

const router: IRouter = Router();

// GET /compare/:id1/:id2 — compare two players stats + head-to-head
router.get("/compare/:id1/:id2", async (req, res): Promise<void> => {
  const id1 = parseInt(req.params.id1 ?? "", 10);
  const id2 = parseInt(req.params.id2 ?? "", 10);

  if (isNaN(id1) || isNaN(id2)) {
    res.status(400).json({ error: "IDs de jugador inválidos" });
    return;
  }

  if (id1 === id2) {
    res.status(400).json({ error: "Debes seleccionar dos jugadores distintos" });
    return;
  }

  const [p1] = await db.select().from(playersTable).where(eq(playersTable.id, id1));
  const [p2] = await db.select().from(playersTable).where(eq(playersTable.id, id2));

  if (!p1 || !p2) {
    res.status(404).json({ error: "Jugador no encontrado" });
    return;
  }

  // Finished matches for each player — grab matchId + team + winnerTeam
  const p1Rows = await db
    .select({ matchId: matchPlayersTable.matchId, team: matchPlayersTable.team, winnerTeam: matchesTable.winnerTeam })
    .from(matchPlayersTable)
    .innerJoin(
      matchesTable,
      and(
        eq(matchPlayersTable.matchId, matchesTable.id),
        eq(matchesTable.status, "finished")
      )
    )
    .where(eq(matchPlayersTable.playerId, id1));

  const p2Rows = await db
    .select({ matchId: matchPlayersTable.matchId, team: matchPlayersTable.team, winnerTeam: matchesTable.winnerTeam })
    .from(matchPlayersTable)
    .innerJoin(
      matchesTable,
      and(
        eq(matchPlayersTable.matchId, matchesTable.id),
        eq(matchesTable.status, "finished")
      )
    )
    .where(eq(matchPlayersTable.playerId, id2));

  const p1Map = new Map<number, { team: string; winnerTeam: string | null }>(
    p1Rows.map((r) => [r.matchId, { team: r.team, winnerTeam: r.winnerTeam }])
  );
  const p2Map = new Map<number, { team: string; winnerTeam: string | null }>(
    p2Rows.map((r) => [r.matchId, { team: r.team, winnerTeam: r.winnerTeam }])
  );

  let facedEachOther = 0;
  let playedTogether = 0;
  let h2hWins1 = 0;
  let h2hWins2 = 0;

  for (const [matchId, p1Data] of p1Map) {
    const p2Data = p2Map.get(matchId);
    if (p2Data === undefined) continue;
    if (p1Data.team === p2Data.team) {
      playedTogether++;
    } else {
      facedEachOther++;
      const winner = p1Data.winnerTeam;
      if (winner === p1Data.team) h2hWins1++;
      else if (winner === p2Data.team) h2hWins2++;
    }
  }

  // Lisa matches — winning team scored ≥200 while loser scored 0
  const lisaMatchRows = await db
    .select({
      id: matchesTable.id,
      winnerTeam: matchesTable.winnerTeam,
    })
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

  let p1Lisas = p1.extraLisas;
  let p2Lisas = p2.extraLisas;

  for (const lm of lisaMatchRows) {
    if (!lm.winnerTeam) continue;
    if (p1Map.get(lm.id)?.team === lm.winnerTeam) p1Lisas++;
    if (p2Map.get(lm.id)?.team === lm.winnerTeam) p2Lisas++;
  }

  res.json({
    player1: { ...p1, lisas: p1Lisas },
    player2: { ...p2, lisas: p2Lisas },
    facedEachOther,
    playedTogether,
    h2hWins1,
    h2hWins2,
  });
});

export default router;
