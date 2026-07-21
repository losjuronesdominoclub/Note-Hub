import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useListMatches, getListMatchesQueryKey, useGetMatch, getGetMatchQueryKey } from "@workspace/api-client-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Radio, RefreshCw, Trophy, Volume2, VolumeX } from "lucide-react";

// Speak synchronously — must be called directly from a user gesture on first use.
// After first user-gesture unlock, can be called from any context (useEffect, timers).
function speakNow(text: string) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.resume(); // Chrome bug: keeps synthesis from getting stuck
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "es";
  u.rate = 1.05;
  u.pitch = 1.0;
  window.speechSynthesis.speak(u);
}

function avatarSrc(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http")) return path;
  const slug = path.startsWith("/objects/") ? path.slice("/objects/".length) : path;
  return `/api/storage/objects/${slug}`;
}

function PlayerPill({ player, team }: { player: { name: string; avatarUrl?: string | null }; team: "cortos" | "largos" }) {
  const color = team === "cortos" ? "border-red-500/40 bg-red-500/10" : "border-blue-500/40 bg-blue-500/10";
  const fallbackColor = team === "cortos" ? "bg-red-500/20 text-red-400" : "bg-blue-500/20 text-blue-400";
  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border ${color}`}>
      <Avatar className="h-6 w-6 shrink-0">
        <AvatarImage src={avatarSrc(player.avatarUrl)} className="object-cover" />
        <AvatarFallback className={`text-[9px] font-bold ${fallbackColor}`}>
          {player.name.substring(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span className="font-semibold text-xs leading-tight truncate">{player.name}</span>
    </div>
  );
}

function LiveMatchCard({ matchId, narrate }: { matchId: number; narrate: boolean }) {
  const { data: match } = useGetMatch(matchId, {
    query: { queryKey: getGetMatchQueryKey(matchId), refetchInterval: 3000 },
  });

  // Keep a ref so the score-watcher effect doesn't re-run when narrate toggles
  const narrateRef = useRef(narrate);
  useEffect(() => { narrateRef.current = narrate; }, [narrate]);

  const lastLogIdRef = useRef<number | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    const latest = match?.scoreLog?.[0];
    if (!latest) return;

    // On first load: just snapshot the current latest ID, don't speak
    if (!initializedRef.current) {
      initializedRef.current = true;
      lastLogIdRef.current = latest.id;
      return;
    }

    if (latest.id === lastLogIdRef.current) return;
    lastLogIdRef.current = latest.id;

    if (!narrateRef.current) return;

    const note: string | null = (latest as any).note ?? null;
    const teamName = latest.team === "cortos" ? "los cortos" : "los largos";
    let text: string;

    if (note) {
      if (note.includes("🐐")) {
        const playerName = note.split("🐐")[0].trim().replace(/\s*-\s*$/, "");
        text = `¡${playerName} hizo chivo! Sesenta puntos para ${teamName}.`;
      } else if (note.toLowerCase().includes("pasó con ficha")) {
        const playerName = note.split(" - ")[0].trim();
        text = `${playerName} pasó con ficha. Sesenta puntos para ${teamName}.`;
      } else {
        text = note.replace(/[🐐⚠️]/g, "").trim();
      }
    } else {
      const pts = latest.points === 30 ? "treinta" : latest.points === 60 ? "sesenta" : `${latest.points}`;
      text = `${latest.playerName} anota ${pts} puntos para ${teamName}.`;
    }

    speakNow(text);
  // Only re-run when a genuinely new log entry arrives
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match?.scoreLog?.[0]?.id]);

  if (!match) return null;

  const cortosPlayers = match.players.filter(p => p.team === "cortos");
  const largosPlayers = match.players.filter(p => p.team === "largos");
  const isFinished = match.status === "finished";
  const isLisa = isFinished && (match.shortosScore === 0 || match.largosScore === 0);
  const cortosWin = match.winnerTeam === "cortos";
  const largosWin = match.winnerTeam === "largos";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-3xl overflow-hidden"
    >
      {/* Match number badge */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-border/50">
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
        <div className={`flex flex-col items-center justify-between gap-2 p-3 bg-gradient-to-b from-red-500/10 to-transparent ${cortosWin ? "ring-2 ring-red-500/40 ring-inset" : ""}`}>
          <span className="text-xs font-black uppercase tracking-[0.2em] text-red-500">Cortos</span>
          <div className={`text-[3.5rem] font-black tabular-nums leading-none tracking-tighter ${cortosWin ? "text-red-400" : "text-foreground"}`}>
            {match.shortosScore}
          </div>
          <div className="flex flex-col gap-1 w-full">
            {cortosPlayers.map(({ player }) => (
              <PlayerPill key={player.id} player={player} team="cortos" />
            ))}
          </div>
        </div>

        {/* Center VS */}
        <div className="flex flex-col items-center justify-center gap-1 p-2">
          <div className="text-lg font-black text-muted-foreground/40">VS</div>
          <div className="w-px flex-1 bg-border/30 my-0.5" />
          <div className="text-[9px] text-muted-foreground uppercase tracking-widest">200 pts</div>
        </div>

        {/* Largos */}
        <div className={`flex flex-col items-center justify-between gap-2 p-3 bg-gradient-to-b from-blue-500/10 to-transparent ${largosWin ? "ring-2 ring-blue-500/40 ring-inset" : ""}`}>
          <span className="text-xs font-black uppercase tracking-[0.2em] text-blue-500">Largos</span>
          <div className={`text-[3.5rem] font-black tabular-nums leading-none tracking-tighter ${largosWin ? "text-blue-400" : "text-foreground"}`}>
            {match.largosScore}
          </div>
          <div className="flex flex-col gap-1 w-full">
            {largosPlayers.map(({ player }) => (
              <PlayerPill key={player.id} player={player} team="largos" />
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

      {/* Score log */}
      {match.scoreLog && match.scoreLog.length > 0 && (
        <div className="border-t border-border/50 px-4 py-2">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Registro</span>
            <span className="text-[9px] bg-white/5 border border-white/10 rounded-full px-1.5 py-0.5 text-muted-foreground font-semibold">
              {match.scoreLog.length}
            </span>
          </div>
          <div className="flex flex-col gap-0 max-h-28 overflow-y-auto pr-1 scrollbar-thin">
            <AnimatePresence initial={false}>
              {match.scoreLog.map((log, idx) => {
                const isLatest = idx === 0 && !isFinished;
                return (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.25 }}
                    className={`flex items-center justify-between py-1 px-2 rounded-md transition-colors ${isLatest ? "bg-yellow-500/8 border border-yellow-500/20" : "hover:bg-white/3"}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${log.team === "cortos" ? "bg-red-500" : "bg-blue-500"}`} />
                      <span className={`text-xs font-medium truncate ${isLatest ? "text-yellow-400" : "text-foreground/80"}`}>
                        {(log as any).note ?? log.playerName}
                      </span>
                      {isLatest && (
                        <span className="text-[8px] text-yellow-500 bg-yellow-500/10 px-1 py-0.5 rounded font-bold uppercase tracking-wide shrink-0">nuevo</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <span className={`font-black text-sm tabular-nums ${log.team === "cortos" ? "text-red-400" : "text-blue-400"}`}>
                        +{log.points}
                      </span>
                      <span className="text-[9px] text-muted-foreground/50">
                        {new Date(log.createdAt).toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default function LiveMatches() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [narrate, setNarrate] = useState(true);

  const { data: matches, isLoading, refetch } = useListMatches(
    { status: "active" },
    { query: { queryKey: getListMatchesQueryKey({ status: "active" }), refetchInterval: 5000 } }
  );

  const handleRefresh = useCallback(async () => {
    setSpinning(true);
    await refetch();
    setTimeout(() => setSpinning(false), 600);
    setRefreshKey(k => k + 1);
  }, [refetch]);

  return (
    <div className="flex flex-col gap-3 animate-in fade-in duration-500 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-red-500/10 rounded-full text-red-500 animate-pulse">
            <Radio className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight leading-none">En Vivo</h1>
            <p className="text-muted-foreground text-xs">Auto-actualiza cada 5 s.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (narrate) {
                window.speechSynthesis?.cancel();
                setNarrate(false);
              } else {
                setNarrate(true);
                speakNow("Narrador activado.");
              }
            }}
            className={`gap-1.5 rounded-full px-3 h-8 text-xs transition-colors ${narrate ? "border-yellow-500/50 text-yellow-400 bg-yellow-500/10 hover:bg-yellow-500/20" : "border-border text-muted-foreground hover:bg-white/5"}`}
            title={narrate ? "Silenciar narrador" : "Activar narrador"}
          >
            {narrate ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{narrate ? "Narrador" : "Silenciado"}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="gap-1.5 border-primary/30 text-primary hover:bg-primary/10 rounded-full px-3 h-8 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 transition-transform duration-500 ${spinning ? "rotate-180" : ""}`} />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Matches */}
      {isLoading ? (
        <div className="text-center py-16 text-muted-foreground">Cargando partidas...</div>
      ) : matches && matches.length > 0 ? (
        <div key={refreshKey} className="flex flex-col gap-3">
          {matches.map(m => (
            <LiveMatchCard key={m.id} matchId={m.id} narrate={narrate} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 glass-card rounded-2xl">
          <Radio className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-20" />
          <h3 className="text-lg font-bold mb-1">No hay partidas activas</h3>
          <p className="text-muted-foreground text-sm">Cuando inicie un nuevo juego, aparecerá aquí automáticamente.</p>
        </div>
      )}
    </div>
  );
}
