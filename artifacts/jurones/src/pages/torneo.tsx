import React, { useState, useMemo, useRef, useEffect } from "react";
import ScrollToTop from "@/components/scroll-to-top";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Brackets,
  Plus,
  Trash2,
  Play,
  ArrowLeft,
  Trophy,
  Users,
  ChevronRight,
  RotateCcw,
  CheckCircle2,
  Clock,
  Crown,
  Medal,
  Swords,
  UserPlus,
  PencilLine,
  ArrowUp,
  ArrowDown,
  ArrowLeftRight,
  Save,
  AlertTriangle,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Player {
  id: number;
  name: string;
  avatarUrl: string | null;
  hidden?: boolean;
}

interface TournamentSummary {
  id: number;
  name: string;
  status: "setup" | "active" | "finished";
  createdAt: string;
  teamCount: number;
}

interface Team {
  id: number;
  tournamentId: number;
  name: string;
  player1: string;
  player2: string;
}

interface TournamentMatch {
  id: number;
  tournamentId: number;
  round: number;
  position: number;
  team1Id: number | null;
  team2Id: number | null;
  winnerId: number | null;
  team1Score: number | null;
  team2Score: number | null;
  status: "pending" | "finished" | "bye";
  isThirdPlace: boolean;
  team1: Team | null;
  team2: Team | null;
  winner: Team | null;
}

