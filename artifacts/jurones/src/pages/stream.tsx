import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  ChevronDown,
  Maximize2,
  Minimize2,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useListMatches, useGetMatch } from "@workspace/api-client-react";
import { useUser } from "@clerk/react";

const ADMIN_CODE = "110880";
const ROOM_NAME = "jurones-stream";

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

function avatarSrc(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http")) return path;
  const slug = path.startsWith("/objects/") ? path.slice("/objects/".length) : path;
  return `/api/storage/objects/${slug}`;
}

// ─── Minimal score bar inside the video ───────────────────────────────────────
function ScoreOverlay({ matchId }: { matchId: number | null }) {
  const { data: match } = useGetMatch(matchId ?? 0, {
    query: { enabled: matchId !== null, refetchInterval: 3000 },
  });
  if (!match) return null;
  return (
    <div
      className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 px-4 py-2 rounded-xl text-white font-bold text-lg shadow-2xl"
      style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.12)" }}
    >
      <span className="text-red-400 text-sm font-black uppercase tracking-widest">Cortos</span>
      <span className="text-2xl tabular-nums text-red-300">{match.shortosScore}</span>
      <span className="text-muted-foreground text-xs">vs</span>
      <span className="text-2xl tabular-nums text-blue-300">{match.largosScore}</span>
      <span className="text-blue-400 text-sm font-black uppercase tracking-widest">Largos</span>
      <span className="ml-1 text-xs bg-red-600 px-2 py-0.5 rounded-full animate-pulse">EN VIVO</span>
    </div>
  );
}

