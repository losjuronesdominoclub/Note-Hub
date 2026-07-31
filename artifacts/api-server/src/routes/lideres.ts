import { Router, type IRouter } from "express";
import { isNotNull, desc } from "drizzle-orm";
import { db, playersTable } from "@workspace/db";

const router: IRouter = Router();

// GET /lideres — throne-time leaderboard
router.get("/lideres", async (_req, res): Promise<void> => {
  const players = await db
    .select({
      id: playersTable.id,
      name: playersTable.name,
      avatarUrl: playersTable.avatarUrl,
      wins: playersTable.wins,
      throneTimeSeconds: playersTable.throneTimeSeconds,
      topSince: playersTable.topSince,
      hidden: playersTable.hidden,
    })
    .from(playersTable);

  const now = Date.now();

  const entries = players
    .filter((p) => !p.hidden)
    .map((p) => {
      const isCurrent = p.topSince !== null;
      const liveSeconds = isCurrent
        ? Math.floor((now - new Date(p.topSince!).getTime()) / 1000)
        : 0;
      const totalSeconds = (p.throneTimeSeconds ?? 0) + liveSeconds;
      return {
        playerId: p.id,
        name: p.name,
        avatarUrl: p.avatarUrl ?? null,
        totalSeconds,
        isCurrent,
        topSince: p.topSince ? p.topSince.toISOString() : null,
      };
    })
    .filter((e) => e.totalSeconds > 0 || e.isCurrent)
    .sort((a, b) => {
      // Current leader always first if tied
      if (b.totalSeconds !== a.totalSeconds) return b.totalSeconds - a.totalSeconds;
      if (a.isCurrent) return -1;
      if (b.isCurrent) return 1;
      return 0;
    })
    .map((e, i) => ({ position: i + 1, ...e }));

  res.json(entries);
});

export default router;
