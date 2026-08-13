import { Router, type IRouter } from "express";
import { db, tournamentsTable, tournamentTeamsTable, tournamentMatchesTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

const router: IRouter = Router();

// ─── List tournaments ─────────────────────────────────────────────────────────
router.get("/", async (_req, res) => {
  try {
    const tournaments = await db.select().from(tournamentsTable).orderBy(desc(tournamentsTable.createdAt));
    const teams = await db.select().from(tournamentTeamsTable);
    const result = tournaments.map((t) => ({
      ...t,
      teamCount: teams.filter((tm) => tm.tournamentId === t.id).length,
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Error al cargar torneos" });
  }
});

// ─── Create tournament ────────────────────────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "Nombre requerido" });
    const [t] = await db.insert(tournamentsTable).values({ name: name.trim(), status: "setup" }).returning();
    res.status(201).json(t);
  } catch (err) {
    res.status(500).json({ error: "Error al crear torneo" });
  }
});

// ─── Get tournament detail ────────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, id));
    if (!tournament) return res.status(404).json({ error: "Torneo no encontrado" });

    const teams = await db.select().from(tournamentTeamsTable).where(eq(tournamentTeamsTable.tournamentId, id));
    const matches = await db.select().from(tournamentMatchesTable).where(eq(tournamentMatchesTable.tournamentId, id));

    const teamMap = new Map(teams.map((t) => [t.id, t]));
    const enrichedMatches = matches.map((m) => ({
      ...m,
      team1: m.team1Id ? teamMap.get(m.team1Id) ?? null : null,
      team2: m.team2Id ? teamMap.get(m.team2Id) ?? null : null,
      winner: m.winnerId ? teamMap.get(m.winnerId) ?? null : null,
    }));

    res.json({ ...tournament, teams, matches: enrichedMatches });
  } catch (err) {
    res.status(500).json({ error: "Error al cargar torneo" });
  }
});

// ─── Delete tournament ────────────────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(tournamentsTable).where(eq(tournamentsTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar torneo" });
  }
});

// ─── Add team ─────────────────────────────────────────────────────────────────
router.post("/:id/equipos", async (req, res) => {
  try {
    const tournamentId = parseInt(req.params.id);
    const { name, player1, player2 } = req.body;
    if (!name?.trim() || !player1?.trim() || !player2?.trim())
      return res.status(400).json({ error: "Nombre, jugador1 y jugador2 requeridos" });

    const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tournamentId));
    if (!tournament) return res.status(404).json({ error: "Torneo no encontrado" });
    if (tournament.status !== "setup") return res.status(400).json({ error: "El torneo ya inició" });

    const [team] = await db
      .insert(tournamentTeamsTable)
      .values({ tournamentId, name: name.trim(), player1: player1.trim(), player2: player2.trim() })
      .returning();
    res.status(201).json(team);
  } catch (err) {
    res.status(500).json({ error: "Error al agregar equipo" });
  }
});

// ─── Remove team ──────────────────────────────────────────────────────────────
router.delete("/:id/equipos/:teamId", async (req, res) => {
  try {
    const tournamentId = parseInt(req.params.id);
    const teamId = parseInt(req.params.teamId);
    const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tournamentId));
    if (!tournament) return res.status(404).json({ error: "Torneo no encontrado" });
    if (tournament.status !== "setup") return res.status(400).json({ error: "El torneo ya inició" });
    await db
      .delete(tournamentTeamsTable)
      .where(and(eq(tournamentTeamsTable.id, teamId), eq(tournamentTeamsTable.tournamentId, tournamentId)));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar equipo" });
  }
});

// ─── Start tournament (generate bracket) ─────────────────────────────────────
router.post("/:id/iniciar", async (req, res) => {
  try {
    const tournamentId = parseInt(req.params.id);
    const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tournamentId));
    if (!tournament) return res.status(404).json({ error: "Torneo no encontrado" });
    if (tournament.status !== "setup") return res.status(400).json({ error: "El torneo ya inició" });

    const teams = await db.select().from(tournamentTeamsTable).where(eq(tournamentTeamsTable.tournamentId, tournamentId));
    if (teams.length < 2) return res.status(400).json({ error: "Se necesitan al menos 2 equipos" });

    // Shuffle teams
    const shuffled = [...teams].sort(() => Math.random() - 0.5);

    // Next power of 2
    let capacity = 1;
    while (capacity < shuffled.length) capacity *= 2;
    const totalRounds = Math.log2(capacity);

    // Pad with nulls
    while (shuffled.length < capacity) (shuffled as any[]).push(null);

    const matchInserts: any[] = [];

    // Round 1
    for (let pos = 0; pos < capacity / 2; pos++) {
      const t1 = shuffled[pos * 2];
      const t2 = shuffled[pos * 2 + 1];
      const isBye = t1 !== null && t2 === null;
      matchInserts.push({
        tournamentId,
        round: 1,
        position: pos,
        team1Id: t1?.id ?? null,
        team2Id: t2?.id ?? null,
        winnerId: isBye ? t1.id : null,
        team1Score: null,
        team2Score: null,
        status: isBye ? "bye" : "pending",
        isThirdPlace: false,
      });
    }

    // Subsequent rounds
    for (let round = 2; round <= totalRounds; round++) {
      const count = capacity / Math.pow(2, round);
      for (let pos = 0; pos < count; pos++) {
        matchInserts.push({
          tournamentId,
          round,
          position: pos,
          team1Id: null,
          team2Id: null,
          winnerId: null,
          team1Score: null,
          team2Score: null,
          status: "pending",
          isThirdPlace: false,
        });
      }
    }

    // 3rd place match (only if totalRounds >= 2)
    if (totalRounds >= 2) {
      matchInserts.push({
        tournamentId,
        round: totalRounds,
        position: 999,
        team1Id: null,
        team2Id: null,
        winnerId: null,
        team1Score: null,
        team2Score: null,
        status: "pending",
        isThirdPlace: true,
      });
    }

    await db.insert(tournamentMatchesTable).values(matchInserts);

    // Propagate bye wins
    const r1Byes = matchInserts.filter((m) => m.round === 1 && m.status === "bye");
    for (const byeMatch of r1Byes) {
      // Need to get inserted matches to propagate
      await propagateByeWinner(tournamentId, byeMatch.round, byeMatch.position, byeMatch.winnerId, totalRounds);
    }

    // Mark tournament active
    await db.update(tournamentsTable).set({ status: "active" }).where(eq(tournamentsTable.id, tournamentId));

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al iniciar torneo" });
  }
});

