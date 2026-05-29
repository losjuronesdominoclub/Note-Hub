import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  Room,
  RoomEvent,
  Track,
  createLocalVideoTrack,
  createLocalAudioTrack,
  type LocalVideoTrack,
  type LocalAudioTrack,
  type RemoteTrack,
} from "livekit-client";
import { io, type Socket } from "socket.io-client";
import {
  Tv2,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Radio,
  Users,
  Send,
  LogOut,
  SwitchCamera,
  Eye,
  ShieldCheck,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUser } from "@clerk/react";

const ADMIN_CODE = "110880";
const ROOM_NAME = "jurones-stream";

interface LiveMatch {
  id: number;
  shortosScore: number;
  largosScore: number;
  status: string;
  type: string;
}

interface ChatMessage {
  id: number;
  name: string;
  text: string;
  ts: number;
}

type AppState =
  | "idle"
  | "admin-gate"
  | "connecting"
  | "live"
  | "error";

// ─── Score overlay pulled from live matches ───────────────────────────────────
function ScoreOverlay() {
  const { data: matches } = useQuery<LiveMatch[]>({
    queryKey: ["matches-live-overlay"],
    queryFn: async () => {
      const r = await fetch("/api/matches?status=in_progress");
      return r.ok ? r.json() : [];
    },
    refetchInterval: 5000,
  });

  const live = matches?.[0];
  if (!live) return null;

  return (
    <div
      className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 px-4 py-2 rounded-xl text-white font-bold text-lg shadow-2xl"
      style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.12)" }}
    >
      <span className="text-yellow-400">{live.type === "cortos" ? "Cortos" : "Largos"}</span>
      <span className="text-2xl tabular-nums">{live.shortosScore}</span>
      <span className="text-muted-foreground text-sm">vs</span>
      <span className="text-2xl tabular-nums">{live.largosScore}</span>
      <span className="ml-1 text-xs bg-red-600 px-2 py-0.5 rounded-full animate-pulse">EN VIVO</span>
    </div>
  );
}

// ─── Admin code gate ──────────────────────────────────────────────────────────
function AdminGate({ onUnlock, onCancel }: { onUnlock: () => void; onCancel: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code === ADMIN_CODE) {
      onUnlock();
    } else {
      setError(true);
      setTimeout(() => setError(false), 1500);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center gap-6 p-8 rounded-2xl glass-card border border-border/40 max-w-sm mx-auto"
    >
      <ShieldCheck className="h-12 w-12 text-yellow-400" />
      <div className="text-center">
        <h3 className="text-lg font-bold">Modo Transmisor</h3>
        <p className="text-muted-foreground text-sm mt-1">Ingresa el código de administrador para iniciar el stream.</p>
      </div>
      <form onSubmit={handleSubmit} className="w-full space-y-3">
        <Input
          type="password"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Código"
          className={`text-center tracking-widest text-lg ${error ? "border-red-500" : ""}`}
          autoFocus
        />
        {error && <p className="text-red-400 text-xs text-center">Código incorrecto</p>}
        <Button type="submit" className="w-full">Desbloquear</Button>
      </form>
      <Button variant="ghost" size="sm" onClick={onCancel} className="text-muted-foreground">
        Cancelar
      </Button>
    </motion.div>
  );
}

// ─── Chat panel ───────────────────────────────────────────────────────────────
function ChatPanel({ socket, userName }: { socket: Socket | null; userName: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!socket) return;
    const handler = (msg: ChatMessage) => {
      setMessages((prev) => [...prev.slice(-99), msg]);
    };
    socket.on("chat-message", handler);
    return () => { socket.off("chat-message", handler); };
  }, [socket]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !socket) return;
    socket.emit("chat-message", { name: userName, text: input.trim() });
    setInput("");
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-2 p-3 min-h-0">
        {messages.length === 0 && (
          <p className="text-center text-muted-foreground text-xs mt-4">Chat vacío. ¡Sé el primero en escribir!</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className="text-sm">
            <span className="font-semibold text-yellow-400">{m.name}: </span>
            <span>{m.text}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={send} className="flex gap-2 p-3 border-t border-border/30">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Mensaje..."
          className="text-sm h-8"
          maxLength={200}
        />
        <Button type="submit" size="icon" className="h-8 w-8 shrink-0">
          <Send className="h-3 w-3" />
        </Button>
      </form>
    </div>
  );
}

