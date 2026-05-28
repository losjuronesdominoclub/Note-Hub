import React from "react";
import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Fish, Medal } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

function avatarSrc(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http")) return path;
  const slug = path.startsWith("/objects/") ? path.slice("/objects/".length) : path;
  return `/api/storage/objects/${slug}`;
}

interface LisaEntry {
  player: {
    id: number;
    name: string;
    avatarUrl?: string | null;
    wins: number;
    losses: number;
    winRate: number;
  };
  lisas: number;
}

export default function Lisas() {
  const { data: ranking, isLoading } = useQuery<LisaEntry[]>({
    queryKey: ["lisas"],
    queryFn: async () => {
      const res = await fetch("/api/lisas");
      if (!res.ok) throw new Error("Error cargando lisas");
      return res.json();
    },
  });

  const getPositionColor = (index: number) => {
    switch (index) {
      case 0: return "text-yellow-500 bg-yellow-500/10 border-yellow-500/50";
      case 1: return "text-slate-300 bg-slate-300/10 border-slate-300/50";
      case 2: return "text-amber-600 bg-amber-600/10 border-amber-600/50";
      default: return "text-muted-foreground bg-muted border-border";
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="text-center space-y-4 mb-10">
        <div className="relative inline-flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-cyan-500/10 blur-2xl scale-150" />
          <Fish className="w-16 h-16 text-cyan-400 relative" />
        </div>
        <h1 className="text-4xl font-black tracking-tighter uppercase">Lisas</h1>
        <p className="text-muted-foreground">
          Jugadores con más victorias <span className="text-cyan-400 font-semibold">200 – 0</span>.
          Una Lisa es la victoria perfecta.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 glass-card rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : ranking && ranking.length > 0 ? (
        <div className="space-y-3">
          {ranking.map((item, index) => (
            <motion.div
              key={item.player.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.08 }}
              className={`flex items-center gap-4 p-4 rounded-2xl glass-card relative overflow-hidden ${
                index < 3 ? "border " + getPositionColor(index).split(" ")[2] : ""
              }`}
            >
              {index === 0 && (
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-transparent pointer-events-none" />
              )}

              {/* Position badge */}
              <div className={`w-12 h-12 flex items-center justify-center font-black text-xl rounded-full shrink-0 ${getPositionColor(index)}`}>
                {index < 3 ? <Medal className="w-6 h-6" /> : `#${index + 1}`}
              </div>

              {/* Avatar */}
              <Avatar className={`h-14 w-14 border-2 shrink-0 ${index === 0 ? "border-cyan-400" : "border-transparent"}`}>
                <AvatarImage src={avatarSrc(item.player.avatarUrl)} className="object-cover" />
                <AvatarFallback className="bg-cyan-500/20 text-cyan-400 font-bold">
                  {item.player.name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              {/* Name & stats */}
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-lg truncate">{item.player.name}</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {item.player.wins}V · {item.player.losses}D · WR {(Number(item.player.winRate) * 100).toFixed(2)}%
                </p>
              </div>

              {/* Lisa count */}
              <div className="text-right pl-4 border-l border-border shrink-0">
                <div className="flex items-center justify-end gap-2">
                  <Fish className="h-5 w-5 text-cyan-400" />
                  <span className="text-3xl font-black text-cyan-400">{item.lisas}</span>
                </div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                  {item.lisas === 1 ? "Lisa" : "Lisas"}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 text-muted-foreground glass-card rounded-2xl flex flex-col items-center gap-4">
          <Fish className="w-12 h-12 opacity-30" />
          <p>Aún no hay partidas 200–0 registradas.</p>
        </div>
      )}
    </div>
  );
}
