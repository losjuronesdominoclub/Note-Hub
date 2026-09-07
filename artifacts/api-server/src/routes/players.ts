import { Router, type IRouter } from "express";
import { and, eq, gte, or, sql } from "drizzle-orm";
import { db, matchesTable, matchPlayersTable, playersTable } from "@workspace/db";
import {
  GetPlayerParams,
  UpdatePlayerParams,
  DeletePlayerParams,
  CreatePlayerBody,
  UpdatePlayerBody,
} from "@workspace/api-zod";
import z from "zod";

const ADMIN_CODE = process.env.ADMIN_CODE ?? "110880";

const ImportJugadorSchema = z.object({
  nombre: z.string().min(1),
  victorias: z.number().int().min(0),
  derrotas: z.number().int().min(0),
  racha: z.number().int().min(0).optional(),
});

const ImportJugadoresBody = z.object({
  adminCode: z.string(),
  jugadores: z.array(ImportJugadorSchema).min(1),
});

const PlayerStatisticsParams = z.object({
  id: z.coerce.number().int().positive(),
});

const UpdatePlayerStatisticsBody = z.object({
  adminCode: z.string().min(1),
  wins: z.number().int().min(0),
  losses: z.number().int().min(0),
  lisas: z.number().int().min(0),
  averagePoints: z.number().finite().min(0),
  winRate: z.number().finite().min(0).max(100),
  totalPoints: z.number().int().min(0),
  topPts: z.number().int().min(0),
  currentStreak: z.number().int().min(0),
  gamesPlayed: z.number().int().min(0),
});

const router: IRouter = Router();

router.get("/players", async (req, res): Promise<void> => {
  const players = await db.select().from(playersTable).orderBy(playersTable.name);
  res.json(players);
});

// POST /players/import — must be before /:id routes
router.post("/players/import", async (req, res): Promise<void> => {
  const parsed = ImportJugadoresBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Formato inválido", details: parsed.error.message });
    return;
  }
  if (parsed.data.adminCode !== ADMIN_CODE) {
    res.status(403).json({ error: "Código de administrador inválido." });
    return;
  }

  const { jugadores } = parsed.data;
  let updated = 0;
  let notFound = 0;
  const errors: string[] = [];

  for (const j of jugadores) {
    try {
      const [player] = await db
        .select()
        .from(playersTable)
        .where(sql`lower(${playersTable.name}) = lower(${j.nombre})`);

      if (!player) {
        notFound++;
        errors.push(`Jugador no encontrado: "${j.nombre}"`);
        continue;
      }

      const total = j.victorias + j.derrotas;
      const winRate = total > 0 ? j.victorias / total : 0;
      const updateData: Record<string, unknown> = {
        wins: j.victorias,
        losses: j.derrotas,
        winRate,
      };
      if (j.racha !== undefined) updateData.currentStreak = j.racha;

      await db.update(playersTable).set(updateData).where(eq(playersTable.id, player.id));
      updated++;
    } catch (err) {
      errors.push(`Error actualizando "${j.nombre}": ${String(err)}`);
    }
  }

  res.json({ updated, notFound, errors });
});

router.post("/players", async (req, res): Promise<void> => {
  const parsed = CreatePlayerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [player] = await db
    .insert(playersTable)
    .values({
      name: parsed.data.name,
      avatarUrl: parsed.data.avatarUrl ?? null,
    })
    .returning();

  res.status(201).json(player);
});

// PATCH /players/:id/statistics — deliberately separate from general player edits.
// This retains admin-code verification on the server even when developer UI is exposed.
router.patch("/players/:id/statistics", async (req, res): Promise<void> => {
  const params = PlayerStatisticsParams.safeParse(req.params);
  if (!params.success) {
    req.log.warn({ errors: params.error.message }, "Invalid player statistics parameters");
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdatePlayerStatisticsBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid player statistics payload");
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (parsed.data.adminCode !== ADMIN_CODE) {
    req.log.warn({ playerId: params.data.id }, "Rejected player statistics update with invalid admin code");
    res.status(403).json({ error: "Código de administrador inválido." });
    return;
  }

  const lisaMatches = await db
    .select()
    .from(matchesTable)
    .where(
      and(
        eq(matchesTable.status, "finished"),
        or(
          and(gte(matchesTable.shortosScore, 200), eq(matchesTable.largosScore, 0)),
          and(gte(matchesTable.largosScore, 200), eq(matchesTable.shortosScore, 0)),
        ),
      ),
    );

  let matchDerivedLisas = 0;
  for (const match of lisaMatches) {
    if (!match.winnerTeam) continue;
    const winningPlayer = await db
      .select({ playerId: matchPlayersTable.playerId })
      .from(matchPlayersTable)
      .where(
        and(
          eq(matchPlayersTable.matchId, match.id),
          eq(matchPlayersTable.team, match.winnerTeam as "cortos" | "largos"),
          eq(matchPlayersTable.playerId, params.data.id),
        ),
      );
    matchDerivedLisas += winningPlayer.length;
  }

  const extraLisas = parsed.data.lisas - matchDerivedLisas;
  const [player] = await db
    .update(playersTable)
    .set({
      wins: parsed.data.wins,
      losses: parsed.data.losses,
      extraLisas,
      averagePointsOverride: parsed.data.averagePoints,
      gamesPlayedOverride: parsed.data.gamesPlayed,
      // The UI supplies a percentage; the database consistently stores 0–1.
      winRate: parsed.data.winRate / 100,
      totalPoints: parsed.data.totalPoints,
      topPts: parsed.data.topPts,
      currentStreak: parsed.data.currentStreak,
    })
    .where(eq(playersTable.id, params.data.id))
    .returning();

  if (!player) {
    res.status(404).json({ error: "Player not found" });
    return;
  }

  req.log.info({ playerId: player.id }, "Player statistics updated");
  res.json({ player, lisas: matchDerivedLisas + extraLisas });
});

router.get("/players/:id", async (req, res): Promise<void> => {
  const params = GetPlayerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [player] = await db.select().from(playersTable).where(eq(playersTable.id, params.data.id));
  if (!player) {
    res.status(404).json({ error: "Player not found" });
    return;
  }

  res.json(player);
});

router.patch("/players/:id", async (req, res): Promise<void> => {
  const params = UpdatePlayerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdatePlayerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.avatarUrl !== undefined) updateData.avatarUrl = parsed.data.avatarUrl;
  if (parsed.data.hidden !== undefined) updateData.hidden = parsed.data.hidden;

  const [player] = await db
    .update(playersTable)
    .set(updateData)
    .where(eq(playersTable.id, params.data.id))
    .returning();

  if (!player) {
    res.status(404).json({ error: "Player not found" });
    return;
  }

  res.json(player);
});

router.delete("/players/:id", async (req, res): Promise<void> => {
  const params = DeletePlayerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [player] = await db
    .delete(playersTable)
    .where(eq(playersTable.id, params.data.id))
    .returning();

  if (!player) {
    res.status(404).json({ error: "Player not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
