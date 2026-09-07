import React, { useRef, useState } from "react";
import ScrollToTop from "@/components/scroll-to-top";
import { motion } from "framer-motion";
import { useListPlayers, getListPlayersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Percent, Share2, Medal, Flame, CheckCircle2, Loader2, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useDevMode } from "@/contexts/dev-mode-context";
import html2canvas from "html2canvas";

function avatarSrc(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http")) return path;
  const slug = path.startsWith("/objects/") ? path.slice("/objects/".length) : path;
  return `/api/storage/objects/${slug}`;
}

type PlayerGames = {
  wins: number;
  losses: number;
  gamesPlayedOverride?: number | null;
};

function displayedGames(player: PlayerGames): number {
  return player.gamesPlayedOverride ?? player.wins + player.losses;
}

function positionStyle(pos: number) {
  if (pos === 1) return { badge: "text-yellow-400 bg-yellow-400/15 border-yellow-400/50", row: "border-yellow-400/30 bg-yellow-400/5" };
  if (pos === 2) return { badge: "text-slate-300 bg-slate-300/15 border-slate-300/50", row: "border-slate-300/20 bg-slate-300/5" };
  if (pos === 3) return { badge: "text-amber-600 bg-amber-600/15 border-amber-600/50", row: "border-amber-600/20 bg-amber-600/5" };
  return { badge: "text-muted-foreground bg-muted/50 border-border", row: "border-border/40 bg-card/40" };
}

function positionIcon(pos: number) {
  if (pos <= 3) return <Medal className={`h-4 w-4 ${pos === 1 ? "text-yellow-400" : pos === 2 ? "text-slate-300" : "text-amber-600"}`} />;
  return <span className="text-xs font-bold">{pos}</span>;
}

