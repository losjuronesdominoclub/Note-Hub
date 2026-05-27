import React, { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useListPlayers, useCreateMatch } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChevronRight, ArrowLeft, Play } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function MatchNew() {
  const [, setLocation] = useLocation();
  const { data: players, isLoading } = useListPlayers();
  const createMatch = useCreateMatch();
  const { toast } = useToast();

  const [step, setStep] = useState<1 | 2>(1);
  const [cortos, setCortos] = useState<number[]>([]);
  const [largos, setLargos] = useState<number[]>([]);

  const toggleCorto = (id: number) => {
    if (cortos.includes(id)) {
      setCortos(cortos.filter(p => p !== id));
    } else if (cortos.length < 2) {
      setCortos([...cortos, id]);
    }
  };

  const toggleLargo = (id: number) => {
    if (largos.includes(id)) {
      setLargos(largos.filter(p => p !== id));
    } else if (largos.length < 2) {
      setLargos([...largos, id]);
    }
  };

  const handleNextStep = () => {
    if (cortos.length === 2) {
      setStep(2);
    }
  };

  const handleStartMatch = () => {
    if (cortos.length === 2 && largos.length === 2) {
      createMatch.mutate({ data: { cortos, largos } }, {
        onSuccess: (match) => {
          setLocation(`/match/${match.id}`);
        },
        onError: () => {
          toast({ variant: "destructive", title: "Error", description: "No se pudo crear la partida." });
        }
      });
    }
  };

  const availableForLargos = players?.filter(p => !cortos.includes(p.id)) || [];

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        {step === 2 && (
          <Button variant="ghost" size="icon" onClick={() => setStep(1)} className="rounded-full">
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

      <div className="flex items-center gap-2 mb-8">
        <div className={`h-2 flex-1 rounded-full transition-colors ${step >= 1 ? 'bg-red-500' : 'bg-muted'}`} />
        <div className={`h-2 flex-1 rounded-full transition-colors ${step >= 2 ? 'bg-blue-500' : 'bg-muted'}`} />
      </div>

      {step === 1 && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {players?.map((player) => (
              <Card 
                key={player.id} 
                className={`cursor-pointer transition-all ${cortos.includes(player.id) ? 'ring-2 ring-red-500 bg-red-500/10' : 'hover:bg-white/5 glass-card'}`}
                onClick={() => toggleCorto(player.id)}
              >
                <CardContent className="p-4 flex flex-col items-center text-center gap-3">
                  <Avatar className={`h-16 w-16 transition-all ${cortos.includes(player.id) ? 'ring-2 ring-red-500 ring-offset-2 ring-offset-background' : ''}`}>
                    <AvatarImage src={player.avatarUrl || undefined} />
                    <AvatarFallback>{player.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="font-semibold text-sm">{player.name}</span>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="flex justify-end">
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

      {step === 2 && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {availableForLargos.map((player) => (
              <Card 
                key={player.id} 
                className={`cursor-pointer transition-all ${largos.includes(player.id) ? 'ring-2 ring-blue-500 bg-blue-500/10' : 'hover:bg-white/5 glass-card'}`}
                onClick={() => toggleLargo(player.id)}
              >
                <CardContent className="p-4 flex flex-col items-center text-center gap-3">
                  <Avatar className={`h-16 w-16 transition-all ${largos.includes(player.id) ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-background' : ''}`}>
                    <AvatarImage src={player.avatarUrl || undefined} />
                    <AvatarFallback>{player.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="font-semibold text-sm">{player.name}</span>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="flex justify-end">
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
