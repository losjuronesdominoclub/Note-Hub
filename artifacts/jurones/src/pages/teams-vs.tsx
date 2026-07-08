import React, { useState, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  Swords, Search, X, Trophy, Skull, Fish,
  Users, ChevronDown, Share2, Loader2,
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

interface PairRank {
  p1Id: number; p1Name: string; p1Avatar: string | null;
  p2Id: number; p2Name: string; p2Avatar: string | null;
  wins: number; losses: number; total: number; winRate: number;
}

interface TeamsVsData {
  pairA: { p1: PlayerInfo; p2: PlayerInfo; wins: number; losses: number; lisas: number };
  pairB: { p1: PlayerInfo; p2: PlayerInfo; wins: number; losses: number; lisas: number };
  facedEachOther: number;
}

interface PlayerInfo {
  id: number; name: string; avatarUrl: string | null;
}

type PairKey = string; // "${p1Id}-${p2Id}"

// --- Mini dual-avatar display ---
function PairAvatars({ pair, size = "sm" }: { pair: PairRank; size?: "sm" | "md" }) {
  const sz = size === "md" ? "h-10 w-10" : "h-7 w-7";
  const textSz = size === "md" ? "text-sm" : "text-xs";
  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        <Avatar className={`${sz} border-2 border-background`}>
          <AvatarImage src={avatarSrc(pair.p1Avatar)} />
          <AvatarFallback className={`${textSz} bg-primary/20 text-primary font-bold`}>
            {initials(pair.p1Name)}
          </AvatarFallback>
        </Avatar>
        <Avatar className={`${sz} border-2 border-background`}>
          <AvatarImage src={avatarSrc(pair.p2Avatar)} />
          <AvatarFallback className={`${textSz} bg-amber-400/20 text-amber-400 font-bold`}>
            {initials(pair.p2Name)}
          </AvatarFallback>
        </Avatar>
      </div>
      <div className="min-w-0">
        <p className="font-semibold text-sm truncate leading-tight">
          {pair.p1Name} &amp; {pair.p2Name}
        </p>
        <p className="text-xs text-muted-foreground">{pair.wins}V — {pair.losses}D</p>
      </div>
    </div>
  );
}

