import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, eventsTable } from "@workspace/db";
import {
  CreateEventBody,
  UpdateEventParams,
  UpdateEventBody,
  DeleteEventParams,
  AttendEventParams,
  AttendEventBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/events", async (_req, res): Promise<void> => {
  const events = await db.select().from(eventsTable).orderBy(eventsTable.date);
  res.json(events);
});

router.post("/events", async (req, res): Promise<void> => {
  const parsed = CreateEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [event] = await db
    .insert(eventsTable)
    .values({
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      date: parsed.data.date,
      time: parsed.data.time ?? null,
      location: parsed.data.location ?? null,
      mapsUrl: parsed.data.mapsUrl ?? null,
      attendees: [],
    })
    .returning();

  res.status(201).json(event);
});

router.patch("/events/:id", async (req, res): Promise<void> => {
  const params = UpdateEventParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) updateData.title = parsed.data.title;
  if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
  if (parsed.data.date !== undefined) updateData.date = parsed.data.date;
  if (parsed.data.time !== undefined) updateData.time = parsed.data.time;
  if (parsed.data.location !== undefined) updateData.location = parsed.data.location;
  if (parsed.data.mapsUrl !== undefined) updateData.mapsUrl = parsed.data.mapsUrl;

  const [event] = await db
    .update(eventsTable)
    .set(updateData)
    .where(eq(eventsTable.id, params.data.id))
    .returning();

  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  res.json(event);
});

router.delete("/events/:id", async (req, res): Promise<void> => {
  const params = DeleteEventParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [event] = await db.delete(eventsTable).where(eq(eventsTable.id, params.data.id)).returning();
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  res.sendStatus(204);
});

router.post("/events/:id/attend", async (req, res): Promise<void> => {
  const params = AttendEventParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = AttendEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db.select().from(eventsTable).where(eq(eventsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  const attendees = existing.attendees ?? [];
  const name = parsed.data.attendeeName;

  let newAttendees: string[];
  if (attendees.includes(name)) {
    newAttendees = attendees.filter((a) => a !== name);
  } else {
    newAttendees = [...attendees, name];
  }

  const [event] = await db
    .update(eventsTable)
    .set({ attendees: newAttendees })
    .where(eq(eventsTable.id, params.data.id))
    .returning();

  res.json(event);
});

export default router;
