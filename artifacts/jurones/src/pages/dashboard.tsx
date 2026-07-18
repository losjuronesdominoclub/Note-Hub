import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Play, Users, Trophy, Activity, ArrowRight, Medal, Zap, Flame, Star, Instagram, RotateCcw, XCircle, AlertTriangle, BarChart2, Ticket, CalendarDays, Terminal, ShieldCheck, ShieldOff, WifiOff, Clock, ListOrdered, Plus, ChevronRight, Search } from "lucide-react";
import { useUser } from "@clerk/react";
import { useMatchRecovery } from "@/hooks/useOfflineMatch";
import { useDevMode } from "@/contexts/dev-mode-context";
import { useGetDashboardStats, useGetRecentActivity, useListMatches, useListEvents, useListPlayers } from "@workspace/api-client-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TURNOS_QUERY_KEY, type TurnoEntry } from "@/pages/turnos";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

function avatarSrc(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http")) return path;
  const slug = path.startsWith("/objects/") ? path.slice("/objects/".length) : path;
  return `/api/storage/objects/${slug}`;
}

function formatTopSince(topSince: string | null | undefined): string | null {
  if (!topSince) return null;
  const diffMs = Date.now() - new Date(topSince).getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Hoy";
  if (diffDays === 1) return "1 día";

  const months = Math.floor(diffDays / 30);
  if (months >= 1) {
    const remDays = diffDays - months * 30;
    const remWeeks = Math.floor(remDays / 7);
    const remExtra = remDays % 7;
    let s = `${months} ${months === 1 ? "mes" : "meses"}`;
    if (remWeeks > 0) s += ` + ${remWeeks} ${remWeeks === 1 ? "semana" : "semanas"}`;
    else if (remExtra > 0) s += ` + ${remExtra} ${remExtra === 1 ? "día" : "días"}`;
    return s;
  }

  const weeks = Math.floor(diffDays / 7);
  const remDays = diffDays % 7;
  if (weeks >= 1) {
    let s = `${weeks} ${weeks === 1 ? "semana" : "semanas"}`;
    if (remDays > 0) s += ` + ${remDays} ${remDays === 1 ? "día" : "días"}`;
    return s;
  }

  return `${diffDays} días`;
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { recovery, dismiss } = useMatchRecovery();
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: activity, isLoading: activityLoading } = useGetRecentActivity();
  const { data: activeMatches } = useListMatches({ status: "active" });
  const { data: events } = useListEvents();

  const nextEvent = React.useMemo(() => {
    if (!events?.length) return null;
    const today = new Date().toISOString().slice(0, 10);
    return (
      events
        .filter((e) => e.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null
    );
  }, [events]);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: allPlayers } = useListPlayers();
  const { data: turnos = [] } = useQuery<TurnoEntry[]>({
    queryKey: TURNOS_QUERY_KEY,
    queryFn: async () => {
      const res = await fetch("/api/turnos");
      if (!res.ok) throw new Error("Error cargando turnos");
      return res.json();
    },
    refetchInterval: 10000,
  });
  const [turnoSearch, setTurnoSearch] = useState("");
  const turnoPlayerIds = new Set(turnos.map((t) => t.player.id));
  const availablePlayers = (allPlayers ?? [])
    .filter((p) => !p.hidden && !turnoPlayerIds.has(p.id))
    .filter((p) => !turnoSearch.trim() || p.name.toLowerCase().includes(turnoSearch.trim().toLowerCase()));

  const addTurnoMutation = useMutation({
    mutationFn: async (playerId: number) => {
      const res = await fetch("/api/turnos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId }),
      });
      if (!res.ok) throw new Error("Error agregando turno");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TURNOS_QUERY_KEY }),
    onError: () => toast({ title: "Error", description: "No se pudo agregar al jugador", variant: "destructive" }),
  });
  const { isDevMode, enableDevMode, disableDevMode } = useDevMode();
  const { user } = useUser();

  // Dev mode dialog
  const [isDevDialogOpen, setIsDevDialogOpen] = useState(false);
  const [devCode, setDevCode] = useState("");
  const [devCodeError, setDevCodeError] = useState(false);

  const openDevDialog = () => {
    if (isDevMode) {
      disableDevMode();
      toast({ title: "Dev Mode desactivado", description: "Modo administrador deshabilitado." });
      return;
    }
    setDevCode("");
    setDevCodeError(false);
    setIsDevDialogOpen(true);
  };

  const handleDevCodeVerify = () => {
    if (devCode === "110880") {
      enableDevMode();
      setIsDevDialogOpen(false);
      toast({ title: "Dev Mode activado", description: "Modo administrador habilitado. Los controles de edición están visibles." });
    } else {
      setDevCodeError(true);
    }
  };

  const [isResetOpen, setIsResetOpen] = useState(false);
  const [resetStep, setResetStep] = useState<"code" | "confirm">("code");
  const [resetCode, setResetCode] = useState("");
  const [resetCodeError, setResetCodeError] = useState(false);
  const [resetting, setResetting] = useState(false);

  const openReset = () => {
    setResetStep("code");
    setResetCode("");
    setResetCodeError(false);
    setIsResetOpen(true);
  };

  const handleVerifyResetCode = () => {
    if (resetCode === "110880") {
      setResetStep("confirm");
      setResetCodeError(false);
    } else {
      setResetCodeError(true);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      const res = await fetch("/api/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminCode: "110880" }),
      });
      if (!res.ok) throw new Error("Error en el servidor");
      queryClient.invalidateQueries();
      setIsResetOpen(false);
      toast({ title: "Reset completado", description: "Todas las estadísticas han sido restablecidas a 0." });
    } catch {
      toast({ title: "Error", description: "No se pudo completar el reset.", variant: "destructive" });
    } finally {
      setResetting(false);
    }
  };

  const statCards = [
    { title: "Partidas Activas",  value: stats?.activeMatches,    icon: Activity, color: "text-green-500",  bg: "bg-green-500/10"  },
    { title: "Partidas Jugadas",  value: stats?.totalGamesPlayed,  icon: Play,     color: "text-purple-500", bg: "bg-purple-500/10" },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      {/* ── Crash recovery dialog ── */}
      {recovery && (
        <Dialog open onOpenChange={() => dismiss()}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <WifiOff className="h-5 w-5 text-yellow-400" />
                Partida en curso encontrada
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Se encontraron <strong className="text-white">{recovery.pendingOps.length} operación{recovery.pendingOps.length !== 1 ? "es" : ""}</strong> sin sincronizar de la partida <strong className="text-white">#{recovery.matchNumber ?? recovery.matchId}</strong>. ¿Desea continuar y sincronizarlas?
            </p>
            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={dismiss} className="text-red-400 border-red-500/30 hover:bg-red-500/10">
                Descartar
              </Button>
              <Button size="sm" className="bg-primary font-bold" onClick={() => { setLocation(`/match/${recovery.matchId}`); dismiss(); }}>
                Continuar partida →
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Header + Nueva Partida ── */}
      <div className="flex flex-col gap-3">
        {/* Row 1: title + icon links */}
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-bold tracking-tight mr-1">Dashboard</h1>
          <a
            href="https://www.instagram.com/losjuronesdominoclub/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-pink-500 transition-colors group"
          >
            <Instagram className="h-6 w-6 group-hover:scale-110 transition-transform" />
          </a>
          <Link href="/daily-results">
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:brightness-110 active:scale-95"
              style={{ background: "#e8b03f", color: "#1a1209" }}
            >
              <BarChart2 className="h-3.5 w-3.5" />
              Resultados
            </button>
          </Link>
          <Link href="/turnos">
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:brightness-110 active:scale-95"
              style={{ background: "#7c3aed", color: "#fff" }}
            >
              <ListOrdered className="h-3.5 w-3.5" />
              Turnos
            </button>
          </Link>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold transition-all hover:brightness-110 active:scale-95 active:rotate-180"
            style={{ background: "rgba(255,255,255,0.08)", color: "#9ca3af" }}
            title="Actualizar"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Row 2: subtitle + action buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-muted-foreground mt-1 uppercase tracking-[0.15em] sm:tracking-[0.2em] md:tracking-[0.3em] text-xs">Resumen del club y actividad reciente.</p>
          <div className="flex flex-wrap items-center gap-2">
            {/* Logged-in user chip */}
            {user && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-muted-foreground max-w-[200px]">
                <Avatar className="h-5 w-5 shrink-0">
                  <AvatarImage src={user.imageUrl} className="object-cover" />
                  <AvatarFallback className="text-[8px] bg-primary/20 text-primary font-bold">
                    {(user.fullName ?? user.primaryEmailAddress?.emailAddress ?? "U").substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium truncate">
                  {user.fullName ?? user.primaryEmailAddress?.emailAddress ?? user.username ?? "Miembro"}
                </span>
              </div>
            )}
            {/* Dev Mode toggle */}
            <Button
              size="icon"
              variant="outline"
              title={isDevMode ? "Desactivar Dev Mode" : "Activar Dev Mode"}
              onClick={openDevDialog}
              className={`h-10 w-10 rounded-full transition-all ${
                isDevMode
                  ? "border-amber-500/60 text-amber-400 bg-amber-500/10 hover:bg-amber-500/20"
                  : "border-muted-foreground/30 text-muted-foreground hover:bg-muted/40"
              }`}
            >
              {isDevMode ? <ShieldCheck className="h-4 w-4" /> : <Terminal className="h-4 w-4" />}
            </Button>

            {/* Reset — solo visible en Dev Mode */}
            {isDevMode && (
              <Button
                size="icon"
                variant="outline"
                title="Reset estadísticas"
                onClick={openReset}
                className="h-10 w-10 rounded-full border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-300 hover:border-red-500/60 transition-all"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            )}

            <Button
              className="gap-2 rounded-full shadow-lg bg-green-600 hover:bg-green-500 text-white shadow-green-900/40 font-bold px-5 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={turnos.length < 4}
              title={turnos.length < 4 ? `Se necesitan 4 jugadores en turnos (${turnos.length}/4)` : undefined}
              onClick={() => { if (turnos.length >= 4) setLocation("/match/new"); }}
            >
              <Play className="h-4 w-4 fill-current" /> + Crear Partida
            </Button>
          </div>
        </div>
      </div>

      {/* ── Partidas en Curso ── */}
      {activeMatches && activeMatches.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-green-400 animate-pulse" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-green-400">
              Partidas en Curso
            </h2>
            <span className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-green-500/20 px-1.5 text-[10px] font-black text-green-400 border border-green-500/30">
              {activeMatches.length}
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {activeMatches.map((match, i) => {
              const startedAt = match.createdAt
                ? new Date(match.createdAt).toLocaleTimeString("es-DO", {
                    timeZone: "America/Santo_Domingo",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: true,
                  })
                : null;
              const startedDate = match.createdAt
                ? new Date(match.createdAt).toLocaleDateString("es-DO", {
                    timeZone: "America/Santo_Domingo",
                    day: "2-digit",
                    month: "short",
                  })
                : null;

              return (
                <motion.div
                  key={match.id}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="relative overflow-hidden rounded-2xl border border-green-500/35 bg-green-500/8 backdrop-blur-sm shadow-lg shadow-green-900/10"
                >
                  {/* Glow accent */}
                  <div className="pointer-events-none absolute -top-6 -right-6 h-24 w-24 rounded-full bg-green-500/10 blur-2xl" />

                  <div className="p-4 space-y-3">
                    {/* Top row: badge + número */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500/20 border border-green-500/40">
                          <Zap className="h-3 w-3 text-green-400" />
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-green-400">En Curso</span>
                      </div>
                      <span className="text-xs text-muted-foreground font-semibold">
                        Partida <span className="text-white font-black">#{match.matchNumber}</span>
                      </span>
                    </div>

                    {/* Scores */}
                    <div className="flex items-center justify-center gap-3">
                      <div className="flex-1 text-center">
                        <p className="text-[10px] uppercase tracking-widest text-red-400/80 font-bold mb-0.5">Cortos</p>
                        <p className="text-4xl font-black text-red-400 leading-none">{match.shortosScore ?? 0}</p>
                      </div>
                      <div className="text-muted-foreground/40 text-lg font-black">vs</div>
                      <div className="flex-1 text-center">
                        <p className="text-[10px] uppercase tracking-widest text-blue-400/80 font-bold mb-0.5">Largos</p>
                        <p className="text-4xl font-black text-blue-400 leading-none">{match.largosScore ?? 0}</p>
                      </div>
                    </div>

                    {/* Players */}
                    {match.players && match.players.length > 0 && (
                      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
                        {match.players.filter((p: any) => p.team === "cortos").map((p: any, j: number) => (
                          <div key={j} className="flex items-center gap-1 truncate">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" />
                            <span className="truncate text-foreground/80 font-medium">{p.player?.name ?? "—"}</span>
                          </div>
                        ))}
                        {match.players.filter((p: any) => p.team === "largos").map((p: any, j: number) => (
                          <div key={j} className="flex items-center gap-1 truncate">
                            <span className="h-1.5 w-1.5 rounded-full bg-blue-400 shrink-0" />
                            <span className="truncate text-foreground/80 font-medium">{p.player?.name ?? "—"}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Meta: fecha + hora */}
                    {(startedDate || startedAt) && (
                      <p className="text-[10px] text-muted-foreground/60 font-medium">
                        Inicio: {startedDate} · {startedAt}
                      </p>
                    )}

                    {/* Continuar button */}
                    <Link href={`/match/${match.id}`}>
                      <Button className="w-full gap-2 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold shadow-md shadow-green-900/30 transition-all">
                        <ArrowRight className="h-4 w-4" /> Continuar Partida
                      </Button>
                    </Link>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Row 1: Jugador Top (left) + Actividad Reciente (right) ── */}
      <div className="grid gap-6 md:grid-cols-2">

        {/* Jugador Top */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="animated-border-card-gold h-full"
        >
          <Card className="animated-border-card-inner glass-card h-full bg-gradient-to-br from-card to-primary/5 border-0">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-xl">Jugador Top</CardTitle>
              <Trophy className="h-5 w-5 text-yellow-500" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <div className="flex flex-col items-center gap-4 py-4">
                  <Skeleton className="h-24 w-24 rounded-full" />
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ) : stats?.topPlayer ? (
                <div className="flex flex-col items-center text-center gap-4 py-4">
                  <div className="relative">
                    <Avatar className="h-28 w-28 border-4 border-yellow-500 shadow-xl shadow-yellow-500/20">
                      <AvatarImage src={avatarSrc(stats.topPlayer.avatarUrl)} className="object-cover" />
                      <AvatarFallback className="text-3xl font-bold bg-muted">
                        {stats.topPlayer.name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-3 -right-2 bg-yellow-500 text-yellow-950 p-1.5 rounded-full shadow-lg">
                      <Medal className="h-6 w-6" />
                    </div>
                  </div>
                  <div className="w-full space-y-3">
                    <h3 className="text-2xl font-bold">{stats.topPlayer.name}</h3>
                    <div className="flex items-center justify-center gap-2 flex-wrap">
                      <span className="flex items-center gap-1 text-sm bg-green-500/20 text-green-400 px-2.5 py-1 rounded-full font-semibold">
                        <Trophy className="h-3.5 w-3.5" /> {stats.topPlayer.wins}V · {stats.topPlayer.losses}D
                      </span>
                      <span className="flex items-center gap-1 text-sm bg-yellow-500/20 text-yellow-400 px-2.5 py-1 rounded-full font-semibold">
                        {(Number(stats.topPlayer.winRate) * 100).toFixed(0)}% WR
                      </span>
                    </div>
                    {formatTopSince(stats.topPlayer.topSince) && (
                      <div className="flex items-center justify-center gap-1.5 text-xs text-purple-300 bg-purple-500/10 border border-purple-500/20 rounded-full px-3 py-1.5 mx-auto w-fit">
                        <Clock className="h-3 w-3" />
                        <span className="font-medium">{formatTopSince(stats.topPlayer.topSince)} en el trono</span>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3 mt-1">
                      <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl py-3 px-2">
                        <div className="flex items-center justify-center gap-1.5 text-orange-400">
                          <Flame className="h-5 w-5" />
                          <span className="text-2xl font-black">{stats.topPlayer.currentStreak ?? 0}</span>
                        </div>
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">Racha</p>
                      </div>
                      <div className="bg-primary/10 border border-primary/20 rounded-xl py-3 px-2">
                        <div className="flex items-center justify-center gap-1.5 text-primary">
                          <Star className="h-5 w-5" />
                          <span className="text-2xl font-black">{stats.topPlayer.totalPoints ?? 0}</span>
                        </div>
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">Puntos</p>
                      </div>
                    </div>
                  </div>
                  <Button variant="outline" className="rounded-full w-full" asChild>
                    <Link href="/ranking">Ver Ranking Completo</Link>
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center text-center gap-4 py-4">
                  <div className="relative">
                    <Avatar className="h-28 w-28 border-4 border-yellow-500/40 shadow-xl shadow-yellow-500/10">
                      <AvatarImage src="/logo.png" className="object-cover" />
                      <AvatarFallback className="text-3xl font-bold bg-muted">LJ</AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-3 -right-2 bg-yellow-500/40 text-yellow-950 p-1.5 rounded-full shadow-lg">
                      <Medal className="h-6 w-6 text-yellow-500" />
                    </div>
                  </div>
                  <div className="w-full space-y-3">
                    <h3 className="text-2xl font-bold">Los Jurones</h3>
                    <div className="flex items-center justify-center">
                      <span className="text-sm text-muted-foreground px-3 py-1 rounded-full bg-muted">
                        Sin partidas registradas aún
                      </span>
                    </div>
                  </div>
                  <Button variant="outline" className="rounded-full w-full" asChild>
                    <Link href="/ranking">Ver Ranking Completo</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Turnos */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="glass-card h-full flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-xl">Turnos</CardTitle>
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-primary text-xs" asChild>
                <Link href="/turnos">Ver lista <ChevronRight className="h-3.5 w-3.5" /></Link>
              </Button>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
              {turnos.length > 0 && (
                <div className="mb-4 space-y-1.5">
                  {turnos.slice(0, 4).map((t, i) => (
                    <div key={t.player.id} className="flex items-center gap-2.5 text-sm">
                      <span className="text-primary/60 font-black w-5 text-center text-xs">{i + 1}</span>
                      <Avatar className="h-6 w-6 border border-primary/20 shrink-0">
                        <AvatarImage src={t.player.avatarUrl ? (t.player.avatarUrl.startsWith("http") ? t.player.avatarUrl : `/api/storage/objects/${t.player.avatarUrl.replace(/^\/objects\//, "")}`) : undefined} className="object-cover" />
                        <AvatarFallback className="text-[10px] font-bold bg-primary/10 text-primary">{t.player.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium truncate flex-1">{t.player.name}</span>
                    </div>
                  ))}
                  {turnos.length > 4 && (
                    <p className="text-xs text-muted-foreground pl-7">+{turnos.length - 4} más en lista</p>
                  )}
                </div>
              )}

              {(allPlayers ?? []).filter((p) => !p.hidden && !turnoPlayerIds.has(p.id)).length > 0 && (
                <div className="relative mb-2">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Buscar jugador..."
                    value={turnoSearch}
                    onChange={(e) => setTurnoSearch(e.target.value)}
                    className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg bg-white/5 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
                  />
                  {turnoSearch && (
                    <button
                      onClick={() => setTurnoSearch("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}

              {availablePlayers.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground text-xs">
                  {(allPlayers ?? []).filter((p) => !p.hidden && !turnoPlayerIds.has(p.id)).length === 0
                    ? (allPlayers?.length === 0 ? "No hay jugadores registrados." : "Todos los jugadores están en lista.")
                    : `Sin resultados para "${turnoSearch}"`}
                </div>
              ) : (
                <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                  {availablePlayers.map((player) => (
                    <div key={player.id} className="flex items-center gap-2.5">
                      <Avatar className="h-8 w-8 border border-primary/20 shrink-0">
                        <AvatarImage src={player.avatarUrl ? (player.avatarUrl.startsWith("http") ? player.avatarUrl : `/api/storage/objects/${player.avatarUrl.replace(/^\/objects\//, "")}`) : undefined} className="object-cover" />
                        <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">{player.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium flex-1 truncate">{player.name}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10 shrink-0"
                        onClick={() => addTurnoMutation.mutate(player.id)}
                        disabled={addTurnoMutation.isPending}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ── Row 2: Partidas Activas · Pareja Top · Partidas Jugadas · Próximo Evento ── */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 + i * 0.1 }}
            className="h-full"
          >
            <Card className="glass-card overflow-hidden relative h-full">
              <div className={`absolute top-0 right-0 p-4 ${stat.color} opacity-20`}>
                <stat.icon className="w-24 h-24 -mr-8 -mt-8" />
              </div>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  {stat.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${stat.bg}`}>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <div className="text-4xl font-bold">{stat.value || 0}</div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}

        {/* Pareja Top */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="h-full"
        >
          <Card className="glass-card overflow-hidden relative h-full">
            <div className="absolute top-0 right-0 p-4 text-pink-500 opacity-20">
              <Users className="w-24 h-24 -mr-8 -mt-8" />
            </div>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Pareja Top
              </CardTitle>
              <div className="p-2 rounded-lg bg-pink-500/10">
                <Users className="h-4 w-4 text-pink-500" />
              </div>
            </CardHeader>
            <CardContent className="pt-1">
              {statsLoading ? (
                <div className="flex items-center gap-2">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-4 w-16 ml-1" />
                </div>
              ) : stats?.topPair ? (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <Avatar className="h-7 w-7 border border-pink-500/40 shrink-0">
                      <AvatarImage src={avatarSrc(stats.topPair.player1AvatarUrl)} className="object-cover" />
                      <AvatarFallback className="text-[10px] font-bold bg-pink-500/10 text-pink-400">
                        {stats.topPair.player1Name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <Avatar className="h-7 w-7 border border-pink-500/40 shrink-0">
                      <AvatarImage src={avatarSrc(stats.topPair.player2AvatarUrl)} className="object-cover" />
                      <AvatarFallback className="text-[10px] font-bold bg-pink-500/10 text-pink-400">
                        {stats.topPair.player2Name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-3xl font-black text-pink-400 leading-none ml-1">{stats.topPair.wins}</span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest self-end mb-0.5">V</span>
                  </div>
                  <div className="text-xs text-muted-foreground leading-tight">
                    <span className="font-semibold text-foreground/80">{stats.topPair.player1Name}</span>
                    <span className="mx-1 text-pink-500/60">&</span>
                    <span className="font-semibold text-foreground/80">{stats.topPair.player2Name}</span>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Sin datos</div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Próximo Evento */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="h-full"
        >
          <Card className="glass-card overflow-hidden relative h-full">
            <div className="absolute top-0 right-0 p-4 text-yellow-500 opacity-20">
              <CalendarDays className="w-24 h-24 -mr-8 -mt-8" />
            </div>
            <CardHeader className="flex flex-row items-center justify-between pb-1">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Próximo Evento
              </CardTitle>
              <div className="p-2 rounded-lg bg-yellow-500/10">
                <CalendarDays className="h-4 w-4 text-yellow-500" />
              </div>
            </CardHeader>
            <CardContent className="pt-1">
              {nextEvent ? (
                <div className="flex flex-col gap-0">
                  <div className="text-lg font-bold leading-snug line-clamp-2">{nextEvent.title}</div>
                  <div className="text-xs text-muted-foreground font-semibold mt-0.5">
                    {format(new Date(nextEvent.date + "T12:00:00"), "d 'de' MMM, yyyy", { locale: es })}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Sin eventos próximos</div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ── Dev Mode dialog ── */}
      <Dialog open={isDevDialogOpen} onOpenChange={(o) => { setIsDevDialogOpen(o); if (!o) { setDevCode(""); setDevCodeError(false); } }}>
        <DialogContent className="glass-card sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-400">
              <Terminal className="h-5 w-5" />
              Dev Mode
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">Ingresa el código de administrador para habilitar el modo de edición.</p>
            <div className="grid gap-2">
              <Label>Código</Label>
              <Input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                value={devCode}
                onChange={(e) => { setDevCode(e.target.value); setDevCodeError(false); }}
                placeholder="••••••"
                className="bg-background text-center text-xl tracking-widest"
                onKeyDown={(e) => e.key === "Enter" && handleDevCodeVerify()}
                autoFocus
              />
              {devCodeError && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <XCircle className="h-4 w-4 shrink-0" />
                  Código incorrecto
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDevDialogOpen(false)} className="flex-1">Cancelar</Button>
            <Button
              onClick={handleDevCodeVerify}
              disabled={!devCode}
              className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
            >
              <ShieldCheck className="h-4 w-4 mr-2" />
              Activar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reset dialog ── */}
      <Dialog open={isResetOpen} onOpenChange={(o) => { setIsResetOpen(o); if (!o) { setResetCode(""); setResetCodeError(false); setResetStep("code"); } }}>
        <DialogContent className="glass-card sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <RotateCcw className="h-5 w-5" />
              Reset General
            </DialogTitle>
          </DialogHeader>

          {resetStep === "code" ? (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">Ingresa el código de administrador para continuar.</p>
              <div className="grid gap-2">
                <Label>Código secreto</Label>
                <Input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={resetCode}
                  onChange={(e) => { setResetCode(e.target.value); setResetCodeError(false); }}
                  placeholder="••••••"
                  className="bg-background text-center text-xl tracking-widest"
                  onKeyDown={(e) => e.key === "Enter" && handleVerifyResetCode()}
                  autoFocus
                />
                {resetCodeError && (
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <XCircle className="h-4 w-4 shrink-0" />
                    Código incorrecto
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsResetOpen(false)} className="flex-1">Cancelar</Button>
                <Button onClick={handleVerifyResetCode} disabled={!resetCode} className="flex-1">Verificar</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 flex gap-3 items-start">
                <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                <div className="text-sm text-red-300 space-y-1">
                  <p className="font-bold">Esta acción no se puede deshacer.</p>
                  <ul className="list-disc list-inside text-red-400/80 space-y-0.5">
                    <li>Se eliminará todo el historial de partidas</li>
                    <li>Victorias, derrotas, puntos y rachas → 0</li>
                    <li>Ranking de lisas → 0</li>
                    <li>Se conservan nombres y fotos de jugadores</li>
                  </ul>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsResetOpen(false)} className="flex-1">Cancelar</Button>
                <Button
                  variant="destructive"
                  onClick={handleReset}
                  disabled={resetting}
                  className="flex-1"
                >
                  {resetting ? "Reseteando..." : "Confirmar Reset"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
