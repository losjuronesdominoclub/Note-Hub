import type { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { logger } from "./lib/logger";

const STREAM_ROOM = "jurones-stream";

export function setupSocket(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    path: "/api/socket.io/",
    cors: { origin: true, credentials: true },
  });

  // Per-room state
  const streamActive = { value: false };
  const viewerSet = new Set<string>();

  function broadcastViewerCount() {
    io.to(STREAM_ROOM).emit("viewer-count", viewerSet.size);
  }

  io.on("connection", (socket) => {
    logger.info({ socketId: socket.id }, "Socket connected");

    // Send current stream state immediately
    socket.emit("stream-status", { active: streamActive.value });
    socket.emit("viewer-count", viewerSet.size);

    socket.on("join-stream", () => {
      socket.join(STREAM_ROOM);
      viewerSet.add(socket.id);
      broadcastViewerCount();
    });

    socket.on("stream-start", () => {
      streamActive.value = true;
      io.to(STREAM_ROOM).emit("stream-status", { active: true });
      logger.info("Stream started");
    });

    socket.on("stream-stop", () => {
      streamActive.value = false;
      io.to(STREAM_ROOM).emit("stream-status", { active: false });
      logger.info("Stream stopped");
    });

    socket.on("chat-message", (data: { name: string; text: string }) => {
      if (!data.text?.trim() || !data.name?.trim()) return;
      const message = {
        id: Date.now(),
        name: data.name.trim().substring(0, 30),
        text: data.text.trim().substring(0, 200),
        ts: Date.now(),
      };
      io.to(STREAM_ROOM).emit("chat-message", message);
    });

    socket.on("disconnect", () => {
      viewerSet.delete(socket.id);
      broadcastViewerCount();
      logger.info({ socketId: socket.id }, "Socket disconnected");
    });
  });

  return io;
}
