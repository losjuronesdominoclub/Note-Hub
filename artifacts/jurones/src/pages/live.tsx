import React, { useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useListMatches, useGetMatch } from "@workspace/api-client-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Radio, RefreshCw, Trophy } from "lucide-react";

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
    <div className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border ${color}`}>
      <Avatar className="h-9 w-9 shrink-0">
        <AvatarImage src={avatarSrc(player.avatarUrl)} className="object-cover" />
        <AvatarFallback className={`text-xs font-bold ${fallbackColor}`}>
          {player.name.substring(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span className="font-semibold text-sm leading-tight">{player.name}</span>
    </div>
  );
}

function LiveMatchCard({ matchId }: { matchId: number }) {
  const { data: match } = useGetMatch(matchId, {
    query: { refetchInterval: 3000 },
  });

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
              <PlayerPill key={player.id} player={player} team="cortos" />
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
    </motion.div>
  );
}

export default function LiveMatches() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [spinning, setSpinning] = useState(false);

  const { data: matches, isLoading, refetch } = useListMatches(
    { status: "active" },
    { query: { refetchInterval: 5000 } }
  );

  const handleRefresh = useCallback(async () => {
    setSpinning(true);
    await refetch();
    setTimeout(() => setSpinning(false), 600);
    setRefreshKey(k => k + 1);
  }, [refetch]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-4xl mx-auto">
      {/* Header — solo el botón de actualizar como acción */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-red-500/10 rounded-full text-red-500 animate-pulse">
            <Radio className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">En Vivo</h1>
            <p className="text-muted-foreground text-sm">Actualización automática cada 5 s.</p>
          </div>
        </div>

        {/* ÚNICO botón permitido */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          className="gap-2 border-primary/30 text-primary hover:bg-primary/10 rounded-full px-4"
        >
          <RefreshCw className={`h-4 w-4 transition-transform duration-500 ${spinning ? "rotate-180" : ""}`} />
          Actualizar
        </Button>
      </div>

      {/* Matches */}
      {isLoading ? (
        <div className="text-center py-20 text-muted-foreground">Cargando partidas...</div>
      ) : matches && matches.length > 0 ? (
        <div key={refreshKey} className="flex flex-col gap-6">
          {matches.map(m => (
            <LiveMatchCard key={m.id} matchId={m.id} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 glass-card rounded-2xl">
          <Radio className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-20" />
          <h3 className="text-xl font-bold mb-2">No hay partidas activas</h3>
          <p className="text-muted-foreground">Cuando inicie un nuevo juego, aparecerá aquí automáticamente.</p>
        </div>
      )}
    </div>
  );
}
