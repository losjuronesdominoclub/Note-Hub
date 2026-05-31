import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { 
  Menu, X, Home, History, Trophy, Calendar, Users, Radio, Fish, Star, BarChart2, Tv2, Scale, LogOut, Skull
} from "lucide-react";
import { useClerk, Show } from "@clerk/react";
import { Button } from "@/components/ui/button";

export default function FloatingMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [location, setLocation] = useLocation();
  const { signOut } = useClerk();

  const menuItems = [
    { icon: Home, label: "Inicio", path: "/dashboard" },
    { icon: Radio, label: "Live", path: "/live" },
    { icon: History, label: "Records", path: "/history" },
    { icon: Trophy, label: "Ranking", path: "/ranking" },
    { icon: Star, label: "Puntos", path: "/ranking-points" },
    { icon: Fish, label: "Lisas", path: "/lisas" },
    { icon: Skull, label: "Lisas Recibidas", path: "/lisas-recibidas" },
    { icon: BarChart2, label: "Resultados", path: "/daily-results" },
    { icon: Calendar, label: "Eventos", path: "/events" },
    { icon: Tv2, label: "Stream", path: "/stream" },
    { icon: Users, label: "Jugadores", path: "/players" },
    { icon: Scale, label: "Compare", path: "/compare" },
  ];

  const handleNav = (path: string) => {
    setLocation(path);
    setIsOpen(false);
  };

  return (
    <div className="fixed bottom-6 left-6 z-50">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-16 left-0 mb-2 w-64 glass-card rounded-2xl overflow-hidden shadow-2xl flex flex-col p-2"
          >
            {menuItems.map((item, index) => {
              const isActive = location === item.path;
              return (
                <motion.button
                  key={item.path}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => handleNav(item.path)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    isActive 
                      ? "bg-primary/10 text-primary font-bold" 
                      : "text-foreground hover:bg-white/5"
                  }`}
                >
                  <item.icon className={`h-5 w-5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                  {item.label}
                </motion.button>
              );
            })}
            
            <Show when="signed-in">
              <div className="h-px bg-border my-2 mx-2" />
              <motion.button
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: menuItems.length * 0.05 }}
                onClick={() => signOut({ redirectUrl: "/" })}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-destructive hover:bg-destructive/10"
              >
                <LogOut className="h-5 w-5" />
                Cerrar Sesión
              </motion.button>
            </Show>
          </motion.div>
        )}
      </AnimatePresence>

      <Button
        size="icon"
        className="h-14 w-14 rounded-full shadow-2xl bg-primary hover:bg-primary/90 text-primary-foreground relative"
        onClick={() => setIsOpen(!isOpen)}
      >
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </motion.div>
      </Button>
    </div>
  );
}
