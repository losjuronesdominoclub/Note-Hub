import React from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Play, Users, Trophy, Activity, ArrowRight, Medal, Zap, Flame, Star } from "lucide-react";
import { useGetDashboardStats, useGetRecentActivity, useListMatches } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

function avatarSrc(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http")) return path;
  const slug = path.startsWith("/objects/") ? path.slice("/objects/".length) : path;
  return `/api/storage/objects/${slug}`;
}

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: activity, isLoading: activityLoading } = useGetRecentActivity();
  const { data: activeMatches } = useListMatches({ status: "active" });
  const activeMatch = activeMatches?.[0] ?? null;

  const statCards = [
    { title: "Partidas Activas", value: stats?.activeMatches, icon: Activity, color: "text-green-500", bg: "bg-green-500/10" },
    { title: "Total Jugadores", value: stats?.totalPlayers, icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
    { title: "Partidas Jugadas", value: stats?.totalGamesPlayed, icon: Play, color: "text-purple-500", bg: "bg-purple-500/10" },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Resumen del club y actividad reciente.</p>
        </div>
        <Link href="/match/new">
          <Button size="icon" title="Nueva Partida" className="h-14 w-14 rounded-full shadow-lg bg-green-600 hover:bg-green-500 text-white shadow-green-900/40">
            <Play className="h-6 w-6 fill-current" />
          </Button>
        </Link>
      </div>

      {activeMatch && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl border border-green-500/40 bg-green-500/10 p-4 flex items-center gap-4"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-500/20">
            <Zap className="h-5 w-5 text-green-400 animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-green-400 text-sm uppercase tracking-wider">Partida en curso</p>
            <p className="text-white font-semibold truncate">
              Partida #{activeMatch.matchNumber} — Cortos {activeMatch.shortosScore} vs {activeMatch.largosScore} Largos
            </p>
          </div>
          <Link href={`/match/${activeMatch.id}`}>
            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white rounded-full shrink-0 gap-2">
              <ArrowRight className="h-4 w-4" /> Continuar
            </Button>
          </Link>
        </motion.div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {statCards.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className="glass-card overflow-hidden relative">
              <div className={`absolute top-0 right-0 p-4 ${stat.color} opacity-20`}>
                <stat.icon className="w-24 h-24 -mr-8 -mt-8" />
              </div>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  {stat.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${stat.bg}`}>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <div className="text-4xl font-bold">{stat.value || 0}</div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="glass-card h-full">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-xl">Actividad Reciente</CardTitle>
              <Activity className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {activityLoading ? (
                <div className="space-y-4">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-[200px]" />
                        <Skeleton className="h-3 w-[100px]" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : activity && activity.length > 0 ? (
                <div className="space-y-6">
                  {activity.slice(0, 5).map((entry, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <div className={`w-2 h-2 rounded-full ${entry.team === 'cortos' ? 'bg-red-500' : 'bg-blue-500'}`} />
                      <div className="flex-1 space-y-1">
                        <p className="text-sm font-medium leading-none">
                          <span className="font-bold">{entry.playerName}</span> anotó {entry.points} pts
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Partida #{entry.matchNumber} • {new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))}
                  <Button variant="link" className="w-full text-muted-foreground" asChild>
                    <Link href="/history">Ver historial completo <ArrowRight className="ml-2 h-4 w-4" /></Link>
                  </Button>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No hay actividad reciente.
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="glass-card h-full bg-gradient-to-br from-card to-primary/5 border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-xl">Jugador Top</CardTitle>
              <Trophy className="h-5 w-5 text-yellow-500" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <div className="flex flex-col items-center gap-4 py-4">
                  <Skeleton className="h-24 w-24 rounded-full" />
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ) : stats?.topPlayer ? (
                <div className="flex flex-col items-center text-center gap-4 py-4">
                  <div className="relative">
                    <Avatar className="h-28 w-28 border-4 border-yellow-500 shadow-xl shadow-yellow-500/20">
                      <AvatarImage src={avatarSrc(stats.topPlayer.avatarUrl)} className="object-cover" />
                      <AvatarFallback className="text-3xl font-bold bg-muted">{stats.topPlayer.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-3 -right-2 bg-yellow-500 text-yellow-950 p-1.5 rounded-full shadow-lg">
                      <Medal className="h-6 w-6" />
                    </div>
                  </div>
                  <div className="w-full space-y-3">
                    <h3 className="text-2xl font-bold">{stats.topPlayer.name}</h3>

                    {/* Stats row */}
                    <div className="flex items-center justify-center gap-2 flex-wrap">
                      <span className="flex items-center gap-1 text-sm bg-green-500/20 text-green-400 px-2.5 py-1 rounded-full font-semibold">
                        <Trophy className="h-3.5 w-3.5" /> {stats.topPlayer.wins}V · {stats.topPlayer.losses}D
                      </span>
                      <span className="flex items-center gap-1 text-sm bg-yellow-500/20 text-yellow-400 px-2.5 py-1 rounded-full font-semibold">
                        {(Number(stats.topPlayer.winRate) * 100).toFixed(0)}% WR
                      </span>
                    </div>

                    {/* Streak & points */}
                    <div className="grid grid-cols-2 gap-3 mt-1">
                      <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl py-3 px-2">
                        <div className="flex items-center justify-center gap-1.5 text-orange-400">
                          <Flame className="h-5 w-5" />
                          <span className="text-2xl font-black">{stats.topPlayer.currentStreak ?? 0}</span>
                        </div>
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">Racha</p>
                      </div>
                      <div className="bg-primary/10 border border-primary/20 rounded-xl py-3 px-2">
                        <div className="flex items-center justify-center gap-1.5 text-primary">
                          <Star className="h-5 w-5" />
                          <span className="text-2xl font-black">{stats.topPlayer.totalPoints ?? 0}</span>
                        </div>
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">Puntos</p>
                      </div>
                    </div>
                  </div>

                  <Button variant="outline" className="rounded-full w-full" asChild>
                    <Link href="/ranking">Ver Ranking Completo</Link>
                  </Button>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Aún no hay suficientes datos para el ranking.
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
