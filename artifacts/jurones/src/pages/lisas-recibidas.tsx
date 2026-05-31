import React, { useRef, useState } from "react";
import ScrollToTop from "@/components/scroll-to-top";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Skull, Medal, Download, Upload, KeyRound, CheckCircle2, XCircle, Pencil } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

function avatarSrc(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http")) return path;
  const slug = path.startsWith("/objects/") ? path.slice("/objects/".length) : path;
  return `/api/storage/objects/${slug}`;
}

interface LisaReciEntry {
  player: {
    id: number;
    name: string;
    avatarUrl?: string | null;
    wins: number;
    losses: number;
    winRate: number;
  };
  lisasRecibidas: number;
}

interface ImportResult {
  name: string;
  status: string;
}

export default function LisasRecibidas() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [adminCode, setAdminCode] = useState("");
  const [pendingData, setPendingData] = useState<{ playerName: string; lisasRecibidas: number }[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<ImportResult[] | null>(null);

  const [editEntry, setEditEntry] = useState<LisaReciEntry | null>(null);
  const [editCount, setEditCount] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const { data: ranking, isLoading } = useQuery<LisaReciEntry[]>({
    queryKey: ["lisas-recibidas"],
    queryFn: async () => {
      const res = await fetch("/api/lisas-recibidas");
      if (!res.ok) throw new Error("Error cargando lisas recibidas");
      return res.json();
    },
  });

  const handleExport = () => {
    if (!ranking || ranking.length === 0) return;
    const payload = ranking.map((e) => ({ playerName: e.player.name, lisasRecibidas: e.lisasRecibidas }));
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lisas_recibidas_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (!Array.isArray(parsed)) throw new Error("Formato inválido");
        const data = parsed.map((row: Record<string, unknown>) => ({
          playerName: String(row.playerName ?? row.name ?? ""),
          lisasRecibidas: Number(row.lisasRecibidas ?? row.lisas ?? 0),
        }));
        setPendingData(data);
        setAdminCode("");
        setImportResults(null);
        setImportDialogOpen(true);
      } catch {
        toast({ variant: "destructive", title: "Error", description: "El archivo JSON no tiene el formato correcto." });
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleImportConfirm = async () => {
    if (!pendingData || !adminCode) return;
    setImporting(true);
    try {
      const res = await fetch("/api/lisas-recibidas/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminCode, data: pendingData }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast({ variant: "destructive", title: "Error", description: json.error ?? "Error al importar." });
        return;
      }
      setImportResults(json.results ?? []);
      queryClient.invalidateQueries({ queryKey: ["lisas-recibidas"] });
    } catch {
      toast({ variant: "destructive", title: "Error", description: "No se pudo conectar con el servidor." });
    } finally {
      setImporting(false);
    }
  };

  const handleCloseImport = () => {
    setImportDialogOpen(false);
    setPendingData(null);
    setAdminCode("");
    setImportResults(null);
  };

  const openEdit = (entry: LisaReciEntry) => {
    setEditEntry(entry);
    setEditCount(String(entry.lisasRecibidas));
    setEditCode("");
  };

  const handleEditSave = async () => {
    if (!editEntry || !editCode) return;
    const count = parseInt(editCount);
    if (isNaN(count) || count < 0) {
      toast({ variant: "destructive", title: "Error", description: "El número debe ser 0 o mayor." });
      return;
    }
    setEditSaving(true);
    try {
      const res = await fetch(`/api/lisas-recibidas/${editEntry.player.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminCode: editCode, lisasRecibidas: count }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast({ variant: "destructive", title: "Error", description: json.error ?? "No se pudo actualizar." });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["lisas-recibidas"] });
      setEditEntry(null);
      toast({
        title: "Actualizado",
        description: `${editEntry.player.name}: ${json.total} lisa${json.total !== 1 ? "s" : ""} recibida${json.total !== 1 ? "s" : ""}`,
      });
    } catch {
      toast({ variant: "destructive", title: "Error", description: "No se pudo conectar con el servidor." });
    } finally {
      setEditSaving(false);
    }
  };

  const getPositionColor = (index: number) => {
    switch (index) {
      case 0: return "text-red-500 bg-red-500/10 border-red-500/50";
      case 1: return "text-orange-400 bg-orange-400/10 border-orange-400/50";
      case 2: return "text-amber-500 bg-amber-500/10 border-amber-500/50";
      default: return "text-muted-foreground bg-muted border-border";
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-2">
        <div className="text-center sm:text-left space-y-3">
          <div className="relative inline-flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-red-500/10 blur-2xl scale-150" />
            <Skull className="w-14 h-14 text-red-400 relative" />
          </div>
          <h1 className="text-4xl font-black tracking-tighter uppercase">Lisas Recibidas</h1>
          <p className="text-muted-foreground">
            Jugadores con más derrotas <span className="text-red-400 font-semibold">0 – 200</span>.
            La deshonra de salir en blanco.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={!ranking || ranking.length === 0}
            className="gap-2 border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-full"
          >
            <Download className="h-4 w-4" />
            Exportar JSON
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="gap-2 border-primary/30 text-primary hover:bg-primary/10 rounded-full"
          >
            <Upload className="h-4 w-4" />
            Importar JSON
          </Button>
          <input ref={fileInputRef} type="file" accept="application/json,.json" className="hidden" onChange={handleFileChange} />
        </div>
      </div>

      {/* Ranking */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 glass-card rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : ranking && ranking.length > 0 ? (
        <div className="space-y-3">
          {ranking.map((item, index) => {
            const hasRecibidas = item.lisasRecibidas > 0;
            const reciRank = ranking.filter((r) => r.lisasRecibidas > 0).indexOf(item);
            const isFirstZero = !hasRecibidas && index > 0 && ranking[index - 1].lisasRecibidas > 0;

            return (
              <React.Fragment key={item.player.id}>
                {isFirstZero && (
                  <div className="flex items-center gap-3 py-2">
                    <div className="flex-1 h-px bg-border/40" />
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground/50 font-semibold">Sin lisas recibidas</span>
                    <div className="flex-1 h-px bg-border/40" />
                  </div>
                )}

                <motion.div
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.04, layout: { type: "spring", stiffness: 300, damping: 30 } }}
                  className={`flex items-center gap-4 p-4 rounded-2xl glass-card relative overflow-hidden ${
                    hasRecibidas && reciRank < 3
                      ? "border " + getPositionColor(reciRank).split(" ")[2]
                      : hasRecibidas ? "" : "opacity-50"
                  }`}
                >
                  {hasRecibidas && reciRank === 0 && (
                    <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 to-transparent pointer-events-none" />
                  )}

                  {/* Position badge */}
                  <div className={`w-12 h-12 flex items-center justify-center font-black text-xl rounded-full shrink-0 ${
                    hasRecibidas ? getPositionColor(reciRank) : "text-muted-foreground/40 bg-muted/30 border-border/20"
                  }`}>
                    {hasRecibidas && reciRank < 3 ? <Medal className="w-6 h-6" /> : hasRecibidas ? `#${reciRank + 1}` : "—"}
                  </div>

                  {/* Avatar */}
                  <Avatar className={`h-14 w-14 border-2 shrink-0 ${hasRecibidas && reciRank === 0 ? "border-red-400" : "border-transparent"}`}>
                    <AvatarImage src={avatarSrc(item.player.avatarUrl)} className="object-cover" />
                    <AvatarFallback className="bg-red-500/20 text-red-400 font-bold">
                      {item.player.name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  {/* Name & stats */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-lg truncate">{item.player.name}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {item.player.wins}V · {item.player.losses}D · WR {(Number(item.player.winRate) * 100).toFixed(0)}%
                    </p>
                  </div>

                  {/* Count */}
                  <div className={`text-right pl-4 border-l border-border shrink-0 ${!hasRecibidas ? "opacity-40" : ""}`}>
                    <div className="flex items-center justify-end gap-2">
                      <Skull className={`h-5 w-5 ${hasRecibidas ? "text-red-400" : "text-muted-foreground"}`} />
                      <span className={`text-3xl font-black ${hasRecibidas ? "text-red-400" : "text-muted-foreground"}`}>
                        {item.lisasRecibidas}
                      </span>
                    </div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                      {item.lisasRecibidas === 1 ? "Recibida" : "Recibidas"}
                    </div>
                  </div>

                </motion.div>
              </React.Fragment>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-20 text-muted-foreground glass-card rounded-2xl flex flex-col items-center gap-4">
          <Skull className="w-12 h-12 opacity-30" />
          <p>No hay jugadores registrados.</p>
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editEntry} onOpenChange={(o) => { if (!o) setEditEntry(null); }}>
        <DialogContent className="bg-[#141414] border-[#2a2a2a] max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Skull className="h-5 w-5 text-red-400" /> Editar Lisas Recibidas
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Modifica el total para <span className="text-white font-semibold">{editEntry?.player.name}</span>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-gray-300 flex items-center gap-1.5">
                <Skull className="h-3.5 w-3.5 text-red-400" /> Lisas Recibidas
              </Label>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 shrink-0 border-[#2a2a2a] text-gray-300 hover:bg-[#2a2a2a] text-lg font-bold"
                  onClick={() => setEditCount((v) => String(Math.max(0, (parseInt(v) || 0) - 1)))}
                >
                  −
                </Button>
                <Input
                  type="number"
                  min={0}
                  value={editCount}
                  onChange={(e) => setEditCount(e.target.value)}
                  className="bg-background border-[#2a2a2a] text-white text-center text-2xl font-black h-12"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 shrink-0 border-[#2a2a2a] text-gray-300 hover:bg-[#2a2a2a] text-lg font-bold"
                  onClick={() => setEditCount((v) => String((parseInt(v) || 0) + 1))}
                >
                  +
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-gray-300 flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5" /> Código de administrador
              </Label>
              <Input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="••••••"
                value={editCode}
                onChange={(e) => setEditCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleEditSave()}
                className="bg-background border-[#2a2a2a] text-white"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setEditEntry(null)}
              disabled={editSaving}
              className="border-[#2a2a2a] text-gray-300 hover:bg-[#2a2a2a]"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleEditSave}
              disabled={editSaving || !editCode}
              className="bg-red-600 hover:bg-red-700 text-white gap-2"
            >
              <CheckCircle2 className="h-4 w-4" />
              {editSaving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={(o) => { if (!o) handleCloseImport(); }}>
        <DialogContent className="bg-[#141414] border-[#2a2a2a] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" /> Importar Lisas Recibidas
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              {importResults
                ? "Importación completada."
                : `Se actualizarán ${pendingData?.length ?? 0} jugador(es). Ingresa el código de administrador para confirmar.`}
            </DialogDescription>
          </DialogHeader>

          <AnimatePresence mode="wait">
            {!importResults ? (
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4 py-2">
                {pendingData && pendingData.length > 0 && (
                  <div className="bg-background/60 rounded-xl p-3 space-y-1.5 max-h-40 overflow-y-auto">
                    {pendingData.map((row, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-foreground">{row.playerName}</span>
                        <span className="text-red-400 font-bold flex items-center gap-1">
                          <Skull className="h-3.5 w-3.5" /> {row.lisasRecibidas}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label className="text-gray-300 flex items-center gap-1.5">
                    <KeyRound className="h-3.5 w-3.5" /> Código de administrador
                  </Label>
                  <Input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="••••••"
                    value={adminCode}
                    onChange={(e) => setAdminCode(e.target.value)}
                    className="bg-background border-[#2a2a2a] text-white"
                    onKeyDown={(e) => e.key === "Enter" && handleImportConfirm()}
                  />
                </div>
              </motion.div>
            ) : (
              <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-2 space-y-2 max-h-52 overflow-y-auto">
                {importResults.map((r, i) => (
                  <div key={i} className="flex items-center justify-between text-sm bg-background/40 rounded-lg px-3 py-2">
                    <span className="text-foreground">{r.name}</span>
                    <span className={`flex items-center gap-1 font-medium ${r.status === "actualizado" ? "text-green-400" : "text-red-400"}`}>
                      {r.status === "actualizado"
                        ? <><CheckCircle2 className="h-4 w-4" /> Actualizado</>
                        : <><XCircle className="h-4 w-4" /> No encontrado</>}
                    </span>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleCloseImport} className="border-[#2a2a2a] text-gray-300 hover:bg-[#2a2a2a]">
              {importResults ? "Cerrar" : "Cancelar"}
            </Button>
            {!importResults && (
              <Button onClick={handleImportConfirm} disabled={importing || !adminCode} className="bg-primary hover:bg-primary/90 text-white">
                {importing ? "Importando..." : "Confirmar importación"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ScrollToTop />
    </div>
  );
}
