import { Router, type IRouter } from "express";
import { eq, desc, count } from "drizzle-orm";
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

  // Top player by wins
  const [topPlayer] = await db
    .select()
    .from(playersTable)
    .orderBy(desc(playersTable.wins))
    .limit(1);

  res.json({
    totalPlayers,
    totalMatches,
    activeMatches,
    totalGamesPlayed: totalMatches,
    topPlayer: topPlayer ?? null,
  });
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
