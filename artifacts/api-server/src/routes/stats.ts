import { Router, type IRouter } from "express";
import { eq, desc, count, gt, and, isNull } from "drizzle-orm";
import { db, playersTable, matchesTable, scoreLogTable, matchPlayersTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/stats/dashboard", async (_req, res): Promise<void> => {
  const [totalPlayersRow] = await db.select({ count: count() }).from(playersTable);
  const [totalMatchesRow] = await db.select({ count: count() }).from(matchesTable);
  const [activeMatchesRow] = await db
    .select({ count: count() })
    .from(matchesTable)
    .where(eq(matchesTable.status, "active"));

  const totalPlayers = totalPlayersRow?.count ?? 0;
  const totalMatches = totalMatchesRow?.count ?? 0;
  const activeMatches = activeMatchesRow?.count ?? 0;

  // Top player by wins — only players with at least 1 win
  const [topPlayer] = await db
    .select()
    .from(playersTable)
    .where(gt(playersTable.wins, 0))
    .orderBy(desc(playersTable.wins))
    .limit(1);

  // Top pair: fetch all finished match-player rows (non-substituted) in one query
  const winnerRows = await db
    .select({
      matchId: matchPlayersTable.matchId,
      playerId: matchPlayersTable.playerId,
      team: matchPlayersTable.team,
      winnerTeam: matchesTable.winnerTeam,
    })
    .from(matchPlayersTable)
    .innerJoin(matchesTable, eq(matchPlayersTable.matchId, matchesTable.id))
    .where(and(eq(matchesTable.status, "finished"), isNull(matchPlayersTable.substitutedAt)));

  // Group rows by match, then count wins per sorted pair
  const matchMap: Record<number, { winnerTeam: string | null; players: Array<{ playerId: number; team: string }> }> = {};
  for (const row of winnerRows) {
    if (!matchMap[row.matchId]) matchMap[row.matchId] = { winnerTeam: row.winnerTeam, players: [] };
    matchMap[row.matchId].players.push({ playerId: row.playerId, team: row.team });
  }

  const pairWins: Record<string, number> = {};
  for (const m of Object.values(matchMap)) {
    if (!m.winnerTeam) continue;
    const ids = m.players
      .filter(p => p.team === m.winnerTeam)
      .map(p => p.playerId)
      .sort((a, b) => a - b);
    if (ids.length === 2) {
      const key = `${ids[0]}-${ids[1]}`;
      pairWins[key] = (pairWins[key] ?? 0) + 1;
    }
  }

  let topPair = null;
  const topKey = Object.keys(pairWins).sort((a, b) => pairWins[b] - pairWins[a])[0];
  if (topKey) {
    const [id1, id2] = topKey.split("-").map(Number);
    const [[p1], [p2]] = await Promise.all([
      db.select().from(playersTable).where(eq(playersTable.id, id1)),
      db.select().from(playersTable).where(eq(playersTable.id, id2)),
    ]);
    if (p1 && p2) {
      topPair = {
        player1Id: p1.id, player1Name: p1.name, player1AvatarUrl: p1.avatarUrl ?? null,
        player2Id: p2.id, player2Name: p2.name, player2AvatarUrl: p2.avatarUrl ?? null,
        wins: pairWins[topKey],
      };
    }
  }

  res.json({
    totalPlayers,
    totalMatches,
    activeMatches,
    totalGamesPlayed: totalMatches,
    topPlayer: topPlayer ?? null,
    topPair,
  });
});

router.get("/stats/teams", async (_req, res): Promise<void> => {
  // Fetch all finished match-player rows (non-substituted) with player info
  const rows = await db
    .select({
      matchId: matchPlayersTable.matchId,
      playerId: matchPlayersTable.playerId,
      team: matchPlayersTable.team,
      winnerTeam: matchesTable.winnerTeam,
      playerName: playersTable.name,
      playerAvatarUrl: playersTable.avatarUrl,
    })
    .from(matchPlayersTable)
    .innerJoin(matchesTable, eq(matchPlayersTable.matchId, matchesTable.id))
    .innerJoin(playersTable, eq(matchPlayersTable.playerId, playersTable.id))
    .where(and(eq(matchesTable.status, "finished"), isNull(matchPlayersTable.substitutedAt)));

  // Group rows by match
  const matchMap: Record<number, {
    winnerTeam: string | null;
    players: Array<{ playerId: number; team: string; name: string; avatarUrl: string | null }>;
  }> = {};
  for (const row of rows) {
    if (!matchMap[row.matchId]) matchMap[row.matchId] = { winnerTeam: row.winnerTeam, players: [] };
    matchMap[row.matchId].players.push({ playerId: row.playerId, team: row.team, name: row.playerName, avatarUrl: row.playerAvatarUrl ?? null });
  }

  // Accumulate wins and losses per pair
  const pairStats: Record<string, { wins: number; losses: number; p1Id: number; p1Name: string; p1Avatar: string | null; p2Id: number; p2Name: string; p2Avatar: string | null }> = {};

  for (const m of Object.values(matchMap)) {
    if (!m.winnerTeam) continue;
    const loserTeam = m.winnerTeam === "cortos" ? "largos" : "cortos";

    const winPair = m.players.filter(p => p.team === m.winnerTeam).sort((a, b) => a.playerId - b.playerId);
    const losePair = m.players.filter(p => p.team === loserTeam).sort((a, b) => a.playerId - b.playerId);

    for (const [pair, isWin] of [[winPair, true], [losePair, false]] as [typeof winPair, boolean][]) {
      if (pair.length !== 2) continue;
      const [p1, p2] = pair;
      const key = `${p1.playerId}-${p2.playerId}`;
      if (!pairStats[key]) {
        pairStats[key] = { wins: 0, losses: 0, p1Id: p1.playerId, p1Name: p1.name, p1Avatar: p1.avatarUrl, p2Id: p2.playerId, p2Name: p2.name, p2Avatar: p2.avatarUrl };
      }
      if (isWin) pairStats[key].wins++;
      else pairStats[key].losses++;
    }
  }

  const ranked = Object.values(pairStats)
    .map(s => {
      const total = s.wins + s.losses;
      return { ...s, total, winRate: total > 0 ? s.wins / total : 0 };
    })
    .sort((a, b) => b.wins - a.wins || b.winRate - a.winRate || a.losses - b.losses);

  res.json(ranked);
});

router.get("/stats/activity", async (_req, res): Promise<void> => {
  const logs = await db
    .select({
      id: scoreLogTable.id,
      matchId: scoreLogTable.matchId,
      matchNumber: matchesTable.matchNumber,
      playerId: scoreLogTable.playerId,
      playerName: playersTable.name,
      team: scoreLogTable.team,
      points: scoreLogTable.points,
      createdAt: scoreLogTable.createdAt,
    })
    .from(scoreLogTable)
    .innerJoin(playersTable, eq(scoreLogTable.playerId, playersTable.id))
    .innerJoin(matchesTable, eq(scoreLogTable.matchId, matchesTable.id))
    .orderBy(desc(scoreLogTable.createdAt))
    .limit(50);

  res.json(logs);
});

export default router;
