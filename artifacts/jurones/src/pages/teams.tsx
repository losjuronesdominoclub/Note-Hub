import React, { useRef } from "react";
import { motion } from "framer-motion";
import { Users, Medal, Trophy, Share2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import ScrollToTop from "@/components/scroll-to-top";
import html2canvas from "html2canvas";

function avatarSrc(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http")) return path;
  const slug = path.startsWith("/objects/") ? path.slice("/objects/".length) : path;
  return `/api/storage/objects/${slug}`;
}

function positionStyle(pos: number) {
  if (pos === 1) return { badge: "text-yellow-400 bg-yellow-400/15 border-yellow-400/50", row: "border-yellow-400/30 bg-yellow-400/5", glow: "shadow-yellow-900/20" };
  if (pos === 2) return { badge: "text-slate-300 bg-slate-300/15 border-slate-300/50", row: "border-slate-300/20 bg-slate-300/5", glow: "shadow-slate-900/10" };
  if (pos === 3) return { badge: "text-amber-600 bg-amber-600/15 border-amber-600/50", row: "border-amber-600/20 bg-amber-600/5", glow: "shadow-amber-900/10" };
  return { badge: "text-muted-foreground bg-muted/50 border-border", row: "border-border/40 bg-card/40", glow: "" };
}

function positionIcon(pos: number) {
  if (pos <= 3) return <Medal className={`h-4 w-4 ${pos === 1 ? "text-yellow-400" : pos === 2 ? "text-slate-300" : "text-amber-600"}`} />;
  return <span className="text-xs font-bold">{pos}</span>;
}

function PairAvatars({ p1Avatar, p1Name, p2Avatar, p2Name, size = "md" }: { p1Avatar?: string | null; p1Name: string; p2Avatar?: string | null; p2Name: string; size?: "sm" | "md" | "lg" }) {
  const s = size === "lg" ? "h-14 w-14" : size === "sm" ? "h-7 w-7" : "h-10 w-10";
  const text = size === "lg" ? "text-base" : size === "sm" ? "text-[9px]" : "text-xs";
  return (
    <div className="flex -space-x-2 shrink-0">
      <Avatar className={`${s} border-2 border-background shrink-0`}>
        <AvatarImage src={avatarSrc(p1Avatar)} className="object-cover" />
        <AvatarFallback className={`bg-emerald-500/20 text-emerald-400 font-bold ${text}`}>{p1Name.substring(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <Avatar className={`${s} border-2 border-background shrink-0`}>
        <AvatarImage src={avatarSrc(p2Avatar)} className="object-cover" />
        <AvatarFallback className={`bg-emerald-500/20 text-emerald-400 font-bold ${text}`}>{p2Name.substring(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
    </div>
  );
}

export default function Teams() {
  const { toast } = useToast();
  const shareRef = useRef<HTMLDivElement>(null);
  const [pairs, setPairs] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    fetch("/api/stats/teams")
      .then(r => r.json())
      .then(data => { setPairs(data); setIsLoading(false); })
      .catch(() => setIsLoading(false));
  }, []);

  const top10 = pairs.slice(0, 10);
  const leader = pairs[0] ?? null;

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
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Santo_Domingo" });
      a.download = `jurones_teams_${today}.jpg`;
      a.click();
      toast({ title: "¡Imagen generada!", description: "Ranking de parejas descargado como JPG." });
    } catch {
      toast({ title: "Error", description: "No se pudo generar la imagen.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <ScrollToTop />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Users className="h-8 w-8 text-emerald-400" />
            Teams
          </h1>
          <p className="text-muted-foreground mt-1 uppercase tracking-[0.15em] sm:tracking-[0.2em] md:tracking-[0.3em] text-xs">
            Clasificación de parejas por victorias.
          </p>
        </div>
        <Button
          size="icon"
          onClick={handleShare}
          disabled={isLoading || top10.length === 0}
          title="Compartir Top 10"
          className="h-12 w-12 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30 hover:text-emerald-300 transition-all shadow-lg shadow-emerald-900/20"
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
          className="relative overflow-hidden rounded-2xl border border-emerald-400/40 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent p-5 sm:p-6 shadow-lg shadow-emerald-900/10"
        >
          <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-emerald-500/15 blur-3xl" />
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="shrink-0 text-center">
              <p className="text-[10px] uppercase tracking-widest text-emerald-400/70 font-bold mb-0.5">Mejor Pareja</p>
              <p className="text-4xl sm:text-5xl font-black text-emerald-400 leading-none">#1</p>
            </div>
            <PairAvatars p1Avatar={leader.p1Avatar} p1Name={leader.p1Name} p2Avatar={leader.p2Avatar} p2Name={leader.p2Name} size="lg" />
            <div className="flex-1 min-w-0">
              <p className="text-lg sm:text-xl font-black truncate leading-tight">{leader.p1Name}</p>
              <p className="text-lg sm:text-xl font-black truncate leading-tight text-emerald-300">{leader.p2Name}</p>
              <div className="flex items-center gap-3 mt-2">
                <div className="flex items-center gap-1.5">
                  <Trophy className="h-5 w-5 text-emerald-400 shrink-0" />
                  <span className="text-3xl sm:text-4xl font-black text-emerald-400">{leader.wins}</span>
                  <span className="text-xs text-emerald-400/60 font-semibold uppercase tracking-widest self-end mb-1">V</span>
                </div>
                <div className="text-muted-foreground text-sm">
                  {leader.losses}D · {leader.total} total
                </div>
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
      ) : pairs.length > 0 ? (
        <div className="space-y-3">
          {pairs.map((pair, index) => {
            const pos = index + 1;
            const style = positionStyle(pos);
            const wrPct = (pair.winRate * 100).toFixed(1);
            return (
              <motion.div
                key={`${pair.p1Id}-${pair.p2Id}`}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.04 }}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl border ${style.row} ${style.glow} backdrop-blur-sm shadow-lg`}
              >
                {/* Position */}
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-bold ${style.badge}`}>
                  {positionIcon(pos)}
                </div>

                {/* Avatars */}
                <PairAvatars p1Avatar={pair.p1Avatar} p1Name={pair.p1Name} p2Avatar={pair.p2Avatar} p2Name={pair.p2Name} size="md" />

                {/* Names + stats */}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm leading-tight truncate">{pair.p1Name}</p>
                  <p className="font-bold text-sm leading-tight truncate text-emerald-400">{pair.p2Name}</p>
                  <div className="flex items-center gap-x-2 text-xs text-muted-foreground mt-0.5">
                    <span>{pair.wins}V · {pair.losses}D</span>
                    <span className="text-muted-foreground/60">{pair.total} Part</span>
                  </div>
                </div>

                {/* Wins stat */}
                <div className="text-right shrink-0 pl-2 border-l border-border">
                  <p className="text-2xl font-black text-emerald-400">{pair.wins}<span className="text-base font-bold text-emerald-400/60"> V</span></p>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{wrPct}% WR</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 text-muted-foreground glass-card rounded-2xl">
          Aún no hay suficientes partidas para generar el ranking de parejas.
        </div>
      )}

      {/* Hidden share card */}
      <div className="absolute left-[-9999px] top-0 pointer-events-none" aria-hidden>
        <div
          ref={shareRef}
          style={{ width: 480, background: "#0f0f13", borderRadius: 20, padding: "28px 24px 24px", fontFamily: "Inter, system-ui, sans-serif" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#34d399", letterSpacing: "-0.5px" }}>
              👥 Teams — Ranking de Parejas
            </div>
            <div style={{ flex: 1 }} />
            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, letterSpacing: "0.1em" }}>LOS JURONES</div>
          </div>
          {top10.map((pair, index) => {
            const pos = index + 1;
            const medalColor = pos === 1 ? "#fbbf24" : pos === 2 ? "#cbd5e1" : pos === 3 ? "#d97706" : "#4b5563";
            const rowBg = pos === 1 ? "rgba(52,211,153,0.08)" : pos <= 3 ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)";
            return (
              <div
                key={`${pair.p1Id}-${pair.p2Id}`}
                style={{ display: "flex", alignItems: "center", gap: 12, background: rowBg, borderRadius: 12, padding: "10px 12px", marginBottom: 6, border: `1px solid ${pos === 1 ? "rgba(52,211,153,0.3)" : "rgba(255,255,255,0.06)"}` }}
              >
                <div style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 13, color: medalColor, border: `1.5px solid ${medalColor}`, background: `${medalColor}18`, flexShrink: 0 }}>
                  {pos}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#f3f4f6", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{pair.p1Name}</div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#34d399", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{pair.p2Name}</div>
                </div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginRight: 8 }}>
                  {pair.wins}V · {pair.losses}D
                </div>
                <div style={{ fontWeight: 900, fontSize: 20, color: "#34d399", minWidth: 44, textAlign: "right" }}>
                  {pair.wins}<span style={{ fontSize: 11, color: "#6b7280", marginLeft: 2 }}>V</span>
                </div>
              </div>
            );
          })}
          <div style={{ marginTop: 16, textAlign: "center", fontSize: 10, color: "#374151", letterSpacing: "0.15em", fontWeight: 700 }}>
            LOSJURONESDOMINOCLUB.COM
          </div>
        </div>
      </div>
    </div>
  );
}
