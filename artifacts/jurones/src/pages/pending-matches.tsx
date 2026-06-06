import React, { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { WifiOff, RefreshCw, Trash2, ArrowRight, CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { loadActiveSession, clearActiveSession, type MatchSession, type PendingOp } from "@/hooks/useOfflineMatch";

function opLabel(op: PendingOp): string {
  return op.label ?? op.endpoint.split("/").pop() ?? "operación";
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es-DO", {
      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function PendingMatches() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [session, setSession] = useState<MatchSession | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    setSession(loadActiveSession());
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  const handleSync = useCallback(async () => {
    if (!session || !isOnline) return;
    setSyncing(true);
    try {
      for (const op of session.pendingOps) {
        const res = await fetch(op.endpoint, {
          method: op.method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(op.body),
        });
        if (!res.ok) {
          toast({ variant: "destructive", title: "Error de sincronización", description: `Falló: ${opLabel(op)}` });
          return;
        }
      }
      clearActiveSession();
      setSession(null);
      setSynced(true);
      toast({ title: "Sincronización completa", description: "Todas las operaciones fueron enviadas al servidor." });
    } catch {
      toast({ variant: "destructive", title: "Sin conexión", description: "No se pudo conectar al servidor." });
    } finally {
      setSyncing(false);
    }
  }, [session, isOnline, toast]);

  const handleDiscard = useCallback(() => {
    clearActiveSession();
    setSession(null);
    toast({ title: "Partida descartada", description: "Los datos locales fueron eliminados." });
  }, [toast]);

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="space-y-1">
        <h1 className="text-3xl font-black tracking-tight uppercase">Partidas Pendientes</h1>
        <p className="text-muted-foreground text-sm uppercase tracking-widest font-medium">
          Operaciones guardadas localmente sin sincronizar
        </p>
      </div>

      {!isOnline && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          <WifiOff className="h-4 w-4 shrink-0" />
          Sin conexión. Conéctate a Internet para sincronizar.
        </div>
      )}

      {synced && !session && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4 py-16 text-center"
        >
          <CheckCircle2 className="h-16 w-16 text-green-400" />
          <p className="text-xl font-bold text-green-400">¡Todo sincronizado!</p>
          <Button variant="outline" onClick={() => setLocation("/dashboard")}>
            Volver al inicio
          </Button>
        </motion.div>
      )}

      {!session && !synced && (
        <div className="flex flex-col items-center gap-4 py-16 text-center text-muted-foreground">
          <CheckCircle2 className="h-16 w-16 text-green-500/40" />
          <p className="text-lg font-semibold">No hay partidas pendientes</p>
          <p className="text-sm">Todas las partidas están sincronizadas con el servidor.</p>
          <Button variant="outline" onClick={() => setLocation("/dashboard")}>
            Volver al inicio
          </Button>
        </div>
      )}

      {session && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-2xl p-6 space-y-5"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-400" />
                <span className="font-bold text-white">
                  Partida #{session.matchNumber ?? session.matchId}
                </span>
                <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs">
                  {session.pendingOps.length} op{session.pendingOps.length !== 1 ? "s" : ""} pendiente{session.pendingOps.length !== 1 ? "s" : ""}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Guardado: {formatDate(session.updatedAt)}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation(`/match/${session.matchId}`)}
              className="gap-1.5 shrink-0"
            >
              Ver partida <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Operaciones pendientes</p>
            <div className="space-y-1.5">
              {session.pendingOps.map((op, i) => (
                <div key={op.id} className="flex items-center gap-2.5 text-sm px-3 py-2 rounded-lg bg-muted/30">
                  <span className="text-muted-foreground tabular-nums text-xs w-5 shrink-0">{i + 1}.</span>
                  <span className="flex-1 text-gray-300">{opLabel(op)}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(op.createdAt)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleSync}
              disabled={syncing || !isOnline}
              className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold gap-2"
            >
              {syncing ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Sincronizando…</>
              ) : (
                <><RefreshCw className="h-4 w-4" /> Sincronizar ahora</>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleDiscard}
              disabled={syncing}
              className="border-red-500/40 text-red-400 hover:bg-red-500/10 gap-2"
            >
              <Trash2 className="h-4 w-4" /> Descartar
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
