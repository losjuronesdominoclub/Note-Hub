import React from "react";
import { motion } from "framer-motion";
import { useGetRanking } from "@workspace/api-client-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy, Medal, Flame } from "lucide-react";

export default function Ranking() {
  const { data: ranking, isLoading } = useGetRanking();

  const getPositionColor = (position: number) => {
    switch (position) {
      case 1: return "text-yellow-500 bg-yellow-500/10 border-yellow-500/50";
      case 2: return "text-slate-300 bg-slate-300/10 border-slate-300/50";
      case 3: return "text-amber-600 bg-amber-600/10 border-amber-600/50";
      default: return "text-muted-foreground bg-muted border-border";
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="text-center space-y-4 mb-12">
        <Trophy className="w-16 h-16 mx-auto text-primary" />
        <h1 className="text-4xl font-black tracking-tighter uppercase">Global Ranking</h1>
        <p className="text-muted-foreground">Los mejores jugadores del club, clasificados por tasa de victoria.</p>
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
              transition={{ delay: index * 0.1 }}
              className={`flex items-center gap-4 p-4 rounded-2xl glass-card relative overflow-hidden ${index < 3 ? 'border ' + getPositionColor(index + 1).split(' ')[2] : ''}`}
            >
              {index === 0 && <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/10 to-transparent pointer-events-none" />}
              
              <div className={`w-12 h-12 flex items-center justify-center font-black text-xl rounded-full ${getPositionColor(index + 1)}`}>
                {index < 3 ? <Medal className="w-6 h-6" /> : `#${index + 1}`}
              </div>

              <Avatar className={`h-14 w-14 border-2 ${index === 0 ? 'border-yellow-500' : 'border-transparent'}`}>
                <AvatarImage src={item.player.avatarUrl || undefined} />
                <AvatarFallback className="bg-primary/20 text-primary font-bold">
                  {item.player.name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-lg truncate">{item.player.name}</h3>
                <div className="flex items-center gap-4 text-sm mt-1">
                  <span className="text-muted-foreground">{item.player.wins}V - {item.player.losses}D</span>
                  {item.player.currentStreak > 2 && (
                    <span className="flex items-center text-orange-500 font-medium text-xs bg-orange-500/10 px-2 py-0.5 rounded">
                      <Flame className="w-3 h-3 mr-1" /> Racha x{item.player.currentStreak}
                    </span>
                  )}
                </div>
              </div>

              <div className="text-right pl-4 border-l border-border">
                <div className="text-2xl font-black text-primary">{Number(item.player.winRate).toFixed(2)}%</div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Win Rate</div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 text-muted-foreground glass-card rounded-2xl">
          Aún no hay suficientes datos para generar el ranking.
        </div>
      )}
    </div>
  );
}
