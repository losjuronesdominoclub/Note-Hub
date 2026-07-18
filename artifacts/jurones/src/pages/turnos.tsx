import React, { useState } from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { X, ListOrdered, Trash2, GripVertical, Check, Swords } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useGetBusyPlayers } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import ScrollToTop from "@/components/scroll-to-top";

export interface TurnoEntry {
  id: number;
  position: number;
  arrivedAt: string;
  player: { id: number; name: string; avatarUrl: string | null };
}

function avatarSrc(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http")) return path;
  const slug = path.startsWith("/objects/") ? path.slice("/objects/".length) : path;
  return `/api/storage/objects/${slug}`;
}

function formatTime(iso: string): string {
  try {
    return format(new Date(iso), "h:mm a", { locale: es });
  } catch {
    return "--:--";
  }
}

export const TURNOS_QUERY_KEY = ["turnos"];

async function fetchTurnos(): Promise<TurnoEntry[]> {
  const res = await fetch("/api/turnos");
  if (!res.ok) throw new Error("Error cargando turnos");
  return res.json();
}

async function removeTurno(playerId: number): Promise<void> {
  const res = await fetch(`/api/turnos/${playerId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Error eliminando turno");
}

async function clearTurnos(): Promise<void> {
  const res = await fetch("/api/turnos/clear", { method: "DELETE" });
  if (!res.ok) throw new Error("Error limpiando turnos");
}

async function reorderTurnos(order: number[]): Promise<void> {
  const res = await fetch("/api/turnos/reorder", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ order }),
  });
  if (!res.ok) throw new Error("Error reordenando turnos");
}

export default function Turnos() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editMode, setEditMode] = useState(false);
  const [localOrder, setLocalOrder] = useState<TurnoEntry[]>([]);

  const { data: rawTurnos = [], isLoading } = useQuery<TurnoEntry[]>({
    queryKey: TURNOS_QUERY_KEY,
    queryFn: fetchTurnos,
    refetchInterval: 10000,
  });

  const { data: busyData } = useGetBusyPlayers({ query: { refetchInterval: 5000 } });
  const busyPlayerIds = new Set(busyData?.busyPlayerIds ?? []);

  const turnos = rawTurnos.filter((t) => !busyPlayerIds.has(t.player.id));
  const playingCount = rawTurnos.length - turnos.length;

  const remove = useMutation({
    mutationFn: removeTurno,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TURNOS_QUERY_KEY }),
    onError: () => toast({ title: "Error", description: "No se pudo eliminar el jugador", variant: "destructive" }),
  });

  const clear = useMutation({
    mutationFn: clearTurnos,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TURNOS_QUERY_KEY });
      toast({ title: "Lista limpiada", description: "Todos los jugadores fueron eliminados de la lista." });
    },
    onError: () => toast({ title: "Error", description: "No se pudo limpiar la lista", variant: "destructive" }),
  });

  const reorder = useMutation({
    mutationFn: reorderTurnos,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TURNOS_QUERY_KEY }),
  });

  const enterEditMode = () => {
    setLocalOrder([...turnos]);
    setEditMode(true);
  };

  const saveEditMode = () => {
    const order = localOrder.map((t) => t.player.id);
    reorder.mutate(order);
    setEditMode(false);
  };

  const cancelEditMode = () => setEditMode(false);

  const displayList = editMode ? localOrder : turnos;

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-500">
      <ScrollToTop />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Turnos</h1>
          <p className="text-muted-foreground mt-1 uppercase tracking-[0.2em] text-xs">
            Lista de jugadores por orden de llegada
          </p>
          {playingCount > 0 && (
            <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full bg-orange-500/15 border border-orange-500/30 text-[10px] font-semibold text-orange-400 uppercase tracking-wider">
              <Swords className="h-3 w-3" />
              {playingCount} jugando — oculto{playingCount !== 1 ? "s" : ""} de la lista
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {editMode ? (
            <>
              <Button size="sm" variant="ghost" onClick={cancelEditMode} className="text-muted-foreground">
                Cancelar
              </Button>
              <Button size="sm" onClick={saveEditMode} className="gap-1.5">
                <Check className="h-4 w-4" /> Guardar
              </Button>
            </>
          ) : (
            <>
              <Button
                size="icon"
                variant="ghost"
                className="h-9 w-9 text-muted-foreground hover:text-primary"
                title="Editar orden"
                onClick={enterEditMode}
                disabled={turnos.length < 2}
              >
                <ListOrdered className="h-5 w-5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-9 w-9 text-muted-foreground hover:text-destructive"
                title="Limpiar lista"
                onClick={() => clear.mutate()}
                disabled={turnos.length === 0 || clear.isPending}
              >
                <Trash2 className="h-5 w-5" />
              </Button>
            </>
          )}
        </div>
      </div>

      <Card className="glass-card">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
              Cargando...
            </div>
          ) : displayList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
              <ListOrdered className="h-10 w-10 opacity-20" />
              <p className="text-sm">No hay jugadores en lista</p>
              <p className="text-xs opacity-60">Agrega jugadores desde el Dashboard</p>
            </div>
          ) : editMode ? (
            <Reorder.Group
              axis="y"
              values={localOrder}
              onReorder={setLocalOrder}
              className="divide-y divide-border"
            >
              {localOrder.map((entry, index) => (
                <Reorder.Item
                  key={entry.player.id}
                  value={entry}
                  className="flex items-center gap-4 px-5 py-4 cursor-grab active:cursor-grabbing bg-background/30 hover:bg-white/5 transition-colors select-none"
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-lg font-black text-muted-foreground w-7 text-center shrink-0">
                    {index + 1}
                  </span>
                  <Avatar className="h-10 w-10 border border-primary/20 shrink-0">
                    <AvatarImage src={avatarSrc(entry.player.avatarUrl)} className="object-cover" />
                    <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
                      {entry.player.name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-semibold flex-1">{entry.player.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{formatTime(entry.arrivedAt)}</span>
                </Reorder.Item>
              ))}
            </Reorder.Group>
          ) : (
            <AnimatePresence>
              {turnos.map((entry, index) => (
                <motion.div
                  key={entry.player.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20, height: 0, paddingTop: 0, paddingBottom: 0 }}
                  transition={{ delay: index * 0.04 }}
                  className={`flex items-center gap-4 px-5 py-4 ${index < turnos.length - 1 ? "border-b border-border" : ""}`}
                >
                  <span className="text-2xl font-black text-primary/70 w-8 text-center shrink-0">
                    {index + 1}
                  </span>
                  <Avatar className="h-10 w-10 border border-primary/20 shrink-0">
                    <AvatarImage src={avatarSrc(entry.player.avatarUrl)} className="object-cover" />
                    <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
                      {entry.player.name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{entry.player.name}</p>
                    <p className="text-xs text-muted-foreground">Llegó a las {formatTime(entry.arrivedAt)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => remove.mutate(entry.player.id)}
                    disabled={remove.isPending}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