// ─── Full match score card (same design as Live module) ───────────────────────
function StreamScoreCard({ matchId }: { matchId: number }) {
  const { data: match } = useGetMatch(matchId, {
    query: { refetchInterval: 3000 },
  });
  if (!match) return null;

  const cortosPlayers = match.players.filter((p) => p.team === "cortos");
  const largosPlayers = match.players.filter((p) => p.team === "largos");
  const isFinished = match.status === "finished";
  const isLisa = isFinished && (match.shortosScore === 0 || match.largosScore === 0);
  const cortosWin = match.winnerTeam === "cortos";
  const largosWin = match.winnerTeam === "largos";

  return (
    <motion.div
      key={matchId}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-3xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-border/50">
        <span className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
          Partida #{match.matchNumber}
        </span>
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-red-400">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          {isFinished ? "Finalizada" : "En vivo"}
        </div>
      </div>

      {/* Winner banner */}
      <AnimatePresence>
        {isFinished && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className={`flex items-center justify-center gap-3 py-4 px-6 ${cortosWin ? "bg-red-500/20" : "bg-blue-500/20"}`}
          >
            <Trophy className={`h-6 w-6 ${cortosWin ? "text-red-400" : "text-blue-400"}`} />
            <span className={`text-xl font-black uppercase tracking-widest ${cortosWin ? "text-red-400" : "text-blue-400"}`}>
              ¡Ganan los {match.winnerTeam}!{isLisa ? " 🐟 ¡LISA!" : ""}
            </span>
            <Trophy className={`h-6 w-6 ${cortosWin ? "text-red-400" : "text-blue-400"}`} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scoreboard */}
      <div className="grid grid-cols-3 items-stretch divide-x divide-border/50">
        {/* Cortos */}
        <div className={`flex flex-col items-center justify-between gap-4 p-6 bg-gradient-to-b from-red-500/10 to-transparent ${cortosWin ? "ring-2 ring-red-500/40 ring-inset" : ""}`}>
          <span className="text-xs font-black uppercase tracking-[0.2em] text-red-500">Cortos</span>
          <div className={`text-[5.5rem] font-black tabular-nums leading-none tracking-tighter ${cortosWin ? "text-red-400" : "text-foreground"}`}>
            {match.shortosScore}
          </div>
          <div className="flex flex-col gap-2 w-full">
            {cortosPlayers.map(({ player }) => (
              <div key={player.id} className="flex items-center gap-2.5 px-3 py-2 rounded-xl border border-red-500/40 bg-red-500/10">
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarImage src={avatarSrc(player.avatarUrl)} className="object-cover" />
                  <AvatarFallback className="text-xs font-bold bg-red-500/20 text-red-400">
                    {player.name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="font-semibold text-sm leading-tight">{player.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Center VS */}
        <div className="flex flex-col items-center justify-center gap-2 p-4">
          <div className="text-2xl font-black text-muted-foreground/40">VS</div>
          <div className="w-px flex-1 bg-border/30 my-1" />
          <div className="text-[10px] text-muted-foreground uppercase tracking-widest">200 pts</div>
        </div>

        {/* Largos */}
        <div className={`flex flex-col items-center justify-between gap-4 p-6 bg-gradient-to-b from-blue-500/10 to-transparent ${largosWin ? "ring-2 ring-blue-500/40 ring-inset" : ""}`}>
          <span className="text-xs font-black uppercase tracking-[0.2em] text-blue-500">Largos</span>
          <div className={`text-[5.5rem] font-black tabular-nums leading-none tracking-tighter ${largosWin ? "text-blue-400" : "text-foreground"}`}>
            {match.largosScore}
          </div>
          <div className="flex flex-col gap-2 w-full">
            {largosPlayers.map(({ player }) => (
              <div key={player.id} className="flex items-center gap-2.5 px-3 py-2 rounded-xl border border-blue-500/40 bg-blue-500/10">
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarImage src={avatarSrc(player.avatarUrl)} className="object-cover" />
                  <AvatarFallback className="text-xs font-bold bg-blue-500/20 text-blue-400">
                    {player.name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="font-semibold text-sm leading-tight">{player.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Progress bars */}
      <div className="grid grid-cols-2 gap-0 border-t border-border/50">
        <div className="h-2 bg-red-500/10">
          <motion.div
            className="h-full bg-red-500"
            initial={{ width: 0 }}
            animate={{ width: `${Math.min((match.shortosScore / 200) * 100, 100)}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
        <div className="h-2 bg-blue-500/10">
          <motion.div
            className="h-full bg-blue-500 ml-auto"
            initial={{ width: 0 }}
            animate={{ width: `${Math.min((match.largosScore / 200) * 100, 100)}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>
    </motion.div>
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
          inputMode="numeric"
          pattern="[0-9]*"
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
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const localVideoTrackRef = useRef<LocalVideoTrack | null>(null);
  const localAudioTrackRef = useRef<LocalAudioTrack | null>(null);

  // Socket.io
  const socketRef = useRef<Socket | null>(null);
  // Ref for isAdmin to avoid stale closures in Socket.io callbacks
  const isAdminRef = useRef(false);
  // Track remote audio elements so we can clean them up
  const remoteAudioEls = useRef<HTMLAudioElement[]>([]);

  // UI state
  const [appState, setAppState] = useState<AppState>("idle");
  // Keep appState in a ref so socket/LiveKit callbacks can read it without stale closure
  const appStateRef = useRef<AppState>("idle");
  const setAppStateSynced = useCallback((s: AppState) => {
    appStateRef.current = s;
    setAppState(s);
  }, []);
  const [isAdmin, setIsAdmin] = useState(false);
  // Keep ref in sync
  const setIsAdminSynced = (v: boolean) => { isAdminRef.current = v; setIsAdmin(v); };
  const [showAdminGate, setShowAdminGate] = useState(false);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [remoteActive, setRemoteActive] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [switchingCamera, setSwitchingCamera] = useState(false);
  const [showCamSelector, setShowCamSelector] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
  // Whether native fullscreen API is available (fails in sandboxed iframes)
  const nativeFullscreenAvailable = typeof document !== "undefined" && !!document.documentElement.requestFullscreen;

  // Active matches for score panel
  const { data: activeMatches } = useListMatches(
    { status: "active" },
    { query: { refetchInterval: 5000 } }
  );

  // Auto-select first match when matches load
  useEffect(() => {
    if (!activeMatches || activeMatches.length === 0) return;
    setSelectedMatchId((prev) => {
      if (prev !== null && activeMatches.some((m) => m.id === prev)) return prev;
      return activeMatches[0].id;
    });
  }, [activeMatches]);

  // Fullscreen toggle — tries native API first, falls back to CSS pseudo-fullscreen
  const toggleFullscreen = useCallback(() => {
    const el = videoContainerRef.current;
    if (!el) return;

    // If already in CSS pseudo-fullscreen, exit it
    if (!document.fullscreenElement && isFullscreen) {
      setIsFullscreen(false);
      return;
    }

    if (!document.fullscreenElement) {
      // Try native fullscreen
      el.requestFullscreen().catch(() => {
        // Native API failed (sandboxed iframe) — use CSS pseudo-fullscreen
        setIsFullscreen(true);
      });
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, [isFullscreen]);

  // Sync fullscreen state with browser native fullscreen events
  useEffect(() => {
    const onChange = () => {
      if (document.fullscreenElement) {
        setIsFullscreen(true);
      } else {
        setIsFullscreen(false);
      }
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Escape key exits CSS pseudo-fullscreen
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen && !document.fullscreenElement) {
        setIsFullscreen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isFullscreen]);

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
      // If broadcaster is still live after a socket reconnect, re-announce
      // so the server's streamActive stays in sync.
      if (isAdminRef.current && appStateRef.current === "live") {
        s.emit("stream-start");
      }
    });
    s.on("disconnect", () => setSocketConnected(false));
    s.on("viewer-count", (n: number) => setViewerCount(n));
    s.on("stream-status", ({ active }: { active: boolean }) => {
      // Use ref to avoid stale closure — isAdmin changes after mount
      if (!isAdminRef.current) setRemoteActive(active);
    });

    return () => { s.disconnect(); };
  }, []);

  // Close cam selector when clicking outside
  useEffect(() => {
    if (!showCamSelector) return;
    const close = () => setShowCamSelector(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [showCamSelector]);

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
    setAppStateSynced("connecting");
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
            const el = track.attach() as HTMLAudioElement;
            document.body.appendChild(el);
            remoteAudioEls.current.push(el);
          }
        });
        room.on(RoomEvent.TrackUnsubscribed, () => setRemoteActive(false));
        room.on(RoomEvent.ParticipantDisconnected, () => {
          if (room.remoteParticipants.size === 0) setRemoteActive(false);
        });
      }

      room.on(RoomEvent.Disconnected, () => {
        // If the broadcaster's connection drops, notify the server so viewers
        // are informed immediately rather than waiting for a timeout.
        if (isAdminRef.current) {
          socketRef.current?.emit("stream-stop");
        }
        setAppStateSynced("idle");
        setRemoteActive(false);
        // Clean up remote audio elements
        remoteAudioEls.current.forEach((el) => { el.pause(); el.remove(); });
        remoteAudioEls.current = [];
      });

      await room.connect(url, token);

      if (role === "broadcaster") {
        const videoTrack = await createLocalVideoTrack();
        const audioTrack = await createLocalAudioTrack();
        localVideoTrackRef.current = videoTrack;
        localAudioTrackRef.current = audioTrack;

        await room.localParticipant.publishTrack(videoTrack);
        await room.localParticipant.publishTrack(audioTrack);

        if (localVideoRef.current) videoTrack.attach(localVideoRef.current);

        // Enumerate cameras AFTER permissions are granted (labels now available)
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cams = devices.filter((d) => d.kind === "videoinput");
        setCameras(cams);
        setSelectedCameraId(cams[0]?.deviceId ?? "");

        socketRef.current?.emit("stream-start");
      }

      setAppStateSynced("live");
    } catch (err: any) {
      setErrorMsg(err?.message ?? "Error de conexión");
      setAppStateSynced("error");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userName, user]);

  const stopBroadcast = useCallback(async () => {
    localVideoTrackRef.current?.stop();
    localAudioTrackRef.current?.stop();
    await roomRef.current?.disconnect();
    roomRef.current = null;
    socketRef.current?.emit("stream-stop");
    setAppStateSynced("idle");
    setRemoteActive(false);
  }, [setAppStateSynced]);

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

  const switchToCamera = useCallback(async (deviceId: string) => {
    const room = roomRef.current;
    if (!room || switchingCamera) return;
    setSwitchingCamera(true);
    try {
      // v2 API: switches the active device and re-publishes automatically
      await room.switchActiveDevice("videoinput", deviceId);
      // Re-attach the new track to the local preview element
      const camPub = room.localParticipant.getTrackPublication(Track.Source.Camera);
      const newVideoTrack = camPub?.videoTrack as LocalVideoTrack | undefined;
      if (newVideoTrack) {
        localVideoTrackRef.current = newVideoTrack;
        if (localVideoRef.current) {
          // Detach only from the specific element, not all elements
          newVideoTrack.detach(localVideoRef.current);
          newVideoTrack.attach(localVideoRef.current);
        }
      }
      setSelectedCameraId(deviceId);
    } finally {
      setSwitchingCamera(false);
      setShowCamSelector(false);
    }
  }, [switchingCamera]);

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
          <p className="text-muted-foreground mt-1 uppercase tracking-[0.3em] text-xs">Transmisión en vivo de Los Jurones Domino Club.</p>
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
            onUnlock={() => { setIsAdminSynced(true); setShowAdminGate(false); }}
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
              ref={videoContainerRef}
              className={`relative overflow-hidden bg-black ${
                isFullscreen && !document.fullscreenElement
                  ? "fixed inset-0 z-[9999] w-screen h-screen rounded-none"
                  : "w-full rounded-2xl"
              }`}
              style={isFullscreen && !document.fullscreenElement ? {} : { aspectRatio: "16/9" }}
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
              {isLive && <ScoreOverlay matchId={selectedMatchId} />}

              {/* Fullscreen button */}
              <button
                onClick={toggleFullscreen}
                className="absolute bottom-3 right-3 z-30 h-8 w-8 flex items-center justify-center rounded-lg transition-opacity hover:opacity-100 opacity-60 active:scale-95"
                style={{ background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.15)" }}
                title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
              >
                {isFullscreen
                  ? <Minimize2 className="h-4 w-4 text-white" />
                  : <Maximize2 className="h-4 w-4 text-white" />
                }
              </button>
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
                    {/* Mic toggle */}
                    <Button onClick={toggleMute} variant="outline" size="icon" title={muted ? "Activar mic" : "Silenciar"}>
                      {muted ? <MicOff className="h-4 w-4 text-red-400" /> : <Mic className="h-4 w-4" />}
                    </Button>

                    {/* Camera toggle */}
                    <Button onClick={toggleCamera} variant="outline" size="icon" title={cameraOff ? "Activar cámara" : "Apagar cámara"}>
                      {cameraOff ? <VideoOff className="h-4 w-4 text-red-400" /> : <Video className="h-4 w-4" />}
                    </Button>

                    {/* Camera selector dropdown */}
                    <div className="relative" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="outline"
                        className="gap-1.5 h-9 px-3 text-sm"
                        title="Cambiar cámara"
                        onClick={() => setShowCamSelector((v) => !v)}
                        disabled={switchingCamera || cameras.length === 0}
                      >
                        {switchingCamera ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <SwitchCamera className="h-4 w-4" />
                        )}
                        <span className="hidden sm:inline max-w-[90px] truncate">
                          {cameras.find((c) => c.deviceId === selectedCameraId)?.label ||
                            (cameras.length === 0 ? "Sin cámaras" : "Cámara")}
                        </span>
                        <ChevronDown className="h-3 w-3 opacity-60" />
                      </Button>

                      <AnimatePresence>
                        {showCamSelector && cameras.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, y: -6, scale: 0.97 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -6, scale: 0.97 }}
                            transition={{ duration: 0.12 }}
                            className="absolute bottom-full mb-2 left-0 z-50 min-w-[200px] max-w-[280px] rounded-xl border border-border/60 overflow-hidden shadow-2xl"
                            style={{ background: "hsl(var(--background))" }}
                          >
                            <div className="px-3 py-2 text-xs font-semibold text-muted-foreground border-b border-border/40">
                              Seleccionar cámara
                            </div>
                            {cameras.map((cam, idx) => (
                              <button
                                key={cam.deviceId}
                                onClick={() => switchToCamera(cam.deviceId)}
                                disabled={switchingCamera}
                                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left transition-colors hover:bg-white/5 ${
                                  cam.deviceId === selectedCameraId
                                    ? "text-yellow-400 font-semibold"
                                    : "text-foreground"
                                }`}
                              >
                                <SwitchCamera className="h-3.5 w-3.5 shrink-0 opacity-60" />
                                <span className="truncate">
                                  {cam.label || `Cámara ${idx + 1}`}
                                </span>
                                {cam.deviceId === selectedCameraId && (
                                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-yellow-400 shrink-0" />
                                )}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Stop broadcast */}
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

      {/* Match selector + Score card */}
      {activeMatches && activeMatches.length > 0 && (
        <div className="space-y-4">
          {/* Selector — only shown when multiple matches are active */}
          {activeMatches.length > 1 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground font-semibold uppercase tracking-widest">Partida:</span>
              {activeMatches.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelectedMatchId(m.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors border ${
                    selectedMatchId === m.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border/50 text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  }`}
                >
                  #{m.matchNumber ?? m.id}
                </button>
              ))}
            </div>
          )}

          {/* Score card */}
          {selectedMatchId !== null && (
            <StreamScoreCard matchId={selectedMatchId} />
          )}
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
