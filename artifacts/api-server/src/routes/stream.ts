import { Router, type IRouter } from "express";
import { AccessToken, RoomServiceClient } from "livekit-server-sdk";

const router: IRouter = Router();

const ROOM_NAME = "jurones-stream";

function getLiveKitConfig() {
  const url = process.env["LIVEKIT_URL"];
  const apiKey = process.env["LIVEKIT_API_KEY"];
  const apiSecret = process.env["LIVEKIT_API_SECRET"];
  return { url, apiKey, apiSecret };
}

// GET /api/stream/config — check if LiveKit is configured
router.get("/stream/config", (_req, res): void => {
  const { url, apiKey, apiSecret } = getLiveKitConfig();
  res.json({ configured: !!(url && apiKey && apiSecret) });
});

// GET /api/stream/status — check room participant count
router.get("/stream/status", async (_req, res): Promise<void> => {
  const { url, apiKey, apiSecret } = getLiveKitConfig();
  if (!url || !apiKey || !apiSecret) {
    res.json({ active: false, numParticipants: 0, configured: false });
    return;
  }
  try {
    const svc = new RoomServiceClient(url, apiKey, apiSecret);
    const rooms = await svc.listRooms([ROOM_NAME]);
    const room = rooms[0];
    res.json({
      configured: true,
      active: !!room && room.numParticipants > 0,
      numParticipants: room?.numParticipants ?? 0,
    });
  } catch (err) {
    res.json({ configured: true, active: false, numParticipants: 0, error: String(err) });
  }
});

// POST /api/stream/token — generate LiveKit token
router.post("/stream/token", async (req, res): Promise<void> => {
  const { url, apiKey, apiSecret } = getLiveKitConfig();
  if (!url || !apiKey || !apiSecret) {
    res.status(503).json({ error: "LiveKit not configured. Set LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET." });
    return;
  }

  const { identity, name, role } = req.body as {
    identity?: string;
    name?: string;
    role?: "broadcaster" | "viewer";
  };

  if (!identity || !name) {
    res.status(400).json({ error: "identity and name are required" });
    return;
  }

  const isHost = role === "broadcaster";

  const at = new AccessToken(apiKey, apiSecret, {
    identity,
    name,
    ttl: "6h",
  });

  at.addGrant({
    roomJoin: true,
    room: ROOM_NAME,
    canPublish: isHost,
    canSubscribe: true,
    canPublishData: true,
  });

  const token = await at.toJwt();
  res.json({ token, url, room: ROOM_NAME });
});

export default router;
