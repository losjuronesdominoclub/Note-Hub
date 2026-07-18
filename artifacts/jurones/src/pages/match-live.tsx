import React, { useEffect, useState, useRef, useCallback } from "react";
import { useUser } from "@clerk/react";
import { useRoute, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { useGetMatch, useCreateMatch, useListPlayers, useSwapMatchTeams, getGetMatchQueryKey } from "@workspace/api-client-react";
import { useOfflineMatch } from "@/hooks/useOfflineMatch";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, ChevronUp, Activity, Undo2, Trash2, KeyRound, Clock, RefreshCw, Users, ArrowLeftRight, Gavel } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";

function avatarSrc(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http")) return path;
  const slug = path.startsWith("/objects/") ? path.slice("/objects/".length) : path;
  return `/api/storage/objects/${slug}`;
}

export default function MatchLive() {
  const [, params] = useRoute("/match/:id");
  const [, setLocation] = useLocation();
  const matchId = parseInt(params?.id || "0");
  const { toast } = useToast();
  
  const { data: match, isLoading } = useGetMatch(matchId, {
    query: { refetchInterval: 3000 }
  });
  const { user } = useUser();
  const createMatch = useCreateMatch();

  const [pointsInput, setPointsInput] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelCode, setCancelCode] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [elapsed, setElapsed] = useState("00:00:00");
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [pendingScore, setPendingScore] = useState<{ playerId: number; team: "cortos" | "largos"; points: number; isQuickThirty: boolean; note?: string } | null>(null);

  // Special event confirmation state
  const [pendingSpecialEvent, setPendingSpecialEvent] = useState<{
    player: { id: number; name: string };
    team: "cortos" | "largos";
    eventType: "chivo" | "paso";
  } | null>(null);

  // Multas state
  const [showMultasDialog, setShowMultasDialog] = useState(false);
  const [multasTeam, setMultasTeam] = useState<"cortos" | "largos" | null>(null);
  const [multasPlayerId, setMultasPlayerId] = useState<string>("");
  const [multasTipo, setMultasTipo] = useState<"levantar" | "hablar" | "adelantado" | "">("");

  // Swap teams state
  const [showSwapDialog, setShowSwapDialog] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const swapTeams = useSwapMatchTeams();

  // Substitute state
  const [showSubDialog, setShowSubDialog] = useState(false);
  const [subOutPlayerId, setSubOutPlayerId] = useState<string>("");
  const [subInPlayerId, setSubInPlayerId] = useState<string>("");
  const [subSearch, setSubSearch] = useState("");
  const [showSubConfirm, setShowSubConfirm] = useState(false);
  const [substituting, setSubstituting] = useState(false);

  const { data: allPlayers } = useListPlayers();

  const { isOnline, syncStatus, isSyncing, pendingOpsCount, enqueueOp, saveSnapshot, syncQueue } = useOfflineMatch(
    matchId,
    { onSyncComplete: () => queryClient.invalidateQueries({ queryKey: getGetMatchQueryKey(matchId) }) }
  );

  // Save snapshot for crash recovery
  useEffect(() => {
    if (match) saveSnapshot(match);
  }, [match]);

  // Toast when going offline
  const wasOnlineRef = useRef(true);
  useEffect(() => {
    if (!isOnline && wasOnlineRef.current) {
      toast({ title: "Sin conexión", description: "La partida seguirá guardándose localmente y se sincronizará cuando vuelva Internet." });
    }
    if (isOnline && !wasOnlineRef.current && pendingOpsCount === 0) {
      toast({ title: "Conexión restaurada", description: "Todos los datos están sincronizados." });
    }
    wasOnlineRef.current = isOnline;
  }, [isOnline]);

  useEffect(() => {
    if (match?.status === "finished") {
      triggerConfetti();
    }
  }, [match?.status]);

  // Auto-add losing pair to the end of turnos when match finishes
  const autoAddedToTurnosRef = useRef(false);
  useEffect(() => {
    if (match?.status !== "finished" || !match?.winnerTeam || autoAddedToTurnosRef.current) return;
    autoAddedToTurnosRef.current = true;
    const losingTeam = match.winnerTeam === "cortos" ? "largos" : "cortos";
    const losingPlayerIds = match.players
      .filter((p) => p.team === losingTeam)
      .map((p) => p.playerId);
    Promise.all(
      losingPlayerIds.map((playerId) =>
        fetch("/api/turnos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerId }),
        })
      )
    ).then(() => {
      queryClient.invalidateQueries({ queryKey: ["turnos"] });
    });
  }, [match?.status, match?.winnerTeam, match?.players]);

  // Elapsed time clock
  useEffect(() => {
    if (!match?.createdAt) return;
    const start = new Date(match.createdAt).getTime();
    const tick = () => {
      const secs = Math.max(0, Math.floor((Date.now() - start) / 1000));
      const h = Math.floor(secs / 3600);
      const m = Math.floor((secs % 3600) / 60);
      const s = secs % 60;
      setElapsed(
        h > 0
          ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
          : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [match?.createdAt]);

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

  const executeScore = async (playerId: number, team: "cortos" | "largos", actualPoints: number, isQuickThirty: boolean, note?: string) => {
    setSubmitting(true);
    setShowFinishConfirm(false);
    setPendingScore(null);

    const willFinish = ((team === "cortos" ? match!.shortosScore : match!.largosScore) + actualPoints) >= 200;

    if (!isOnline) {
      enqueueOp({ endpoint: `/api/matches/${matchId}/score`, method: "POST", body: { playerId, team, points: actualPoints, isQuickThirty, ...(note ? { note } : {}) }, label: `+${actualPoints} pts (${team})` });
      if (willFinish) enqueueOp({ endpoint: `/api/matches/${matchId}/finish`, method: "POST", body: {}, label: "Finalizar partida" });
      queryClient.setQueryData(getGetMatchQueryKey(matchId), (old: any) => {
        if (!old) return old;
        const newShort = team === "cortos" ? old.shortosScore + actualPoints : old.shortosScore;
        const newLargo = team === "largos" ? old.largosScore + actualPoints : old.largosScore;
        const playerName = old.players?.find((p: any) => p.playerId === playerId)?.player?.name ?? "";
        return {
          ...old,
          shortosScore: newShort,
          largosScore: newLargo,
          status: willFinish ? "finished" : "active",
          winnerTeam: willFinish ? team : old.winnerTeam,
          players: old.players?.map((p: any) =>
            p.playerId === playerId ? { ...p, playerPoints: (p.playerPoints ?? 0) + actualPoints } : p
          ) ?? [],
          scoreLog: [
            { id: -Date.now(), playerId, team, points: actualPoints, createdAt: new Date().toISOString(), playerName: note ?? playerName, note: note ?? null },
            ...(old.scoreLog ?? []),
          ],
        };
      });
      setPointsInput(prev => ({ ...prev, [playerId]: "" }));
      setSubmitting(false);
      return;
    }

    try {
      await fetch(`/api/matches/${matchId}/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, team, points: actualPoints, isQuickThirty, ...(note ? { note } : {}) })
      });
      setPointsInput(prev => ({ ...prev, [playerId]: "" }));
      queryClient.invalidateQueries({ queryKey: getGetMatchQueryKey(matchId) });

      const newScore = (team === "cortos" ? match!.shortosScore : match!.largosScore) + actualPoints;
      if (newScore >= 200) {
        await fetch(`/api/matches/${matchId}/finish`, { method: "POST" });
        queryClient.invalidateQueries({ queryKey: getGetMatchQueryKey(matchId) });
      }
    } catch {
      toast({ title: "Error", description: "No se pudo añadir el puntaje.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddScore = async (playerId: number, team: "cortos" | "largos", points: number, isQuickThirty = false, note?: string) => {
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

    const currentScore = team === "cortos" ? match!.shortosScore : match!.largosScore;
    const newScore = currentScore + actualPoints;

    if (newScore >= 200) {
      setPendingScore({ playerId, team, points: actualPoints, isQuickThirty, note });
      setShowFinishConfirm(true);
      return;
    }

    await executeScore(playerId, team, actualPoints, isQuickThirty, note);
  };

  // Special events: 🐐 Chivo and ⚠️ Pasó con ficha — add 60 pts to the opponent team
  const handleSpecialEvent = async (
    triggeringPlayer: { id: number; name: string },
    triggeringTeam: "cortos" | "largos",
    eventType: "chivo" | "paso"
  ) => {
    if (match?.status === "finished" || submitting) return;
    const opponentTeam = triggeringTeam === "cortos" ? "largos" : "cortos";
    const opponentPlayers = opponentTeam === "cortos" ? cortosPlayers : largosPlayers;
    const opponentFirstPlayer = opponentPlayers[0];
    if (!opponentFirstPlayer) return;
    const note = eventType === "chivo"
      ? `${triggeringPlayer.name} 🐐 (Chivo)`
      : `${triggeringPlayer.name} - Pasó con ficha`;
    await handleAddScore(opponentFirstPlayer.player.id, opponentTeam, 60, false, note);
  };


  const handleMulta = async () => {
    if (!multasTeam || !multasPlayerId || !multasTipo || !match) return;
    const opponentTeam = multasTeam === "cortos" ? "largos" : "cortos";
    const opponentPlayers = opponentTeam === "cortos" ? cortosPlayers : largosPlayers;
    const opponentFirst = opponentPlayers[0];
    if (!opponentFirst) return;
    const teamPlayers = multasTeam === "cortos" ? cortosPlayers : largosPlayers;
    const faultPlayer = teamPlayers.find(p => p.player.id === parseInt(multasPlayerId));
    if (!faultPlayer) return;
    const descs: Record<string, string> = {
      levantar: "Levantó ficha equivocada",
      hablar: "Habló durante la jugada",
      adelantado: "Jugó adelantado",
    };
    const pts = multasTipo === "adelantado" ? 60 : 30;
    const note = `🚨 ${faultPlayer.player.name} - ${descs[multasTipo]}`;
    setShowMultasDialog(false);
    setMultasPlayerId("");
    setMultasTipo("");
    await handleAddScore(opponentFirst.player.id, opponentTeam, pts, false, note);
  };

  const handleCancelMatch = async () => {
    if (!cancelCode) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/matches/${matchId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminCode: cancelCode }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast({ variant: "destructive", title: "Error", description: err.error || "No se pudo cancelar la partida." });
        return;
      }
      setLocation("/");
    } catch {
      toast({ variant: "destructive", title: "Error", description: "No se pudo cancelar la partida." });
    } finally {
      setCancelling(false);
    }
  };

  const openSubDialog = () => {
    setSubOutPlayerId("");
    setSubInPlayerId("");
    setSubSearch("");
    setShowSubConfirm(false);
    setShowSubDialog(true);
  };

  const handleSwapTeams = async () => {
    if (!isOnline) {
      toast({ variant: "destructive", title: "Sin conexión", description: "El cambio de equipos requiere conexión a Internet." });
      return;
    }
    setSwapping(true);
    try {
      await swapTeams.mutateAsync({ id: matchId });
      queryClient.invalidateQueries({ queryKey: getGetMatchQueryKey(matchId) });
      setShowSwapDialog(false);
      toast({ title: "Equipos invertidos", description: "Los jugadores han sido movidos al equipo contrario." });
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? err?.message ?? "No se pudo invertir los equipos.";
      toast({ variant: "destructive", title: "Error", description: msg });
    } finally {
      setSwapping(false);
    }
  };

  const handleSubstitute = async () => {
    if (!subOutPlayerId || !subInPlayerId) return;
    if (!isOnline) {
      toast({ variant: "destructive", title: "Sin conexión", description: "El cambio de jugador requiere conexión a Internet." });
      return;
    }
    setSubstituting(true);
    try {
      const res = await fetch(`/api/matches/${matchId}/substitute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outPlayerId: parseInt(subOutPlayerId), inPlayerId: parseInt(subInPlayerId) }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast({ variant: "destructive", title: "Error", description: err.error || "No se pudo realizar la sustitución." });
        return;
      }
      queryClient.invalidateQueries({ queryKey: getGetMatchQueryKey(matchId) });
      setShowSubDialog(false);
      setShowSubConfirm(false);
      const outName = match?.players.find(p => p.playerId === parseInt(subOutPlayerId))?.player?.name ?? "";
      const inName = allPlayers?.find(p => p.id === parseInt(subInPlayerId))?.name ?? "";
      toast({ title: "Sustitución realizada", description: `${outName} → ${inName}` });
    } catch {
      toast({ variant: "destructive", title: "Error", description: "No se pudo realizar la sustitución." });
    } finally {
      setSubstituting(false);
    }
  };

  const handleUndoScore = async () => {
    try {
      const res = await fetch(`/api/matches/${matchId}/undo-score`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: "Error", description: err.error || "No se pudo deshacer.", variant: "destructive" });
        return;
      }
      queryClient.invalidateQueries({ queryKey: getGetMatchQueryKey(matchId) });
      toast({ title: "Anotación deshecha", description: "El último punto fue eliminado." });
    } catch {
      toast({ title: "Error", description: "No se pudo deshacer.", variant: "destructive" });
    }
  };

  if (isLoading) return <div className="text-center py-20">Cargando partida...</div>;
  if (!match) return <div className="text-center py-20">Partida no encontrada.</div>;

  const cortosPlayers = match.players.filter(p => p.team === "cortos");
  const largosPlayers = match.players.filter(p => p.team === "largos");

  const isFinished = match.status === "finished";

  const handleRepeat = () => {
    const cortosIds = cortosPlayers.map(({ player }) => player.id);
    const largosIds = largosPlayers.map(({ player }) => player.id);
    const anotador = user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? user?.username ?? undefined;
    createMatch.mutate(
      { data: { cortos: cortosIds, largos: largosIds, createdBy: anotador } },
      {
        onSuccess: (newMatch) => setLocation(`/match/${newMatch.id}`),
        onError: () => toast({ variant: "destructive", title: "Error", description: "No se pudo crear la partida." }),
      }
    );
  };
  const isLisa = isFinished && (match.shortosScore === 0 || match.largosScore === 0);

  return (
    <div className="max-w-5xl mx-auto space-y-3">
      <style>{`
        .cortos-input-wrap {
          padding: 2px;
          border-radius: 10px;
          background: #CD2221;
        }
        .largos-input-wrap {
          padding: 2px;
          border-radius: 10px;
          background: #307EFF;
        }
        .match-score-input {
          position: relative;
          z-index: 1;
          width: 100%;
          height: 36px;
          text-align: center;
          background: #111;
          border: none;
          border-radius: 8px;
          color: #f3f4f6;
          font-size: 17px;
          font-weight: 700;
          outline: none;
        }
        .match-score-input::placeholder { color: #4b5563; }
        .match-score-input::-webkit-inner-spin-button,
        .match-score-input::-webkit-outer-spin-button { -webkit-appearance: none; }
      `}</style>

      {/* Finish confirmation dialog */}
      <Dialog open={showFinishConfirm} onOpenChange={(o) => { if (!o) { setShowFinishConfirm(false); setPendingScore(null); } }}>
        <DialogContent className="bg-[#141414] border-[#2a2a2a]">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-400" /> Confirmar finalización de partida
            </DialogTitle>
            <DialogDescription className="text-gray-300 text-sm leading-relaxed">
              {pendingScore && (() => {
                const teamName = pendingScore.team === "cortos" ? "Cortos" : "Largos";
                const currentScore = pendingScore.team === "cortos" ? match?.shortosScore ?? 0 : match?.largosScore ?? 0;
                const newScore = currentScore + pendingScore.points;
                return `Con esta anotación el equipo ${teamName} alcanzará ${newScore} puntos y la partida finalizará. ¿Está seguro de continuar?`;
              })()}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 mt-2">
            <Button
              variant="outline"
              onClick={() => { setShowFinishConfirm(false); setPendingScore(null); }}
              disabled={submitting}
              className="border-[#2a2a2a] text-gray-300 hover:bg-[#2a2a2a]"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => pendingScore && executeScore(pendingScore.playerId, pendingScore.team, pendingScore.points, pendingScore.isQuickThirty, pendingScore.note)}
              disabled={submitting}
              className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold gap-2"
            >
              <Trophy className="h-4 w-4" />
              {submitting ? "Registrando…" : "Sí, finalizar partida"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Swap teams confirmation dialog */}
      <Dialog open={showSwapDialog} onOpenChange={setShowSwapDialog}>
        <DialogContent className="bg-[#141414] border-[#2a2a2a] max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-orange-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 16V4m0 0L3 8m4-4 4 4"/><path d="M17 8v12m0 0 4-4m-4 4-4-4"/>
              </svg>
              Invertir Equipos
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Los jugadores serán intercambiados al equipo contrario. Esta acción solo puede hacerse <span className="text-orange-400 font-semibold">una vez</span> por partida.
            </DialogDescription>
          </DialogHeader>

          {/* Preview of the swap */}
          {match && (
            <div className="py-2 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex-1 rounded-xl border border-red-500/30 bg-red-500/10 p-3">
                  <div className="text-[10px] uppercase font-bold text-red-400 mb-1">Cortos → Largos</div>
                  {(match.players ?? []).filter((p: any) => p.team === "cortos").map((p: any) => (
                    <div key={p.playerId} className="text-sm text-white font-medium">{p.player?.name}</div>
                  ))}
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-orange-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 16V4m0 0L3 8m4-4 4 4"/><path d="M17 8v12m0 0 4-4m-4 4-4-4"/>
                </svg>
                <div className="flex-1 rounded-xl border border-blue-500/30 bg-blue-500/10 p-3">
                  <div className="text-[10px] uppercase font-bold text-blue-400 mb-1">Largos → Cortos</div>
                  {(match.players ?? []).filter((p: any) => p.team === "largos").map((p: any) => (
                    <div key={p.playerId} className="text-sm text-white font-medium">{p.player?.name}</div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowSwapDialog(false)} disabled={swapping}
              className="border-[#2a2a2a] text-gray-300 hover:bg-[#2a2a2a]">
              Cancelar
            </Button>
            <Button onClick={handleSwapTeams} disabled={swapping}
              className="bg-orange-600 hover:bg-orange-700 text-white gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 16V4m0 0L3 8m4-4 4 4"/><path d="M17 8v12m0 0 4-4m-4 4-4-4"/>
              </svg>
              {swapping ? "Invirtiendo…" : "Sí, invertir equipos"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Substitute player dialog */}
      {(() => {
        const activePlayerIds = new Set((match?.players ?? []).map(p => p.playerId));
        const availablePlayers = (allPlayers ?? []).filter(p => !activePlayerIds.has(p.id));
        const subOutPlayer = match?.players.find(p => p.playerId === parseInt(subOutPlayerId || "0"));
        const subInPlayer = availablePlayers.find(p => p.id === parseInt(subInPlayerId || "0"));
        return (
          <Dialog open={showSubDialog} onOpenChange={(o) => { if (!o) { setShowSubDialog(false); setShowSubConfirm(false); } }}>
            <DialogContent className="bg-[#141414] border-[#2a2a2a] max-w-md">
              <DialogHeader>
                <DialogTitle className="text-white flex items-center gap-2">
                  <ArrowLeftRight className="h-5 w-5 text-green-400" /> Cambiar Jugador
                </DialogTitle>
                <DialogDescription className="text-gray-400">
                  Selecciona el jugador que sale y el jugador que entra.
                </DialogDescription>
              </DialogHeader>

              {!showSubConfirm ? (
                <div className="space-y-5 py-2">
                  {/* Select outgoing player */}
                  <div className="space-y-2">
                    <Label className="text-gray-300 text-sm font-medium">Jugador que sale</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {(match?.players ?? []).map(({ playerId, player, team }) => (
                        <button
                          key={playerId}
                          onClick={() => { setSubOutPlayerId(String(playerId)); setSubInPlayerId(""); }}
                          className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-all ${
                            subOutPlayerId === String(playerId)
                              ? team === "cortos"
                                ? "border-red-500 bg-red-500/15"
                                : "border-blue-500 bg-blue-500/15"
                              : "border-[#2a2a2a] hover:border-[#3a3a3a] bg-[#1a1a1a]"
                          }`}
                        >
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarImage src={avatarSrc(player.avatarUrl)} className="object-cover" />
                            <AvatarFallback className={`text-xs ${team === "cortos" ? "bg-red-500/20 text-red-400" : "bg-blue-500/20 text-blue-400"}`}>
                              {player.name.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-white truncate">{player.name}</div>
                            <div className={`text-[10px] uppercase font-bold ${team === "cortos" ? "text-red-400" : "text-blue-400"}`}>{team}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Select incoming player with search */}
                  <div className="space-y-2">
                    <Label className="text-gray-300 text-sm font-medium">Jugador que entra</Label>
                    <div className={`rounded-xl border ${!subOutPlayerId ? "opacity-50 pointer-events-none" : ""} border-[#2a2a2a] bg-[#1a1a1a] overflow-hidden`}>
                      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#2a2a2a]">
                        <svg className="h-4 w-4 text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                        </svg>
                        <input
                          type="text"
                          placeholder={subOutPlayerId ? "Buscar jugador…" : "Primero elige quién sale"}
                          value={subSearch}
                          onChange={e => { setSubSearch(e.target.value); setSubInPlayerId(""); }}
                          className="flex-1 bg-transparent text-sm text-white placeholder:text-gray-500 outline-none"
                        />
                        {subSearch && (
                          <button onClick={() => { setSubSearch(""); setSubInPlayerId(""); }} className="text-gray-500 hover:text-gray-300">
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                      <ScrollArea className="h-36">
                        <div className="p-1">
                          {availablePlayers
                            .filter(p => p.name.toLowerCase().includes(subSearch.toLowerCase()))
                            .map(p => (
                              <button
                                key={p.id}
                                onClick={() => { setSubInPlayerId(String(p.id)); setSubSearch(p.name); }}
                                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                                  subInPlayerId === String(p.id)
                                    ? "bg-green-500/20 text-green-300"
                                    : "text-gray-200 hover:bg-[#2a2a2a]"
                                }`}
                              >
                                <Avatar className="h-6 w-6 shrink-0">
                                  <AvatarImage src={avatarSrc(p.avatarUrl)} className="object-cover" />
                                  <AvatarFallback className="text-[10px] bg-[#333]">{p.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                {p.name}
                              </button>
                            ))}
                          {availablePlayers.filter(p => p.name.toLowerCase().includes(subSearch.toLowerCase())).length === 0 && (
                            <div className="px-3 py-3 text-sm text-gray-500 text-center">
                              {availablePlayers.length === 0 ? "No hay jugadores disponibles" : "Sin resultados"}
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                  </div>

                  <DialogFooter className="gap-2 pt-2">
                    <Button variant="outline" onClick={() => setShowSubDialog(false)}
                      className="border-[#2a2a2a] text-gray-300 hover:bg-[#2a2a2a]">
                      Cancelar
                    </Button>
                    <Button
                      onClick={() => setShowSubConfirm(true)}
                      disabled={!subOutPlayerId || !subInPlayerId}
                      className="bg-green-600 hover:bg-green-500 text-white font-bold gap-2"
                    >
                      <ArrowLeftRight className="h-4 w-4" /> Continuar
                    </Button>
                  </DialogFooter>
                </div>
              ) : (
                <div className="space-y-4 py-2">
                  <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-4 text-sm text-gray-200 leading-relaxed">
                    ¿Está seguro de sustituir a{" "}
                    <span className="font-bold text-white">{subOutPlayer?.player?.name}</span>
                    {" "}por{" "}
                    <span className="font-bold text-white">{subInPlayer?.name}</span>
                    {"? "}
                    La partida continuará con el marcador actual.
                  </div>
                  <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => setShowSubConfirm(false)}
                      className="border-[#2a2a2a] text-gray-300 hover:bg-[#2a2a2a]">
                      Volver
                    </Button>
                    <Button
                      onClick={handleSubstitute}
                      disabled={substituting}
                      className="bg-green-600 hover:bg-green-500 text-white font-bold gap-2"
                    >
                      <ArrowLeftRight className="h-4 w-4" />
                      {substituting ? "Sustituyendo…" : "Confirmar"}
                    </Button>
                  </DialogFooter>
                </div>
              )}
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* Special event confirmation dialog (Chivo / Pasó con ficha) */}
      <Dialog open={!!pendingSpecialEvent} onOpenChange={(o) => { if (!o) setPendingSpecialEvent(null); }}>
        <DialogContent className="bg-[#141414] border-[#2a2a2a] max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2 text-lg">
              {pendingSpecialEvent?.eventType === "chivo" ? "🐐 Confirmar Chivo" : "⚠️ Confirmar Pasó con ficha"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground pt-1">
              {pendingSpecialEvent?.eventType === "chivo" ? (
                <>
                  <span className="font-semibold text-white">{pendingSpecialEvent?.player.name}</span> hizo chivo.{" "}
                  Se sumarán <span className="font-black text-yellow-400">+60 pts</span> al equipo contrario.
                </>
              ) : (
                <>
                  <span className="font-semibold text-white">{pendingSpecialEvent?.player.name}</span> pasó con ficha.{" "}
                  Se sumarán <span className="font-black text-yellow-400">+60 pts</span> al equipo contrario.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1 border-border text-muted-foreground hover:text-foreground"
              onClick={() => setPendingSpecialEvent(null)}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-black font-bold"
              disabled={submitting}
              onClick={async () => {
                if (!pendingSpecialEvent) return;
                const { player, team, eventType } = pendingSpecialEvent;
                setPendingSpecialEvent(null);
                await handleSpecialEvent(player, team, eventType);
              }}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Multas dialog */}
      <Dialog open={showMultasDialog} onOpenChange={(o) => { if (!o) { setShowMultasDialog(false); setMultasPlayerId(""); setMultasTipo(""); } }}>
        <DialogContent className="bg-[#141414] border-[#2a2a2a]">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Gavel className={`h-5 w-5 ${multasTeam === "cortos" ? "text-red-400" : "text-blue-400"}`} />
              Multa — Equipo {multasTeam === "cortos" ? "Cortos" : "Largos"}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Los puntos de la multa se suman al equipo contrario.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Player selector */}
            <div className="space-y-1.5">
              <Label className="text-gray-300 text-sm">Jugador que cometió la falta</Label>
              <div className="grid grid-cols-2 gap-2">
                {(multasTeam === "cortos" ? cortosPlayers : largosPlayers).map(({ player }) => (
                  <button
                    key={player.id}
                    onClick={() => setMultasPlayerId(String(player.id))}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border transition-all text-left ${
                      multasPlayerId === String(player.id)
                        ? multasTeam === "cortos"
                          ? "border-red-500 bg-red-500/15 text-white"
                          : "border-blue-500 bg-blue-500/15 text-white"
                        : "border-[#2a2a2a] bg-[#1a1a1a] text-gray-400 hover:border-gray-600"
                    }`}
                  >
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarImage src={avatarSrc(player.avatarUrl)} className="object-cover" />
                      <AvatarFallback className={`text-xs ${multasTeam === "cortos" ? "bg-red-500/20 text-red-400" : "bg-blue-500/20 text-blue-400"}`}>
                        {player.name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-semibold truncate">{player.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Fine type selector */}
            <div className="space-y-1.5">
              <Label className="text-gray-300 text-sm">Tipo de multa</Label>
              <div className="flex flex-col gap-2">
                {([
                  { key: "levantar", label: "Levantó ficha equivocada", pts: 30 },
                  { key: "hablar",   label: "Habló durante la jugada",   pts: 30 },
                  { key: "adelantado", label: "Jugó adelantado",         pts: 60 },
                ] as const).map(({ key, label, pts }) => (
                  <button
                    key={key}
                    onClick={() => setMultasTipo(key)}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all text-left ${
                      multasTipo === key
                        ? "border-amber-500 bg-amber-500/10 text-white"
                        : "border-[#2a2a2a] bg-[#1a1a1a] text-gray-400 hover:border-gray-600"
                    }`}
                  >
                    <span className="text-sm font-medium">{label}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${pts === 60 ? "bg-red-500/20 text-red-400" : "bg-orange-500/20 text-orange-400"}`}>
                      +{pts} pts
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowMultasDialog(false); setMultasPlayerId(""); setMultasTipo(""); }}
              className="border-[#2a2a2a] text-gray-300 hover:bg-[#2a2a2a]">
              Cancelar
            </Button>
            <Button
              onClick={handleMulta}
              disabled={!multasPlayerId || !multasTipo || submitting}
              className="bg-amber-600 hover:bg-amber-500 text-white font-bold gap-2"
            >
              <Gavel className="h-4 w-4" />
              Aplicar Multa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel match dialog */}
      <Dialog open={showCancelDialog} onOpenChange={(o) => { if (!o) { setShowCancelDialog(false); setCancelCode(""); } }}>
        <DialogContent className="bg-[#141414] border-[#2a2a2a]">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-500" /> ¿Cancelar la partida?
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              La partida será eliminada permanentemente junto con todos sus puntos. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label className="text-gray-300 flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5" /> Código de administrador
            </Label>
            <input
              type="password"
              placeholder="••••••"
              value={cancelCode}
              onChange={e => setCancelCode(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleCancelMatch()}
              className="w-full rounded-md border border-[#2a2a2a] bg-background px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowCancelDialog(false); setCancelCode(""); }} disabled={cancelling}
              className="border-[#2a2a2a] text-gray-300 hover:bg-[#2a2a2a]">
              Volver
            </Button>
            <Button onClick={handleCancelMatch} disabled={cancelling || !cancelCode}
              className="bg-red-600 hover:bg-red-700 text-white gap-2">
              <Trash2 className="h-4 w-4" />
              {cancelling ? "Cancelando…" : "Sí, cancelar partida"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Action buttons — only for active matches */}
      {!isFinished && (
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {/* Elapsed timer + sync status + anotador */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted/40 border border-border/50">
              <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="font-mono text-base font-bold tabular-nums tracking-widest">{elapsed}</span>
            </div>
            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              syncStatus === "synced" ? "border-green-500/30 text-green-400 bg-green-500/5" :
              syncStatus === "local" ? "border-yellow-500/30 text-yellow-400 bg-yellow-500/5" :
              "border-red-500/30 text-red-400 bg-red-500/5"
            }`}>
              <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                syncStatus === "synced" ? "bg-green-400" :
                syncStatus === "local" ? "bg-yellow-400 animate-pulse" :
                "bg-red-400"
              }`} />
              {syncStatus === "synced" ? "Sync" :
               syncStatus === "local" ? `Local (${pendingOpsCount})` :
               "Sin conexión"}
            </div>
            {user && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-muted-foreground">
                <span className="text-white/40">Anotador:</span>
                <span className="font-semibold text-white/70 truncate max-w-[120px]">
                  {user.fullName ?? user.primaryEmailAddress?.emailAddress ?? user.username ?? "—"}
                </span>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            {/* Swap teams — one-time use */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowSwapDialog(true)}
              disabled={match.teamsSwapped}
              className={`h-9 w-9 ${match.teamsSwapped ? "opacity-40 cursor-not-allowed border-border text-muted-foreground" : "border-orange-500/50 text-orange-400 hover:bg-orange-500/10"}`}
              title={match.teamsSwapped ? "Cambio de equipos ya utilizado" : "Invertir equipos"}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 16V4m0 0L3 8m4-4 4 4"/><path d="M17 8v12m0 0 4-4m-4 4-4-4"/>
              </svg>
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={openSubDialog}
              className="border-green-500/50 text-green-400 hover:bg-green-500/10 h-9 w-9"
              title="Cambiar jugador"
            >
              <ArrowLeftRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setCancelCode(""); setShowCancelDialog(true); }}
              className="border-red-500/50 text-red-400 hover:bg-red-500/10 h-9 w-9"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

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

            {/* Post-match action buttons */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="relative z-10 flex flex-col sm:flex-row gap-3 mt-8 justify-center"
            >
              <Button
                size="lg"
                onClick={handleRepeat}
                disabled={createMatch.isPending}
                className="rounded-full px-8 font-bold bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/40 gap-2"
              >
                <RefreshCw className="h-5 w-5" />
                {createMatch.isPending ? "Creando..." : "Repetir"}
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => setLocation("/match/new")}
                className="rounded-full px-8 font-bold gap-2"
              >
                <Users className="h-5 w-5" />
                Seleccionar jugadores
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid md:grid-cols-2 gap-3">
        {/* Cortos Team */}
        <div className="glass-card rounded-2xl p-4 border-t-4 border-t-red-600 bg-gradient-to-b from-red-500/10 to-transparent relative overflow-hidden">
          {!isFinished && (
            <button
              className="absolute top-2 left-2 z-10 h-7 w-7 flex items-center justify-center rounded-lg text-red-400 hover:bg-red-500/20 transition-colors border border-red-500/30"
              title="Multas"
              onClick={() => { setMultasTeam("cortos"); setMultasPlayerId(""); setMultasTipo(""); setShowMultasDialog(true); }}
            >
              <Gavel className="h-3.5 w-3.5" />
            </button>
          )}
          <div className="text-center mb-3">
            <h2 className="text-lg font-bold text-red-500 uppercase tracking-widest">Cortos</h2>
            <div className="text-5xl font-black tabular-nums tracking-tighter mt-1">{match.shortosScore}</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {cortosPlayers.map(({ player }) => (
              <Card key={player.id} className="bg-background/50 border-red-500/20">

                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Avatar className="h-8 w-8 border border-red-500/50 shrink-0">
                      <AvatarImage src={avatarSrc(player.avatarUrl)} className="object-cover" />
                      <AvatarFallback className="bg-red-500/20 text-red-500 text-xs">{player.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 font-semibold text-sm truncate">{player.name}</div>
                  </div>
                  {!isFinished && (
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-1">
                        <div className="cortos-input-wrap flex-1">
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            placeholder="Pts"
                            maxLength={3}
                            className="match-score-input"
                            value={pointsInput[player.id] || ""}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, "").slice(0, 3);
                              setPointsInput({ ...pointsInput, [player.id]: val });
                            }}
                          />
                        </div>
                        <button
                          className="flex-shrink-0 h-9 w-9 flex items-center justify-center rounded-lg text-lg leading-none transition-all active:scale-90 disabled:opacity-40"
                          style={{ background: "#1a1a1a", border: "1px solid #333" }}
                          disabled={submitting}
                          title="Chivo (+60 al equipo contrario)"
                          onClick={() => setPendingSpecialEvent({ player: { id: player.id, name: player.name }, team: "cortos", eventType: "chivo" })}
                        >
                          🐐
                        </button>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          className="flex-1 h-7 bg-red-600 hover:bg-red-700 text-white font-bold text-xs"
                          disabled={submitting || !pointsInput[player.id]}
                          onClick={() => handleAddScore(player.id, "cortos", parseInt(pointsInput[player.id] || "0"))}
                        >
                          + Sumar
                        </Button>
                        <Button
                          className="h-7 px-2 font-bold text-xs"
                          style={{ background: "#3B3321", border: "1px solid #66552B", color: "#DDBC5B" }}
                          disabled={submitting}
                          onClick={() => handleAddScore(player.id, "cortos", 30, true)}
                        >
                          +30
                        </Button>
                        <button
                          className="flex-shrink-0 h-7 w-7 flex items-center justify-center rounded-md text-sm leading-none transition-all active:scale-90 disabled:opacity-40"
                          style={{ background: "#2a1a0a", border: "1px solid #7c5a1e" }}
                          disabled={submitting}
                          title="Pasó con ficha (+60 al equipo contrario)"
                          onClick={() => setPendingSpecialEvent({ player: { id: player.id, name: player.name }, team: "cortos", eventType: "paso" })}
                        >
                          ⚠️
                        </button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
          {!isFinished && (
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em", color: "#22d3ee", marginTop: 8, textAlign: "center" }}>
              Faltan {Math.max(0, 200 - match.shortosScore)} pts
            </p>
          )}
        </div>

        {/* Largos Team */}
        <div className="glass-card rounded-2xl p-4 border-t-4 border-t-blue-600 bg-gradient-to-b from-blue-500/10 to-transparent relative overflow-hidden">
          {!isFinished && (
            <button
              className="absolute top-2 left-2 z-10 h-7 w-7 flex items-center justify-center rounded-lg text-blue-400 hover:bg-blue-500/20 transition-colors border border-blue-500/30"
              title="Multas"
              onClick={() => { setMultasTeam("largos"); setMultasPlayerId(""); setMultasTipo(""); setShowMultasDialog(true); }}
            >
              <Gavel className="h-3.5 w-3.5" />
            </button>
          )}
          <div className="text-center mb-3">
            <h2 className="text-lg font-bold text-blue-500 uppercase tracking-widest">Largos</h2>
            <div className="text-5xl font-black tabular-nums tracking-tighter mt-1">{match.largosScore}</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {largosPlayers.map(({ player }) => (
              <Card key={player.id} className="bg-background/50 border-blue-500/20">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Avatar className="h-8 w-8 border border-blue-500/50 shrink-0">
                      <AvatarImage src={avatarSrc(player.avatarUrl)} className="object-cover" />
                      <AvatarFallback className="bg-blue-500/20 text-blue-500 text-xs">{player.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 font-semibold text-sm truncate">{player.name}</div>
                  </div>
                  {!isFinished && (
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-1">
                        <div className="largos-input-wrap flex-1">
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            placeholder="Pts"
                            maxLength={3}
                            className="match-score-input"
                            value={pointsInput[player.id] || ""}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, "").slice(0, 3);
                              setPointsInput({ ...pointsInput, [player.id]: val });
                            }}
                          />
                        </div>
                        <button
                          className="flex-shrink-0 h-9 w-9 flex items-center justify-center rounded-lg text-lg leading-none transition-all active:scale-90 disabled:opacity-40"
                          style={{ background: "#1a1a1a", border: "1px solid #333" }}
                          disabled={submitting}
                          title="Chivo (+60 al equipo contrario)"
                          onClick={() => setPendingSpecialEvent({ player: { id: player.id, name: player.name }, team: "largos", eventType: "chivo" })}
                        >
                          🐐
                        </button>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          className="flex-1 h-7 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs"
                          disabled={submitting || !pointsInput[player.id]}
                          onClick={() => handleAddScore(player.id, "largos", parseInt(pointsInput[player.id] || "0"))}
                        >
                          + Sumar
                        </Button>
                        <Button
                          className="h-7 px-2 font-bold text-xs"
                          style={{ background: "#3B3321", border: "1px solid #66552B", color: "#DDBC5B" }}
                          disabled={submitting}
                          onClick={() => handleAddScore(player.id, "largos", 30, true)}
                        >
                          +30
                        </Button>
                        <button
                          className="flex-shrink-0 h-7 w-7 flex items-center justify-center rounded-md text-sm leading-none transition-all active:scale-90 disabled:opacity-40"
                          style={{ background: "#2a1a0a", border: "1px solid #7c5a1e" }}
                          disabled={submitting}
                          title="Pasó con ficha (+60 al equipo contrario)"
                          onClick={() => setPendingSpecialEvent({ player: { id: player.id, name: player.name }, team: "largos", eventType: "paso" })}
                        >
                          ⚠️
                        </button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
          {!isFinished && (
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em", color: "#22d3ee", marginTop: 8, textAlign: "center" }}>
              Faltan {Math.max(0, 200 - match.largosScore)} pts
            </p>
          )}
        </div>
      </div>

      <div className="glass-card rounded-2xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Activity className="h-5 w-5" /> Registro de puntos
          </h3>
          {!isFinished && match.scoreLog.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleUndoScore}
              className="border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10 gap-1.5 h-7 text-xs"
            >
              <Undo2 className="h-3.5 w-3.5" /> Deshacer última
            </Button>
          )}
        </div>
        <ScrollArea className="h-32 pr-4">
          <div className="space-y-1">
            {match.scoreLog.map((log, idx) => {
              const isLatest = idx === 0;
              return (
                <div
                  key={log.id}
                  className={`flex items-center justify-between text-sm py-2 border-b border-border/50 last:border-0 rounded-lg px-2 transition-colors ${isLatest && !isFinished ? 'bg-yellow-500/5 border-yellow-500/20' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${log.team === 'cortos' ? 'bg-red-500' : 'bg-blue-500'}`} />
                    <span className="font-medium">{(log as any).note ?? log.playerName}</span>
                    {isLatest && !isFinished && (
                      <span className="text-[10px] text-yellow-500 bg-yellow-500/10 px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide">último</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold">+{log.points}</span>
                    <span className="text-muted-foreground text-xs">{new Date(log.createdAt).toLocaleTimeString("es-DO", { timeZone: "America/Santo_Domingo", hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                  </div>
                </div>
              );
            })}
            {match.scoreLog.length === 0 && (
              <div className="text-center text-muted-foreground py-4">No hay puntos registrados aún.</div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
