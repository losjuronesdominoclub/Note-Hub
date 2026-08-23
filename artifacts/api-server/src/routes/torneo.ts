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
    if (!name?.trim()) {
      res.status(400).json({ error: "Nombre requerido" });
      return;
    }
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
    if (!tournament) {
      res.status(404).json({ error: "Torneo no encontrado" });
      return;
    }

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
    if (!name?.trim() || !player1?.trim() || !player2?.trim()) {
      res.status(400).json({ error: "Nombre, jugador1 y jugador2 requeridos" });
      return;
    }

    const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tournamentId));
    if (!tournament) {
      res.status(404).json({ error: "Torneo no encontrado" });
      return;
    }
    if (tournament.status !== "setup") {
      res.status(400).json({ error: "El torneo ya inició" });
      return;
    }

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
    if (!tournament) {
      res.status(404).json({ error: "Torneo no encontrado" });
      return;
    }
    if (tournament.status !== "setup") {
      res.status(400).json({ error: "El torneo ya inició" });
      return;
    }
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
    if (!tournament) {
      res.status(404).json({ error: "Torneo no encontrado" });
      return;
    }
    if (tournament.status !== "setup") {
      res.status(400).json({ error: "El torneo ya inició" });
      return;
    }

    const teams = await db.select().from(tournamentTeamsTable).where(eq(tournamentTeamsTable.tournamentId, tournamentId));
    if (teams.length < 2) {
      res.status(400).json({ error: "Se necesitan al menos 2 equipos" });
      return;
    }

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
      const isBye = (t1 !== null && t2 === null) || (t1 === null && t2 === null);
      matchInserts.push({
        tournamentId,
        round: 1,
        position: pos,
        team1Id: t1?.id ?? null,
        team2Id: t2?.id ?? null,
        winnerId: isBye && t1 ? t1.id : null,
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
    const r1Byes = matchInserts.filter((m) => m.round === 1 && m.status === "bye" && m.winnerId);
    for (const byeMatch of r1Byes) {
      await propagateWinner(tournamentId, byeMatch.round, byeMatch.position, byeMatch.winnerId, totalRounds);
    }

    // Mark tournament active
    await db.update(tournamentsTable).set({ status: "active" }).where(eq(tournamentsTable.id, tournamentId));

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al iniciar torneo" });
  }
});

type BracketSlotInput = {
  matchId: number;
  team1Id: number | null;
  team2Id: number | null;
};

