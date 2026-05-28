import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  useListPlayers,
  useCreateMatch,
  useGetBusyPlayers,
  useListMatches,
  useGetMatch,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  ChevronRight,
  ArrowLeft,
  Play,
  Search,
  CheckCircle2,
  Swords,
  Shield,
  Trophy,
  Zap,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function avatarSrc(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http")) return path;
  const slug = path.startsWith("/objects/") ? path.slice("/objects/".length) : path;
  return `/api/storage/objects/${slug}`;
}

export default function MatchNew() {
  const [, setLocation] = useLocation();
  const { data: players, isLoading } = useListPlayers();
  const { data: busyData } = useGetBusyPlayers({ query: { refetchInterval: 5000 } });
  const busyPlayerIds = new Set(busyData?.busyPlayerIds ?? []);
  const createMatch = useCreateMatch();
  const { toast } = useToast();

  // Normal mode state
  const [step, setStep] = useState<1 | 2>(1);
  const [cortos, setCortos] = useState<number[]>([]);
  const [largos, setLargos] = useState<number[]>([]);
  const [search, setSearch] = useState("");

  // Survivor mode
  const [survivorMode, setSurvivorMode] = useState(false);
  const [survivorLockedTeam, setSurvivorLockedTeam] = useState<"cortos" | "largos" | null>(null);
  const [survivorLockedIds, setSurvivorLockedIds] = useState<number[]>([]);
  const [survivorChallengers, setSurvivorChallengers] = useState<number[]>([]);

  // Fetch last finished match for survivor
  const { data: finishedMatches } = useListMatches(
    { status: "finished" },
    { query: { enabled: survivorMode } }
  );
  const lastMatchId = finishedMatches?.[0]?.id;
  const { data: lastMatch } = useGetMatch(lastMatchId ?? 0, {
    query: { enabled: survivorMode && !!lastMatchId },
  });

  // When last match loads, auto-lock the winning team
  useEffect(() => {
    if (!survivorMode || !lastMatch) return;
    const winner = lastMatch.winnerTeam as "cortos" | "largos" | null;
    if (!winner) return;
    const lockedIds = lastMatch.players
      .filter((p) => p.team === winner)
      .map((p) => p.player.id);
    setSurvivorLockedTeam(winner);
    setSurvivorLockedIds(lockedIds);
    setSurvivorChallengers([]);
    // Also pre-fill normal state so handleStartMatch works
    if (winner === "cortos") {
      setCortos(lockedIds);
      setLargos([]);
    } else {
      setLargos(lockedIds);
      setCortos([]);
    }
  }, [survivorMode, lastMatch]);

  const handleToggleSurvivor = (on: boolean) => {
    setSurvivorMode(on);
    if (!on) {
      // Reset everything
      setSurvivorLockedTeam(null);
      setSurvivorLockedIds([]);
      setSurvivorChallengers([]);
      setCortos([]);
      setLargos([]);
      setStep(1);
      setSearch("");
    }
  };

  // Survivor challenger toggle
  const toggleChallenger = (id: number) => {
    if (busyPlayerIds.has(id)) return;
    if (survivorLockedIds.includes(id)) return;
    if (survivorChallengers.includes(id)) {
      const next = survivorChallengers.filter((p) => p !== id);
      setSurvivorChallengers(next);
      if (survivorLockedTeam === "cortos") setLargos(next);
      else setCortos(next);
    } else if (survivorChallengers.length < 2) {
      const next = [...survivorChallengers, id];
      setSurvivorChallengers(next);
      if (survivorLockedTeam === "cortos") setLargos(next);
      else setCortos(next);
    }
  };

  // Normal mode toggles
  const toggleCorto = (id: number) => {
    if (busyPlayerIds.has(id)) return;
    if (cortos.includes(id)) setCortos(cortos.filter((p) => p !== id));
    else if (cortos.length < 2) setCortos([...cortos, id]);
  };

  const toggleLargo = (id: number) => {
    if (busyPlayerIds.has(id)) return;
    if (largos.includes(id)) setLargos(largos.filter((p) => p !== id));
    else if (largos.length < 2) setLargos([...largos, id]);
  };

  const handleNextStep = () => {
    if (cortos.length === 2) {
      setStep(2);
      setSearch("");
    }
  };

  const handleStartMatch = () => {
    if (cortos.length === 2 && largos.length === 2) {
      createMatch.mutate(
        { data: { cortos, largos } },
        {
          onSuccess: (match) => setLocation(`/match/${match.id}`),
          onError: () =>
            toast({ variant: "destructive", title: "Error", description: "No se pudo crear la partida." }),
        }
      );
    }
  };

  // Derived lists for normal mode
  const availableForLargos = players?.filter((p) => !cortos.includes(p.id)) ?? [];
  const q = search.toLowerCase().trim();
  const filteredCortos = q ? (players ?? []).filter((p) => p.name.toLowerCase().includes(q)) : (players ?? []);
  const filteredLargos = q ? availableForLargos.filter((p) => p.name.toLowerCase().includes(q)) : availableForLargos;

  const selectedCortos = (players ?? []).filter((p) => cortos.includes(p.id));
  const selectedLargos = (players ?? []).filter((p) => largos.includes(p.id));

  // Survivor: locked players info
  const lockedPlayers = (players ?? []).filter((p) => survivorLockedIds.includes(p.id));
  const challengerColor = survivorLockedTeam === "cortos" ? "blue" : "red";
  const challengerTeamLabel = survivorLockedTeam === "cortos" ? "Largos" : "Cortos";

  // Survivor available (exclude locked + busy)
  const survivorAvailable = (players ?? []).filter(
    (p) => !survivorLockedIds.includes(p.id)
  );
  const filteredSurvivor = q
    ? survivorAvailable.filter((p) => p.name.toLowerCase().includes(q))
    : survivorAvailable;

  // Whether survivor is ready to start
  const survivorReady = survivorLockedIds.length === 2 && survivorChallengers.length === 2;

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {!survivorMode && step === 2 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => { setStep(1); setSearch(""); }}
              className="rounded-full"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Nueva Partida</h1>
            <p className="text-muted-foreground mt-1">
              {survivorMode
                ? survivorLockedTeam
                  ? `Elige los 2 retadores del equipo ${challengerTeamLabel}`
                  : "Cargando última partida..."
                : step === 1
                ? "Selecciona el equipo Cortos (2 jugadores)"
                : "Selecciona el equipo Largos (2 jugadores)"}
            </p>
          </div>
        </div>

        {/* Survivor Toggle */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <Zap className={`h-4 w-4 transition-colors ${survivorMode ? "text-green-400" : "text-muted-foreground"}`} />
            <Label
              htmlFor="survivor-toggle"
              className={`text-sm font-bold cursor-pointer select-none transition-colors ${survivorMode ? "text-green-400" : "text-muted-foreground"}`}
            >
              Survivor
            </Label>
          </div>
          <Switch
            id="survivor-toggle"
            checked={survivorMode}
            onCheckedChange={handleToggleSurvivor}
            className={survivorMode
              ? "data-[state=checked]:bg-green-500"
              : "data-[state=unchecked]:bg-red-600"
            }
          />
        </div>
      </div>

      {/* Step progress — only in normal mode */}
      {!survivorMode && (
        <div className="flex items-center gap-2">
          <div className={`h-2 flex-1 rounded-full transition-colors ${step >= 1 ? "bg-red-500" : "bg-muted"}`} />
          <div className={`h-2 flex-1 rounded-full transition-colors ${step >= 2 ? "bg-blue-500" : "bg-muted"}`} />
        </div>
      )}

      {/* ─── SURVIVOR MODE ─── */}
      <AnimatePresence mode="wait">
        {survivorMode && (
          <motion.div
            key="survivor"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="space-y-6"
          >
            {/* Champions banner */}
            {lockedPlayers.length > 0 && (
              <div className={`glass-card rounded-2xl p-4 border ${survivorLockedTeam === "cortos" ? "border-red-500/40 bg-red-500/5" : "border-blue-500/40 bg-blue-500/5"}`}>
                <div className="flex items-center gap-2 mb-3">
                  <Trophy className={`h-5 w-5 ${survivorLockedTeam === "cortos" ? "text-red-400" : "text-blue-400"}`} />
                  <span className={`font-bold text-sm uppercase tracking-widest ${survivorLockedTeam === "cortos" ? "text-red-400" : "text-blue-400"}`}>
                    Campeones · {survivorLockedTeam === "cortos" ? "Cortos" : "Largos"}
                  </span>
                  <Shield className="h-4 w-4 text-yellow-400 ml-auto" />
                  <span className="text-xs text-yellow-400 font-semibold">Bloqueados</span>
                </div>
                <div className="flex gap-4">
                  {lockedPlayers.map((p) => (
                    <div key={p.id} className="flex items-center gap-3">
                      <div className="relative">
                        <Avatar className={`h-12 w-12 ring-2 ${survivorLockedTeam === "cortos" ? "ring-red-500" : "ring-blue-500"} ring-offset-2 ring-offset-background`}>
                          <AvatarImage src={avatarSrc(p.avatarUrl)} className="object-cover" />
                          <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
                            {p.name.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="absolute -top-1 -right-1 bg-yellow-500 rounded-full p-0.5">
                          <Trophy className="h-3 w-3 text-black" />
                        </div>
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.wins}V · {p.losses}D</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Challenger picker */}
            {survivorLockedTeam && (
              <>
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar retador..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 bg-background"
                  />
                </div>

                {filteredSurvivor.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">Sin resultados para "{search}"</div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {filteredSurvivor.map((player) => {
                      const selected = survivorChallengers.includes(player.id);
                      const busy = busyPlayerIds.has(player.id);
                      const ringColor = challengerColor === "blue" ? "ring-blue-500 bg-blue-500/10" : "ring-red-500 bg-red-500/10";
                      const avatarRing = challengerColor === "blue" ? "ring-blue-500" : "ring-red-500";
                      const badgeBg = challengerColor === "blue" ? "bg-blue-500" : "bg-red-500";
                      return (
                        <Card
                          key={player.id}
                          className={`transition-all ${busy ? "opacity-40 cursor-not-allowed" : selected ? `cursor-pointer ring-2 ${ringColor}` : "cursor-pointer hover:bg-white/5 glass-card"}`}
                          onClick={() => toggleChallenger(player.id)}
                        >
                          <CardContent className="p-4 flex flex-col items-center text-center gap-3">
                            <div className="relative">
                              <Avatar className={`h-16 w-16 transition-all ${selected ? `ring-2 ${avatarRing} ring-offset-2 ring-offset-background` : ""}`}>
                                <AvatarImage src={avatarSrc(player.avatarUrl)} className="object-cover" />
                                <AvatarFallback className="bg-primary/10 text-primary font-bold">
                                  {player.name.substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              {selected && !busy && (
                                <div className={`absolute -top-1 -right-1 ${badgeBg} rounded-full p-0.5`}>
                                  <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                                </div>
                              )}
                              {busy && (
                                <div className="absolute -top-1 -right-1 bg-yellow-500 rounded-full p-0.5">
                                  <Swords className="h-3.5 w-3.5 text-black" />
                                </div>
                              )}
                            </div>
                            <span className="font-semibold text-sm leading-tight">{player.name}</span>
                            {busy
                              ? <span className="text-xs font-semibold text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded-full">En partida</span>
                              : <span className="text-xs text-muted-foreground">{player.wins}V · {player.losses}D</span>
                            }
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}

                <div className="flex items-center">
                  <span className="text-sm text-muted-foreground">{survivorChallengers.length}/2 retadores</span>
                </div>
                <motion.div
                  className="fixed bottom-8 right-8 z-50"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: survivorReady ? 1 : 0.85, opacity: survivorReady ? 1 : 0.4 }}
                  transition={{ type: "spring", stiffness: 300, damping: 22 }}
                >
                  <Button
                    size="icon"
                    onClick={handleStartMatch}
                    disabled={!survivorReady || createMatch.isPending}
                    className={`h-16 w-16 rounded-full text-white shadow-2xl disabled:pointer-events-none ${challengerColor === "blue" ? "bg-blue-600 hover:bg-blue-500 shadow-blue-900/50" : "bg-red-600 hover:bg-red-500 shadow-red-900/50"}`}
                  >
                    {createMatch.isPending ? <span className="text-xs font-bold">...</span> : <Play className="h-7 w-7 fill-current" />}
                  </Button>
                </motion.div>
              </>
            )}

            {/* No finished matches */}
            {!survivorLockedTeam && lastMatchId === undefined && finishedMatches !== undefined && (
              <div className="text-center text-muted-foreground py-12">
                <Swords className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No hay partidas finalizadas</p>
                <p className="text-sm mt-1">El modo Survivor necesita al menos una partida terminada.</p>
              </div>
            )}
          </motion.div>
        )}

        {/* ─── NORMAL MODE ─── */}
        {!survivorMode && (
          <motion.div
            key="normal"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="space-y-6"
          >
            {/* Selected players mini-summary */}
            {(selectedCortos.length > 0 || selectedLargos.length > 0) && (
              <div className="flex gap-3 flex-wrap">
                {step === 1 && selectedCortos.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-full px-3 py-1.5">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={avatarSrc(p.avatarUrl)} className="object-cover" />
                      <AvatarFallback className="text-[10px]">{p.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium text-red-400">{p.name}</span>
                    <CheckCircle2 className="h-4 w-4 text-red-400" />
                  </div>
                ))}
                {step === 2 && selectedLargos.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/30 rounded-full px-3 py-1.5">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={avatarSrc(p.avatarUrl)} className="object-cover" />
                      <AvatarFallback className="text-[10px]">{p.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium text-blue-400">{p.name}</span>
                    <CheckCircle2 className="h-4 w-4 text-blue-400" />
                  </div>
                ))}
              </div>
            )}

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar jugador..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-background"
              />
            </div>

            {/* Step 1 — Cortos */}
            {step === 1 && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                {isLoading ? (
                  <div className="text-center text-muted-foreground py-8">Cargando jugadores...</div>
                ) : filteredCortos.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">Sin resultados para "{search}"</div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {filteredCortos.map((player) => {
                      const selected = cortos.includes(player.id);
                      const busy = busyPlayerIds.has(player.id);
                      return (
                        <Card
                          key={player.id}
                          className={`transition-all ${busy ? "opacity-40 cursor-not-allowed" : selected ? "cursor-pointer ring-2 ring-red-500 bg-red-500/10" : "cursor-pointer hover:bg-white/5 glass-card"}`}
                          onClick={() => toggleCorto(player.id)}
                        >
                          <CardContent className="p-4 flex flex-col items-center text-center gap-3">
                            <div className="relative">
                              <Avatar className={`h-16 w-16 transition-all ${selected ? "ring-2 ring-red-500 ring-offset-2 ring-offset-background" : ""}`}>
                                <AvatarImage src={avatarSrc(player.avatarUrl)} className="object-cover" />
                                <AvatarFallback className="bg-primary/10 text-primary font-bold">
                                  {player.name.substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              {selected && !busy && (
                                <div className="absolute -top-1 -right-1 bg-red-500 rounded-full p-0.5">
                                  <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                                </div>
                              )}
                              {busy && (
                                <div className="absolute -top-1 -right-1 bg-yellow-500 rounded-full p-0.5">
                                  <Swords className="h-3.5 w-3.5 text-black" />
                                </div>
                              )}
                            </div>
                            <span className="font-semibold text-sm leading-tight">{player.name}</span>
                            {busy
                              ? <span className="text-xs font-semibold text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded-full">En partida</span>
                              : <span className="text-xs text-muted-foreground">{player.wins}V · {player.losses}D</span>
                            }
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
                <div className="flex items-center">
                  <span className="text-sm text-muted-foreground">{cortos.length}/2 seleccionados</span>
                </div>
                {/* Floating round button */}
                <motion.div
                  className="fixed bottom-8 right-8 z-50"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: cortos.length === 2 ? 1 : 0.85, opacity: cortos.length === 2 ? 1 : 0.4 }}
                  transition={{ type: "spring", stiffness: 300, damping: 22 }}
                >
                  <Button
                    size="icon"
                    onClick={handleNextStep}
                    disabled={cortos.length !== 2}
                    className="h-16 w-16 rounded-full bg-red-600 hover:bg-red-500 text-white shadow-2xl shadow-red-900/50 disabled:pointer-events-none"
                  >
                    <ChevronRight className="h-7 w-7" />
                  </Button>
                </motion.div>
              </motion.div>
            )}

            {/* Step 2 — Largos */}
            {step === 2 && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                {filteredLargos.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">Sin resultados para "{search}"</div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {filteredLargos.map((player) => {
                      const selected = largos.includes(player.id);
                      const busy = busyPlayerIds.has(player.id);
                      return (
                        <Card
                          key={player.id}
                          className={`transition-all ${busy ? "opacity-40 cursor-not-allowed" : selected ? "cursor-pointer ring-2 ring-blue-500 bg-blue-500/10" : "cursor-pointer hover:bg-white/5 glass-card"}`}
                          onClick={() => toggleLargo(player.id)}
                        >
                          <CardContent className="p-4 flex flex-col items-center text-center gap-3">
                            <div className="relative">
                              <Avatar className={`h-16 w-16 transition-all ${selected ? "ring-2 ring-blue-500 ring-offset-2 ring-offset-background" : ""}`}>
                                <AvatarImage src={avatarSrc(player.avatarUrl)} className="object-cover" />
                                <AvatarFallback className="bg-primary/10 text-primary font-bold">
                                  {player.name.substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              {selected && !busy && (
                                <div className="absolute -top-1 -right-1 bg-blue-500 rounded-full p-0.5">
                                  <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                                </div>
                              )}
                              {busy && (
                                <div className="absolute -top-1 -right-1 bg-yellow-500 rounded-full p-0.5">
                                  <Swords className="h-3.5 w-3.5 text-black" />
                                </div>
                              )}
                            </div>
                            <span className="font-semibold text-sm leading-tight">{player.name}</span>
                            {busy
                              ? <span className="text-xs font-semibold text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded-full">En partida</span>
                              : <span className="text-xs text-muted-foreground">{player.wins}V · {player.losses}D</span>
                            }
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
                <div className="flex items-center">
                  <span className="text-sm text-muted-foreground">{largos.length}/2 seleccionados</span>
                </div>
                <motion.div
                  className="fixed bottom-8 right-8 z-50"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: largos.length === 2 ? 1 : 0.85, opacity: largos.length === 2 ? 1 : 0.4 }}
                  transition={{ type: "spring", stiffness: 300, damping: 22 }}
                >
                  <Button
                    size="icon"
                    onClick={handleStartMatch}
                    disabled={largos.length !== 2 || createMatch.isPending}
                    className="h-16 w-16 rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-2xl shadow-blue-900/50 disabled:pointer-events-none"
                  >
                    {createMatch.isPending ? <span className="text-xs font-bold">...</span> : <Play className="h-7 w-7 fill-current" />}
                  </Button>
                </motion.div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
