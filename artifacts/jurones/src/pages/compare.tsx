import React, { useState, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useListPlayers } from "@workspace/api-client-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  Scale, Search, X, Trophy, Skull, Fish, Percent, Flame,
  Swords, Users2, ChevronDown, Share2, Loader2,
} from "lucide-react";
import ScrollToTop from "@/components/scroll-to-top";

function avatarSrc(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http")) return path;
  const slug = path.startsWith("/objects/") ? path.slice("/objects/".length) : path;
  return `/api/storage/objects/${slug}`;
}

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

interface CompareData {
  player1: PlayerWithLisas;
  player2: PlayerWithLisas;
  facedEachOther: number;
  playedTogether: number;
}

interface PlayerWithLisas {
  id: number;
  name: string;
  avatarUrl: string | null;
  wins: number;
  losses: number;
  winRate: number;
  currentStreak: number;
  lisas: number;
  extraLisas: number;
}

type PlayerOption = { id: number; name: string; avatarUrl: string | null };

// --- Player picker dropdown ---
function PlayerPicker({
  label,
  value,
  options,
  onChange,
  exclude,
}: {
  label: string;
  value: PlayerOption | null;
  options: PlayerOption[];
  onChange: (p: PlayerOption | null) => void;
  exclude: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () =>
      options
        .filter((p) => p.id !== exclude)
        .filter((p) => p.name.toLowerCase().includes(search.toLowerCase())),
    [options, exclude, search]
  );

  return (
    <div className="relative w-full">
      <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2 font-semibold">{label}</p>
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); setSearch(""); }}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-card border border-border hover:border-primary/50 transition-all text-left"
      >
        {value ? (
          <>
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarImage src={avatarSrc(value.avatarUrl)} />
              <AvatarFallback className="text-xs bg-primary/20 text-primary font-bold">
                {initials(value.name)}
              </AvatarFallback>
            </Avatar>
            <span className="font-semibold truncate">{value.name}</span>
            <X
              className="ml-auto h-4 w-4 text-muted-foreground hover:text-foreground shrink-0"
              onClick={(e) => { e.stopPropagation(); onChange(null); setOpen(false); }}
            />
          </>
        ) : (
          <>
            <Users2 className="h-5 w-5 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">Seleccionar jugador...</span>
            <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground shrink-0" />
          </>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 top-full mt-2 z-50 bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
          >
            <div className="p-2 border-b border-border">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  autoFocus
                  placeholder="Buscar..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9 bg-background border-border text-sm"
                />
              </div>
            </div>
            <div className="max-h-56 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-4">Sin resultados</p>
              ) : (
                filtered.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => { onChange(p); setOpen(false); setSearch(""); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors text-left"
                  >
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarImage src={avatarSrc(p.avatarUrl)} />
                      <AvatarFallback className="text-xs bg-primary/20 text-primary font-bold">
                        {initials(p.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium truncate">{p.name}</span>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Stat row (static version for the share card — no animations) ---
type StatSide = "left" | "right" | "tie";

function StatRow({
  icon: Icon,
  label,
  v1,
  v2,
  format = (x: number) => String(x),
  higherIsBetter = true,
  animate = true,
}: {
  icon: React.ElementType;
  label: string;
  v1: number;
  v2: number;
  format?: (x: number) => string;
  higherIsBetter?: boolean;
  animate?: boolean;
}) {
  const winner: StatSide =
    v1 === v2 ? "tie" : higherIsBetter ? (v1 > v2 ? "left" : "right") : (v1 < v2 ? "left" : "right");

  const total = v1 + v2 || 1;
  const pct1 = Math.round((v1 / total) * 100);
  const pct2 = 100 - pct1;

  const bar1 = animate ? (
    <motion.div
      className={`h-full rounded-l-full ${winner === "left" ? "bg-primary" : winner === "tie" ? "bg-muted-foreground/50" : "bg-muted-foreground/30"}`}
      initial={{ width: 0 }}
      animate={{ width: `${pct1}%` }}
      transition={{ duration: 0.7, ease: "easeOut" }}
    />
  ) : (
    <div
      className={`h-full rounded-l-full ${winner === "left" ? "bg-primary" : winner === "tie" ? "bg-muted-foreground/50" : "bg-muted-foreground/30"}`}
      style={{ width: `${pct1}%` }}
    />
  );

  const bar2 = animate ? (
    <motion.div
      className={`h-full rounded-r-full ${winner === "right" ? "bg-amber-500" : winner === "tie" ? "bg-muted-foreground/50" : "bg-muted-foreground/30"}`}
      initial={{ width: 0 }}
      animate={{ width: `${pct2}%` }}
      transition={{ duration: 0.7, ease: "easeOut" }}
    />
  ) : (
    <div
      className={`h-full rounded-r-full ${winner === "right" ? "bg-amber-500" : winner === "tie" ? "bg-muted-foreground/50" : "bg-muted-foreground/30"}`}
      style={{ width: `${pct2}%` }}
    />
  );

  return (
    <div className="mb-4">
      <div className="flex items-center justify-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">{label}</span>
      </div>
      <div className="flex items-center gap-3">
        <span
          className={`w-16 text-right text-xl font-black tabular-nums transition-colors ${
            winner === "left" ? "text-primary" : winner === "tie" ? "text-foreground" : "text-muted-foreground"
          }`}
        >
          {format(v1)}
          {winner === "left" && <span className="ml-1 text-xs">★</span>}
        </span>
        <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden flex">
          {bar1}
          {bar2}
        </div>
        <span
          className={`w-16 text-left text-xl font-black tabular-nums transition-colors ${
            winner === "right" ? "text-amber-400" : winner === "tie" ? "text-foreground" : "text-muted-foreground"
          }`}
        >
          {winner === "right" && <span className="mr-1 text-xs">★</span>}
          {format(v2)}
        </span>
      </div>
    </div>
  );
}

// --- Player card header ---
function PlayerCard({ player, side }: { player: PlayerWithLisas; side: "left" | "right" }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: side === "left" ? -30 : 30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4 }}
      className={`flex flex-col items-center gap-3 ${side === "right" ? "items-end" : "items-start"} sm:items-center`}
    >
      <div className={`relative ${side === "left" ? "ring-2 ring-primary/60" : "ring-2 ring-amber-400/60"} rounded-full`}>
        <Avatar className="h-20 w-20 sm:h-24 sm:w-24">
          <AvatarImage src={avatarSrc(player.avatarUrl)} className="object-cover" />
          <AvatarFallback
            className={`text-2xl font-black ${side === "left" ? "bg-primary/20 text-primary" : "bg-amber-400/20 text-amber-400"}`}
          >
            {initials(player.name)}
          </AvatarFallback>
        </Avatar>
      </div>
      <p className={`font-black text-base sm:text-lg text-center leading-tight ${side === "left" ? "text-primary" : "text-amber-400"}`}>
        {player.name}
      </p>
    </motion.div>
  );
}

// --- Head to head card ---
function H2HCard({ label, value, icon: Icon }: { label: string; value: number; icon: React.ElementType }) {
  return (
    <div className="flex flex-col items-center gap-1 bg-card border border-border rounded-2xl px-6 py-4 flex-1">
      <Icon className="h-5 w-5 text-muted-foreground mb-1" />
      <span className="text-3xl font-black tabular-nums">{value}</span>
      <span className="text-xs text-muted-foreground text-center uppercase tracking-wider font-semibold">{label}</span>
    </div>
  );
}

// --- Shareable snapshot card (rendered off-screen for html2canvas) ---
function ShareCard({ data }: { data: CompareData }) {
  const { player1: p1, player2: p2, facedEachOther, playedTogether } = data;

  const statRows: Array<{
    icon: React.ElementType;
    label: string;
    v1: number;
    v2: number;
    format?: (x: number) => string;
    higherIsBetter?: boolean;
  }> = [
    { icon: Trophy, label: "Victorias", v1: p1.wins, v2: p2.wins },
    { icon: Skull, label: "Derrotas", v1: p1.losses, v2: p2.losses, higherIsBetter: false },
    { icon: Fish, label: "Lisas", v1: p1.lisas, v2: p2.lisas },
    { icon: Percent, label: "Win Rate", v1: Number(p1.winRate), v2: Number(p2.winRate), format: (x) => `${(x * 100).toFixed(0)}%` },
    { icon: Flame, label: "Racha", v1: p1.currentStreak, v2: p2.currentStreak },
  ];

  return (
    <div
      style={{
        width: 480,
        background: "#141414",
        borderRadius: 20,
        padding: 24,
        fontFamily: "Inter, sans-serif",
        color: "#f8f8f8",
      }}
    >
      {/* Logo + title */}
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <p style={{ fontSize: 10, letterSpacing: 4, color: "#888", textTransform: "uppercase", marginBottom: 4 }}>
          Los Jurones Domino Club
        </p>
        <p style={{ fontSize: 22, fontWeight: 900, letterSpacing: 2, marginBottom: 0 }}>COMPARE</p>
      </div>

      {/* Player headers */}
      <div style={{ display: "flex", justifyContent: "space-around", marginBottom: 20 }}>
        {[p1, p2].map((p, i) => {
          const isLeft = i === 0;
          const color = isLeft ? "#e81111" : "#f59e0b";
          return (
            <div key={p.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 72, height: 72, borderRadius: "50%",
                  border: `3px solid ${color}`,
                  overflow: "hidden",
                  background: isLeft ? "rgba(232,17,17,0.15)" : "rgba(245,158,11,0.15)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 24, fontWeight: 900, color,
                }}
              >
                {p.avatarUrl ? (
                  <img
                    src={avatarSrc(p.avatarUrl)}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    crossOrigin="anonymous"
                  />
                ) : (
                  initials(p.name)
                )}
              </div>
              <p style={{ fontWeight: 900, color, fontSize: 14, textAlign: "center", maxWidth: 120 }}>{p.name}</p>
            </div>
          );
        })}
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: "#2a2a2a", marginBottom: 16 }} />

      {/* Stats */}
      <p style={{ fontSize: 9, letterSpacing: 3, color: "#666", textTransform: "uppercase", textAlign: "center", marginBottom: 12 }}>
        Estadísticas
      </p>
      {statRows.map((row) => {
        const v1 = row.v1;
        const v2 = row.v2;
        const higherIsBetter = row.higherIsBetter !== false;
        const winner: StatSide =
          v1 === v2 ? "tie" : higherIsBetter ? (v1 > v2 ? "left" : "right") : (v1 < v2 ? "left" : "right");
        const total = v1 + v2 || 1;
        const pct1 = Math.round((v1 / total) * 100);
        const pct2 = 100 - pct1;
        const fmt = row.format ?? ((x: number) => String(x));

        return (
          <div key={row.label} style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 9, letterSpacing: 2, color: "#888", textTransform: "uppercase", textAlign: "center", marginBottom: 4 }}>
              {row.label}
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{
                width: 52, textAlign: "right", fontSize: 18, fontWeight: 900,
                color: winner === "left" ? "#e81111" : winner === "tie" ? "#f8f8f8" : "#555",
              }}>
                {fmt(v1)}{winner === "left" ? " ★" : ""}
              </span>
              <div style={{ flex: 1, height: 10, borderRadius: 999, background: "#2a2a2a", overflow: "hidden", display: "flex" }}>
                <div style={{
                  width: `${pct1}%`, height: "100%",
                  background: winner === "left" ? "#e81111" : winner === "tie" ? "#555" : "#333",
                  borderRadius: "999px 0 0 999px",
                }} />
                <div style={{
                  width: `${pct2}%`, height: "100%",
                  background: winner === "right" ? "#f59e0b" : winner === "tie" ? "#555" : "#333",
                  borderRadius: "0 999px 999px 0",
                }} />
              </div>
              <span style={{
                width: 52, textAlign: "left", fontSize: 18, fontWeight: 900,
                color: winner === "right" ? "#f59e0b" : winner === "tie" ? "#f8f8f8" : "#555",
              }}>
                {winner === "right" ? "★ " : ""}{fmt(v2)}
              </span>
            </div>
          </div>
        );
      })}

      {/* Divider */}
      <div style={{ height: 1, background: "#2a2a2a", margin: "16px 0" }} />

      {/* H2H */}
      <p style={{ fontSize: 9, letterSpacing: 3, color: "#666", textTransform: "uppercase", textAlign: "center", marginBottom: 12 }}>
        Historial entre ellos
      </p>
      <div style={{ display: "flex", gap: 12 }}>
        {[
          { label: "Veces enfrentados", value: facedEachOther },
          { label: "Veces como equipo", value: playedTogether },
        ].map((item) => (
          <div key={item.label} style={{
            flex: 1, background: "#1c1c1c", border: "1px solid #2a2a2a", borderRadius: 14,
            padding: "12px 8px", textAlign: "center",
          }}>
            <p style={{ fontSize: 28, fontWeight: 900, margin: 0 }}>{item.value}</p>
            <p style={{ fontSize: 9, color: "#666", letterSpacing: 1.5, textTransform: "uppercase", marginTop: 4 }}>{item.label}</p>
          </div>
        ))}
      </div>

      {/* Footer watermark */}
      <p style={{ fontSize: 9, color: "#444", textAlign: "center", marginTop: 16, letterSpacing: 2 }}>
        jurones.replit.app
      </p>
    </div>
  );
}

