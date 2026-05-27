import React from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { useListMatches } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Radio } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LiveMatches() {
  const { data: matches, isLoading } = useListMatches({ status: "active" }, { query: { refetchInterval: 3000 } });

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-red-500/10 rounded-full text-red-500 animate-pulse">
          <Radio className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Partidas en Vivo</h1>
          <p className="text-muted-foreground">Monitoreo en tiempo real de los juegos activos.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-20 text-muted-foreground">Cargando partidas en vivo...</div>
      ) : matches && matches.length > 0 ? (
        <div className="grid gap-6">
          {matches.map((match, index) => (
            <motion.div
              key={match.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Link href={`/match/${match.id}`}>
                <Card className="glass-card overflow-hidden hover:bg-white/5 transition-colors cursor-pointer group">
                  <CardContent className="p-0">
                    <div className="grid grid-cols-3 divide-x divide-border">
                      <div className="p-6 flex flex-col items-center justify-center bg-red-500/5 group-hover:bg-red-500/10 transition-colors">
                        <span className="text-sm font-bold text-red-500 uppercase tracking-widest mb-2">Cortos</span>
                        <span className="text-5xl font-black tabular-nums">{match.shortosScore}</span>
                      </div>
                      
                      <div className="p-6 flex flex-col items-center justify-center relative">
                        <div className="absolute top-4 bg-primary/20 text-primary text-xs px-2 py-1 rounded font-bold uppercase flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" /> Live
                        </div>
                        <span className="text-sm text-muted-foreground mt-4">Partida #{match.matchNumber}</span>
                        <Button variant="ghost" className="mt-2 w-full max-w-[120px] rounded-full">Ver Detalles</Button>
                      </div>

                      <div className="p-6 flex flex-col items-center justify-center bg-blue-500/5 group-hover:bg-blue-500/10 transition-colors">
                        <span className="text-sm font-bold text-blue-500 uppercase tracking-widest mb-2">Largos</span>
                        <span className="text-5xl font-black tabular-nums">{match.largosScore}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 glass-card rounded-2xl">
          <Radio className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-20" />
          <h3 className="text-xl font-bold mb-2">No hay partidas activas</h3>
          <p className="text-muted-foreground">Cuando inicie un nuevo juego, aparecerá aquí automáticamente.</p>
        </div>
      )}
    </div>
  );
}
