import { Router, type IRouter } from "express";
import { and, eq, isNull } from "drizzle-orm";
import { db, matchesTable, matchPlayersTable, playersTable } from "@workspace/db";

const router: IRouter = Router();

// GET /teams-vs/:a1/:a2/:b1/:b2
// Head-to-head stats for two pairs (a1+a2 vs b1+b2)
router.get("/teams-vs/:a1/:a2/:b1/:b2", async (req, res): Promise<void> => {
  const a1 = parseInt(req.params.a1 ?? "", 10);
  const a2 = parseInt(req.params.a2 ?? "", 10);
  const b1 = parseInt(req.params.b1 ?? "", 10);
  const b2 = parseInt(req.params.b2 ?? "", 10);

  if ([a1, a2, b1, b2].some((n) => isNaN(n))) {
    res.status(400).json({ error: "IDs de jugador inválidos" });
    return;
  }

  const pairA = [a1, a2].sort((x, y) => x - y) as [number, number];
  const pairB = [b1, b2].sort((x, y) => x - y) as [number, number];

  if (new Set([...pairA, ...pairB]).size < 4) {
    res.status(400).json({ error: "Las parejas no pueden compartir jugadores" });
    return;
  }

  const allPlayers = await db.select().from(playersTable);
  const playerMap = Object.fromEntries(allPlayers.map((p) => [p.id, p]));

  const [pa1, pa2, pb1, pb2] = [
    playerMap[pairA[0]],
    playerMap[pairA[1]],
    playerMap[pairB[0]],
    playerMap[pairB[1]],
  ];

  if (!pa1 || !pa2 || !pb1 || !pb2) {
    res.status(404).json({ error: "Jugador no encontrado" });
    return;
  }

  // All finished match-player rows (non-substituted)
  const rows = await db
    .select({
      matchId: matchPlayersTable.matchId,
      playerId: matchPlayersTable.playerId,
      team: matchPlayersTable.team,
      winnerTeam: matchesTable.winnerTeam,
      shortosScore: matchesTable.shortosScore,
      largosScore: matchesTable.largosScore,
    })
    .from(matchPlayersTable)
    .innerJoin(
      matchesTable,
      and(
        eq(matchPlayersTable.matchId, matchesTable.id),
        eq(matchesTable.status, "finished")
      )
    )
    .where(isNull(matchPlayersTable.substitutedAt));

  // Group by matchId
  const matchMap: Record<
    number,
    {
      winnerTeam: string | null;
      shortosScore: number;
      largosScore: number;
      players: { playerId: number; team: string }[];
    }
  > = {};

  for (const row of rows) {
    if (!matchMap[row.matchId]) {
      matchMap[row.matchId] = {
        winnerTeam: row.winnerTeam,
        shortosScore: row.shortosScore,
        largosScore: row.largosScore,
        players: [],
      };
    }
    matchMap[row.matchId].players.push({ playerId: row.playerId, team: row.team });
  }

  let facedEachOther = 0;
  let pairAWins = 0;
  let pairBWins = 0;
  let pairALisas = 0;
  let pairBLisas = 0;

  for (const m of Object.values(matchMap)) {
    const ids = m.players.map((p) => p.playerId);
    if (
      !ids.includes(pairA[0]) ||
      !ids.includes(pairA[1]) ||
      !ids.includes(pairB[0]) ||
      !ids.includes(pairB[1])
    )
      continue;

    const getTeam = (pid: number) =>
      m.players.find((p) => p.playerId === pid)?.team;

    const teamA1 = getTeam(pairA[0]);
    const teamA2 = getTeam(pairA[1]);
    const teamB1 = getTeam(pairB[0]);
    const teamB2 = getTeam(pairB[1]);

    // Both members of each pair must be on the same team, and the two pairs on opposite teams
    if (teamA1 !== teamA2 || teamB1 !== teamB2 || teamA1 === teamB1) continue;

    facedEachOther++;

    const pairATeam = teamA1!;
    const pairBTeam = teamB1!;

    if (m.winnerTeam === pairATeam) pairAWins++;
    else if (m.winnerTeam === pairBTeam) pairBWins++;

    // Lisa: winning team scored ≥200, loser scored 0
    const isLisa =
      m.winnerTeam !== null &&
      ((m.shortosScore >= 200 && m.largosScore === 0) ||
        (m.largosScore >= 200 && m.shortosScore === 0));

    if (isLisa) {
      if (m.winnerTeam === pairATeam) pairALisas++;
      else if (m.winnerTeam === pairBTeam) pairBLisas++;
    }
  }

  res.json({
    pairA: {
      p1: { id: pa1.id, name: pa1.name, avatarUrl: pa1.avatarUrl ?? null },
      p2: { id: pa2.id, name: pa2.name, avatarUrl: pa2.avatarUrl ?? null },
      wins: pairAWins,
      losses: pairBWins,
      lisas: pairALisas,
    },
    pairB: {
      p1: { id: pb1.id, name: pb1.name, avatarUrl: pb1.avatarUrl ?? null },
      p2: { id: pb2.id, name: pb2.name, avatarUrl: pb2.avatarUrl ?? null },
      wins: pairBWins,
      losses: pairAWins,
      lisas: pairBLisas,
    },
    facedEachOther,
  });
});

export default router;