async function propagateByeWinner(
  tournamentId: number,
  fromRound: number,
  fromPosition: number,
  winnerId: number,
  maxRound: number
) {
  if (fromRound >= maxRound) return;

  const nextRound = fromRound + 1;
  const nextPosition = Math.floor(fromPosition / 2);
  const isLeft = fromPosition % 2 === 0;

  const [nextMatch] = await db
    .select()
    .from(tournamentMatchesTable)
    .where(
      and(
        eq(tournamentMatchesTable.tournamentId, tournamentId),
        eq(tournamentMatchesTable.round, nextRound),
        eq(tournamentMatchesTable.position, nextPosition),
        eq(tournamentMatchesTable.isThirdPlace, false)
      )
    );

  if (!nextMatch) return;

  const update: any = isLeft ? { team1Id: winnerId } : { team2Id: winnerId };
  const team1Id = isLeft ? winnerId : nextMatch.team1Id;
  const team2Id = isLeft ? nextMatch.team2Id : winnerId;

  if (team1Id && !team2Id) {
    // Another bye
    update.winnerId = team1Id;
    update.status = "bye";
    await db.update(tournamentMatchesTable).set(update).where(eq(tournamentMatchesTable.id, nextMatch.id));
    await propagateByeWinner(tournamentId, nextRound, nextPosition, team1Id, maxRound);
  } else {
    await db.update(tournamentMatchesTable).set(update).where(eq(tournamentMatchesTable.id, nextMatch.id));
  }
}

// ─── Register match result ────────────────────────────────────────────────────
router.patch("/partidas/:matchId", async (req, res) => {
  try {
    const matchId = parseInt(req.params.matchId);
    const { team1Score, team2Score } = req.body;

    if (team1Score === undefined || team2Score === undefined || team1Score === team2Score)
      return res.status(400).json({ error: "Puntajes requeridos y deben ser diferentes" });

    const [match] = await db
      .select()
      .from(tournamentMatchesTable)
      .where(eq(tournamentMatchesTable.id, matchId));

    if (!match) return res.status(404).json({ error: "Partida no encontrada" });
    if (match.status === "finished") return res.status(400).json({ error: "Partida ya finalizada" });
    if (!match.team1Id || !match.team2Id) return res.status(400).json({ error: "Equipos no asignados" });

    const winnerId = team1Score > team2Score ? match.team1Id : match.team2Id;
    const loserId = winnerId === match.team1Id ? match.team2Id : match.team1Id;

    await db
      .update(tournamentMatchesTable)
      .set({ team1Score, team2Score, winnerId, status: "finished" })
      .where(eq(tournamentMatchesTable.id, matchId));

    // Get all matches for context
    const allMatches = await db
      .select()
      .from(tournamentMatchesTable)
      .where(eq(tournamentMatchesTable.tournamentId, match.tournamentId));

    const mainMatches = allMatches.filter((m) => !m.isThirdPlace);
    const maxRound = Math.max(...mainMatches.map((m) => m.round));
    const thirdPlaceMatch = allMatches.find((m) => m.isThirdPlace);

    // Propagate winner to next round
    if (!match.isThirdPlace && match.round < maxRound) {
      const nextRound = match.round + 1;
      const nextPosition = Math.floor(match.position / 2);
      const isLeft = match.position % 2 === 0;

      const nextMatch = mainMatches.find((m) => m.round === nextRound && m.position === nextPosition);
      if (nextMatch) {
        const update: any = isLeft ? { team1Id: winnerId } : { team2Id: winnerId };
        await db.update(tournamentMatchesTable).set(update).where(eq(tournamentMatchesTable.id, nextMatch.id));
      }

      // If semifinal (one round before final), send loser to 3rd place
      if (match.round === maxRound - 1 && thirdPlaceMatch) {
        const loserSlot: any = !thirdPlaceMatch.team1Id ? { team1Id: loserId } : { team2Id: loserId };
        await db.update(tournamentMatchesTable).set(loserSlot).where(eq(tournamentMatchesTable.id, thirdPlaceMatch.id));
      }
    }

    // Check if tournament is complete
    const updatedMatches = await db
      .select()
      .from(tournamentMatchesTable)
      .where(eq(tournamentMatchesTable.tournamentId, match.tournamentId));

    const allDone = updatedMatches.every((m) => m.status === "finished" || m.status === "bye");
    if (allDone) {
      await db
        .update(tournamentsTable)
        .set({ status: "finished", finishedAt: new Date() })
        .where(eq(tournamentsTable.id, match.tournamentId));
    }

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al registrar resultado" });
  }
});

// ─── Reset tournament to setup ────────────────────────────────────────────────
router.post("/:id/reiniciar", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(tournamentMatchesTable).where(eq(tournamentMatchesTable.tournamentId, id));
    await db.update(tournamentsTable).set({ status: "setup", finishedAt: null }).where(eq(tournamentsTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Error al reiniciar torneo" });
  }
});

export default router;
