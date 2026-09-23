import React, { useRef, useState } from "react";
import ScrollToTop from "@/components/scroll-to-top";
import { motion } from "framer-motion";
import { useListPlayers } from "@workspace/api-client-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Star, Share2, Medal, Trophy, Pencil, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useDevMode } from "@/contexts/dev-mode-context";
import { useQueryClient } from "@tanstack/react-query";
import html2canvas from "html2canvas";

function avatarSrc(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http")) return path;
  const slug = path.startsWith("/objects/") ? path.slice("/objects/".length) : path;
  return `/api/storage/objects/${slug}`;
}

function positionStyle(pos: number) {
  if (pos === 1) return { badge: "text-yellow-400 bg-yellow-400/15 border-yellow-400/50", row: "border-yellow-400/30 bg-yellow-400/5" };
  if (pos === 2) return { badge: "text-slate-300 bg-slate-300/15 border-slate-300/50", row: "border-slate-300/20 bg-slate-300/5" };
  if (pos === 3) return { badge: "text-amber-600 bg-amber-600/15 border-amber-600/50", row: "border-amber-600/20 bg-amber-600/5" };
  return { badge: "text-muted-foreground bg-muted/50 border-border", row: "border-border/40 bg-card/40" };
}

function positionIcon(pos: number) {
  if (pos === 1) return <Medal className="h-4 w-4 text-yellow-400" />;
  if (pos === 2) return <Medal className="h-4 w-4 text-slate-300" />;
  if (pos === 3) return <Medal className="h-4 w-4 text-amber-600" />;
  return <span className="text-xs font-bold">{pos}</span>;
}