function isTeamId(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function normalizedSlot(slot: BracketSlotInput) {
  if (slot.team1Id || !slot.team2Id) return slot;
  return { ...slot, team1Id: slot.team2Id, team2Id: null };
}

async function propagateWinner(
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

  const team1Id = isLeft ? winnerId : nextMatch.team1Id;
  const team2Id = isLeft ? nextMatch.team2Id : winnerId;
  const siblingHasParticipant = await branchHasPotential(
    tournamentId,
    fromRound,
    isLeft ? fromPosition + 1 : fromPosition - 1
  );
  const hasOpponent = isLeft ? Boolean(nextMatch.team2Id) : Boolean(nextMatch.team1Id);
  const shouldAutoAdvance = !hasOpponent && !siblingHasParticipant;

  await db
    .update(tournamentMatchesTable)
    .set({
      team1Id,
      team2Id,
      winnerId: shouldAutoAdvance ? winnerId : null,
      team1Score: null,
      team2Score: null,
      status: shouldAutoAdvance ? "bye" : "pending",
    })
    .where(eq(tournamentMatchesTable.id, nextMatch.id));

  if (shouldAutoAdvance) {
    await propagateWinner(tournamentId, nextRound, nextPosition, winnerId, maxRound);
  }
}

async function branchHasPotential(tournamentId: number, round: number, position: number): Promise<boolean> {
  if (position < 0) return false;

  const [match] = await db
    .select()
    .from(tournamentMatchesTable)
    .where(
      and(
        eq(tournamentMatchesTable.tournamentId, tournamentId),
        eq(tournamentMatchesTable.round, round),
        eq(tournamentMatchesTable.position, position),
        eq(tournamentMatchesTable.isThirdPlace, false)
      )
    );

  if (!match) return false;
  if (match.team1Id || match.team2Id) return true;
  if (round === 1) return false;

  return (
    (await branchHasPotential(tournamentId, round - 1, position * 2)) ||
    (await branchHasPotential(tournamentId, round - 1, position * 2 + 1))
  );
}

// ─── Manually edit the bracket's opening-round positions ──────────────────────
router.put("/:id/bracket", async (req, res) => {
  try {
    const tournamentId = parseInt(req.params.id);
    const requestedSlots = req.body?.slots;

    if (!Array.isArray(requestedSlots)) {
      res.status(400).json({ error: "Se requiere la lista de posiciones del bracket" });
      return;
    }

    const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tournamentId));
    if (!tournament) {
      res.status(404).json({ error: "Torneo no encontrado" });
      return;
    }

    const [teams, matches] = await Promise.all([
      db.select().from(tournamentTeamsTable).where(eq(tournamentTeamsTable.tournamentId, tournamentId)),
      db.select().from(tournamentMatchesTable).where(eq(tournamentMatchesTable.tournamentId, tournamentId)),
    ]);

    const firstRound = matches
      .filter((match) => !match.isThirdPlace && match.round === 1)
      .sort((a, b) => a.position - b.position);

    if (firstRound.length === 0) {
      res.status(400).json({ error: "Primero inicia el torneo para crear el bracket" });
      return;
    }
    if (requestedSlots.length !== firstRound.length) {
      res.status(400).json({ error: "El bracket debe conservar todas sus posiciones" });
      return;
    }

    const validMatchIds = new Set(firstRound.map((match) => match.id));
    const slots: BracketSlotInput[] = [];
    const seenMatchIds = new Set<number>();
    const selectedTeamIds: number[] = [];

    for (const rawSlot of requestedSlots) {
      if (!rawSlot || !isTeamId(rawSlot.matchId) || !validMatchIds.has(rawSlot.matchId) || seenMatchIds.has(rawSlot.matchId)) {
        res.status(400).json({ error: "Las posiciones del bracket no son válidas" });
        return;
      }
      if ((rawSlot.team1Id !== null && !isTeamId(rawSlot.team1Id)) || (rawSlot.team2Id !== null && !isTeamId(rawSlot.team2Id))) {
        res.status(400).json({ error: "Los equipos seleccionados no son válidos" });
        return;
      }
      if (rawSlot.team1Id && rawSlot.team1Id === rawSlot.team2Id) {
        res.status(400).json({ error: "Un equipo no puede enfrentarse consigo mismo" });
        return;
      }

      const slot = normalizedSlot({
        matchId: rawSlot.matchId,
        team1Id: rawSlot.team1Id ?? null,
        team2Id: rawSlot.team2Id ?? null,
      });
      slots.push(slot);
      seenMatchIds.add(slot.matchId);
      if (slot.team1Id) selectedTeamIds.push(slot.team1Id);
      if (slot.team2Id) selectedTeamIds.push(slot.team2Id);
    }

    const validTeamIds = new Set(teams.map((team) => team.id));
    if (selectedTeamIds.some((teamId) => !validTeamIds.has(teamId))) {
      res.status(400).json({ error: "Solo puedes usar equipos de este torneo" });
      return;
    }
    if (new Set(selectedTeamIds).size !== selectedTeamIds.length) {
      res.status(400).json({ error: "Cada equipo solo puede ocupar una posición de la primera ronda" });
      return;
    }
    if (selectedTeamIds.length !== teams.length || selectedTeamIds.some((teamId) => !validTeamIds.has(teamId))) {
      res.status(400).json({ error: "Todos los equipos registrados deben estar ubicados una sola vez" });
      return;
    }

    const currentById = new Map(firstRound.map((match) => [match.id, match]));
    const changedSlotIds = slots
      .filter((slot) => {
        const current = currentById.get(slot.matchId)!;
        return current.team1Id !== slot.team1Id || current.team2Id !== slot.team2Id;
      })
      .map((slot) => slot.matchId);

    const needsEmptySlotResolution = slots.some((slot) => {
      const current = currentById.get(slot.matchId)!;
      return !slot.team1Id && !slot.team2Id && current.status !== "bye";
    });

    if (changedSlotIds.length === 0 && !needsEmptySlotResolution) {
      res.json({ ok: true, changed: false, invalidatedResults: false });
      return;
    }

    const maxRound = Math.max(...matches.filter((match) => !match.isThirdPlace).map((match) => match.round));
    const hadDependentResults = matches.some(
      (match) => match.round > 1 && !match.isThirdPlace && (match.status === "finished" || match.status === "bye")
    );

    await db.transaction(async (tx) => {
      // Every later round is derived from opening-round results, so reset it before
      // propagating the first-round winners that remain valid.
      await tx
        .update(tournamentMatchesTable)
        .set({
          team1Id: null,
          team2Id: null,
          winnerId: null,
          team1Score: null,
          team2Score: null,
          status: "pending",
        })
        .where(
          and(
            eq(tournamentMatchesTable.tournamentId, tournamentId),
            eq(tournamentMatchesTable.isThirdPlace, false),
            eq(tournamentMatchesTable.round, 2)
          )
        );

      for (let round = 3; round <= maxRound; round++) {
        await tx
          .update(tournamentMatchesTable)
          .set({
            team1Id: null,
            team2Id: null,
            winnerId: null,
            team1Score: null,
            team2Score: null,
            status: "pending",
          })
          .where(
            and(
              eq(tournamentMatchesTable.tournamentId, tournamentId),
              eq(tournamentMatchesTable.isThirdPlace, false),
              eq(tournamentMatchesTable.round, round)
            )
          );
      }

      await tx
        .update(tournamentMatchesTable)
        .set({
          team1Id: null,
          team2Id: null,
          winnerId: null,
          team1Score: null,
          team2Score: null,
          status: "pending",
        })
        .where(
          and(
            eq(tournamentMatchesTable.tournamentId, tournamentId),
            eq(tournamentMatchesTable.isThirdPlace, true)
          )
        );

      for (const slot of slots) {
        const current = currentById.get(slot.matchId)!;
        const unchanged = current.team1Id === slot.team1Id && current.team2Id === slot.team2Id;
        const isBye = !slot.team1Id || !slot.team2Id;
        if (unchanged && !(isBye && current.status !== "bye")) continue;

        await tx
          .update(tournamentMatchesTable)
          .set({
            team1Id: slot.team1Id,
            team2Id: slot.team2Id,
            winnerId: isBye ? slot.team1Id : null,
            team1Score: null,
            team2Score: null,
            status: isBye ? "bye" : "pending",
          })
          .where(eq(tournamentMatchesTable.id, slot.matchId));
      }

      await tx
        .update(tournamentsTable)
        .set({ status: "active", finishedAt: null })
        .where(eq(tournamentsTable.id, tournamentId));
    });

    // Rebuild later rounds from all still-valid opening-round winners and byes.
    const refreshedFirstRound = await db
      .select()
      .from(tournamentMatchesTable)
      .where(and(eq(tournamentMatchesTable.tournamentId, tournamentId), eq(tournamentMatchesTable.round, 1)));

    for (const match of refreshedFirstRound.sort((a, b) => a.position - b.position)) {
      if (match.winnerId && (match.status === "finished" || match.status === "bye")) {
        await propagateWinner(tournamentId, match.round, match.position, match.winnerId, maxRound);
      }
    }

    res.json({
      ok: true,
      changed: true,
      invalidatedResults: hadDependentResults || changedSlotIds.some((id) => currentById.get(id)?.status === "finished"),
      preservedFirstRoundResults: firstRound.filter(
        (match) => !changedSlotIds.includes(match.id) && match.status === "finished"
      ).length,
    });
  } catch (err) {
    req.log.error({ err }, "Error al editar bracket");
    res.status(500).json({ error: "Error al guardar los cambios del bracket" });
  }
});

