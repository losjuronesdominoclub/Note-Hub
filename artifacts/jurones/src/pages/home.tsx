import React from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Play, Users, Trophy, ChevronRight, Instagram, CalendarDays } from "lucide-react";
import logoPath from "@assets/logo_1779907396869.png";
import { useGetDashboardStats, useListEvents } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function Home() {
  const { data: stats } = useGetDashboardStats();
  const { data: events } = useListEvents();

  const nextEvent = React.useMemo(() => {
    if (!events?.length) return null;
    const today = new Date().toISOString().slice(0, 10);
    return (
      events
        .filter((e) => e.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null
    );
  }, [events]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100dvh-4rem)] relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-red-500/10 dark:bg-red-900/20 rounded-full blur-[120px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-3xl flex flex-col items-center text-center space-y-8"
      >
        <motion.img 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          src={logoPath} 
          alt="Los Jurones Domino Club" 
          className="w-48 h-48 md:w-64 md:h-64 object-contain drop-shadow-2xl"
        />

        <div className="space-y-4">
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-gradient">
            LOS JURONES
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground font-light max-w-xl mx-auto">
            El club de dominó más competitivo. Juega, puntúa y domina el ranking.
          </p>
        </div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex flex-wrap justify-center gap-4 w-full"
        >
          <div className="animated-border-card min-w-[140px]">
            <div className="animated-border-card-inner px-6 py-4 flex flex-col items-center">
              <span className="text-3xl font-bold">{stats?.activeMatches || 0}</span>
              <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Partidas Live</span>
            </div>
          </div>
          <div className="animated-border-card min-w-[140px]">
            <div className="animated-border-card-inner px-6 py-4 flex flex-col items-center">
              <span className="text-3xl font-bold">{stats?.totalPlayers || 0}</span>
              <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Jugadores</span>
            </div>
          </div>
          <div className="animated-border-card min-w-[160px] max-w-[220px]">
            <div className="animated-border-card-inner px-5 py-4 flex flex-col items-center gap-1">
              <CalendarDays className="h-5 w-5 text-primary mb-1" />
              {nextEvent ? (
                <>
                  <span className="text-sm font-bold leading-tight text-center line-clamp-2">{nextEvent.title}</span>
                  <span className="text-xs text-muted-foreground font-semibold">
                    {format(new Date(nextEvent.date + "T12:00:00"), "d MMM yyyy", { locale: es })}
                  </span>
                </>
              ) : (
                <span className="text-xs text-muted-foreground">Sin eventos</span>
              )}
              <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mt-1">Próximo Evento</span>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="flex flex-col sm:flex-row items-center gap-4 pt-4 w-full sm:w-auto"
        >
          <Link href="/sign-in" className="w-full sm:w-auto">
            <Button size="lg" className="w-full sm:w-auto rounded-full px-8 text-lg font-bold shadow-lg hover:shadow-primary/25 transition-all">
              Entrar al Club <ChevronRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
          <Link href="/live" className="w-full sm:w-auto">
            <Button size="lg" variant="outline" className="w-full sm:w-auto rounded-full px-8 text-lg font-bold glass-card hover:bg-white/10 transition-all">
              Ver Partidas Live
            </Button>
          </Link>
        </motion.div>

      </motion.div>
    </div>
  );
}
