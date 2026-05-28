import { Router, type IRouter } from "express";
import { and, eq, or } from "drizzle-orm";
import { db, matchesTable, matchPlayersTable, playersTable } from "@workspace/db";

const router: IRouter = Router();

// GET /lisas — ranking of players by number of "lisa" wins (200-0)
router.get("/lisas", async (req, res): Promise<void> => {
  // Find all finished matches where one team scored 200 and the other 0
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

  // Count lisas per player (only winning team)
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

  if (Object.keys(lisaCountMap).length === 0) {
    res.json([]);
    return;
  }

  // Fetch player info for all players with lisas
  const playerIds = Object.keys(lisaCountMap).map(Number);
  const allPlayers = await db.select().from(playersTable);
  const playerMap = new Map(allPlayers.map((p) => [p.id, p]));

  const ranking = playerIds
    .filter((id) => playerMap.has(id))
    .map((id) => ({
      player: playerMap.get(id)!,
      lisas: lisaCountMap[id],
    }))
    .sort((a, b) => b.lisas - a.lisas || a.player.name.localeCompare(b.player.name));

  res.json(ranking);
});

export default router;