export default function RankingPoints() {
  const { data: players, isLoading } = useListPlayers();
  const { toast } = useToast();
  const { isDevMode } = useDevMode();
  const queryClient = useQueryClient();
  const shareRef = useRef<HTMLDivElement>(null);
  const [editingPlayer, setEditingPlayer] = useState<{ id: number; name: string; topPts: number } | null>(null);
  const [topPtsInput, setTopPtsInput] = useState("");
  const [adminCode, setAdminCode] = useState("");
  const [saveError, setSaveError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const totalPuntos = (players ?? []).reduce((sum, p) => sum + (p.totalPoints ?? 0), 0);
  const sorted = [...(players ?? [])].sort((a, b) => (b.totalPoints ?? 0) - (a.totalPoints ?? 0));
  const top10 = sorted.slice(0, 10);

  // Record #1: player with highest topPts, only shown if > 120
  const recordHolder = [...(players ?? [])]
    .filter(p => (p.topPts ?? 0) > 120)
    .sort((a, b) => (b.topPts ?? 0) - (a.topPts ?? 0))[0] ?? null;

  const openTopPtsEditor = (player: { id: number; name: string; topPts?: number | null }) => {
    setEditingPlayer({ id: player.id, name: player.name, topPts: player.topPts ?? 0 });
    setTopPtsInput(String(player.topPts ?? 0));
    setAdminCode("");
    setSaveError("");
  };

  const closeTopPtsEditor = () => {
    setEditingPlayer(null);
    setTopPtsInput("");
    setAdminCode("");
    setSaveError("");
  };

  const saveTopPts = async () => {
    if (!editingPlayer || !adminCode.trim()) return;
    const value = Number(topPtsInput);
    if (!Number.isInteger(value) || value < 0) {
      setSaveError("Top Pts debe ser un número entero igual o mayor que 0.");
      return;
    }

    setIsSaving(true);
    setSaveError("");
    try {
      const response = await fetch(`/api/players/${editingPlayer.id}/top-pts`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminCode, topPts: value }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "No se pudo actualizar Top Pts.");

      await queryClient.invalidateQueries();
      closeTopPtsEditor();
      toast({
        title: "Top Pts actualizado",
        description: `${editingPlayer.name}: ${value} puntos.`,
      });
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "No se pudo actualizar Top Pts.");
    } finally {
      setIsSaving(false);
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
      a.download = `jurones_ranking_puntos_${new Date().toISOString().slice(0, 10)}.jpg`;
      a.click();
      toast({ title: "¡Imagen generada!", description: "Top 10 descargado como JPG." });
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
            <Star className="h-8 w-8 text-yellow-400" />
            Ranking de Puntos
          </h1>
          <p className="text-muted-foreground mt-1 uppercase tracking-[0.15em] sm:tracking-[0.2em] md:tracking-[0.3em] text-xs">Clasificación por puntuación total acumulada.</p>
          {!isLoading && (
            <p className="mt-2 text-sm text-white/80">
              <span className="text-white/40 uppercase tracking-widest text-xs font-semibold">Total de Puntos</span>
              {" "}
              <span className="font-black text-white text-base tabular-nums">{totalPuntos.toLocaleString()}</span>
            </p>
          )}
        </div>
        <Button
          size="icon"
          onClick={handleShare}
          disabled={isLoading || top10.length === 0}
          title="Compartir Top 10"
          className="h-12 w-12 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/40 hover:bg-yellow-500/30 hover:text-yellow-300 transition-all shadow-lg shadow-yellow-900/20"
        >
          <Share2 className="h-5 w-5" />
        </Button>
      </div>

      {/* Record #1 Banner */}
      {!isLoading && recordHolder && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative overflow-hidden rounded-2xl border border-[#e8b03f]/40 bg-gradient-to-br from-[#e8b03f]/10 via-[#e8b03f]/5 to-transparent p-5 sm:p-6 shadow-lg shadow-[#e8b03f]/10"
        >
          {/* Glow */}
          <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-[#e8b03f]/15 blur-3xl" />

          <div className="flex items-center gap-4 sm:gap-6">
            {/* #1 label */}
            <div className="shrink-0 text-center">
              <p className="text-[10px] uppercase tracking-widest text-[#e8b03f]/70 font-bold mb-0.5">Récord</p>
              <p className="text-4xl sm:text-5xl font-black text-[#e8b03f] leading-none">#1</p>
            </div>

            {/* Avatar */}
            <Avatar className="h-16 w-16 sm:h-20 sm:w-20 shrink-0 border-2 border-[#e8b03f]/50 shadow-lg shadow-[#e8b03f]/20">
              <AvatarImage src={avatarSrc(recordHolder.avatarUrl)} className="object-cover" />
              <AvatarFallback className="bg-[#e8b03f]/10 text-[#e8b03f] text-xl font-black">
                {recordHolder.name.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            {/* Name + pts */}
            <div className="flex-1 min-w-0">
              <p className="text-lg sm:text-2xl font-black truncate">{recordHolder.name}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-widest mt-0.5">Puntuación individual más alta</p>
                <div className="flex items-center gap-2 mt-2">
                <Trophy className="h-5 w-5 text-[#e8b03f] shrink-0" />
                <span className="text-3xl sm:text-4xl font-black text-[#e8b03f]">{recordHolder.topPts}</span>
                <span className="text-xs text-[#e8b03f]/60 font-semibold uppercase tracking-widest self-end mb-1">pts</span>
                  {isDevMode && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-2 h-8 text-[#e8b03f] hover:bg-[#e8b03f]/10 hover:text-[#f6c95b]"
                      onClick={() => openTopPtsEditor(recordHolder)}
                    >
                      <Pencil className="mr-1 h-3.5 w-3.5" /> Editar
                    </Button>
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
            return (
              <motion.div
                key={player.id}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.04 }}
                className={`flex items-center gap-4 px-4 py-3 rounded-2xl border ${style.row} backdrop-blur-sm`}
              >
                {/* Position badge */}
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-bold ${style.badge}`}>
                  {positionIcon(pos)}
                </div>

                {/* Avatar */}
                <Avatar className="h-12 w-12 border-2 border-white/10 shrink-0">
                  <AvatarImage src={avatarSrc(player.avatarUrl)} className="object-cover" />
                  <AvatarFallback className="bg-muted text-base font-bold">
                    {player.name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                {/* Name + stats */}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-base truncate">{player.name}</p>
                  <div className="flex items-center gap-3 flex-wrap">
                    <p className="text-xs text-muted-foreground">
                      {player.wins}V · {player.losses}D · {(Number(player.winRate) * 100).toFixed(0)}% WR
                    </p>
                    {(player.topPts ?? 0) > 0 && (
                      <p className="flex items-center gap-1 text-xs text-[#e8b03f]/80">
                        <Trophy className="h-3 w-3 text-[#e8b03f]" />
                        <span className="font-bold">{player.topPts}</span>
                        <span className="text-[#e8b03f]/50">top</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Points */}
                <div className="text-right shrink-0">
                  <p className="text-2xl font-black text-yellow-400">{player.totalPoints ?? 0}</p>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">pts</p>
                </div>
                {isDevMode && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1 border-[#e8b03f]/40 text-[#e8b03f] hover:bg-[#e8b03f]/10 hover:text-[#f6c95b]"
                    onClick={() => openTopPtsEditor(player)}
                  >
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </Button>
                )}
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 text-muted-foreground">
          Aún no hay datos de puntuación.
        </div>
      )}

      {/* Hidden share card — top 10 */}
      <div className="absolute left-[-9999px] top-0 pointer-events-none" aria-hidden>
        <div
          ref={shareRef}
          style={{
            width: 480,
            background: "#0f0f13",
            borderRadius: 20,
            padding: "28px 24px 24px",
            fontFamily: "Inter, system-ui, sans-serif",
          }}
        >
          {/* Title */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#fbbf24", letterSpacing: "-0.5px" }}>
              ★ Ranking de Puntos
            </div>
            <div style={{ flex: 1 }} />
            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, letterSpacing: "0.1em" }}>
              LOS JURONES
            </div>
          </div>

          {/* Rows */}
          {top10.map((player, index) => {
            const pos = index + 1;
            const medalColor = pos === 1 ? "#fbbf24" : pos === 2 ? "#cbd5e1" : pos === 3 ? "#d97706" : "#4b5563";
            const rowBg = pos === 1 ? "rgba(251,191,36,0.08)" : pos <= 3 ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)";
            return (
              <div
                key={player.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  background: rowBg,
                  borderRadius: 12,
                  padding: "10px 12px",
                  marginBottom: 6,
                  border: `1px solid ${pos === 1 ? "rgba(251,191,36,0.25)" : "rgba(255,255,255,0.06)"}`,
                }}
              >
                {/* Rank */}
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 900, fontSize: 13, color: medalColor,
                  border: `1.5px solid ${medalColor}`,
                  background: `${medalColor}18`,
                  flexShrink: 0,
                }}>
                  {pos}
                </div>

                {/* Name */}
                <div style={{ flex: 1, fontWeight: 700, fontSize: 15, color: "#f3f4f6", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {player.name}
                </div>

                {/* Top PTS */}
                {(player.topPts ?? 0) > 0 && (
                  <div style={{ fontSize: 11, color: "#e8b03f", marginRight: 6, display: "flex", alignItems: "center", gap: 3 }}>
                    🏆 {player.topPts}
                  </div>
                )}

                {/* W/L */}
                <div style={{ fontSize: 11, color: "#9ca3af", marginRight: 8 }}>
                  {player.wins}V · {player.losses}D
                </div>

                {/* Points */}
                <div style={{ fontWeight: 900, fontSize: 20, color: "#fbbf24", minWidth: 48, textAlign: "right" }}>
                  {player.totalPoints ?? 0}
                  <span style={{ fontSize: 10, color: "#6b7280", fontWeight: 600, marginLeft: 3 }}>pts</span>
                </div>
              </div>
            );
          })}

          {/* Footer */}
          <div style={{ marginTop: 16, textAlign: "center", fontSize: 10, color: "#374151", letterSpacing: "0.15em", fontWeight: 700 }}>
            LOSJURONESDOMINOCLUB.COM
          </div>
        </div>
      </div>
      <Dialog open={Boolean(editingPlayer)} onOpenChange={(open) => !open && closeTopPtsEditor()}>
        <DialogContent className="glass-card sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-[#e8b03f]" />
              Editar Top Pts — {editingPlayer?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Corrige manualmente la puntuación individual más alta. El nuevo valor se reflejará en todos los rankings.
            </p>
            <div className="grid gap-2">
              <Label htmlFor="top-pts-value">Top Pts</Label>
              <Input
                id="top-pts-value"
                type="number"
                min={0}
                step={1}
                value={topPtsInput}
                onChange={(event) => setTopPtsInput(event.target.value)}
                className="bg-background text-center text-2xl font-bold"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="top-pts-admin-code">Código de administrador</Label>
              <Input
                id="top-pts-admin-code"
                type="password"
                value={adminCode}
                onChange={(event) => { setAdminCode(event.target.value); setSaveError(""); }}
                onKeyDown={(event) => event.key === "Enter" && void saveTopPts()}
                className="bg-background"
                autoFocus
              />
            </div>
            {saveError && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <XCircle className="h-4 w-4 shrink-0" />
                {saveError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeTopPtsEditor} disabled={isSaving} className="flex-1">
              Cancelar
            </Button>
            <Button onClick={() => void saveTopPts()} disabled={isSaving || !adminCode.trim()} className="flex-1">
              {isSaving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ScrollToTop />
    </div>
  );
}
