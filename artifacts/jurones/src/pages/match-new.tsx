import React, { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useListPlayers, useCreateMatch, useGetBusyPlayers } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { ChevronRight, ArrowLeft, Play, Search, CheckCircle2, Swords } from "lucide-react";
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

  const [step, setStep] = useState<1 | 2>(1);
  const [cortos, setCortos] = useState<number[]>([]);
  const [largos, setLargos] = useState<number[]>([]);
  const [search, setSearch] = useState("");

  const toggleCorto = (id: number) => {
    if (busyPlayerIds.has(id)) return;
    if (cortos.includes(id)) {
      setCortos(cortos.filter(p => p !== id));
    } else if (cortos.length < 2) {
      setCortos([...cortos, id]);
    }
  };

  const toggleLargo = (id: number) => {
    if (busyPlayerIds.has(id)) return;
    if (largos.includes(id)) {
      setLargos(largos.filter(p => p !== id));
    } else if (largos.length < 2) {
      setLargos([...largos, id]);
    }
  };

  const handleNextStep = () => {
    if (cortos.length === 2) {
      setStep(2);
      setSearch("");
    }
  };

  const handleStartMatch = () => {
    if (cortos.length === 2 && largos.length === 2) {
      createMatch.mutate({ data: { cortos, largos } }, {
        onSuccess: (match) => setLocation(`/match/${match.id}`),
        onError: () => toast({ variant: "destructive", title: "Error", description: "No se pudo crear la partida." }),
      });
    }
  };

  const availableForLargos = players?.filter(p => !cortos.includes(p.id)) || [];
  const query = search.toLowerCase().trim();
  const filteredCortos = query ? (players ?? []).filter(p => p.name.toLowerCase().includes(query)) : (players ?? []);
  const filteredLargos = query ? availableForLargos.filter(p => p.name.toLowerCase().includes(query)) : availableForLargos;

  // Players selected for display in the mini-summary
  const selectedCortos = (players ?? []).filter(p => cortos.includes(p.id));
  const selectedLargos = (players ?? []).filter(p => largos.includes(p.id));

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center gap-4">
        {step === 2 && (
          <Button variant="ghost" size="icon" onClick={() => { setStep(1); setSearch(""); }} className="rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Nueva Partida</h1>
          <p className="text-muted-foreground mt-1">
            {step === 1 ? "Selecciona el equipo Cortos (2 jugadores)" : "Selecciona el equipo Largos (2 jugadores)"}
          </p>
        </div>
      </div>

      {/* Step progress */}
      <div className="flex items-center gap-2">
        <div className={`h-2 flex-1 rounded-full transition-colors ${step >= 1 ? 'bg-red-500' : 'bg-muted'}`} />
        <div className={`h-2 flex-1 rounded-full transition-colors ${step >= 2 ? 'bg-blue-500' : 'bg-muted'}`} />
      </div>

      {/* Selected players mini-summary */}
      {(selectedCortos.length > 0 || selectedLargos.length > 0) && (
        <div className="flex gap-3 flex-wrap">
          {step === 1 && selectedCortos.map(p => (
            <div key={p.id} className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-full px-3 py-1.5">
              <Avatar className="h-6 w-6">
                <AvatarImage src={avatarSrc(p.avatarUrl)} className="object-cover" />
                <AvatarFallback className="text-[10px]">{p.name.substring(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium text-red-400">{p.name}</span>
              <CheckCircle2 className="h-4 w-4 text-red-400" />
            </div>
          ))}
          {step === 2 && selectedLargos.map(p => (
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
          onChange={e => setSearch(e.target.value)}
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
                    className={`transition-all ${busy ? 'opacity-40 cursor-not-allowed' : selected ? 'cursor-pointer ring-2 ring-red-500 bg-red-500/10' : 'cursor-pointer hover:bg-white/5 glass-card'}`}
                    onClick={() => toggleCorto(player.id)}
                  >
                    <CardContent className="p-4 flex flex-col items-center text-center gap-3">
                      <div className="relative">
                        <Avatar className={`h-16 w-16 transition-all ${selected ? 'ring-2 ring-red-500 ring-offset-2 ring-offset-background' : ''}`}>
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
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{cortos.length}/2 seleccionados</span>
            <Button
              size="lg"
              onClick={handleNextStep}
              disabled={cortos.length !== 2}
              className="bg-red-600 hover:bg-red-700 text-white rounded-full px-8"
            >
              Siguiente <ChevronRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
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
                    className={`transition-all ${busy ? 'opacity-40 cursor-not-allowed' : selected ? 'cursor-pointer ring-2 ring-blue-500 bg-blue-500/10' : 'cursor-pointer hover:bg-white/5 glass-card'}`}
                    onClick={() => toggleLargo(player.id)}
                  >
                    <CardContent className="p-4 flex flex-col items-center text-center gap-3">
                      <div className="relative">
                        <Avatar className={`h-16 w-16 transition-all ${selected ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-background' : ''}`}>
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
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{largos.length}/2 seleccionados</span>
            <Button
              size="lg"
              onClick={handleStartMatch}
              disabled={largos.length !== 2 || createMatch.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-8"
            >
              {createMatch.isPending ? "Iniciando..." : "Comenzar Partida"} <Play className="ml-2 h-5 w-5 fill-current" />
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