// ─── Main Stream page ─────────────────────────────────────────────────────────
export default function StreamPage() {
  const { user } = useUser();
  const userName = user?.fullName ?? user?.username ?? "Espectador";

  // LiveKit state
  const roomRef = useRef<Room | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoTrackRef = useRef<LocalVideoTrack | null>(null);
  const localAudioTrackRef = useRef<LocalAudioTrack | null>(null);

  // Socket.io
  const socketRef = useRef<Socket | null>(null);

  // UI state
  const [appState, setAppState] = useState<AppState>("idle");
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminGate, setShowAdminGate] = useState(false);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [remoteActive, setRemoteActive] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [currentCamIdx, setCurrentCamIdx] = useState(0);
  const [showChat, setShowChat] = useState(false);

  // Check LiveKit config on mount
  useEffect(() => {
    fetch("/api/stream/config")
      .then((r) => r.json())
      .then((d) => setConfigured(d.configured))
      .catch(() => setConfigured(false));
  }, []);

  // Connect Socket.io on mount
  useEffect(() => {
    const s = io({ path: "/api/socket.io/", reconnection: true, reconnectionDelay: 2000 });
    socketRef.current = s;

    s.on("connect", () => {
      setSocketConnected(true);
      s.emit("join-stream");
    });
    s.on("disconnect", () => setSocketConnected(false));
    s.on("viewer-count", (n: number) => setViewerCount(n));
    s.on("stream-status", ({ active }: { active: boolean }) => {
      if (!isAdmin) setRemoteActive(active);
    });

    return () => { s.disconnect(); };
  }, []);

  // Enumerate cameras
  useEffect(() => {
    navigator.mediaDevices?.enumerateDevices().then((devices) => {
      setCameras(devices.filter((d) => d.kind === "videoinput"));
    });
  }, []);

  const getToken = async (role: "broadcaster" | "viewer") => {
    const res = await fetch("/api/stream/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identity: user?.id ?? `viewer-${Date.now()}`,
        name: userName,
        role,
      }),
    });
    if (!res.ok) throw new Error((await res.json()).error ?? "Token error");
    return res.json() as Promise<{ token: string; url: string }>;
  };

  const connectToRoom = useCallback(async (role: "broadcaster" | "viewer") => {
    setAppState("connecting");
    setErrorMsg("");
    try {
      const { token, url } = await getToken(role);

      const room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;

      if (role === "viewer") {
        room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
          if (track.kind === Track.Kind.Video && remoteVideoRef.current) {
            track.attach(remoteVideoRef.current);
            setRemoteActive(true);
          }
          if (track.kind === Track.Kind.Audio) {
            const el = track.attach();
            document.body.appendChild(el);
          }
        });
        room.on(RoomEvent.TrackUnsubscribed, () => setRemoteActive(false));
        room.on(RoomEvent.ParticipantDisconnected, () => {
          if (room.remoteParticipants.size === 0) setRemoteActive(false);
        });
      }

      room.on(RoomEvent.Disconnected, () => {
        setAppState("idle");
        setRemoteActive(false);
      });

      await room.connect(url, token);

      if (role === "broadcaster") {
        const camDevice = cameras[currentCamIdx];
        const videoTrack = await createLocalVideoTrack(
          camDevice ? { deviceId: camDevice.deviceId } : undefined
        );
        const audioTrack = await createLocalAudioTrack();
        localVideoTrackRef.current = videoTrack;
        localAudioTrackRef.current = audioTrack;

        await room.localParticipant.publishTrack(videoTrack);
        await room.localParticipant.publishTrack(audioTrack);

        if (localVideoRef.current) videoTrack.attach(localVideoRef.current);

        socketRef.current?.emit("stream-start");
      }

      setAppState("live");
    } catch (err: any) {
      setErrorMsg(err?.message ?? "Error de conexión");
      setAppState("error");
    }
  }, [cameras, currentCamIdx, userName, user]);

  const stopBroadcast = useCallback(async () => {
    localVideoTrackRef.current?.stop();
    localAudioTrackRef.current?.stop();
    await roomRef.current?.disconnect();
    roomRef.current = null;
    socketRef.current?.emit("stream-stop");
    setAppState("idle");
    setRemoteActive(false);
  }, []);

  const toggleMute = useCallback(() => {
    const track = localAudioTrackRef.current;
    if (!track) return;
    if (muted) track.unmute();
    else track.mute();
    setMuted((m) => !m);
  }, [muted]);

  const toggleCamera = useCallback(() => {
    const track = localVideoTrackRef.current;
    if (!track) return;
    if (cameraOff) track.unmute();
    else track.mute();
    setCameraOff((c) => !c);
  }, [cameraOff]);

  const switchCamera = useCallback(async () => {
    if (cameras.length < 2 || !localVideoTrackRef.current) return;
    const nextIdx = (currentCamIdx + 1) % cameras.length;
    setCurrentCamIdx(nextIdx);
    const nextCam = cameras[nextIdx];
    await localVideoTrackRef.current.restartTrack({ deviceId: nextCam.deviceId });
  }, [cameras, currentCamIdx]);

  // ─── Render ────────────────────────────────────────────────────────────────
  const isLive = appState === "live";

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Tv2 className="h-8 w-8 text-red-500" />
            Stream
            {isLive && isAdmin && (
              <span className="flex items-center gap-1.5 text-sm font-bold text-red-400 animate-pulse">
                <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                EN VIVO
              </span>
            )}
          </h1>
          <p className="text-muted-foreground mt-1">Transmisión en vivo de Los Jurones Domino Club.</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Eye className="h-4 w-4" />
          <span className="font-bold">{viewerCount}</span>
          <span className="hidden sm:inline">espectadores</span>
        </div>
      </div>

      {/* Not configured warning */}
      {configured === false && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/8"
        >
          <AlertCircle className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-yellow-300">LiveKit no configurado</p>
            <p className="text-sm text-muted-foreground mt-1">
              Para activar el streaming debes configurar tres secretos en el proyecto:
              <code className="mx-1 text-yellow-400">LIVEKIT_URL</code>,
              <code className="mx-1 text-yellow-400">LIVEKIT_API_KEY</code> y
              <code className="mx-1 text-yellow-400">LIVEKIT_API_SECRET</code>.
              Crea una cuenta gratuita en{" "}
              <a href="https://livekit.io/cloud" target="_blank" rel="noreferrer" className="underline text-yellow-400">
                livekit.io/cloud
              </a>{" "}
              y copia las credenciales de tu proyecto.
            </p>
          </div>
        </motion.div>
      )}

      {/* Admin gate dialog */}
      <AnimatePresence>
        {showAdminGate && (
          <AdminGate
            onUnlock={() => { setIsAdmin(true); setShowAdminGate(false); }}
            onCancel={() => setShowAdminGate(false)}
          />
        )}
      </AnimatePresence>

      {/* Main content */}
      {!showAdminGate && (
        <div className={`flex flex-col ${showChat ? "lg:flex-row" : ""} gap-4`}>

          {/* Video area */}
          <div className="flex-1 min-w-0">
            <div
              className="relative w-full rounded-2xl overflow-hidden bg-black"
              style={{ aspectRatio: "16/9" }}
            >
              {/* Local video (broadcaster) */}
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className={`absolute inset-0 w-full h-full object-cover ${isLive && isAdmin ? "block" : "hidden"}`}
              />
              {/* Remote video (viewer) */}
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className={`absolute inset-0 w-full h-full object-cover ${isLive && !isAdmin ? "block" : "hidden"}`}
              />

              {/* Placeholder when idle */}
              {!isLive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                  <Tv2 className="h-16 w-16 opacity-20" />
                  {appState === "connecting" ? (
                    <div className="flex items-center gap-2 text-sm">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Conectando...
                    </div>
                  ) : appState === "error" ? (
                    <p className="text-red-400 text-sm text-center px-4">{errorMsg}</p>
                  ) : (
                    <p className="text-sm opacity-60">Sin transmisión activa</p>
                  )}
                </div>
              )}

              {/* Viewer: no remote yet */}
              {isLive && !isAdmin && !remoteActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <Radio className="h-10 w-10 opacity-20 animate-pulse" />
                  <p className="text-sm opacity-60">Esperando al transmisor...</p>
                </div>
              )}

              {/* LIVE badge */}
              {isLive && (
                <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-red-600 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                  <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                  EN VIVO
                </div>
              )}

              {/* Viewer count badge */}
              {isLive && (
                <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/60 text-white text-xs font-semibold px-2.5 py-1 rounded-full">
                  <Users className="h-3 w-3" />
                  {viewerCount}
                </div>
              )}

              {/* Score overlay */}
              {isLive && <ScoreOverlay />}
            </div>

            {/* Controls */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              {/* Left: mode/action buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                {!isLive && !isAdmin && configured !== false && (
                  <>
                    <Button
                      onClick={() => connectToRoom("viewer")}
                      disabled={appState === "connecting"}
                      variant="outline"
                      className="gap-2"
                    >
                      {appState === "connecting" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                      Ver Stream
                    </Button>
                    <Button
                      onClick={() => setShowAdminGate(true)}
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground gap-1"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      Transmisor
                    </Button>
                  </>
                )}

                {!isLive && isAdmin && configured !== false && (
                  <Button
                    onClick={() => connectToRoom("broadcaster")}
                    disabled={appState === "connecting"}
                    className="gap-2 bg-red-600 hover:bg-red-700 text-white"
                  >
                    {appState === "connecting" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radio className="h-4 w-4" />}
                    Iniciar Stream
                  </Button>
                )}

                {isLive && isAdmin && (
                  <>
                    <Button onClick={toggleMute} variant="outline" size="icon" title={muted ? "Activar mic" : "Silenciar"}>
                      {muted ? <MicOff className="h-4 w-4 text-red-400" /> : <Mic className="h-4 w-4" />}
                    </Button>
                    <Button onClick={toggleCamera} variant="outline" size="icon" title={cameraOff ? "Activar cámara" : "Apagar cámara"}>
                      {cameraOff ? <VideoOff className="h-4 w-4 text-red-400" /> : <Video className="h-4 w-4" />}
                    </Button>
                    {cameras.length > 1 && (
                      <Button onClick={switchCamera} variant="outline" size="icon" title="Cambiar cámara">
                        <SwitchCamera className="h-4 w-4" />
                      </Button>
                    )}
                    <Button onClick={stopBroadcast} variant="destructive" className="gap-2">
                      <LogOut className="h-4 w-4" />
                      Detener
                    </Button>
                  </>
                )}

                {isLive && !isAdmin && (
                  <Button
                    onClick={async () => { await roomRef.current?.disconnect(); setAppState("idle"); }}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                  >
                    <LogOut className="h-4 w-4" />
                    Salir
                  </Button>
                )}
              </div>

              {/* Right: chat toggle */}
              {isLive && (
                <Button
                  variant={showChat ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setShowChat((v) => !v)}
                  className="gap-2"
                >
                  <Send className="h-4 w-4" />
                  Chat
                </Button>
              )}
            </div>
          </div>

          {/* Chat panel */}
          <AnimatePresence>
            {showChat && isLive && (
              <motion.div
                initial={{ opacity: 0, x: 32, width: 0 }}
                animate={{ opacity: 1, x: 0, width: undefined }}
                exit={{ opacity: 0, x: 32, width: 0 }}
                className="w-full lg:w-72 h-80 lg:h-auto glass-card rounded-2xl border border-border/40 overflow-hidden"
                style={{ minHeight: 320 }}
              >
                <div className="flex items-center justify-between px-3 pt-3 pb-2 border-b border-border/30">
                  <span className="text-sm font-semibold">Chat en vivo</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowChat(false)}>
                    <span className="text-lg leading-none">×</span>
                  </Button>
                </div>
                <div className="h-full pb-14">
                  <ChatPanel socket={socketRef.current} userName={userName} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Status bar */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span
          className={`h-2 w-2 rounded-full ${socketConnected ? "bg-green-500" : "bg-red-500"}`}
        />
        {socketConnected ? "Conectado al servidor" : "Reconectando..."}
        {isAdmin && <span className="text-yellow-400 font-semibold">· Modo Transmisor</span>}
      </div>
    </div>
  );
}
