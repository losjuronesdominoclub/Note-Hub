import React, { useRef, useState } from "react";
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
import { Fish, Medal, Download, Upload, KeyRound, CheckCircle2, XCircle } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

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

interface ImportResult {
  name: string;
  status: string;
}

export default function Lisas() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [adminCode, setAdminCode] = useState("");
  const [pendingData, setPendingData] = useState<{ playerName: string; lisas: number }[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<ImportResult[] | null>(null);

  const { data: ranking, isLoading } = useQuery<LisaEntry[]>({
    queryKey: ["lisas"],
    queryFn: async () => {
      const res = await fetch("/api/lisas");
      if (!res.ok) throw new Error("Error cargando lisas");
      return res.json();
    },
  });

  // --- Export ---
  const handleExport = () => {
    if (!ranking || ranking.length === 0) return;
    const payload = ranking.map((e) => ({ playerName: e.player.name, lisas: e.lisas }));
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lisas_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // --- Import: file pick ---
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
          lisas: Number(row.lisas ?? 0),
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

  // --- Import: confirm ---
  const handleImportConfirm = async () => {
    if (!pendingData || !adminCode) return;
    setImporting(true);
    try {
      const res = await fetch("/api/lisas/import", {
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
      queryClient.invalidateQueries({ queryKey: ["lisas"] });
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-2">
        <div className="text-center sm:text-left space-y-3">
          <div className="relative inline-flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-cyan-500/10 blur-2xl scale-150" />
            <Fish className="w-14 h-14 text-cyan-400 relative" />
          </div>
          <h1 className="text-4xl font-black tracking-tighter uppercase">Lisas</h1>
          <p className="text-muted-foreground">
            Jugadores con más victorias <span className="text-cyan-400 font-semibold">200 – 0</span>.
            Una Lisa es la victoria perfecta.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={!ranking || ranking.length === 0}
            className="gap-2 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 rounded-full"
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
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={handleFileChange}
          />
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

              <div className={`w-12 h-12 flex items-center justify-center font-black text-xl rounded-full shrink-0 ${getPositionColor(index)}`}>
                {index < 3 ? <Medal className="w-6 h-6" /> : `#${index + 1}`}
              </div>

              <Avatar className={`h-14 w-14 border-2 shrink-0 ${index === 0 ? "border-cyan-400" : "border-transparent"}`}>
                <AvatarImage src={avatarSrc(item.player.avatarUrl)} className="object-cover" />
                <AvatarFallback className="bg-cyan-500/20 text-cyan-400 font-bold">
                  {item.player.name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-lg truncate">{item.player.name}</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {item.player.wins}V · {item.player.losses}D · WR {(Number(item.player.winRate) * 100).toFixed(2)}%
                </p>
              </div>

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

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={(o) => { if (!o) handleCloseImport(); }}>
        <DialogContent className="bg-[#141414] border-[#2a2a2a] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" /> Importar Lisas
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
                {/* Preview */}
                {pendingData && pendingData.length > 0 && (
                  <div className="bg-background/60 rounded-xl p-3 space-y-1.5 max-h-40 overflow-y-auto">
                    {pendingData.map((row, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-foreground">{row.playerName}</span>
                        <span className="text-cyan-400 font-bold flex items-center gap-1">
                          <Fish className="h-3.5 w-3.5" /> {row.lisas}
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
                    placeholder="••••••"
                    value={adminCode}
                    onChange={e => setAdminCode(e.target.value)}
                    className="bg-background border-[#2a2a2a] text-white"
                    onKeyDown={e => e.key === "Enter" && handleImportConfirm()}
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
              <Button
                onClick={handleImportConfirm}
                disabled={importing || !adminCode}
                className="bg-primary hover:bg-primary/90 text-white"
              >
                {importing ? "Importando..." : "Confirmar importación"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
