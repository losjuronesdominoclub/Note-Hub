import { Router, type IRouter } from "express";
import { eq, max, asc, sql } from "drizzle-orm";
import { db, playersTable, turnosTable } from "@workspace/db";
import z from "zod";

const router: IRouter = Router();

router.get("/turnos", async (req, res): Promise<void> => {
  const rows = await db.transaction(async (tx) => {
    // Serialize queue cleanup and inserts across requests/processes.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(730421)`);
    // Keep the earliest queue entry for each player and discard any legacy duplicates.
    await tx.execute(sql`
      DELETE FROM turnos AS turno
      USING (
        SELECT id,
          ROW_NUMBER() OVER (
            PARTITION BY player_id
            ORDER BY position ASC, arrived_at ASC, id ASC
          ) AS duplicate_rank
        FROM turnos
      ) AS ranked
      WHERE turno.id = ranked.id AND ranked.duplicate_rank > 1
    `);
    return tx
      .select({
        id: turnosTable.id,
        position: turnosTable.position,
        arrivedAt: turnosTable.arrivedAt,
        player: {
          id: playersTable.id,
          name: playersTable.name,
          avatarUrl: playersTable.avatarUrl,
        },
      })
      .from(turnosTable)
      .innerJoin(playersTable, eq(turnosTable.playerId, playersTable.id))
      .orderBy(asc(turnosTable.position), asc(turnosTable.arrivedAt), asc(turnosTable.id));
  });
  res.json(rows);
});

router.post("/turnos", async (req, res): Promise<void> => {
  const body = z.object({ playerId: z.number().int().positive() }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "playerId requerido" });
    return;
  }

  const inserted = await db.transaction(async (tx) => {
    // Match the lock used by GET cleanup so concurrent adds cannot race.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(730421)`);
    const existing = await tx
      .select({ id: turnosTable.id })
      .from(turnosTable)
      .where(eq(turnosTable.playerId, body.data.playerId))
      .limit(1);
    if (existing.length > 0) return null;

    const maxRow = await tx.select({ val: max(turnosTable.position) }).from(turnosTable);
    const nextPos = (maxRow[0]?.val ?? 0) + 1;
    return tx.insert(turnosTable).values({
      playerId: body.data.playerId,
      position: nextPos,
    }).returning();
  });
  if (!inserted) {
    res.status(409).json({ error: "Jugador ya está en la lista de turnos" });
    return;
  }
  res.status(201).json(inserted[0]);
});

router.delete("/turnos/clear", async (_req, res): Promise<void> => {
  await db.delete(turnosTable);
  res.status(204).send();
});

router.delete("/turnos/:playerId", async (req, res): Promise<void> => {
  const playerId = parseInt(req.params.playerId, 10);
  if (isNaN(playerId)) {
    res.status(400).json({ error: "playerId inválido" });
    return;
  }
  await db.delete(turnosTable).where(eq(turnosTable.playerId, playerId));
  res.status(204).send();
});

const ReorderBody = z.object({ order: z.array(z.number().int().positive()).min(1) });

router.patch("/turnos/reorder", async (req, res): Promise<void> => {
  const body = ReorderBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "order debe ser un array de playerIds" });
    return;
  }
  await Promise.all(
    body.data.order.map((playerId, idx) =>
      db.update(turnosTable).set({ position: idx + 1 }).where(eq(turnosTable.playerId, playerId))
    )
  );
  res.status(204).send();
});

export default router;
