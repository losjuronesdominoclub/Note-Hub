import React from "react";
import ScrollToTop from "@/components/scroll-to-top";
import { motion } from "framer-motion";
import { useGetLideres, getGetLideresQueryKey } from "@workspace/api-client-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Crown, Medal } from "lucide-react";

function avatarSrc(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http")) return path;
  const slug = path.startsWith("/objects/") ? path.slice("/objects/".length) : path;
  return `/api/storage/objects/${slug}`;
}

/** Format seconds into a human-readable reign string */
function formatReign(totalSeconds: number): string {
  if (totalSeconds <= 0) return "0 días";
  const days = Math.floor(totalSeconds / 86400);
  const remainingAfterDays = totalSeconds % 86400;
  const hours = Math.floor(remainingAfterDays / 3600);
  const weeks = Math.floor(days / 7);
  const extraDays = days % 7;

  const parts: string[] = [];

  if (weeks > 0) parts.push(`${weeks} ${weeks === 1 ? "semana" : "semanas"}`);
  if (extraDays > 0) parts.push(`${extraDays} ${extraDays === 1 ? "día" : "días"}`);
  if (parts.length === 0 && hours > 0) parts.push(`${hours} ${hours === 1 ? "hora" : "horas"}`);
  if (parts.length === 0) parts.push("menos de 1 hora");

  return parts.join(" + ");
}

function positionStyle(pos: number) {
  if (pos === 1) return { badge: "text-yellow-400 bg-yellow-400/15 border-yellow-400/50", row: "border-yellow-400/30 bg-yellow-400/5" };
  if (pos === 2) return { badge: "text-slate-300 bg-slate-300/15 border-slate-300/50", row: "border-slate-300/20 bg-slate-300/5" };
  if (pos === 3) return { badge: "text-amber-600 bg-amber-600/15 border-amber-600/50", row: "border-amber-600/20 bg-amber-600/5" };
  return { badge: "text-muted-foreground bg-muted/50 border-border", row: "border-border/40 bg-card/40" };
}

function positionIcon(pos: number) {
  if (pos === 1) return <Crown className="h-4 w-4 text-yellow-400" />;
  if (pos === 2) return <Medal className="h-4 w-4 text-slate-300" />;
  if (pos === 3) return <Medal className="h-4 w-4 text-amber-600" />;
  return <span className="text-xs font-bold">{pos}</span>;
}

export default function Lideres() {
  const { data: entries, isLoading } = useGetLideres({
    query: {
      queryKey: getGetLideresQueryKey(),
      refetchInterval: 30000,
    },
  });

  const current = entries?.find((e) => e.isCurrent);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <ScrollToTop />

      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Crown className="h-8 w-8 text-yellow-400" />
          Líderes
        </h1>
        <p className="text-muted-foreground uppercase tracking-[0.15em] text-xs">
          Tiempo acumulado en el primer lugar
        </p>
      </div>

      {/* Current throne holder highlight */}
      {current && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-yellow-400/30 bg-yellow-400/5 px-5 py-4 flex items-center gap-4"
        >
          <Crown className="h-6 w-6 text-yellow-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-yellow-400/70 mb-0.5">En el Trono</p>
            <p className="font-black text-lg truncate">{current.name}</p>
            <p className="text-sm text-yellow-300/80 font-medium">{formatReign(current.totalSeconds)} en el trono</p>
          </div>
          <Avatar className="h-12 w-12 border-2 border-yellow-400/40 shrink-0">
            <AvatarImage src={avatarSrc(current.avatarUrl)} className="object-cover" />
            <AvatarFallback className="bg-yellow-400/10 text-yellow-400 font-black text-base">
              {current.name.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </motion.div>
      )}

      {/* Leaderboard */}
      <div className="space-y-2">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />
          ))
        ) : !entries || entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
            <Crown className="h-12 w-12 opacity-20" />
            <p className="text-sm">Nadie ha sido líder todavía</p>
            <p className="text-xs opacity-60">Los datos se registran al finalizar cada partida</p>
          </div>
        ) : (
          entries.map((entry, index) => {
            const style = positionStyle(entry.position);
            return (
              <motion.div
                key={entry.playerId}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.04 }}
                className={`flex items-center gap-4 px-4 py-3 rounded-xl border ${style.row} transition-colors`}
              >
                {/* Position badge */}
                <div className={`flex items-center justify-center h-8 w-8 rounded-full border text-xs font-black shrink-0 ${style.badge}`}>
                  {positionIcon(entry.position)}
                </div>

                {/* Avatar */}
                <Avatar className="h-10 w-10 border border-white/10 shrink-0">
                  <AvatarImage src={avatarSrc(entry.avatarUrl)} className="object-cover" />
                  <AvatarFallback className="bg-muted text-sm font-bold">
                    {entry.name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                {/* Name + time */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold truncate">{entry.name}</span>
                    {entry.isCurrent && (
                      <Badge className="bg-yellow-400/20 text-yellow-300 border-yellow-400/40 text-[10px] font-bold uppercase tracking-wide px-2 py-0 h-5 shrink-0">
                        Actual
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatReign(entry.totalSeconds)} en el trono
                  </p>
                </div>

                {/* Position number for 4+ */}
                {entry.position > 3 && (
                  <span className="text-xs text-muted-foreground font-bold shrink-0">
                    #{entry.position}
                  </span>
                )}
              </motion.div>
            );
          })
        )}
      </div>

      {/* Footer note */}
      {entries && entries.length > 0 && (
        <p className="text-center text-xs text-muted-foreground/50 pb-4">
          El tiempo se acumula desde que un jugador sube al primer lugar hasta que otro lo supera.
        </p>
      )}
    </div>
  );
}
