import { Router, type IRouter } from "express";
import { eq, desc, inArray } from "drizzle-orm";
import { db, matchesTable, matchPlayersTable, playersTable } from "@workspace/db";

const router: IRouter = Router();

/** Convert a Date to a local yyyy-mm-dd string in the given IANA timezone. */
function toLocalDateStr(date: Date, tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
    return `${get("year")}-${get("month")}-${get("day")}`;
  } catch {
    // Fallback to UTC if tz is invalid
    return date.toISOString().slice(0, 10);
  }
}

// GET /daily-results?tz=America/Santo_Domingo
// Returns match results grouped by local calendar day (descending), with per-player G/P/Lisas
router.get("/daily-results", async (req, res): Promise<void> => {
  const tz = typeof req.query.tz === "string" && req.query.tz ? req.query.tz : "UTC";

  const finishedMatches = await db
    .select()
    .from(matchesTable)
    .where(eq(matchesTable.status, "finished"))
    .orderBy(desc(matchesTable.finishedAt));

  if (finishedMatches.length === 0) {
    res.json([]);
    return;
  }

  const matchIds = finishedMatches.map((m) => m.id);
  const allMatchPlayers = await db
    .select()
    .from(matchPlayersTable)
    .where(inArray(matchPlayersTable.matchId, matchIds));

  const allPlayers = await db.select().from(playersTable);
  const playerMap = new Map(allPlayers.map((p) => [p.id, p]));
  const matchMap = new Map(finishedMatches.map((m) => [m.id, m]));

  // Group matches by local calendar date in the client's timezone
  const dateGroupMap = new Map<string, number[]>();
  for (const match of finishedMatches) {
    const ts = match.finishedAt ?? match.createdAt;
    const dateStr = toLocalDateStr(new Date(ts), tz);
    if (!dateGroupMap.has(dateStr)) dateGroupMap.set(dateStr, []);
    dateGroupMap.get(dateStr)!.push(match.id);
  }

  const sortedDates = Array.from(dateGroupMap.keys()).sort((a, b) => b.localeCompare(a));

  const results = sortedDates.map((date) => {
    const dayMatchIds = new Set(dateGroupMap.get(date)!);
    const dayMatchPlayers = allMatchPlayers.filter((mp) => dayMatchIds.has(mp.matchId));

    type Stats = { wins: number; losses: number; lisas: number };
    const playerDayMap = new Map<number, Stats>();

    for (const mp of dayMatchPlayers) {
      if (!playerDayMap.has(mp.playerId)) {
        playerDayMap.set(mp.playerId, { wins: 0, losses: 0, lisas: 0 });
      }
      const match = matchMap.get(mp.matchId);
      if (!match) continue;
      const stats = playerDayMap.get(mp.playerId)!;

      if (match.winnerTeam === mp.team) {
        stats.wins++;
        const isLisa =
          (match.shortosScore >= 200 && match.largosScore === 0) ||
          (match.largosScore >= 200 && match.shortosScore === 0);
        if (isLisa) stats.lisas++;
      } else if (match.winnerTeam != null) {
        stats.losses++;
      }
    }

    const players = Array.from(playerDayMap.entries())
      .map(([playerId, stats]) => {
        const player = playerMap.get(playerId);
        if (!player) return null;
        return {
          playerId,
          name: player.name,
          avatarUrl: player.avatarUrl ?? null,
          wins: stats.wins,
          losses: stats.losses,
          lisas: stats.lisas,
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.wins - a.wins || b.lisas - a.lisas || a.losses - b.losses);

    return { date, players };
  });

  res.json(results);
});

export default router;