export default function Promedios() {
  const { data: players, isLoading } = useListPlayers();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isDevMode } = useDevMode();
  const shareRef = useRef<HTMLDivElement>(null);

  const sorted = [...(players ?? [])]
    .filter(p => displayedGames(p) > 0)
    .sort((a, b) => Number(b.winRate) - Number(a.winRate));

  const top10 = sorted.slice(0, 10);

  const leader = sorted[0] ?? null;

  // Edit dialog state
  const [editPlayer, setEditPlayer] = useState<{ id: number; name: string; wins: number; losses: number } | null>(null);
  const [editWins, setEditWins] = useState("");
  const [editLosses, setEditLosses] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const openEdit = (p: { id: number; name: string; wins: number; losses: number }) => {
    setEditPlayer(p);
    setEditWins(String(p.wins));
    setEditLosses(String(p.losses));
  };

  const handleEditSave = async () => {
    if (!editPlayer) return;
    const wins = parseInt(editWins);
    const losses = parseInt(editLosses);
    if (isNaN(wins) || isNaN(losses) || wins < 0 || losses < 0) {
      toast({ variant: "destructive", title: "Valores inválidos", description: "Ingresa números mayores o iguales a 0." });
      return;
    }
    setEditSaving(true);
    try {
      const res = await fetch(`/api/players/${editPlayer.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wins, losses }),
      });
      if (!res.ok) throw new Error();
      await queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() });
      toast({ title: "Actualizado", description: `${editPlayer.name}: ${wins}V – ${losses}D` });
      setEditPlayer(null);
    } catch {
      toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar el jugador." });
    } finally {
      setEditSaving(false);
    }
  };

  const handleShare = async () => {
    if (!shareRef.current || top10.length === 0) return;
    try {
      const canvas = await html2canvas(shareRef.current, {
        backgroundColor: "#0f0f13",
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
      });
      const url = canvas.toDataURL("image/jpeg", 0.92);
      const a = document.createElement("a");
      a.href = url;
      a.download = `jurones_promedios_${new Date().toISOString().slice(0, 10)}.jpg`;
      a.click();
      toast({ title: "¡Imagen generada!", description: "Top 10 promedios descargado como JPG." });
    } catch {
      toast({ title: "Error", description: "No se pudo generar la imagen.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Percent className="h-8 w-8 text-purple-400" />
            Promedios
          </h1>
          <p className="text-muted-foreground mt-1 uppercase tracking-[0.15em] sm:tracking-[0.2em] md:tracking-[0.3em] text-xs">Clasificación por porcentaje de victorias.</p>
        </div>
        <Button
          size="icon"
          onClick={handleShare}
          disabled={isLoading || top10.length === 0}
          title="Compartir Top 10"
          className="h-12 w-12 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/40 hover:bg-purple-500/30 hover:text-purple-300 transition-all shadow-lg shadow-purple-900/20"
        >
          <Share2 className="h-5 w-5" />
        </Button>
      </div>

      {/* Leader banner */}
      {!isLoading && leader && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative overflow-hidden rounded-2xl border border-purple-400/40 bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent p-5 sm:p-6 shadow-lg shadow-purple-900/10"
        >
          <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-purple-500/15 blur-3xl" />
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="shrink-0 text-center">
              <p className="text-[10px] uppercase tracking-widest text-purple-400/70 font-bold mb-0.5">Líder</p>
              <p className="text-4xl sm:text-5xl font-black text-purple-400 leading-none">#1</p>
            </div>
            <Avatar className="h-16 w-16 sm:h-20 sm:w-20 shrink-0 border-2 border-purple-400/50 shadow-lg shadow-purple-900/20">
              <AvatarImage src={avatarSrc(leader.avatarUrl)} className="object-cover" />
              <AvatarFallback className="bg-purple-500/10 text-purple-400 text-xl font-black">
                {leader.name.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-lg sm:text-2xl font-black truncate">{leader.name}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-widest mt-0.5">Mayor win rate del club</p>
              <div className="flex items-center gap-2 mt-2">
                <Percent className="h-5 w-5 text-purple-400 shrink-0" />
                <span className="text-3xl sm:text-4xl font-black text-purple-400">
                  {(Number(leader.winRate) * 100).toFixed(1)}
                </span>
                <span className="text-xs text-purple-400/60 font-semibold uppercase tracking-widest self-end mb-1">%</span>
                {leader.currentStreak > 2 && (
                  <span className="flex items-center gap-1 text-orange-400 text-sm font-bold ml-2">
                    <Flame className="h-4 w-4" /> x{leader.currentStreak}
                  </span>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Ranking list */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-20 glass-card rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : sorted.length > 0 ? (
        <div className="space-y-3">
          {sorted.map((player, index) => {
            const pos = index + 1;
            const style = positionStyle(pos);
            const wrPct = (Number(player.winRate) * 100).toFixed(1);
            const total = displayedGames(player);
            return (
              <motion.div
                key={player.id}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.04 }}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl border ${style.row} backdrop-blur-sm`}
              >
                {/* Position */}
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-bold ${style.badge}`}>
                  {positionIcon(pos)}
                </div>

                {/* Avatar */}
                <Avatar className="h-10 w-10 border-2 border-white/10 shrink-0">
                  <AvatarImage src={avatarSrc(player.avatarUrl)} className="object-cover" />
                  <AvatarFallback className="bg-muted text-sm font-bold">
                    {player.name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                {/* Name + secondary stats */}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-base truncate">{player.name}</p>
                  <div className="flex items-center gap-x-2 gap-y-0.5 flex-wrap text-xs text-muted-foreground mt-0.5">
                    <span>{player.wins}V · {player.losses}D</span>
                    <span className="text-muted-foreground/60">{total} Part</span>
                    {player.currentStreak > 2 && (
                      <span className="flex items-center gap-0.5 text-orange-400 font-bold">
                        <Flame className="h-3 w-3" /> x{player.currentStreak}
                      </span>
                    )}
                  </div>
                </div>

                {/* Win Rate */}
                <div className="text-right shrink-0 pl-2 border-l border-border">
                  <p className="text-2xl font-black text-purple-400">{wrPct}<span className="text-base font-bold text-purple-400/60">%</span></p>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">WR</p>
                </div>

                {/* Dev mode edit */}
                {isDevMode && (
                  <button
                    onClick={(e) => { e.stopPropagation(); openEdit({ id: player.id, name: player.name, wins: player.wins, losses: player.losses }); }}
                    className="shrink-0 h-7 w-7 flex items-center justify-center rounded-lg border border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10 transition-colors"
                    title="Editar victorias y derrotas"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 text-muted-foreground glass-card rounded-2xl">
          Aún no hay suficientes datos para generar el ranking de promedios.
        </div>
      )}

      {/* Hidden share card — top 10 */}
      <div className="absolute left-[-9999px] top-0 pointer-events-none" aria-hidden>
        <div
          ref={shareRef}
          style={{ width: 480, background: "#0f0f13", borderRadius: 20, padding: "28px 24px 24px", fontFamily: "Inter, system-ui, sans-serif" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#c084fc", letterSpacing: "-0.5px" }}>
              % Promedios — Win Rate
            </div>
            <div style={{ flex: 1 }} />
            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, letterSpacing: "0.1em" }}>LOS JURONES</div>
          </div>
          {top10.map((player, index) => {
            const pos = index + 1;
            const medalColor = pos === 1 ? "#c084fc" : pos === 2 ? "#cbd5e1" : pos === 3 ? "#d97706" : "#4b5563";
            const rowBg = pos === 1 ? "rgba(192,132,252,0.08)" : pos <= 3 ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)";
            return (
              <div
                key={player.id}
                style={{ display: "flex", alignItems: "center", gap: 12, background: rowBg, borderRadius: 12, padding: "10px 12px", marginBottom: 6, border: `1px solid ${pos === 1 ? "rgba(192,132,252,0.3)" : "rgba(255,255,255,0.06)"}` }}
              >
                <div style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 13, color: medalColor, border: `1.5px solid ${medalColor}`, background: `${medalColor}18`, flexShrink: 0 }}>
                  {pos}
                </div>
                <div style={{ flex: 1, fontWeight: 700, fontSize: 15, color: "#f3f4f6", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {player.name}
                </div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginRight: 8 }}>
                  {player.wins}V · {player.losses}D
                </div>
                <div style={{ fontWeight: 900, fontSize: 20, color: "#c084fc", minWidth: 56, textAlign: "right" }}>
                  {(Number(player.winRate) * 100).toFixed(1)}<span style={{ fontSize: 11, color: "#9ca3af", marginLeft: 2 }}>%</span>
                </div>
              </div>
            );
          })}
          <div style={{ marginTop: 16, textAlign: "center", fontSize: 10, color: "#374151", letterSpacing: "0.15em", fontWeight: 700 }}>
            LOSJURONESDOMINOCLUB.COM
          </div>
        </div>
      </div>

      {/* Edit dialog — dev mode only */}
      <Dialog open={!!editPlayer} onOpenChange={(o) => { if (!o) setEditPlayer(null); }}>
        <DialogContent className="bg-[#141414] border-[#2a2a2a] max-w-xs">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-yellow-400">
              <Pencil className="h-4 w-4" /> Editar estadísticas
            </DialogTitle>
          </DialogHeader>
          {editPlayer && (
            <div className="space-y-4 py-1">
              <p className="text-sm text-muted-foreground">Jugador: <strong className="text-white">{editPlayer.name}</strong></p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-gray-300 text-xs font-semibold uppercase tracking-wider">Victorias</Label>
                  <Input type="number" min={0} value={editWins} onChange={(e) => setEditWins(e.target.value)}
                    className="bg-background border-[#2a2a2a] text-white text-center text-lg font-bold h-12"
                    onKeyDown={(e) => e.key === "Enter" && handleEditSave()} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-gray-300 text-xs font-semibold uppercase tracking-wider">Derrotas</Label>
                  <Input type="number" min={0} value={editLosses} onChange={(e) => setEditLosses(e.target.value)}
                    className="bg-background border-[#2a2a2a] text-white text-center text-lg font-bold h-12"
                    onKeyDown={(e) => e.key === "Enter" && handleEditSave()} />
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditPlayer(null)} disabled={editSaving}
              className="border-[#2a2a2a] text-gray-300 hover:bg-[#2a2a2a]">Cancelar</Button>
            <Button size="sm" onClick={handleEditSave} disabled={editSaving}
              className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold gap-1.5">
              {editSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {editSaving ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ScrollToTop />
    </div>
  );
}
