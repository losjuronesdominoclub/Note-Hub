import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, rulesConfigTable } from "@workspace/db";

const router: IRouter = Router();

const RULES_KEY = "segments";

router.get("/rules", async (_req, res): Promise<void> => {
  const [row] = await db
    .select()
    .from(rulesConfigTable)
    .where(eq(rulesConfigTable.key, RULES_KEY));

  if (!row) {
    res.json(null);
    return;
  }
  res.json(row.segments);
});

router.put("/rules", async (req, res): Promise<void> => {
  const segments = req.body;
  if (!Array.isArray(segments)) {
    res.status(400).json({ error: "segments must be an array" });
    return;
  }

  await db
    .insert(rulesConfigTable)
    .values({ key: RULES_KEY, segments })
    .onConflictDoUpdate({
      target: rulesConfigTable.key,
      set: { segments, updatedAt: new Date() },
    });

  res.json({ ok: true });
});

export default router;