// --- Pair picker dropdown ---
function PairPicker({
  label,
  value,
  options,
  onChange,
  excludeKey,
  color,
}: {
  label: string;
  value: PairRank | null;
  options: PairRank[];
  onChange: (p: PairRank | null) => void;
  excludeKey: PairKey | null;
  color: "primary" | "amber";
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const key = (p: PairRank) => `${p.p1Id}-${p.p2Id}`;
    return options
      .filter((p) => key(p) !== excludeKey)
      .filter((p) =>
        `${p.p1Name} ${p.p2Name}`.toLowerCase().includes(search.toLowerCase())
      );
  }, [options, excludeKey, search]);

  const ringClass = color === "primary" ? "ring-primary/40" : "ring-amber-400/40";
  const textClass = color === "primary" ? "text-primary" : "text-amber-400";

  return (
    <div className="relative w-full">
      <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2 font-semibold">{label}</p>
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); setSearch(""); }}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-card border border-border hover:border-primary/50 transition-all text-left ${open ? `ring-2 ${ringClass}` : ""}`}
      >
        {value ? (
          <>
            <div className="flex -space-x-2 shrink-0">
              <Avatar className="h-7 w-7 border-2 border-background">
                <AvatarImage src={avatarSrc(value.p1Avatar)} />
                <AvatarFallback className={`text-xs bg-primary/20 ${textClass} font-bold`}>{initials(value.p1Name)}</AvatarFallback>
              </Avatar>
              <Avatar className="h-7 w-7 border-2 border-background">
                <AvatarImage src={avatarSrc(value.p2Avatar)} />
                <AvatarFallback className={`text-xs bg-amber-400/20 ${textClass} font-bold`}>{initials(value.p2Name)}</AvatarFallback>
              </Avatar>
            </div>
            <span className={`font-semibold truncate ${textClass}`}>{value.p1Name} &amp; {value.p2Name}</span>
            <X
              className="ml-auto h-4 w-4 text-muted-foreground hover:text-foreground shrink-0"
              onClick={(e) => { e.stopPropagation(); onChange(null); setOpen(false); }}
            />
          </>
        ) : (
          <>
            <Users className="h-5 w-5 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">Seleccionar pareja...</span>
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
                  placeholder="Buscar pareja..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9 bg-background border-border text-sm"
                />
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-4">Sin resultados</p>
              ) : (
                filtered.map((p) => (
                  <button
                    key={`${p.p1Id}-${p.p2Id}`}
                    type="button"
                    onClick={() => { onChange(p); setOpen(false); setSearch(""); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors text-left"
                  >
                    <PairAvatars pair={p} size="sm" />
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

// --- Stat row (same pattern as compare) ---
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
    <div className={`h-full rounded-l-full ${winner === "left" ? "bg-primary" : winner === "tie" ? "bg-muted-foreground/50" : "bg-muted-foreground/30"}`} style={{ width: `${pct1}%` }} />
  );

  const bar2 = animate ? (
    <motion.div
      className={`h-full rounded-r-full ${winner === "right" ? "bg-amber-500" : winner === "tie" ? "bg-muted-foreground/50" : "bg-muted-foreground/30"}`}
      initial={{ width: 0 }}
      animate={{ width: `${pct2}%` }}
      transition={{ duration: 0.7, ease: "easeOut" }}
    />
  ) : (
    <div className={`h-full rounded-r-full ${winner === "right" ? "bg-amber-500" : winner === "tie" ? "bg-muted-foreground/50" : "bg-muted-foreground/30"}`} style={{ width: `${pct2}%` }} />
  );

  return (
    <div className="mb-4">
      <div className="flex items-center justify-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">{label}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className={`w-16 text-right text-xl font-black tabular-nums transition-colors ${winner === "left" ? "text-primary" : winner === "tie" ? "text-foreground" : "text-muted-foreground"}`}>
          {format(v1)}{winner === "left" && <span className="ml-1 text-xs">★</span>}
        </span>
        <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden flex">
          {bar1}{bar2}
        </div>
        <span className={`w-16 text-left text-xl font-black tabular-nums transition-colors ${winner === "right" ? "text-amber-400" : winner === "tie" ? "text-foreground" : "text-muted-foreground"}`}>
          {winner === "right" && <span className="mr-1 text-xs">★</span>}{format(v2)}
        </span>
      </div>
    </div>
  );
}

// --- Pair header card ---
function PairCard({ pairData, side }: { pairData: TeamsVsData["pairA"]; side: "left" | "right" }) {
  const isLeft = side === "left";
  const color = isLeft ? "text-primary" : "text-amber-400";
  const ring = isLeft ? "ring-primary/60" : "ring-amber-400/60";
  return (
    <motion.div
      initial={{ opacity: 0, x: isLeft ? -30 : 30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4 }}
      className={`flex flex-col items-center gap-2 ${isLeft ? "items-start" : "items-end"} sm:items-center`}
    >
      <div className="flex -space-x-3">
        {[pairData.p1, pairData.p2].map((p, i) => (
          <div key={p.id} className={`relative ring-2 ${ring} rounded-full`} style={{ zIndex: 2 - i }}>
            <Avatar className="h-14 w-14 sm:h-16 sm:w-16 border-2 border-background">
              <AvatarImage src={avatarSrc(p.avatarUrl)} className="object-cover" />
              <AvatarFallback className={`text-lg font-black ${isLeft ? "bg-primary/20 text-primary" : "bg-amber-400/20 text-amber-400"}`}>
                {initials(p.name)}
              </AvatarFallback>
            </Avatar>
          </div>
        ))}
      </div>
      <p className={`font-black text-sm sm:text-base text-center leading-tight ${color}`}>
        {pairData.p1.name}<br className="hidden sm:block" /> <span className="text-muted-foreground text-xs font-normal">&amp;</span> {pairData.p2.name}
      </p>
    </motion.div>
  );
}

// --- Share card (off-screen for html2canvas) ---
function ShareCard({ data }: { data: TeamsVsData }) {
  const { pairA, pairB, facedEachOther } = data;

  const rows: Array<{ label: string; v1: number; v2: number; higherIsBetter?: boolean }> = [
    { label: "Victorias", v1: pairA.wins, v2: pairB.wins },
    { label: "Derrotas", v1: pairA.losses, v2: pairB.losses, higherIsBetter: false },
    { label: "Lisas", v1: pairA.lisas, v2: pairB.lisas },
  ];

  const pairALabel = `${pairA.p1.name} & ${pairA.p2.name}`;
  const pairBLabel = `${pairB.p1.name} & ${pairB.p2.name}`;

  return (
    <div style={{ width: 480, background: "#141414", borderRadius: 20, padding: 24, fontFamily: "Inter, sans-serif", color: "#f8f8f8" }}>
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <p style={{ fontSize: 10, letterSpacing: 4, color: "#888", textTransform: "uppercase", marginBottom: 4 }}>Los Jurones Domino Club</p>
        <p style={{ fontSize: 22, fontWeight: 900, letterSpacing: 2 }}>TEAMS VS</p>
      </div>

      <div style={{ display: "flex", justifyContent: "space-around", marginBottom: 20 }}>
        {([{ pair: pairA, color: "#e81111", bg: "rgba(232,17,17,0.15)" }, { pair: pairB, color: "#f59e0b", bg: "rgba(245,158,11,0.15)" }] as const).map(({ pair, color, bg }, gi) => (
          <div key={gi} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <div style={{ display: "flex" }}>
              {[pair.p1, pair.p2].map((p, i) => (
                <div key={p.id} style={{ width: 52, height: 52, borderRadius: "50%", border: `3px solid ${color}`, background: bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 900, color, marginLeft: i === 1 ? -12 : 0, overflow: "hidden" }}>
                  {p.avatarUrl ? (
                    <img src={avatarSrc(p.avatarUrl)} style={{ width: "100%", height: "100%", objectFit: "cover" }} crossOrigin="anonymous" />
                  ) : initials(p.name)}
                </div>
              ))}
            </div>
            <p style={{ fontWeight: 900, color, fontSize: 12, textAlign: "center", maxWidth: 140 }}>
              {gi === 0 ? pairALabel : pairBLabel}
            </p>
          </div>
        ))}
      </div>

      <div style={{ height: 1, background: "#2a2a2a", marginBottom: 16 }} />

      <p style={{ fontSize: 9, letterSpacing: 3, color: "#666", textTransform: "uppercase", textAlign: "center", marginBottom: 12 }}>Estadísticas H2H</p>
      {rows.map((row) => {
        const higherIsBetter = row.higherIsBetter !== false;
        const winner: StatSide = row.v1 === row.v2 ? "tie" : higherIsBetter ? (row.v1 > row.v2 ? "left" : "right") : (row.v1 < row.v2 ? "left" : "right");
        const total = row.v1 + row.v2 || 1;
        const pct1 = Math.round((row.v1 / total) * 100);
        const pct2 = 100 - pct1;
        return (
          <div key={row.label} style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 9, letterSpacing: 2, color: "#888", textTransform: "uppercase", textAlign: "center", marginBottom: 4 }}>{row.label}</p>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 36, textAlign: "right", fontSize: 18, fontWeight: 900, color: winner === "left" ? "#e81111" : winner === "tie" ? "#f8f8f8" : "#555" }}>
                {row.v1}{winner === "left" ? "★" : ""}
              </span>
              <div style={{ flex: 1, height: 10, borderRadius: 999, background: "#2a2a2a", overflow: "hidden", display: "flex" }}>
                <div style={{ width: `${pct1}%`, height: "100%", background: winner === "left" ? "#e81111" : winner === "tie" ? "#555" : "#333", borderRadius: "999px 0 0 999px" }} />
                <div style={{ width: `${pct2}%`, height: "100%", background: winner === "right" ? "#f59e0b" : winner === "tie" ? "#555" : "#333", borderRadius: "0 999px 999px 0" }} />
              </div>
              <span style={{ width: 36, textAlign: "left", fontSize: 18, fontWeight: 900, color: winner === "right" ? "#f59e0b" : winner === "tie" ? "#f8f8f8" : "#555" }}>
                {winner === "right" ? "★" : ""}{row.v2}
              </span>
            </div>
          </div>
        );
      })}

      <div style={{ height: 1, background: "#2a2a2a", margin: "16px 0" }} />
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1, background: "#1c1c1c", border: "1px solid #2a2a2a", borderRadius: 14, padding: "12px 8px", textAlign: "center" }}>
          <p style={{ fontSize: 28, fontWeight: 900, margin: 0 }}>{facedEachOther}</p>
          <p style={{ fontSize: 9, color: "#666", letterSpacing: 1.5, textTransform: "uppercase", marginTop: 4 }}>Veces enfrentadas</p>
        </div>
        <div style={{ flex: 1, background: "#1c1c1c", border: "1px solid #2a2a2a", borderRadius: 14, padding: "12px 8px", textAlign: "center" }}>
          <p style={{ fontSize: 20, fontWeight: 900, margin: 0, color: pairA.wins > pairB.wins ? "#e81111" : pairB.wins > pairA.wins ? "#f59e0b" : "#888" }}>
            {pairA.wins > pairB.wins ? pairALabel : pairB.wins > pairA.wins ? pairBLabel : "Empate"}
          </p>
          <p style={{ fontSize: 9, color: "#666", letterSpacing: 1.5, textTransform: "uppercase", marginTop: 4 }}>Líder de serie</p>
        </div>
      </div>

      <p style={{ fontSize: 9, color: "#444", textAlign: "center", marginTop: 16, letterSpacing: 2 }}>jurones.replit.app</p>
    </div>
  );
}

export default function TeamsVs() {
  const { data: teams = [], isLoading } = useQuery<PairRank[]>({
    queryKey: ["teams-ranking"],
    queryFn: () => fetch("/api/stats/teams").then((r) => r.json()),
  });

  const [pairA, setPairA] = useState<PairRank | null>(null);
  const [pairB, setPairB] = useState<PairRank | null>(null);
  const [vsData, setVsData] = useState<TeamsVsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  const shareCardRef = useRef<HTMLDivElement>(null);

  const pairKey = (p: PairRank) => `${p.p1Id}-${p.p2Id}`;

  const canCompare =
    pairA !== null && pairB !== null && pairKey(pairA) !== pairKey(pairB);

  const runCompare = useCallback(async () => {
    if (!pairA || !pairB) return;
    setLoading(true);
    setError(null);
    setVsData(null);
    try {
      const res = await fetch(
        `/api/teams-vs/${pairA.p1Id}/${pairA.p2Id}/${pairB.p1Id}/${pairB.p2Id}`
      );
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Error al comparar");
      }
      setVsData(await res.json());
    } catch (e: any) {
      setError(e?.message ?? "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, [pairA, pairB]);

  React.useEffect(() => {
    if (canCompare) runCompare();
    else setVsData(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairA?.p1Id, pairA?.p2Id, pairB?.p1Id, pairB?.p2Id]);

  const handleShare = useCallback(async () => {
    if (!shareCardRef.current || !vsData) return;
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
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Canvas vacío"))), "image/jpeg", 0.92)
      );
      const n1 = `${vsData.pairA.p1.name}_${vsData.pairA.p2.name}`.replace(/\s+/g, "_");
      const n2 = `${vsData.pairB.p1.name}_${vsData.pairB.p2.name}`.replace(/\s+/g, "_");
      const filename = `teams_vs_${n1}_vs_${n2}.jpg`;
      if (navigator.share && navigator.canShare?.({ files: [new File([blob], filename, { type: "image/jpeg" })] })) {
        await navigator.share({ title: `${n1} vs ${n2} — Los Jurones`, files: [new File([blob], filename, { type: "image/jpeg" })] });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e: any) {
      console.error("Share error:", e);
    } finally {
      setIsSharing(false);
    }
  }, [vsData]);

  const seriesLeader = vsData
    ? vsData.pairA.wins > vsData.pairB.wins
      ? { label: `${vsData.pairA.p1.name} & ${vsData.pairA.p2.name}`, side: "left" as const }
      : vsData.pairB.wins > vsData.pairA.wins
      ? { label: `${vsData.pairB.p1.name} & ${vsData.pairB.p2.name}`, side: "right" as const }
      : { label: "Serie empatada", side: "tie" as const }
    : null;

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6 pb-24">
      <ScrollToTop />

      {/* Off-screen share card */}
      <div ref={shareCardRef} style={{ position: "fixed", top: -9999, left: -9999, pointerEvents: "none", zIndex: -1 }}>
        {vsData && <ShareCard data={vsData} />}
      </div>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-1 pt-2"
      >
        <div className="flex items-center justify-center gap-2 mb-2">
          <Swords className="h-6 w-6 text-primary" />
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">TEAMS VS</h1>
        </div>
        <p className="text-muted-foreground mt-1 uppercase tracking-[0.15em] sm:tracking-[0.2em] md:tracking-[0.3em] text-xs">
          Enfrenta dos parejas cara a cara
        </p>
      </motion.div>

      {/* Pair selectors */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card rounded-2xl p-4 space-y-3"
      >
        {isLoading ? (
          <p className="text-center text-muted-foreground py-4 text-sm">Cargando parejas...</p>
        ) : teams.length === 0 ? (
          <p className="text-center text-muted-foreground py-4 text-sm">No hay parejas con partidas registradas.</p>
        ) : (
          <div className="flex flex-col sm:flex-row gap-3">
            <PairPicker
              label="Pareja 1"
              value={pairA}
              options={teams}
              onChange={setPairA}
              excludeKey={pairB ? pairKey(pairB) : null}
              color="primary"
            />
            <div className="flex items-center justify-center shrink-0">
              <div className="h-px w-8 bg-border sm:h-8 sm:w-px" />
              <Swords className="h-5 w-5 text-muted-foreground mx-2 sm:mx-0 sm:my-2" />
              <div className="h-px w-8 bg-border sm:h-8 sm:w-px" />
            </div>
            <PairPicker
              label="Pareja 2"
              value={pairB}
              options={teams}
              onChange={setPairB}
              excludeKey={pairA ? pairKey(pairA) : null}
              color="amber"
            />
          </div>
        )}
      </motion.div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-8">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground mt-3 text-sm">Analizando historial...</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="glass-card rounded-2xl p-4 border border-destructive/30 text-destructive text-sm text-center">
          {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && !vsData && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12 text-muted-foreground space-y-2"
        >
          <Swords className="h-12 w-12 mx-auto opacity-20" />
          <p className="text-sm">Selecciona dos parejas para ver el historial</p>
        </motion.div>
      )}

      {/* Results */}
      <AnimatePresence>
        {vsData && !loading && (
          <motion.div
            key={`${pairA?.p1Id}-${pairA?.p2Id}-${pairB?.p1Id}-${pairB?.p2Id}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-4"
          >
            {/* Pair headers */}
            <div className="glass-card rounded-2xl p-6">
              <div className="grid grid-cols-3 items-center gap-4">
                <PairCard pairData={vsData.pairA} side="left" />
                <div className="flex flex-col items-center gap-1">
                  <Swords className="h-6 w-6 text-muted-foreground" />
                  <span className="text-2xl font-black tabular-nums">
                    <span className="text-primary">{vsData.pairA.wins}</span>
                    <span className="text-muted-foreground mx-1">—</span>
                    <span className="text-amber-400">{vsData.pairB.wins}</span>
                  </span>
                  <span className="text-xs text-muted-foreground uppercase tracking-widest">Serie</span>
                </div>
                <PairCard pairData={vsData.pairB} side="right" />
              </div>
            </div>

            {/* No matches found */}
            {vsData.facedEachOther === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="glass-card rounded-2xl p-8 text-center space-y-2"
              >
                <Swords className="h-10 w-10 mx-auto opacity-20" />
                <p className="text-muted-foreground">Estas parejas aún no se han enfrentado</p>
              </motion.div>
            ) : (
              <>
                {/* Stats */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="glass-card rounded-2xl p-6"
                >
                  <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold text-center mb-5">
                    Estadísticas directas
                  </p>
                  <StatRow icon={Trophy} label="Victorias" v1={vsData.pairA.wins} v2={vsData.pairB.wins} />
                  <StatRow icon={Skull} label="Derrotas" v1={vsData.pairA.losses} v2={vsData.pairB.losses} higherIsBetter={false} />
                  <StatRow icon={Fish} label="Lisas" v1={vsData.pairA.lisas} v2={vsData.pairB.lisas} />
                </motion.div>

                {/* H2H summary cards */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  className="grid grid-cols-2 gap-3"
                >
                  {/* Veces enfrentadas */}
                  <div className="glass-card rounded-2xl p-5 flex flex-col items-center gap-1">
                    <Swords className="h-5 w-5 text-muted-foreground mb-1" />
                    <span className="text-3xl font-black tabular-nums">{vsData.facedEachOther}</span>
                    <span className="text-xs text-muted-foreground text-center uppercase tracking-wider font-semibold">Veces enfrentadas</span>
                  </div>

                  {/* Líder de serie */}
                  <div className={`glass-card rounded-2xl p-5 flex flex-col items-center gap-1 ${
                    seriesLeader?.side === "left" ? "border border-primary/30 bg-primary/5" :
                    seriesLeader?.side === "right" ? "border border-amber-400/30 bg-amber-400/5" : ""
                  }`}>
                    <Trophy className={`h-5 w-5 mb-1 ${seriesLeader?.side === "left" ? "text-primary" : seriesLeader?.side === "right" ? "text-amber-400" : "text-muted-foreground"}`} />
                    <span className={`text-base font-black text-center leading-tight ${
                      seriesLeader?.side === "left" ? "text-primary" :
                      seriesLeader?.side === "right" ? "text-amber-400" : "text-muted-foreground"
                    }`}>
                      {seriesLeader?.label}
                    </span>
                    <span className="text-xs text-muted-foreground text-center uppercase tracking-wider font-semibold">Líder de serie</span>
                  </div>
                </motion.div>

                {/* Lisa detail */}
                {(vsData.pairA.lisas > 0 || vsData.pairB.lisas > 0) && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35 }}
                    className="glass-card rounded-2xl p-5"
                  >
                    <div className="flex items-center justify-center gap-2 mb-4">
                      <Fish className="h-4 w-4 text-cyan-400" />
                      <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Lisas en enfrentamientos</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {[{ p: vsData.pairA, color: "text-primary", bg: "bg-primary/10 border-primary/30" }, { p: vsData.pairB, color: "text-amber-400", bg: "bg-amber-400/10 border-amber-400/30" }].map(({ p, color, bg }, i) => (
                        <div key={i} className={`rounded-xl border p-4 flex flex-col items-center gap-1 ${p.lisas > 0 ? bg : "border-border"}`}>
                          <Fish className={`h-5 w-5 ${p.lisas > 0 ? color : "text-muted-foreground"}`} />
                          <span className={`text-3xl font-black tabular-nums ${p.lisas > 0 ? color : "text-muted-foreground"}`}>{p.lisas}</span>
                          <span className={`text-xs text-center font-semibold ${p.lisas > 0 ? color : "text-muted-foreground"}`}>
                            {p.p1.name} &amp; {p.p2.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Share button */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="flex justify-center"
                >
                  <button
                    onClick={handleShare}
                    disabled={isSharing}
                    className="flex items-center gap-2 px-6 py-3 rounded-full bg-card border border-border hover:border-primary/50 text-sm font-semibold transition-all hover:bg-primary/5 disabled:opacity-50"
                  >
                    {isSharing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Share2 className="h-4 w-4" />
                    )}
                    {isSharing ? "Generando..." : "Compartir"}
                  </button>
                </motion.div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