export default function Compare() {
  const { data: players = [], isLoading } = useListPlayers();

  const [p1, setP1] = useState<PlayerOption | null>(null);
  const [p2, setP2] = useState<PlayerOption | null>(null);
  const [compareData, setCompareData] = useState<CompareData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  const shareCardRef = useRef<HTMLDivElement>(null);

  const options: PlayerOption[] = useMemo(
    () => players.map((p) => ({ id: p.id, name: p.name, avatarUrl: p.avatarUrl ?? null })),
    [players]
  );

  const canCompare = p1 !== null && p2 !== null && p1.id !== p2.id;

  const runCompare = async () => {
    if (!canCompare) return;
    setLoading(true);
    setError(null);
    setCompareData(null);
    try {
      const res = await fetch(`/api/compare/${p1!.id}/${p2!.id}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error al comparar");
      }
      const data: CompareData = await res.json();
      setCompareData(data);
    } catch (e: any) {
      setError(e?.message ?? "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (canCompare) runCompare();
    else setCompareData(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p1?.id, p2?.id]);

  const handleShare = useCallback(async () => {
    if (!shareCardRef.current || !compareData) return;
    setIsSharing(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(shareCardRef.current, {
        backgroundColor: "#141414",
        scale: 2,
        useCORS: true,
        allowTaint: false,
        logging: false,
      });

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Canvas vacío"))),
          "image/jpeg",
          0.92
        );
      });

      const name1 = compareData.player1.name.replace(/\s+/g, "_");
      const name2 = compareData.player2.name.replace(/\s+/g, "_");
      const filename = `compare_${name1}_vs_${name2}.jpg`;

      if (navigator.share && navigator.canShare?.({ files: [new File([blob], filename, { type: "image/jpeg" })] })) {
        await navigator.share({
          title: `${compareData.player1.name} vs ${compareData.player2.name} — Los Jurones`,
          files: [new File([blob], filename, { type: "image/jpeg" })],
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e: any) {
      console.error("Share error:", e);
    } finally {
      setIsSharing(false);
    }
  }, [compareData]);

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6 pb-24">
      <ScrollToTop />

      {/* Hidden share card rendered off-screen for html2canvas */}
      <div
        ref={shareCardRef}
        style={{
          position: "fixed",
          top: -9999,
          left: -9999,
          pointerEvents: "none",
          zIndex: -1,
        }}
      >
        {compareData && <ShareCard data={compareData} />}
      </div>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-1 pt-2"
      >
        <div className="flex items-center justify-center gap-2 mb-2">
          <Scale className="h-6 w-6 text-primary" />
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">COMPARE</h1>
        </div>
        <p className="text-muted-foreground text-sm">Enfrenta a dos jugadores cara a cara</p>
      </motion.div>

      {/* Selectors */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card rounded-2xl p-4 space-y-3"
      >
        {isLoading ? (
          <p className="text-center text-muted-foreground py-4 text-sm">Cargando jugadores...</p>
        ) : (
          <div className="flex flex-col sm:flex-row gap-3">
            <PlayerPicker
              label="Jugador 1"
              value={p1}
              options={options}
              onChange={setP1}
              exclude={p2?.id ?? null}
            />
            <div className="flex items-center justify-center shrink-0">
              <div className="h-px w-8 bg-border sm:h-8 sm:w-px" />
              <Scale className="h-5 w-5 text-muted-foreground mx-2 sm:mx-0 sm:my-2" />
              <div className="h-px w-8 bg-border sm:h-8 sm:w-px" />
            </div>
            <PlayerPicker
              label="Jugador 2"
              value={p2}
              options={options}
              onChange={setP2}
              exclude={p1?.id ?? null}
            />
          </div>
        )}
      </motion.div>

      {/* Loading state */}
      {loading && (
        <div className="text-center py-8">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground mt-3 text-sm">Analizando estadísticas...</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="glass-card rounded-2xl p-4 border border-destructive/30 text-destructive text-sm text-center">
          {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && !compareData && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12 text-muted-foreground space-y-2"
        >
          <Swords className="h-12 w-12 mx-auto opacity-20" />
          <p className="text-sm">Selecciona dos jugadores para ver la comparación</p>
        </motion.div>
      )}

      {/* Results */}
      <AnimatePresence>
        {compareData && !loading && (
          <motion.div
            key={`${compareData.player1.id}-${compareData.player2.id}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-4"
          >
            {/* Share button */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleShare}
                disabled={isSharing}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-card border border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSharing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Share2 className="h-4 w-4 text-primary" />
                )}
                {isSharing ? "Generando..." : "Compartir"}
              </button>
            </div>

            {/* Player headers */}
            <div className="glass-card rounded-2xl p-5">
              <div className="grid grid-cols-2 gap-4">
                <PlayerCard player={compareData.player1} side="left" />
                <PlayerCard player={compareData.player2} side="right" />
              </div>
            </div>

            {/* Stats comparison */}
            <div className="glass-card rounded-2xl p-5">
              <h2 className="text-center text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-5">
                Estadísticas
              </h2>
              <StatRow icon={Trophy} label="Victorias" v1={compareData.player1.wins} v2={compareData.player2.wins} />
              <StatRow icon={Skull} label="Derrotas" v1={compareData.player1.losses} v2={compareData.player2.losses} higherIsBetter={false} />
              <StatRow icon={Fish} label="Lisas" v1={compareData.player1.lisas} v2={compareData.player2.lisas} />
              <StatRow
                icon={Percent} label="Win Rate"
                v1={Number(compareData.player1.winRate)} v2={Number(compareData.player2.winRate)}
                format={(x) => `${(x * 100).toFixed(0)}%`}
              />
              <StatRow icon={Flame} label="Racha" v1={compareData.player1.currentStreak} v2={compareData.player2.currentStreak} />
            </div>

            {/* Head to head */}
            <div className="glass-card rounded-2xl p-5">
              <h2 className="text-center text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-4">
                Historial entre ellos
              </h2>
              <div className="flex gap-3">
                <H2HCard icon={Swords} label="Veces enfrentados" value={compareData.facedEachOther} />
                <H2HCard icon={Users2} label="Veces como equipo" value={compareData.playedTogether} />
              </div>
              {compareData.facedEachOther === 0 && compareData.playedTogether === 0 && (
                <p className="text-center text-muted-foreground text-xs mt-4">
                  Estos jugadores nunca han coincidido en un partido registrado.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
