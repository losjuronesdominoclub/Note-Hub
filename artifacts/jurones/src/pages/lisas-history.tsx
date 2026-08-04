import React, { useState, useMemo } from "react";
import ScrollToTop from "@/components/scroll-to-top";
import { motion } from "framer-motion";
import { useListHistory, useUpdateMatch, getListHistoryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Fish, Edit2, Trash2, Trophy, Copy, Check, ChevronDown, CalendarDays, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

const TZ = "America/Santo_Domingo";

function matchDay(match: any): string {
  const d = new Date(match.finishedAt ?? match.createdAt);
  return d.toLocaleDateString("en-CA", { timeZone: TZ });
}

function dayLabel(dayStr: string): string {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: TZ });
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString("en-CA", { timeZone: TZ });
  if (dayStr === today) return "Hoy";
  if (dayStr === yesterday) return "Ayer";
  const [yyyy, mm, dd] = dayStr.split("-").map(Number);
  return new Date(yyyy, mm - 1, dd).toLocaleDateString("es-DO", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function buildMatchText(match: any): string {
  const date = new Date(match.finishedAt ?? match.createdAt);
  const dateStr = date.toLocaleDateString("es-DO", {
    timeZone: TZ,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  const num = String(match.matchNumber).padStart(3, "0");
  const cortos: string[] = (match.players ?? [])
    .filter((p: any) => p.team === "cortos")
    .map((p: any) => p.player?.name ?? p.playerName ?? "");
  const largos: string[] = (match.players ?? [])
    .filter((p: any) => p.team === "largos")
    .map((p: any) => p.player?.name ?? p.playerName ?? "");
  const lines: string[] = [];
  lines.push(`Partida #${num} ${dateStr}`);
  lines.push("", "");
  lines.push("Cortos");
  lines.push(String(match.shortosScore));
  cortos.forEach((name, i) => { if (i > 0) lines.push(""); lines.push(name); });
  lines.push("");
  lines.push("VS");
  lines.push("Largos");
  lines.push(String(match.largosScore));
  largos.forEach((name, i) => { if (i > 0) lines.push(""); lines.push(name); });
  return lines.join("\n");
}

export default function LisasHistory() {
  const { data: allMatches, isLoading } = useListHistory();
  const updateMatch = useUpdateMatch();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  // Filter only lisas (one team scored 0)
  const matches = useMemo(
    () => (allMatches ?? []).filter((m: any) => m.shortosScore === 0 || m.largosScore === 0),
    [allMatches]
  );

  const [visibleDays, setVisibleDays] = useState(5);

  const dayGroups = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const m of matches) {
      const day = matchDay(m);
      if (!map[day]) map[day] = [];
      map[day].push(m);
    }
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  }, [matches]);

  const visibleGroups = dayGroups.slice(0, visibleDays);
  const hasMore = visibleDays < dayGroups.length;

  const [copiedId, setCopiedId] = useState<number | null>(null);

  const handleCopy = (match: any) => {
    const text = buildMatchText(match);
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(match.id);
      setTimeout(() => setCopiedId(null), 1800);
    }).catch(() => {
      toast({ title: "Error", description: "No se pudo copiar al portapapeles.", variant: "destructive" });
    });
  };

  const [selectedMatch, setSelectedMatch] = useState<any>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [adminCode, setAdminCode] = useState("");
  const [formData, setFormData] = useState({ shortosScore: 0, largosScore: 0 });

  const openEdit = (match: any) => {
    setSelectedMatch(match);
    setFormData({ shortosScore: match.shortosScore, largosScore: match.largosScore });
    setAdminCode("");
    setIsEditOpen(true);
  };

  const openDelete = (match: any) => {
    setSelectedMatch(match);
    setAdminCode("");
    setIsDeleteOpen(true);
  };

  const handleEdit = () => {
    if (!selectedMatch || !adminCode) return;
    updateMatch.mutate({
      id: selectedMatch.id,
      data: {
        adminCode,
        shortosScore: formData.shortosScore,
        largosScore: formData.largosScore,
        winnerTeam: formData.shortosScore >= 200 ? "cortos" : formData.largosScore >= 200 ? "largos" : selectedMatch.winnerTeam,
      },
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListHistoryQueryKey() });
        setIsEditOpen(false);
        toast({ title: "Partida actualizada", description: "Los cambios han sido guardados." });
      },
      onError: () => {
        toast({ title: "Error", description: "Código de administrador inválido o error al guardar.", variant: "destructive" });
      },
    });
  };

  const handleDelete = () => {
    if (!selectedMatch || !adminCode) return;
    fetch(`/api/matches/${selectedMatch.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminCode }),
    }).then(res => {
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: getListHistoryQueryKey() });
        setIsDeleteOpen(false);
        toast({ title: "Partida eliminada", description: "El registro ha sido borrado." });
      } else {
        toast({ title: "Error", description: "Código de administrador inválido.", variant: "destructive" });
      }
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-8 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="relative inline-flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-cyan-500/10 blur-xl scale-150" />
            <Fish className="w-10 h-10 text-cyan-400 relative" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Historial de LISAS</h1>
            <p className="text-muted-foreground mt-1 uppercase tracking-[0.15em] sm:tracking-[0.2em] text-xs">
              Partidas terminadas <span className="text-cyan-400 font-semibold">200 – 0</span>.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/lisas")}
          className="gap-2 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 rounded-full"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-20 text-muted-foreground">Cargando historial...</div>
      ) : dayGroups.length > 0 ? (
        <div className="space-y-8">
          {visibleGroups.map(([day, dayMatches]) => (
            <div key={day} className="space-y-3">
              {/* Day header */}
              <div className="flex items-center gap-3">
                <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-bold uppercase tracking-widest text-muted-foreground capitalize">
                  {dayLabel(day)}
                </span>
                <span className="text-xs text-muted-foreground/50 font-medium">
                  · {dayMatches.length} lisa{dayMatches.length !== 1 ? "s" : ""}
                </span>
                <div className="flex-1 h-px bg-border/50" />
              </div>

              {/* Matches for this day */}
              <div className="grid gap-4">
                {dayMatches.map((match, index) => (
                  <motion.div
                    key={match.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.04 }}
                  >
                    <Card className="glass-card group hover:bg-white/5 transition-colors border-cyan-500/20">
                      <CardContent className="p-5 flex flex-col gap-4">
                        {/* Lisa badge + header row */}
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-muted-foreground">Partida #{match.matchNumber}</span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(match.finishedAt || match.createdAt).toLocaleTimeString("es-DO", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: true })}
                              </span>
                              <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 rounded-full px-2 py-0.5 flex items-center gap-1">
                                <Fish className="h-2.5 w-2.5" /> Lisa
                              </span>
                            </div>
                            {match.createdBy && (
                              <span className="text-xs text-muted-foreground/60">
                                <span className="text-muted-foreground/40">Anotador:</span>{" "}
                                <span className="font-medium text-muted-foreground/70">{match.createdBy}</span>
                              </span>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className={`h-8 w-8 transition-colors ${copiedId === match.id ? "text-green-400 hover:text-green-400" : "hover:text-primary"}`}
                              title="Copiar datos de la partida"
                              onClick={() => handleCopy(match)}
                            >
                              {copiedId === match.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-primary" onClick={() => openEdit(match)}>
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" onClick={() => openDelete(match)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>

                        {/* Score row with player names */}
                        <div className="flex items-stretch gap-3">
                          {/* Cortos */}
                          <div className={`flex-1 flex flex-col items-center rounded-xl py-3 px-2 ${match.winnerTeam === "cortos" ? "bg-red-500/10 border border-red-500/30" : "bg-muted/30"}`}>
                            <span className={`uppercase text-xs tracking-widest mb-1 font-semibold ${match.winnerTeam === "cortos" ? "text-red-400" : "text-muted-foreground"}`}>Cortos</span>
                            <div className="flex items-center gap-1.5">
                              <span className={`text-3xl font-bold tabular-nums ${match.winnerTeam === "cortos" ? "text-red-400" : "text-muted-foreground"}`}>{match.shortosScore}</span>
                              {match.winnerTeam === "cortos" && <Trophy className="h-4 w-4 text-red-400" />}
                            </div>
                            <div className="mt-2 space-y-0.5 text-center">
                              {(match as any).players?.filter((p: any) => p.team === "cortos").map((p: any) => (
                                <p key={p.playerId} className="text-xs text-muted-foreground leading-tight">{p.player?.name ?? p.playerName}</p>
                              ))}
                            </div>
                          </div>

                          {/* VS divider */}
                          <div className="flex items-center text-muted-foreground/50 font-light text-lg self-center">VS</div>

                          {/* Largos */}
                          <div className={`flex-1 flex flex-col items-center rounded-xl py-3 px-2 ${match.winnerTeam === "largos" ? "bg-blue-500/10 border border-blue-500/30" : "bg-muted/30"}`}>
                            <span className={`uppercase text-xs tracking-widest mb-1 font-semibold ${match.winnerTeam === "largos" ? "text-blue-400" : "text-muted-foreground"}`}>Largos</span>
                            <div className="flex items-center gap-1.5">
                              <span className={`text-3xl font-bold tabular-nums ${match.winnerTeam === "largos" ? "text-blue-400" : "text-muted-foreground"}`}>{match.largosScore}</span>
                              {match.winnerTeam === "largos" && <Trophy className="h-4 w-4 text-blue-400" />}
                            </div>
                            <div className="mt-2 space-y-0.5 text-center">
                              {(match as any).players?.filter((p: any) => p.team === "largos").map((p: any) => (
                                <p key={p.playerId} className="text-xs text-muted-foreground leading-tight">{p.player?.name ?? p.playerName}</p>
                              ))}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}

          {/* Cargar más */}
          {hasMore && (
            <div className="flex flex-col items-center gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setVisibleDays(d => d + 1)}
                className="gap-2 rounded-full px-6 border-border hover:border-primary hover:bg-primary/5"
              >
                <ChevronDown className="h-4 w-4" />
                Cargar más
                <span className="text-xs text-muted-foreground ml-1">
                  ({dayGroups.length - visibleDays} jornada{dayGroups.length - visibleDays !== 1 ? "s" : ""} restante{dayGroups.length - visibleDays !== 1 ? "s" : ""})
                </span>
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-20 text-muted-foreground glass-card rounded-2xl flex flex-col items-center gap-4">
          <Fish className="w-12 h-12 opacity-30" />
          <p>No hay lisas registradas.</p>
        </div>
      )}

      {/* Edit Modal */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="glass-card sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar Resultado</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className="text-red-500">Puntos Cortos</Label>
                <Input
                  type="number"
                  value={formData.shortosScore}
                  onChange={e => setFormData({ ...formData, shortosScore: parseInt(e.target.value) || 0 })}
                  className="bg-background text-center text-xl"
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-blue-500">Puntos Largos</Label>
                <Input
                  type="number"
                  value={formData.largosScore}
                  onChange={e => setFormData({ ...formData, largosScore: parseInt(e.target.value) || 0 })}
                  className="bg-background text-center text-xl"
                />
              </div>
            </div>
            <div className="grid gap-2 mt-4 pt-4 border-t border-border">
              <Label>Código de Admin</Label>
              <Input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                value={adminCode}
                onChange={e => setAdminCode(e.target.value)}
                placeholder="******"
                className="bg-background"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleEdit} disabled={updateMatch.isPending || !adminCode} className="w-full">
              {updateMatch.isPending ? "Guardando..." : "Guardar Modificación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Modal */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="glass-card sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>¿Eliminar Partida?</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <p className="text-muted-foreground text-sm">Esta acción eliminará el registro permanentemente. Ingresa el código de admin para confirmar.</p>
            <div className="grid gap-2">
              <Label>Código de Admin</Label>
              <Input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                value={adminCode}
                onChange={e => setAdminCode(e.target.value)}
                placeholder="******"
                className="bg-background"
              />
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)} className="flex-1">Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={!adminCode} className="flex-1">
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ScrollToTop />
    </div>
  );
}
