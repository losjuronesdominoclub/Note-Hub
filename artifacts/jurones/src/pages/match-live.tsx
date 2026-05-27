import React, { useEffect, useState, useRef } from "react";
import { useRoute } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { useGetMatch, getGetMatchQueryKey } from "@workspace/api-client-react";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trophy, ChevronUp, Activity } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function MatchLive() {
  const [, params] = useRoute("/match/:id");
  const matchId = parseInt(params?.id || "0");
  const { toast } = useToast();
  
  const { data: match, isLoading } = useGetMatch(matchId, {
    query: { refetchInterval: 3000 }
  });

  const [pointsInput, setPointsInput] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (match?.status === "finished") {
      triggerConfetti();
    }
  }, [match?.status]);

  const triggerConfetti = () => {
    const duration = 3 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
    }, 250);
  };

  const handleAddScore = async (playerId: number, team: "cortos" | "largos", points: number, isQuickThirty = false) => {
    if (match?.status === "finished") return;
    
    let actualPoints = points;
    if (isQuickThirty) {
      const currentScore = team === "cortos" ? match!.shortosScore : match!.largosScore;
      if (currentScore >= 170) {
        actualPoints = 199 - currentScore;
        toast({ title: "Tope alcanzado", description: "El botón 30 no puede cerrar la partida. Máximo permitido: 199", variant: "destructive" });
        if (actualPoints <= 0) return;
      } else {
        actualPoints = 30;
      }
    } else {
      if (!points || isNaN(points) || points <= 0) return;
    }

    setSubmitting(true);
    try {
      await fetch(`/api/matches/${matchId}/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, team, points: actualPoints, isQuickThirty })
      });
      setPointsInput(prev => ({ ...prev, [playerId]: "" }));
      queryClient.invalidateQueries({ queryKey: getGetMatchQueryKey(matchId) });
      
      // Check win condition locally for immediate feedback
      const newScore = (team === "cortos" ? match!.shortosScore : match!.largosScore) + actualPoints;
      if (newScore >= 200) {
        await fetch(`/api/matches/${matchId}/finish`, { method: "POST" });
        queryClient.invalidateQueries({ queryKey: getGetMatchQueryKey(matchId) });
      }
    } catch (e) {
      toast({ title: "Error", description: "No se pudo añadir el puntaje.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) return <div className="text-center py-20">Cargando partida...</div>;
  if (!match) return <div className="text-center py-20">Partida no encontrada.</div>;

  const cortosPlayers = match.players.filter(p => p.team === "cortos");
  const largosPlayers = match.players.filter(p => p.team === "largos");
  
  const isFinished = match.status === "finished";
  const isLisa = isFinished && (match.shortosScore === 0 || match.largosScore === 0);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <AnimatePresence>
        {isFinished && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: -50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className={`glass-card p-8 rounded-3xl text-center shadow-2xl relative overflow-hidden ${match.winnerTeam === 'cortos' ? 'bg-red-500/20 border-red-500/50' : 'bg-blue-500/20 border-blue-500/50'}`}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent pointer-events-none" />
            <Trophy className={`mx-auto h-20 w-20 mb-4 ${match.winnerTeam === 'cortos' ? 'text-red-500' : 'text-blue-500'}`} />
            <h2 className="text-4xl font-black mb-2 uppercase tracking-widest">
              ¡Ganan los {match.winnerTeam}!
            </h2>
            {isLisa && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.5 }}
                className="mt-6 font-black"
              >
                <div className="text-8xl mb-2">🐟</div>
                <div className="text-6xl text-gradient">¡LISA!</div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Cortos Team */}
        <div className="space-y-6">
          <div className="glass-card rounded-3xl p-6 border-t-4 border-t-red-600 bg-gradient-to-b from-red-500/10 to-transparent relative overflow-hidden">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-red-500 uppercase tracking-widest">Cortos</h2>
              <div className="text-7xl font-black tabular-nums tracking-tighter mt-2">{match.shortosScore}</div>
            </div>
            
            <div className="space-y-4">
              {cortosPlayers.map(({ player }) => (
                <Card key={player.id} className="bg-background/50 border-red-500/20">
                  <CardContent className="p-4 flex items-center gap-4">
                    <Avatar className="h-12 w-12 border border-red-500/50">
                      <AvatarImage src={player.avatarUrl || undefined} />
                      <AvatarFallback className="bg-red-500/20 text-red-500">{player.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 font-semibold">{player.name}</div>
                    {!isFinished && (
                      <div className="flex flex-col gap-2 w-32">
                        <div className="flex gap-2">
                          <Input 
                            type="number" 
                            placeholder="Pts" 
                            className="w-16 h-8 text-center"
                            value={pointsInput[player.id] || ""}
                            onChange={(e) => setPointsInput({ ...pointsInput, [player.id]: e.target.value })}
                          />
                          <Button 
                            size="sm" 
                            className="h-8 flex-1 bg-red-600 hover:bg-red-700 text-white"
                            disabled={submitting || !pointsInput[player.id]}
                            onClick={() => handleAddScore(player.id, "cortos", parseInt(pointsInput[player.id] || "0"))}
                          >
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                        </div>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-8 border-red-500/50 text-red-500 hover:bg-red-500/10"
                          disabled={submitting}
                          onClick={() => handleAddScore(player.id, "cortos", 30, true)}
                        >
                          +30 Rápido
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>

        {/* Largos Team */}
        <div className="space-y-6">
          <div className="glass-card rounded-3xl p-6 border-t-4 border-t-blue-600 bg-gradient-to-b from-blue-500/10 to-transparent relative overflow-hidden">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-blue-500 uppercase tracking-widest">Largos</h2>
              <div className="text-7xl font-black tabular-nums tracking-tighter mt-2">{match.largosScore}</div>
            </div>
            
            <div className="space-y-4">
              {largosPlayers.map(({ player }) => (
                <Card key={player.id} className="bg-background/50 border-blue-500/20">
                  <CardContent className="p-4 flex items-center gap-4">
                    <Avatar className="h-12 w-12 border border-blue-500/50">
                      <AvatarImage src={player.avatarUrl || undefined} />
                      <AvatarFallback className="bg-blue-500/20 text-blue-500">{player.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 font-semibold">{player.name}</div>
                    {!isFinished && (
                      <div className="flex flex-col gap-2 w-32">
                        <div className="flex gap-2">
                          <Input 
                            type="number" 
                            placeholder="Pts" 
                            className="w-16 h-8 text-center"
                            value={pointsInput[player.id] || ""}
                            onChange={(e) => setPointsInput({ ...pointsInput, [player.id]: e.target.value })}
                          />
                          <Button 
                            size="sm" 
                            className="h-8 flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                            disabled={submitting || !pointsInput[player.id]}
                            onClick={() => handleAddScore(player.id, "largos", parseInt(pointsInput[player.id] || "0"))}
                          >
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                        </div>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-8 border-blue-500/50 text-blue-500 hover:bg-blue-500/10"
                          disabled={submitting}
                          onClick={() => handleAddScore(player.id, "largos", 30, true)}
                        >
                          +30 Rápido
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="glass-card rounded-2xl p-6 mt-8">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Activity className="h-5 w-5" /> Registro de puntos
        </h3>
        <ScrollArea className="h-48 pr-4">
          <div className="space-y-3">
            {match.scoreLog.map((log) => (
              <div key={log.id} className="flex items-center justify-between text-sm py-2 border-b border-border/50 last:border-0">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${log.team === 'cortos' ? 'bg-red-500' : 'bg-blue-500'}`} />
                  <span className="font-medium">{log.playerName}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-bold">+{log.points}</span>
                  <span className="text-muted-foreground text-xs">{new Date(log.createdAt).toLocaleTimeString()}</span>
                </div>
              </div>
            ))}
            {match.scoreLog.length === 0 && (
              <div className="text-center text-muted-foreground py-4">No hay puntos registrados aún.</div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
