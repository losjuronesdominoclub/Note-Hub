import React, { useRef, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BarChart2, Search, Share2, Fish, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import html2canvas from "html2canvas";
import logoPath from "@assets/logo_1779907396869.png";

function avatarSrc(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http")) return path;
  const slug = path.startsWith("/objects/") ? path.slice("/objects/".length) : path;
  return `/api/storage/objects/${slug}`;
}

interface DayPlayer {
  playerId: number;
  name: string;
  avatarUrl: string | null;
  wins: number;
  losses: number;
  lisas: number;
}

interface DayResult {
  date: string;
  players: DayPlayer[];
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

function winRate(wins: number, losses: number): string {
  const total = wins + losses;
  if (total === 0) return "—";
  return `${((wins / total) * 100).toFixed(0)}%`;
}

export default function DailyResults() {
  const { data: days, isLoading } = useQuery<DayResult[]>({
    queryKey: ["daily-results"],
    queryFn: async () => {
      const res = await fetch("/api/daily-results");
      if (!res.ok) throw new Error("Error cargando resultados");
      return res.json();
    },
  });

  const { toast } = useToast();
  const shareRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [search, setSearch] = useState("");
  const [filterDate, setFilterDate] = useState("");

  const filtered = useMemo(() => {
    let list = days ?? [];
    if (filterDate) list = list.filter((d) => d.date === filterDate);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list
        .map((d) => ({ ...d, players: d.players.filter((p) => p.name.toLowerCase().includes(q)) }))
        .filter((d) => d.players.length > 0);
    }
    return list;
  }, [days, search, filterDate]);

  const handleShare = async (date: string) => {
    const el = shareRefs.current[date];
    if (!el) return;
    try {
      const canvas = await html2canvas(el, {
        backgroundColor: "#0f0f13",
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
      });
      const url = canvas.toDataURL("image/jpeg", 0.92);
      const a = document.createElement("a");
      a.href = url;
      a.download = `jurones_resultados_${date}.jpg`;
      a.click();
      toast({ title: "¡Imagen generada!", description: `Resultados del ${formatDate(date)} descargados.` });
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
            <BarChart2 className="h-8 w-8" style={{ color: "#e8b03f" }} />
            Resultados Diarios
          </h1>
          <p className="text-muted-foreground mt-1">Rendimiento de cada jugador por jornada.</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar jugador..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-background"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Input
          type="date"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          className="bg-background w-full sm:w-44"
        />
        {filterDate && (
          <Button variant="outline" size="sm" onClick={() => setFilterDate("")} className="shrink-0 rounded-full">
            Limpiar filtro
          </Button>
        )}
      </div>

      {/* Day groups */}
      {isLoading ? (
        <div className="space-y-8">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="h-7 w-56 bg-muted/40 rounded animate-pulse" />
              <div className="h-px bg-border/40" />
              {[...Array(4)].map((_, j) => (
                <div key={j} className="h-16 glass-card rounded-2xl animate-pulse" />
              ))}
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          {search || filterDate ? "Sin resultados para ese filtro." : "Aún no hay partidas finalizadas."}
        </div>
      ) : (
        <div className="space-y-10">
          {filtered.map((day, di) => (
            <motion.div
              key={day.date}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: di * 0.06 }}
              className="space-y-4"
            >
              {/* Day header */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1">
                  <h2 className="text-lg font-bold tracking-tight" style={{ color: "#e8b03f" }}>
                    {formatDate(day.date)}
                  </h2>
                  <div className="flex-1 h-px bg-border/40" />
                  <span className="text-xs text-muted-foreground shrink-0">
                    {day.players.length} jugador{day.players.length !== 1 ? "es" : ""}
                  </span>
                </div>
                <Button
                  size="icon"
                  onClick={() => handleShare(day.date)}
                  title="Exportar imagen"
                  className="h-8 w-8 rounded-full shrink-0"
                  style={{ background: "#e8b03f22", border: "1px solid #e8b03f44", color: "#e8b03f" }}
                >
                  <Share2 className="h-4 w-4" />
                </Button>
              </div>

              {/* Players */}
              <div className="space-y-2">
                {day.players.map((player, pi) => (
                  <motion.div
                    key={player.playerId}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: di * 0.06 + pi * 0.03 }}
                    className="flex items-center gap-3 px-4 py-3 rounded-2xl glass-card border border-border/40"
                  >
                    {/* Rank */}
                    <span className="text-xs font-bold text-muted-foreground w-5 text-center shrink-0">
                      {pi + 1}
                    </span>

                    {/* Avatar */}
                    <Avatar className="h-10 w-10 border border-white/10 shrink-0">
                      <AvatarImage src={avatarSrc(player.avatarUrl)} className="object-cover" />
                      <AvatarFallback className="bg-muted text-sm font-bold">
                        {player.name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    {/* Name */}
                    <span className="flex-1 font-semibold truncate">{player.name}</span>

                    {/* Stats */}
                    <div className="flex items-center gap-2 shrink-0 text-sm">
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 font-bold text-xs">
                        {player.wins}G
                      </span>
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 font-bold text-xs">
                        {player.losses}P
                      </span>
                      {player.lisas > 0 && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 font-bold text-xs">
                          <Fish className="h-3 w-3" />{player.lisas}
                        </span>
                      )}
                      <span className="text-muted-foreground text-xs w-10 text-right">
                        {winRate(player.wins, player.losses)}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Hidden share card */}
              <div className="absolute left-[-9999px] top-0 pointer-events-none" aria-hidden>
                <div
                  ref={(el) => { shareRefs.current[day.date] = el; }}
                  style={{
                    width: 480,
                    background: "#0f0f13",
                    borderRadius: 20,
                    padding: "24px 24px 20px",
                    fontFamily: "Inter, system-ui, sans-serif",
                  }}
                >
                  {/* Header */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                    <div style={{ fontSize: 18, fontWeight: 900, color: "#e8b03f", letterSpacing: "-0.3px" }}>
                      📅 {formatDate(day.date)}
                    </div>
                    <div style={{ flex: 1 }} />
                    <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 700, letterSpacing: "0.12em" }}>
                      LOS JURONES
                    </div>
                  </div>

                  {/* Player rows */}
                  {day.players.map((player, pi) => (
                    <div
                      key={player.playerId}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        background: pi === 0 ? "rgba(232,176,63,0.08)" : "rgba(255,255,255,0.03)",
                        borderRadius: 10,
                        padding: "8px 12px",
                        marginBottom: 5,
                        border: `1px solid ${pi === 0 ? "rgba(232,176,63,0.2)" : "rgba(255,255,255,0.06)"}`,
                      }}
                    >
                      <span style={{ fontSize: 12, color: "#6b7280", width: 18, fontWeight: 700 }}>{pi + 1}</span>
                      <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: "#f3f4f6", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {player.name}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 800, color: "#4ade80", marginRight: 6 }}>{player.wins}G</span>
                      <span style={{ fontSize: 12, fontWeight: 800, color: "#f87171", marginRight: 6 }}>{player.losses}P</span>
                      {player.lisas > 0 && (
                        <span style={{ fontSize: 12, fontWeight: 800, color: "#22d3ee", marginRight: 6 }}>🐟{player.lisas}</span>
                      )}
                      <span style={{ fontSize: 11, color: "#9ca3af", minWidth: 36, textAlign: "right" }}>
                        {winRate(player.wins, player.losses)}
                      </span>
                    </div>
                  ))}

                  {/* Footer */}
                  <div style={{ marginTop: 14, textAlign: "center", fontSize: 10, color: "#374151", letterSpacing: "0.15em", fontWeight: 700 }}>
                    LOSJURONESDOMINOCLUB.COM
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