// ─── Register match result ────────────────────────────────────────────────────
router.patch("/partidas/:matchId", async (req, res) => {
  try {
    const matchId = parseInt(req.params.matchId);
    const { team1Score, team2Score } = req.body;

    if (team1Score === undefined || team2Score === undefined || team1Score === team2Score) {
      res.status(400).json({ error: "Puntajes requeridos y deben ser diferentes" });
      return;
    }

    const [match] = await db
      .select()
      .from(tournamentMatchesTable)
      .where(eq(tournamentMatchesTable.id, matchId));

    if (!match) {
      res.status(404).json({ error: "Partida no encontrada" });
      return;
    }
    if (match.status === "finished") {
      res.status(400).json({ error: "Partida ya finalizada" });
      return;
    }
    if (!match.team1Id || !match.team2Id) {
      res.status(400).json({ error: "Equipos no asignados" });
      return;
    }

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
      await propagateWinner(match.tournamentId, match.round, match.position, winnerId, maxRound);

      // If semifinal (one round before final), send loser to 3rd place
      if (match.round === maxRound - 1 && thirdPlaceMatch) {
        const loserSlot: any = !thirdPlaceMatch.team1Id ? { team1Id: loserId } : { team2Id: loserId };
        await db.update(tournamentMatchesTable).set(loserSlot).where(eq(tournamentMatchesTable.id, thirdPlaceMatch.id));

        const siblingSemifinal = mainMatches.find(
          (candidate) =>
            candidate.round === match.round &&
            candidate.position === (match.position % 2 === 0 ? match.position + 1 : match.position - 1)
        );
        const siblingCannotLose =
          !siblingSemifinal ||
          siblingSemifinal.status === "bye" ||
          !siblingSemifinal.team1Id ||
          !siblingSemifinal.team2Id;

        if (siblingCannotLose) {
          await db
            .update(tournamentMatchesTable)
            .set({ winnerId: loserId, team1Score: null, team2Score: null, status: "bye" })
            .where(eq(tournamentMatchesTable.id, thirdPlaceMatch.id));
        }
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