interface TournamentDetail {
  id: number;
  name: string;
  status: "setup" | "active" | "finished";
  createdAt: string;
  finishedAt: string | null;
  teams: Team[];
  matches: TournamentMatch[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function roundName(round: number, totalRounds: number): string {
  const diff = totalRounds - round;
  if (diff === 0) return "Final";
  if (diff === 1) return "Semifinal";
  if (diff === 2) return "Cuartos de Final";
  if (diff === 3) return "Octavos de Final";
  return `Ronda ${round}`;
}

function statusColor(status: TournamentSummary["status"]) {
  if (status === "setup") return "text-yellow-400 bg-yellow-500/10 border-yellow-500/30";
  if (status === "active") return "text-green-400 bg-green-500/10 border-green-500/30";
  return "text-purple-400 bg-purple-500/10 border-purple-500/30";
}

function statusLabel(status: TournamentSummary["status"]) {
  if (status === "setup") return "Configurando";
  if (status === "active") return "En curso";
  return "Finalizado";
}

function teamInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// ─── Team Avatar ──────────────────────────────────────────────────────────────
function TeamChip({ team, isWinner }: { team: Team | null; isWinner: boolean }) {
  if (!team) {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/3">
        <div className="h-5 w-5 rounded-full bg-white/10 shrink-0" />
        <span className="text-xs text-muted-foreground/40 italic">Por definir</span>
      </div>
    );
  }
  return (
    <div
      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors ${
        isWinner ? "bg-purple-500/15 border border-purple-500/30" : "bg-white/3"
      }`}
    >
      <Avatar className="h-5 w-5 shrink-0">
        <AvatarFallback
          className={`text-[9px] font-black ${isWinner ? "bg-purple-500/30 text-purple-300" : "bg-white/10 text-muted-foreground"}`}
        >
          {teamInitials(team.name)}
        </AvatarFallback>
      </Avatar>
      <span className={`text-xs font-semibold truncate ${isWinner ? "text-purple-300" : ""}`}>{team.name}</span>
    </div>
  );
}

// ─── Match Card ───────────────────────────────────────────────────────────────
function MatchCard({
  match,
  onResult,
}: {
  match: TournamentMatch;
  onResult: (match: TournamentMatch) => void;
}) {
  const isBye = match.status === "bye";
  const isFinished = match.status === "finished";
  const canResult = match.status === "pending" && match.team1Id && match.team2Id;
  const isThirdPlace = match.isThirdPlace;

  return (
    <div
      className={`rounded-xl border p-2.5 flex flex-col gap-1.5 min-w-[160px] w-full transition-all ${
        isThirdPlace
          ? "border-amber-500/20 bg-amber-500/5"
          : isFinished
          ? "border-purple-500/20 bg-purple-500/5"
          : isBye
          ? "border-white/8 bg-white/3 opacity-60"
          : canResult
          ? "border-white/15 bg-white/5 cursor-pointer hover:border-purple-500/40 hover:bg-purple-500/5"
          : "border-white/8 bg-white/3"
      }`}
    >
      {isThirdPlace && (
        <p className="text-[9px] font-black uppercase tracking-widest text-amber-500/70 mb-0.5">
          🥉 Tercer lugar
        </p>
      )}

      {/* Team 1 */}
      <div className="flex items-center justify-between gap-1">
        <TeamChip team={match.team1} isWinner={isFinished && match.winnerId === match.team1Id} />
        {isFinished && (
          <span
            className={`text-sm font-black tabular-nums shrink-0 ${
              match.winnerId === match.team1Id ? "text-purple-300" : "text-muted-foreground/50"
            }`}
          >
            {match.team1Score ?? 0}
          </span>
        )}
      </div>

      {/* Divider */}
      <div className="h-px bg-white/8 mx-1" />

      {/* Team 2 */}
      {isBye ? (
        <p className="text-[10px] text-muted-foreground/40 italic px-2">— Libre —</p>
      ) : (
        <div className="flex items-center justify-between gap-1">
          <TeamChip team={match.team2} isWinner={isFinished && match.winnerId === match.team2Id} />
          {isFinished && (
            <span
              className={`text-sm font-black tabular-nums shrink-0 ${
                match.winnerId === match.team2Id ? "text-purple-300" : "text-muted-foreground/50"
              }`}
            >
              {match.team2Score ?? 0}
            </span>
          )}
        </div>
      )}

      {/* Action */}
      {canResult && (
        <Button
          size="sm"
          variant="ghost"
          className="mt-0.5 h-7 text-[10px] font-bold uppercase tracking-wider text-purple-400 hover:bg-purple-500/10 hover:text-purple-300 gap-1"
          onClick={() => onResult(match)}
        >
          <Swords className="h-3 w-3" />
          Anotar
        </Button>
      )}

      {isFinished && (
        <div className="flex items-center gap-1 mt-0.5">
          <CheckCircle2 className="h-3 w-3 text-purple-400/50 shrink-0" />
          <span className="text-[9px] text-muted-foreground/40 uppercase tracking-wider">Finalizado</span>
        </div>
      )}
    </div>
  );
}

// ─── Bracket View ─────────────────────────────────────────────────────────────
function BracketView({ tournament, onResult }: { tournament: TournamentDetail; onResult: (m: TournamentMatch) => void }) {
  const mainMatches = tournament.matches.filter((m) => !m.isThirdPlace);
  const thirdPlaceMatch = tournament.matches.find((m) => m.isThirdPlace);

  const totalRounds = mainMatches.length > 0 ? Math.max(...mainMatches.map((m) => m.round)) : 0;

  const rounds = useMemo(() => {
    const map: Record<number, TournamentMatch[]> = {};
    for (const m of mainMatches) {
      if (!map[m.round]) map[m.round] = [];
      map[m.round].push(m);
    }
    for (const r of Object.keys(map)) {
      map[Number(r)].sort((a, b) => a.position - b.position);
    }
    return map;
  }, [mainMatches]);

  const roundNumbers = Object.keys(rounds)
    .map(Number)
    .sort((a, b) => a - b);

  if (roundNumbers.length === 0) return null;

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-3 min-w-max">
        {roundNumbers.map((round) => {
          const matches = rounds[round];
          const isFinalRound = round === totalRounds;
          return (
            <div key={round} className="flex flex-col gap-2 w-48">
              {/* Round header */}
              <div
                className={`text-center px-3 py-1.5 rounded-lg ${
                  isFinalRound
                    ? "bg-purple-500/15 border border-purple-500/30"
                    : "bg-white/5 border border-white/10"
                }`}
              >
                <p
                  className={`text-[10px] font-black uppercase tracking-widest ${
                    isFinalRound ? "text-purple-400" : "text-muted-foreground"
                  }`}
                >
                  {roundName(round, totalRounds)}
                </p>
              </div>

              {/* Matches */}
              <div
                className="flex flex-col gap-3"
                style={{
                  justifyContent: "space-around",
                  flex: 1,
                }}
              >
                {matches.map((m) => (
                  <MatchCard key={m.id} match={m} onResult={onResult} />
                ))}

                {/* 3rd place match inline with final */}
                {isFinalRound && thirdPlaceMatch && (
                  <MatchCard key={thirdPlaceMatch.id} match={thirdPlaceMatch} onResult={onResult} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Podium ───────────────────────────────────────────────────────────────────
function Podium({ tournament }: { tournament: TournamentDetail }) {
  const mainMatches = tournament.matches.filter((m) => !m.isThirdPlace);
  const thirdMatch = tournament.matches.find((m) => m.isThirdPlace);
  const totalRounds = mainMatches.length > 0 ? Math.max(...mainMatches.map((m) => m.round)) : 0;
  const finalMatch = mainMatches.find((m) => m.round === totalRounds && m.status === "finished");

  const champion = finalMatch?.winner ?? null;
  const runnerUp = finalMatch
    ? finalMatch.winnerId === finalMatch.team1Id
      ? finalMatch.team2
      : finalMatch.team1
    : null;
  const third = thirdMatch?.winner ?? null;

  const podiumItems = [
    { place: 1, team: champion, icon: "🥇", label: "Campeón", color: "border-yellow-500/40 bg-yellow-500/10 text-yellow-400" },
    { place: 2, team: runnerUp, icon: "🥈", label: "Subcampeón", color: "border-slate-400/40 bg-slate-400/10 text-slate-300" },
    { place: 3, team: third, icon: "🥉", label: "Tercer lugar", color: "border-amber-700/40 bg-amber-700/10 text-amber-600" },
  ];

  if (!finalMatch) return null;

  return (
    <div className="space-y-4 py-2">
      <div className="flex items-center gap-2">
        <Trophy className="h-5 w-5 text-yellow-400" />
        <h2 className="text-lg font-black uppercase tracking-wider">Podio Final</h2>
      </div>
      <div className="grid gap-3">
        {podiumItems.map(({ place, team, icon, label, color }) => (
          <motion.div
            key={place}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: (place - 1) * 0.1 }}
            className={`flex items-center gap-4 p-4 rounded-2xl border ${color}`}
          >
            <span className="text-3xl">{icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold uppercase tracking-widest opacity-60 mb-0.5">{label}</p>
              {team ? (
                <>
                  <p className="font-black text-lg leading-tight truncate">{team.name}</p>
                  <p className="text-xs opacity-60 mt-0.5 truncate">
                    {team.player1} · {team.player2}
                  </p>
                </>
              ) : (
                <p className="font-semibold text-sm opacity-40 italic">Sin definir</p>
              )}
            </div>
            {place === 1 && team && <Crown className="h-6 w-6 shrink-0 text-yellow-400" />}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── Player Picker ────────────────────────────────────────────────────────────
function PlayerPicker({
  label,
  selected,
  onSelect,
  players,
  excluded,
}: {
  label: string;
  selected: Player | null;
  onSelect: (p: Player | null) => void;
  players: Player[];
  excluded: number[];
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const filtered = players.filter(
    (p) =>
      !excluded.includes(p.id) &&
      p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-1" ref={ref}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {selected ? (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-500/10 border border-purple-500/30">
          <Avatar className="h-6 w-6 shrink-0">
            <AvatarFallback className="bg-purple-500/30 text-purple-300 text-[10px] font-black">
              {selected.name.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm font-semibold flex-1 truncate text-purple-200">{selected.name}</span>
          <button
            onClick={() => { onSelect(null); setSearch(""); }}
            className="text-purple-400/60 hover:text-purple-300 transition-colors text-xs ml-1 shrink-0"
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          onClick={() => { setOpen(true); setSearch(""); }}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-background border border-white/10 hover:border-purple-500/40 hover:bg-purple-500/5 transition-colors text-left"
        >
          <span className="text-sm text-muted-foreground/50 italic flex-1">Seleccionar jugador…</span>
        </button>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="z-50 mt-1 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-xl overflow-hidden"
          >
            {/* Search */}
            <div className="p-2 border-b border-white/8">
              <Input
                autoFocus
                placeholder="Buscar jugador…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-background h-8 text-sm border-white/10 focus:border-purple-500/50"
              />
            </div>

            {/* List */}
            <div className="max-h-48 overflow-y-auto overscroll-contain">
              {filtered.length === 0 ? (
                <p className="text-xs text-muted-foreground/40 italic text-center py-4">Sin resultados</p>
              ) : (
                filtered.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => { onSelect(p); setOpen(false); setSearch(""); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-purple-500/10 transition-colors text-left"
                  >
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarFallback className="bg-white/10 text-[10px] font-black">
                        {p.name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium truncate">{p.name}</span>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Tournament Setup ─────────────────────────────────────────────────────────
function TournamentSetup({
  tournament,
  onBack,
  onRefresh,
  onOpenBracketEditor,
}: {
  tournament: TournamentDetail;
  onBack: () => void;
  onRefresh: () => void;
  onOpenBracketEditor: () => void;
}) {
  const { toast } = useToast();

  const [showAddForm, setShowAddForm] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [player1, setPlayer1] = useState<Player | null>(null);
  const [player2, setPlayer2] = useState<Player | null>(null);
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);

  const { data: allPlayers = [] } = useQuery<Player[]>({
    queryKey: ["players"],
    queryFn: async () => {
      const res = await fetch("/api/players");
      if (!res.ok) throw new Error("Error");
      return res.json();
    },
  });

  const visiblePlayers = allPlayers.filter((p) => !p.hidden);

  const autoName = player1 && player2 ? `${player1.name} / ${player2.name}` : "";
  const resolvedName = teamName.trim() || autoName;

  const resetForm = () => {
    setTeamName("");
    setPlayer1(null);
    setPlayer2(null);
    setShowAddForm(false);
  };

  const addTeam = async () => {
    if (!player1 || !player2) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/torneo/${tournament.id}/equipos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: resolvedName,
          player1: player1.name,
          player2: player2.name,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        toast({ title: "Error", description: d.error, variant: "destructive" });
        return;
      }
      resetForm();
      onRefresh();
    } finally {
      setSaving(false);
    }
  };

  const removeTeam = async (teamId: number) => {
    await fetch(`/api/torneo/${tournament.id}/equipos/${teamId}`, { method: "DELETE" });
    onRefresh();
  };

  const deleteTeam = (teamId: number) => removeTeam(teamId);

  const startTournament = async (openEditorAfterStart = false) => {
    setStarting(true);
    try {
      const res = await fetch(`/api/torneo/${tournament.id}/iniciar`, { method: "POST" });
      if (!res.ok) {
        const d = await res.json();
        toast({ title: "Error", description: d.error, variant: "destructive" });
        return;
      }
      onRefresh();
      if (openEditorAfterStart) onOpenBracketEditor();
    } finally {
      setStarting(false);
    }
  };

  const canStart = tournament.teams.length >= 2;
  const isEven = tournament.teams.length % 2 === 0;

  // Players already in some team
  const usedPlayerNames = new Set(tournament.teams.flatMap((t) => [t.player1, t.player2]));
  const availablePlayers = visiblePlayers.filter((p) => !usedPlayerNames.has(p.name));

  const excludedIds = [player1?.id, player2?.id].filter(Boolean) as number[];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Configuración</p>
          <h1 className="text-xl font-black tracking-tight truncate">{tournament.name}</h1>
        </div>
        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full border ${statusColor(tournament.status)}`}>
          {statusLabel(tournament.status)}
        </span>
      </div>

      {/* Teams */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <Users className="h-4 w-4" />
            Equipos · {tournament.teams.length}
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => { setShowAddForm(!showAddForm); if (showAddForm) resetForm(); }}
            className="gap-1.5 h-7 text-xs border-purple-500/30 text-purple-400 hover:bg-purple-500/10 rounded-full"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Agregar
          </Button>
        </div>

        {/* Add Team Form */}
        <AnimatePresence>
          {showAddForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="glass-card rounded-xl p-4 space-y-3 border border-purple-500/20">
                <p className="text-xs font-bold uppercase tracking-widest text-purple-400">Nuevo equipo</p>

                {/* Player pickers */}
                <div className="grid grid-cols-2 gap-3">
                  <PlayerPicker
                    label="Jugador 1"
                    selected={player1}
                    onSelect={setPlayer1}
                    players={availablePlayers}
                    excluded={excludedIds}
                  />
                  <PlayerPicker
                    label="Jugador 2"
                    selected={player2}
                    onSelect={setPlayer2}
                    players={availablePlayers}
                    excluded={excludedIds}
                  />
                </div>

                {/* Team name (optional) */}
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Nombre del equipo{" "}
                    <span className="text-muted-foreground/40">(opcional)</span>
                  </Label>
                  <Input
                    placeholder={autoName || "Ej: Los Invictos"}
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    className="bg-background mt-1 h-9"
                  />
                  {autoName && !teamName && (
                    <p className="text-[10px] text-muted-foreground/40 mt-1">
                      Se usará: <span className="text-muted-foreground/60 font-medium">{autoName}</span>
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={addTeam}
                    disabled={saving || !player1 || !player2}
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white h-8 text-xs"
                  >
                    {saving ? "Guardando..." : "Confirmar"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={resetForm}
                    className="h-8 text-xs text-muted-foreground"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Teams list */}
        {tournament.teams.length === 0 ? (
          <div className="text-center py-8 glass-card rounded-xl text-muted-foreground/50 text-sm">
            No hay equipos. Agrega el primero.
          </div>
        ) : (
          <div className="space-y-2">
            {tournament.teams.map((team, i) => (
              <motion.div
                key={team.id}
                layout
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl glass-card"
              >
                <Avatar className="h-9 w-9 shrink-0 border border-purple-500/20">
                  <AvatarFallback className="bg-purple-500/15 text-purple-300 text-xs font-black">
                    {teamInitials(team.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">{team.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {team.player1} · {team.player2}
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 hover:text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-[#141414] border-[#2a2a2a]">
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Eliminar equipo?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Se eliminará <span className="font-semibold text-white">{team.name}</span> del torneo.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="border-[#2a2a2a]">Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteTeam(team.id)} className="bg-destructive hover:bg-destructive/90 text-white">
                        Eliminar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Info hints */}
      {tournament.teams.length > 0 && !isEven && (
        <p className="text-xs text-yellow-500/70 bg-yellow-500/8 border border-yellow-500/20 rounded-lg px-3 py-2">
          ⚡ Número impar de equipos — un equipo recibirá un pase automático (bye) en la primera ronda.
        </p>
      )}

      {/* Start buttons */}
      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          className="h-11 bg-purple-600 hover:bg-purple-700 text-white font-bold uppercase tracking-wider gap-2"
          disabled={!canStart || starting}
          onClick={() => startTournament(false)}
        >
          {starting ? (
            "Generando bracket..."
          ) : (
            <>
              <Play className="h-4 w-4" />
              Iniciar Torneo
            </>
          )}
        </Button>
        <Button
          variant="outline"
          className="h-11 border-purple-500/30 text-purple-300 hover:bg-purple-500/10 hover:text-purple-200 font-bold uppercase tracking-wider gap-2"
          disabled={!canStart || starting}
          onClick={() => startTournament(true)}
        >
          <PencilLine className="h-4 w-4" />
          Preparar y editar
        </Button>
      </div>

      {canStart && (
        <p className="text-center text-[11px] text-muted-foreground/55">
          El editor permite ordenar los cruces de los {tournament.teams.length} equipos antes de registrar resultados.
        </p>
      )}

      {!canStart && (
        <p className="text-center text-xs text-muted-foreground/50">
          Se necesitan al menos 2 equipos para iniciar
        </p>
      )}
    </div>
  );
}

// ─── Bracket Editor ───────────────────────────────────────────────────────────
type BracketSlotDraft = {
  matchId: number;
  position: number;
  team1Id: number | null;
  team2Id: number | null;
};

function BracketEditorDialog({
  tournament,
  open,
  onOpenChange,
  onSaved,
}: {
  tournament: TournamentDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [slots, setSlots] = useState<BracketSlotDraft[]>([]);
  const [savingBracket, setSavingBracket] = useState(false);
  const [confirmingSave, setConfirmingSave] = useState(false);
  const wasOpen = useRef(false);

  const firstRound = useMemo(
    () =>
      tournament.matches
        .filter((match) => !match.isThirdPlace && match.round === 1)
        .sort((a, b) => a.position - b.position),
    [tournament.matches]
  );

  useEffect(() => {
    if (open && !wasOpen.current) {
      setSlots(
        firstRound.map((match) => ({
          matchId: match.id,
          position: match.position,
          team1Id: match.team1Id,
          team2Id: match.team2Id,
        }))
      );
    }
    wasOpen.current = open;
  }, [open, firstRound]);

  const placedTeamIds = slots.flatMap((slot) => [slot.team1Id, slot.team2Id]).filter((id): id is number => id !== null);
  const allTeamsPlaced = placedTeamIds.length === tournament.teams.length && new Set(placedTeamIds).size === tournament.teams.length;
  const hasRecordedResults = tournament.matches.some((match) => match.status === "finished");

  const setTeam = (matchId: number, side: "team1Id" | "team2Id", rawValue: string) => {
    const newTeamId = rawValue ? Number(rawValue) : null;

    setSlots((currentSlots) => {
      const next = currentSlots.map((slot) => ({ ...slot }));
      const target = next.find((slot) => slot.matchId === matchId);
      if (!target) return currentSlots;

      const otherSide = side === "team1Id" ? "team2Id" : "team1Id";
      if (newTeamId && target[otherSide] === newTeamId) {
        [target.team1Id, target.team2Id] = [target.team2Id, target.team1Id];
        return next;
      }

      const previousTeamId = target[side];
      const source = newTeamId
        ? next.find((slot) => slot.matchId !== matchId && (slot.team1Id === newTeamId || slot.team2Id === newTeamId))
        : undefined;

      target[side] = newTeamId;
      if (source) {
        if (source.team1Id === newTeamId) source.team1Id = previousTeamId;
        else source.team2Id = previousTeamId;
      }
      return next;
    });
  };

  const swapSides = (matchId: number) => {
    setSlots((currentSlots) =>
      currentSlots.map((slot) =>
        slot.matchId === matchId ? { ...slot, team1Id: slot.team2Id, team2Id: slot.team1Id } : slot
      )
    );
  };

  const moveMatch = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= slots.length) return;

    setSlots((currentSlots) => {
      const next = currentSlots.map((slot) => ({ ...slot }));
      const current = next[index];
      const target = next[targetIndex];
      [current.team1Id, target.team1Id] = [target.team1Id, current.team1Id];
      [current.team2Id, target.team2Id] = [target.team2Id, current.team2Id];
      return next;
    });
  };

  const saveBracket = async () => {
    if (!allTeamsPlaced) {
      toast({
        title: "Faltan equipos",
        description: "Ubica cada equipo registrado una sola vez antes de guardar.",
        variant: "destructive",
      });
      return;
    }

    setSavingBracket(true);
    try {
      const res = await fetch(`/api/torneo/${tournament.id}/bracket`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slots: slots.map(({ matchId, team1Id, team2Id }) => ({ matchId, team1Id, team2Id })) }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "No se pudo guardar", description: data.error, variant: "destructive" });
        return;
      }

      toast({
        title: data.changed ? "Bracket actualizado" : "Sin cambios",
        description: data.invalidatedResults
          ? "Los resultados afectados fueron limpiados de forma segura."
          : `${data.preservedFirstRoundResults ?? 0} resultado(s) de primera ronda se conservaron.`,
      });
      setConfirmingSave(false);
      onOpenChange(false);
      onSaved();
    } finally {
      setSavingBracket(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!savingBracket) onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="bg-[#141414] border-[#2a2a2a] max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <PencilLine className="h-4 w-4 text-purple-400" />
            Editar bracket
          </DialogTitle>
          <DialogDescription className="sr-only">
            Reorganiza los equipos y los enfrentamientos de la primera ronda del torneo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 px-3 py-2.5">
            <p className="text-xs font-semibold text-purple-200">Organiza los cruces de la primera ronda</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Puedes intercambiar lados, mover un enfrentamiento y dejar un hueco para un pase libre. Todos los equipos deben quedar ubicados una sola vez.
            </p>
          </div>

          {hasRecordedResults && (
            <div className="rounded-xl border border-yellow-500/25 bg-yellow-500/8 px-3 py-2.5 flex gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-400 shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed text-yellow-100/80">
                Al guardar se conservarán los resultados de primera ronda cuyos equipos no cambien. Se reiniciarán las rondas y resultados que dependan de los cruces modificados.
              </p>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {slots.map((slot, index) => {
              const selectOptions = (currentId: number | null) =>
                tournament.teams.map((team) => {
                  const usedInAnotherSlot = slots.some(
                    (other) =>
                      other.matchId !== slot.matchId &&
                      (other.team1Id === team.id || other.team2Id === team.id)
                  );
                  return (
                    <option key={team.id} value={team.id} disabled={usedInAnotherSlot && currentId !== team.id}>
                      {team.name}
                    </option>
                  );
                });

              return (
                <div key={slot.matchId} className="rounded-xl border border-white/10 bg-white/[0.025] p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      Partido {index + 1}
                    </span>
                    <div className="flex items-center gap-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={index === 0}
                        onClick={() => moveMatch(index, -1)}
                        title="Subir partido"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={index === slots.length - 1}
                        onClick={() => moveMatch(index, 1)}
                        title="Bajar partido"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-purple-300 hover:bg-purple-500/10"
                        onClick={() => swapSides(slot.matchId)}
                        title="Intercambiar lados"
                      >
                        <ArrowLeftRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <select
                    aria-label={`Equipo superior partido ${index + 1}`}
                    value={slot.team1Id ?? ""}
                    onChange={(event) => setTeam(slot.matchId, "team1Id", event.target.value)}
                    className="h-9 w-full rounded-md border border-white/10 bg-background px-2 text-sm font-medium outline-none focus:border-purple-500/60"
                  >
                    <option value="">Pase libre</option>
                    {selectOptions(slot.team1Id)}
                  </select>
                  <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground/40">
                    <div className="h-px bg-white/10 flex-1" />
                    vs
                    <div className="h-px bg-white/10 flex-1" />
                  </div>
                  <select
                    aria-label={`Equipo inferior partido ${index + 1}`}
                    value={slot.team2Id ?? ""}
                    onChange={(event) => setTeam(slot.matchId, "team2Id", event.target.value)}
                    className="h-9 w-full rounded-md border border-white/10 bg-background px-2 text-sm font-medium outline-none focus:border-purple-500/60"
                  >
                    <option value="">Pase libre</option>
                    {selectOptions(slot.team2Id)}
                  </select>
                </div>
              );
            })}
          </div>

          <p className={`text-xs ${allTeamsPlaced ? "text-green-400/80" : "text-yellow-400/80"}`}>
            {allTeamsPlaced
              ? `✓ Los ${tournament.teams.length} equipos están ubicados.`
              : `${placedTeamIds.length} de ${tournament.teams.length} equipos ubicados.`}
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={savingBracket} className="border-[#2a2a2a]">
            Cancelar
          </Button>
          <AlertDialog open={confirmingSave} onOpenChange={setConfirmingSave}>
            <AlertDialogTrigger asChild>
              <Button disabled={!allTeamsPlaced || savingBracket} className="bg-purple-600 hover:bg-purple-700 text-white gap-2">
                <Save className="h-4 w-4" />
                Guardar bracket
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-[#141414] border-[#2a2a2a]">
              <AlertDialogHeader>
                <AlertDialogTitle>¿Guardar la nueva organización?</AlertDialogTitle>
                <AlertDialogDescription>
                  Los cruces posteriores se recalcularán con las posiciones elegidas. Los resultados afectados se limpiarán para evitar avances inválidos.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="border-[#2a2a2a]">Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={saveBracket} disabled={savingBracket} className="bg-purple-600 hover:bg-purple-700 text-white">
                  {savingBracket ? "Guardando..." : "Guardar cambios"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Active / Finished Tournament View ───────────────────────────────────────
function TournamentActiveView({
  tournament,
  onBack,
  onRefresh,
  bracketEditorOpen,
  onBracketEditorOpenChange,
}: {
  tournament: TournamentDetail;
  onBack: () => void;
  onRefresh: () => void;
  bracketEditorOpen: boolean;
  onBracketEditorOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [resultMatch, setResultMatch] = useState<TournamentMatch | null>(null);
  const [score1, setScore1] = useState("");
  const [score2, setScore2] = useState("");
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [tab, setTab] = useState<"bracket" | "podio">(tournament.status === "finished" ? "podio" : "bracket");

  const pendingCount = tournament.matches.filter((m) => m.status === "pending" && m.team1Id && m.team2Id).length;
  const mainMatches = tournament.matches.filter((m) => !m.isThirdPlace);
  const totalRounds = mainMatches.length > 0 ? Math.max(...mainMatches.map((m) => m.round)) : 0;

  const openResult = (m: TournamentMatch) => {
    setResultMatch(m);
    setScore1("");
    setScore2("");
  };

  const submitResult = async () => {
    if (!resultMatch) return;
    const s1 = parseInt(score1);
    const s2 = parseInt(score2);
    if (isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0) {
      toast({ title: "Error", description: "Ingresa puntajes válidos", variant: "destructive" });
      return;
    }
    if (s1 === s2) {
      toast({ title: "Error", description: "No puede haber empate", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/torneo/partidas/${resultMatch.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team1Score: s1, team2Score: s2 }),
      });
      if (!res.ok) {
        const d = await res.json();
        toast({ title: "Error", description: d.error, variant: "destructive" });
        return;
      }
      setResultMatch(null);
      onRefresh();
    } finally {
      setSaving(false);
    }
  };

  const resetTournament = async () => {
    setResetting(true);
    try {
      await fetch(`/api/torneo/${tournament.id}/reiniciar`, { method: "POST" });
      onRefresh();
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 mt-0.5" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Torneo</p>
          <h1 className="text-xl font-black tracking-tight leading-tight truncate">{tournament.name}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusColor(tournament.status)}`}>
              {statusLabel(tournament.status)}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {tournament.teams.length} equipos · {totalRounds} ronda{totalRounds !== 1 ? "s" : ""}
            </span>
            {tournament.status === "active" && (
              <span className="text-[10px] text-yellow-400 font-semibold">
                {pendingCount} partida{pendingCount !== 1 ? "s" : ""} pendiente{pendingCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={() => onBracketEditorOpenChange(true)}
        className="gap-1.5 border-purple-500/30 text-purple-300 hover:bg-purple-500/10 hover:text-purple-200"
      >
        <PencilLine className="h-3.5 w-3.5" />
        Editar bracket
      </Button>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-white/5 rounded-xl">
        <button
          onClick={() => setTab("bracket")}
          className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
            tab === "bracket" ? "bg-purple-500/20 text-purple-300 border border-purple-500/30" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Brackets className="h-3.5 w-3.5 inline mr-1.5" />
          Bracket
        </button>
        {tournament.status === "finished" && (
          <button
            onClick={() => setTab("podio")}
            className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
              tab === "podio" ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Trophy className="h-3.5 w-3.5 inline mr-1.5" />
            Podio
          </button>
        )}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {tab === "bracket" ? (
          <motion.div key="bracket" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <BracketView tournament={tournament} onResult={openResult} />
          </motion.div>
        ) : (
          <motion.div key="podio" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Podium tournament={tournament} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reset */}
      <div className="pt-2 border-t border-border/30">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground/50 hover:text-muted-foreground gap-1.5 text-xs"
            >
              <RotateCcw className="h-3 w-3" />
              Reiniciar bracket
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="bg-[#141414] border-[#2a2a2a]">
            <AlertDialogHeader>
              <AlertDialogTitle>¿Reiniciar torneo?</AlertDialogTitle>
              <AlertDialogDescription>
                Se borrarán todos los resultados y el bracket. Los equipos se conservan.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="border-[#2a2a2a]">Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={resetTournament} disabled={resetting} className="bg-destructive hover:bg-destructive/90 text-white">
                Reiniciar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Result Dialog */}
      <Dialog open={!!resultMatch} onOpenChange={(o) => { if (!o) setResultMatch(null); }}>
        <DialogContent className="bg-[#141414] border-[#2a2a2a] max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Swords className="h-4 w-4 text-purple-400" />
              Registrar Resultado
            </DialogTitle>
          </DialogHeader>
          {resultMatch && (
            <div className="space-y-4 py-2">
              {/* Matchup visual */}
              <div className="flex items-center gap-3">
                <div className="flex-1 text-center">
                  <div className="text-xs text-muted-foreground mb-1 truncate">{resultMatch.team1?.name}</div>
                  <Input
                    type="number"
                    min={0}
                    placeholder="0"
                    value={score1}
                    onChange={(e) => setScore1(e.target.value)}
                    className="bg-background border-purple-500/30 text-white text-center text-2xl font-black h-14 focus:border-purple-500"
                    autoFocus
                  />
                </div>
                <div className="text-muted-foreground/50 font-black text-sm">VS</div>
                <div className="flex-1 text-center">
                  <div className="text-xs text-muted-foreground mb-1 truncate">{resultMatch.team2?.name}</div>
                  <Input
                    type="number"
                    min={0}
                    placeholder="0"
                    value={score2}
                    onChange={(e) => setScore2(e.target.value)}
                    className="bg-background border-purple-500/30 text-white text-center text-2xl font-black h-14 focus:border-purple-500"
                  />
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground/50 text-center">
                El equipo con mayor puntaje avanza. No puede haber empate.
              </p>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setResultMatch(null)} disabled={saving}
              className="border-[#2a2a2a] text-gray-300 hover:bg-[#2a2a2a]">
              Cancelar
            </Button>
            <Button
              onClick={submitResult}
              disabled={saving || !score1 || !score2}
              className="bg-purple-600 hover:bg-purple-700 text-white gap-2"
            >
              <CheckCircle2 className="h-4 w-4" />
              {saving ? "Guardando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BracketEditorDialog
        tournament={tournament}
        open={bracketEditorOpen}
        onOpenChange={onBracketEditorOpenChange}
        onSaved={onRefresh}
      />
    </div>
  );
}

// ─── Tournament List ──────────────────────────────────────────────────────────
function TournamentList({ onSelect }: { onSelect: (id: number) => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: tournaments = [], isLoading } = useQuery<TournamentSummary[]>({
    queryKey: ["torneo-list"],
    queryFn: async () => {
      const res = await fetch("/api/torneo");
      if (!res.ok) throw new Error("Error");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const createTournament = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/torneo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (!res.ok) {
        const d = await res.json();
        toast({ title: "Error", description: d.error, variant: "destructive" });
        return;
      }
      const t = await res.json();
      setNewName("");
      setCreating(false);
      qc.invalidateQueries({ queryKey: ["torneo-list"] });
      onSelect(t.id);
    } finally {
      setSaving(false);
    }
  };

  const deleteTournament = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    await fetch(`/api/torneo/${id}`, { method: "DELETE" });
    qc.invalidateQueries({ queryKey: ["torneo-list"] });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-purple-500/10 blur-2xl scale-150" />
            <Brackets className="w-12 h-12 text-purple-400 relative" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tighter uppercase">Torneo</h1>
            <p className="text-muted-foreground text-xs uppercase tracking-[0.2em]">
              Gestor de torneos de dominó
            </p>
          </div>
        </div>

        <Button
          onClick={() => setCreating(!creating)}
          className="gap-2 bg-purple-600 hover:bg-purple-700 text-white rounded-full self-start"
          size="sm"
        >
          <Plus className="h-4 w-4" />
          Nuevo Torneo
        </Button>
      </div>

      {/* Create form */}
      <AnimatePresence>
        {creating && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="glass-card rounded-xl p-4 space-y-3 border border-purple-500/20">
              <p className="text-xs font-bold uppercase tracking-widest text-purple-400">Nuevo torneo</p>
              <div className="flex gap-2">
                <Input
                  placeholder="Nombre del torneo"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createTournament()}
                  className="bg-background flex-1 h-9"
                  autoFocus
                />
                <Button
                  size="sm"
                  onClick={createTournament}
                  disabled={saving || !newName.trim()}
                  className="bg-purple-600 hover:bg-purple-700 text-white h-9 px-4"
                >
                  {saving ? "..." : "Crear"}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 glass-card rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : tournaments.length === 0 ? (
        <div className="text-center py-20 glass-card rounded-2xl flex flex-col items-center gap-4 text-muted-foreground">
          <Brackets className="h-12 w-12 opacity-20" />
          <p className="text-sm">No hay torneos. Crea el primero.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tournaments.map((t, i) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card
                className="glass-card hover:bg-white/5 transition-colors cursor-pointer group"
                onClick={() => onSelect(t.id)}
              >
                <CardContent className="p-4 flex items-center gap-3">
                  <Avatar className="h-10 w-10 shrink-0 border border-purple-500/20">
                    <AvatarFallback className="bg-purple-500/15 text-purple-300 text-xs font-black">
                      {t.name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate">{t.name}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusColor(t.status)}`}>
                        {statusLabel(t.status)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {t.teamCount} equipo{t.teamCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-[#141414] border-[#2a2a2a]" onClick={(e) => e.stopPropagation()}>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Eliminar torneo?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Se eliminarán todos los datos de <span className="font-semibold text-white">{t.name}</span>.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="border-[#2a2a2a]">Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={(e) => deleteTournament(t.id, e)}
                            className="bg-destructive hover:bg-destructive/90 text-white"
                          >
                            Eliminar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Torneo() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [bracketEditorOpen, setBracketEditorOpen] = useState(false);

  const { data: tournament, refetch } = useQuery<TournamentDetail>({
    queryKey: ["torneo-detail", selectedId],
    queryFn: async () => {
      const res = await fetch(`/api/torneo/${selectedId}`);
      if (!res.ok) throw new Error("Error");
      return res.json();
    },
    enabled: selectedId !== null,
    refetchInterval: 10000,
  });

  const handleBack = () => {
    setSelectedId(null);
    setBracketEditorOpen(false);
    qc.invalidateQueries({ queryKey: ["torneo-list"] });
  };

  const handleRefresh = () => {
    refetch();
    qc.invalidateQueries({ queryKey: ["torneo-list"] });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4 animate-in fade-in duration-500 pb-24">
      {!selectedId ? (
        <TournamentList onSelect={setSelectedId} />
      ) : !tournament ? (
        <div className="py-20 text-center text-muted-foreground">Cargando torneo...</div>
      ) : tournament.status === "setup" ? (
        <TournamentSetup
          tournament={tournament}
          onBack={handleBack}
          onRefresh={handleRefresh}
          onOpenBracketEditor={() => setBracketEditorOpen(true)}
        />
      ) : (
        <TournamentActiveView
          tournament={tournament}
          onBack={handleBack}
          onRefresh={handleRefresh}
          bracketEditorOpen={bracketEditorOpen}
          onBracketEditorOpenChange={setBracketEditorOpen}
        />
      )}
      <ScrollToTop />
    </div>
  );
}
