import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, CalendarDays, Trophy, X, Clock } from "lucide-react";
import { useListHistory } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import ScrollToTop from "@/components/scroll-to-top";

const TZ = "America/Santo_Domingo";

function matchDayKey(match: any): string {
  const d = new Date(match.finishedAt ?? match.createdAt);
  return d.toLocaleDateString("en-CA", { timeZone: TZ }); // YYYY-MM-DD
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-DO", {
    timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

function formatDayLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-DO", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export default function Timeline() {
  const { data: history, isLoading } = useListHistory();
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const today = new Date().toLocaleDateString("en-CA", { timeZone: TZ });
  const [year, month] = today.split("-").map(Number);
  const [viewYear, setViewYear] = useState(year);
  const [viewMonth, setViewMonth] = useState(month); // 1-12

  // Group matches by day key
  const matchesByDay = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const match of history ?? []) {
      const key = matchDayKey(match);
      if (!map[key]) map[key] = [];
      map[key].push(match);
    }
    return map;
  }, [history]);

  // Build calendar grid for the current view month
  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth - 1, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
    const daysInPrev = new Date(viewYear, viewMonth - 1, 0).getDate();

    const cells: Array<{ dateStr: string; isCurrentMonth: boolean }> = [];

    // Trailing days from previous month
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = daysInPrev - i;
      const pm = viewMonth - 1 === 0 ? 12 : viewMonth - 1;
      const py = viewMonth - 1 === 0 ? viewYear - 1 : viewYear;
      cells.push({ dateStr: `${py}-${String(pm).padStart(2, "0")}-${String(d).padStart(2, "0")}`, isCurrentMonth: false });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ dateStr: `${viewYear}-${String(viewMonth).padStart(2, "0")}-${String(d).padStart(2, "0")}`, isCurrentMonth: true });
    }

    // Leading days from next month to complete the grid (always show 6 rows = 42 cells)
    const remaining = 42 - cells.length;
    for (let d = 1; d <= remaining; d++) {
      const nm = viewMonth + 1 === 13 ? 1 : viewMonth + 1;
      const ny = viewMonth + 1 === 13 ? viewYear + 1 : viewYear;
      cells.push({ dateStr: `${ny}-${String(nm).padStart(2, "0")}-${String(d).padStart(2, "0")}`, isCurrentMonth: false });
    }

    return cells;
  }, [viewYear, viewMonth]);

  const prevMonth = () => {
    if (viewMonth === 1) { setViewMonth(12); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };

  const goToToday = () => { setViewYear(year); setViewMonth(month); };

  const nextMonth = () => {
    if (viewMonth === 12) { setViewMonth(1); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const selectedMatches = selectedDay ? (matchesByDay[selectedDay] ?? []) : [];

  // Stats for current month
  const monthKey = `${viewYear}-${String(viewMonth).padStart(2, "0")}`;
  const monthMatches = Object.entries(matchesByDay)
    .filter(([k]) => k.startsWith(monthKey))
    .flatMap(([, m]) => m);
  const daysWithMatches = Object.keys(matchesByDay).filter(k => k.startsWith(monthKey)).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-2xl mx-auto">
      <ScrollToTop />
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-muted rounded-full">
          <CalendarDays className="h-6 w-6 text-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight">Timeline</h1>
          <p className="text-muted-foreground text-sm">Historial de partidas por día</p>
        </div>
      </div>

      {/* Calendar card */}
      <div className="glass-card rounded-2xl p-4 border border-border/50">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="icon" onClick={prevMonth} className="h-8 w-8 rounded-full hover:bg-white/5">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-center">
            <div className="font-black text-lg tracking-tight">
              {MONTH_NAMES[viewMonth - 1]} {viewYear}
            </div>
            {(viewYear !== year || viewMonth !== month) && (
              <button onClick={goToToday} className="text-[11px] text-primary hover:underline mt-0.5">
                Ir a hoy
              </button>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={nextMonth} className="h-8 w-8 rounded-full hover:bg-white/5">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Month stats */}
        {!isLoading && (
          <div className="flex gap-2 mb-4 text-xs">
            <div className="flex-1 rounded-xl bg-primary/10 border border-primary/20 px-3 py-2 text-center">
              <div className="font-black text-primary text-lg">{monthMatches.length}</div>
              <div className="text-muted-foreground">partidas</div>
            </div>
            <div className="flex-1 rounded-xl bg-muted/40 border border-border/40 px-3 py-2 text-center">
              <div className="font-black text-lg">{daysWithMatches}</div>
              <div className="text-muted-foreground">días activos</div>
            </div>
          </div>
        )}

        {/* Weekday headers */}
        <div className="grid grid-cols-7 mb-1">
          {WEEKDAYS.map(d => (
            <div key={d} className="text-center text-[11px] font-semibold text-muted-foreground py-1">{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map(({ dateStr, isCurrentMonth }) => {
              const count = matchesByDay[dateStr]?.length ?? 0;
              const isToday = dateStr === today;
              const hasMatches = count > 0;
              const isFuture = dateStr > today;

              return (
                <motion.button
                  key={dateStr}
                  whileHover={hasMatches && isCurrentMonth ? { scale: 1.08 } : {}}
                  whileTap={hasMatches && isCurrentMonth ? { scale: 0.95 } : {}}
                  onClick={() => hasMatches && isCurrentMonth && setSelectedDay(dateStr)}
                  disabled={!hasMatches || !isCurrentMonth}
                  className={`
                    relative flex flex-col items-center justify-center rounded-xl aspect-square text-sm font-semibold transition-all
                    ${!isCurrentMonth ? "opacity-20 cursor-default" : ""}
                    ${isCurrentMonth && hasMatches ? "cursor-pointer" : isCurrentMonth ? "cursor-default" : ""}
                    ${isToday ? "ring-2 ring-primary" : ""}
                    ${isCurrentMonth && hasMatches
                      ? "bg-primary/15 hover:bg-primary/25 text-primary"
                      : isCurrentMonth && !isFuture
                        ? "text-muted-foreground"
                        : "text-muted-foreground/50"}
                  `}
                >
                  <span className={`text-sm leading-none ${isToday ? "font-black text-primary" : ""}`}>
                    {parseInt(dateStr.split("-")[2])}
                  </span>
                  {hasMatches && isCurrentMonth && (
                    <span className={`
                      mt-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-black px-1
                      ${count >= 5 ? "bg-yellow-500 text-black" : count >= 3 ? "bg-orange-500 text-white" : "bg-primary text-primary-foreground"}
                    `}>
                      {count}
                    </span>
                  )}
                </motion.button>
              );
            })}
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border/30 text-[11px] text-muted-foreground flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-[9px] font-black text-primary-foreground">1</span>
            1-2 partidas
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-orange-500 text-[9px] font-black text-white">3</span>
            3-4 partidas
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-yellow-500 text-[9px] font-black text-black">5</span>
            5+ partidas
          </div>
        </div>
      </div>

      {/* Day detail modal */}
      <Dialog open={!!selectedDay} onOpenChange={(o) => !o && setSelectedDay(null)}>
        <DialogContent className="bg-[#141414] border-[#2a2a2a] max-w-lg max-h-[80dvh] flex flex-col p-0 gap-0">
          <DialogHeader className="p-5 pb-3 border-b border-[#2a2a2a] shrink-0">
            <DialogTitle className="text-white flex items-center gap-2 text-base">
              <CalendarDays className="h-5 w-5 text-primary shrink-0" />
              <span className="capitalize">{selectedDay ? formatDayLabel(selectedDay) : ""}</span>
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {selectedMatches.length} partida{selectedMatches.length !== 1 ? "s" : ""} jugada{selectedMatches.length !== 1 ? "s" : ""}
            </p>
          </DialogHeader>

          <div className="overflow-y-auto flex-1 p-4 space-y-3">
            {selectedMatches.map((match: any) => {
              const cortos = (match.players ?? []).filter((p: any) => p.team === "cortos");
              const largos = (match.players ?? []).filter((p: any) => p.team === "largos");
              const winner = match.winnerTeam;
              const isLisa = (match.shortosScore === 0 || match.largosScore === 0) && match.status === "finished";
              return (
                <motion.div
                  key={match.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] overflow-hidden"
                >
                  {/* Match header */}
                  <div className="flex items-center justify-between px-4 py-2 border-b border-[#2a2a2a] bg-[#141414]">
                    <span className="text-xs font-bold text-muted-foreground">Partida #{match.matchNumber}</span>
                    <div className="flex items-center gap-2">
                      {isLisa && <span className="text-xs font-black text-yellow-400">🐟 LISA</span>}
                      <div className="flex items-center gap-1 text-muted-foreground text-xs">
                        <Clock className="h-3 w-3" />
                        {formatTime(match.finishedAt ?? match.createdAt)}
                      </div>
                    </div>
                  </div>

                  {/* Scoreboard */}
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-3">
                    {/* Cortos */}
                    <div className={`text-right ${winner === "cortos" ? "opacity-100" : "opacity-60"}`}>
                      <div className="flex flex-col items-end gap-0.5">
                        {cortos.map((p: any) => (
                          <span key={p.playerId} className="text-xs font-semibold text-white leading-tight">{p.player?.name}</span>
                        ))}
                      </div>
                      <div className={`text-2xl font-black tabular-nums mt-1 ${winner === "cortos" ? "text-red-400" : "text-muted-foreground"}`}>
                        {match.shortosScore}
                      </div>
                      {winner === "cortos" && <Trophy className="h-3.5 w-3.5 text-yellow-400 ml-auto mt-0.5" />}
                    </div>

                    {/* VS */}
                    <div className="text-center">
                      <div className="text-xs font-black text-muted-foreground/40 uppercase tracking-widest">vs</div>
                    </div>

                    {/* Largos */}
                    <div className={`text-left ${winner === "largos" ? "opacity-100" : "opacity-60"}`}>
                      <div className="flex flex-col items-start gap-0.5">
                        {largos.map((p: any) => (
                          <span key={p.playerId} className="text-xs font-semibold text-white leading-tight">{p.player?.name}</span>
                        ))}
                      </div>
                      <div className={`text-2xl font-black tabular-nums mt-1 ${winner === "largos" ? "text-blue-400" : "text-muted-foreground"}`}>
                        {match.largosScore}
                      </div>
                      {winner === "largos" && <Trophy className="h-3.5 w-3.5 text-yellow-400 mt-0.5" />}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
