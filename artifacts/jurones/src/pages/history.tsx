import React, { useState, useRef } from "react";
import ScrollToTop from "@/components/scroll-to-top";
import { motion } from "framer-motion";
import { useListHistory, useUpdateMatch, getListHistoryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { History as HistoryIcon, Edit2, Trash2, Trophy, Upload, Download, CheckCircle2, AlertCircle, Loader2, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const TZ = "America/Santo_Domingo";

function buildMatchText(match: any): string {
  const date = new Date(match.finishedAt ?? match.createdAt);
  const dateStr = date.toLocaleDateString("es-DO", {
    timeZone: TZ,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const num = String(match.matchNumber).padStart(3, "0");

  const cortos: string[] = (match.players ?? [])
    .filter((p: any) => p.team === "cortos")
    .map((p: any) => p.player?.name ?? p.playerName ?? "");

  const largos: string[] = (match.players ?? [])
    .filter((p: any) => p.team === "largos")
    .map((p: any) => p.player?.name ?? p.playerName ?? "");

  const lines: string[] = [];
  lines.push(`Partida #${num} ${dateStr}`);
  lines.push("", "");
  lines.push("Cortos");
  lines.push(String(match.shortosScore));
  cortos.forEach((name, i) => { if (i > 0) lines.push(""); lines.push(name); });
  lines.push("");
  lines.push("VS");
  lines.push("Largos");
  lines.push(String(match.largosScore));
  largos.forEach((name, i) => { if (i > 0) lines.push(""); lines.push(name); });

  return lines.join("\n");
}

export default function History() {
  const { data: matches, isLoading } = useListHistory();
  const updateMatch = useUpdateMatch();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [copiedId, setCopiedId] = useState<number | null>(null);

  const handleCopy = (match: any) => {
    const text = buildMatchText(match);
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(match.id);
      setTimeout(() => setCopiedId(null), 1800);
    }).catch(() => {
      toast({ title: "Error", description: "No se pudo copiar al portapapeles.", variant: "destructive" });
    });
  };

  const [selectedMatch, setSelectedMatch] = useState<any>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [adminCode, setAdminCode] = useState("");
  const [formData, setFormData] = useState({ shortosScore: 0, largosScore: 0 });

  // Import JSON state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importAdminCode, setImportAdminCode] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importParsed, setImportParsed] = useState<any>(null);
  const [importParseError, setImportParseError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);

  const openEdit = (match: any) => {
    setSelectedMatch(match);
    setFormData({ shortosScore: match.shortosScore, largosScore: match.largosScore });
    setAdminCode("");
    setIsEditOpen(true);
  };

  const openDelete = (match: any) => {
    setSelectedMatch(match);
    setAdminCode("");
    setIsDeleteOpen(true);
  };

  const handleEdit = () => {
    if (!selectedMatch || !adminCode) return;
    updateMatch.mutate({
      id: selectedMatch.id,
      data: {
        adminCode,
        shortosScore: formData.shortosScore,
        largosScore: formData.largosScore,
        winnerTeam: formData.shortosScore >= 200 ? "cortos" : formData.largosScore >= 200 ? "largos" : selectedMatch.winnerTeam,
      },
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListHistoryQueryKey() });
        setIsEditOpen(false);
        toast({ title: "Partida actualizada", description: "Los cambios han sido guardados." });
      },
      onError: () => {
        toast({ title: "Error", description: "Código de administrador inválido o error al guardar.", variant: "destructive" });
      },
    });
  };

  const handleDelete = () => {
    if (!selectedMatch || !adminCode) return;
    fetch(`/api/matches/${selectedMatch.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminCode }),
    }).then(res => {
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: getListHistoryQueryKey() });
        setIsDeleteOpen(false);
        toast({ title: "Partida eliminada", description: "El registro ha sido borrado." });
      } else {
        toast({ title: "Error", description: "Código de administrador inválido.", variant: "destructive" });
      }
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setImportParseError(null);
    setImportParsed(null);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        if (!json.partidas || !Array.isArray(json.partidas)) {
          setImportParseError('El JSON debe tener un campo "partidas" como lista.');
          return;
        }
        setImportParsed(json);
      } catch {
        setImportParseError("Formato JSON inválido. Verifica la estructura del archivo.");
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!importParsed || !importAdminCode) return;
    setIsImporting(true);
    setImportResult(null);
    let res: Response | null = null;
    try {
      res = await fetch("/api/matches/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminCode: importAdminCode, partidas: importParsed.partidas }),
      });
    } catch (err) {
      toast({ title: "Error de red", description: "No se pudo conectar con el servidor. Verifica tu conexión.", variant: "destructive" });
      setIsImporting(false);
      return;
    }

    let data: any = null;
    try {
      data = await res.json();
    } catch {
      toast({ title: "Error del servidor", description: `El servidor respondió con estado ${res.status} pero sin datos válidos.`, variant: "destructive" });
      setIsImporting(false);
      return;
    }

    if (res.status === 403) {
      toast({ title: "Acceso denegado", description: "Código de administrador inválido.", variant: "destructive" });
      setIsImporting(false);
      return;
    }
    if (!res.ok) {
      toast({ title: "Formato JSON inválido", description: data?.error ?? "Error desconocido.", variant: "destructive" });
      setIsImporting(false);
      return;
    }

    setImportResult(data);
    queryClient.invalidateQueries({ queryKey: getListHistoryQueryKey() });
    setIsImporting(false);
  };

  const openImport = () => {
    setImportFile(null);
    setImportParsed(null);
    setImportParseError(null);
    setImportAdminCode("");
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setIsImportOpen(true);
  };

  const handleExport = () => {
    if (!matches || matches.length === 0) return;
    const partidas = matches.map((match: any) => {
      const cortos = (match.players ?? []).filter((p: any) => p.team === "cortos");
      const largos = (match.players ?? []).filter((p: any) => p.team === "largos");
      const date = new Date(match.finishedAt || match.createdAt);
      const fecha = date.toISOString().slice(0, 10);
      const hora = date.toTimeString().slice(0, 5);
      return {
        fecha,
        hora,
        equipo1: {
          jugadores: cortos.map((p: any) => p.player?.name ?? p.playerName ?? ""),
          puntos: match.shortosScore,
        },
        equipo2: {
          jugadores: largos.map((p: any) => p.player?.name ?? p.playerName ?? ""),
          puntos: match.largosScore,
        },
      };
    });
    const blob = new Blob([JSON.stringify({ partidas }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `jurones_partidas_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exportado", description: `${partidas.length} partidas descargadas como JSON.` });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-8 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-muted rounded-full">
            <HistoryIcon className="h-6 w-6 text-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Records</h1>
            <p className="text-muted-foreground mt-1 uppercase tracking-[0.15em] sm:tracking-[0.2em] md:tracking-[0.3em] text-xs">Historial de partidas finalizadas.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleExport}
            variant="outline"
            disabled={!matches || matches.length === 0}
            className="flex items-center gap-2 border-border hover:border-primary"
          >
            <Download className="h-4 w-4" />
            Exportar JSON
          </Button>
          <Button onClick={openImport} variant="outline" className="flex items-center gap-2 border-primary/40 hover:border-primary">
            <Upload className="h-4 w-4" />
            Importar JSON
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-20 text-muted-foreground">Cargando historial...</div>
      ) : matches && matches.length > 0 ? (
        <div className="grid gap-4">
          {matches.map((match, index) => (
            <motion.div
              key={match.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="glass-card group hover:bg-white/5 transition-colors">
                <CardContent className="p-5 flex flex-col gap-4">
                  {/* Header row: match info + actions */}
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-semibold text-muted-foreground">Partida #{match.matchNumber}</span>
                      <span className="text-xs text-muted-foreground ml-3">
                        {new Date(match.finishedAt || match.createdAt).toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-8 w-8 transition-colors ${copiedId === match.id ? "text-green-400 hover:text-green-400" : "hover:text-primary"}`}
                        title="Copiar datos de la partida"
                        onClick={() => handleCopy(match)}
                      >
                        {copiedId === match.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-primary" onClick={() => openEdit(match)}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" onClick={() => openDelete(match)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Score row with player names */}
                  <div className="flex items-stretch gap-3">
                    {/* Cortos */}
                    <div className={`flex-1 flex flex-col items-center rounded-xl py-3 px-2 ${match.winnerTeam === "cortos" ? "bg-red-500/10 border border-red-500/30" : "bg-muted/30"}`}>
                      <span className={`uppercase text-xs tracking-widest mb-1 font-semibold ${match.winnerTeam === "cortos" ? "text-red-400" : "text-muted-foreground"}`}>Cortos</span>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-3xl font-bold tabular-nums ${match.winnerTeam === "cortos" ? "text-red-400" : "text-muted-foreground"}`}>{match.shortosScore}</span>
                        {match.winnerTeam === "cortos" && <Trophy className="h-4 w-4 text-red-400" />}
                      </div>
                      <div className="mt-2 space-y-0.5 text-center">
                        {(match as any).players?.filter((p: any) => p.team === "cortos").map((p: any) => (
                          <p key={p.playerId} className="text-xs text-muted-foreground leading-tight">{p.player?.name ?? p.playerName}</p>
                        ))}
                      </div>
                    </div>

                    {/* VS divider */}
                    <div className="flex items-center text-muted-foreground/50 font-light text-lg self-center">VS</div>

                    {/* Largos */}
                    <div className={`flex-1 flex flex-col items-center rounded-xl py-3 px-2 ${match.winnerTeam === "largos" ? "bg-blue-500/10 border border-blue-500/30" : "bg-muted/30"}`}>
                      <span className={`uppercase text-xs tracking-widest mb-1 font-semibold ${match.winnerTeam === "largos" ? "text-blue-400" : "text-muted-foreground"}`}>Largos</span>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-3xl font-bold tabular-nums ${match.winnerTeam === "largos" ? "text-blue-400" : "text-muted-foreground"}`}>{match.largosScore}</span>
                        {match.winnerTeam === "largos" && <Trophy className="h-4 w-4 text-blue-400" />}
                      </div>
                      <div className="mt-2 space-y-0.5 text-center">
                        {(match as any).players?.filter((p: any) => p.team === "largos").map((p: any) => (
                          <p key={p.playerId} className="text-xs text-muted-foreground leading-tight">{p.player?.name ?? p.playerName}</p>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 text-muted-foreground glass-card rounded-2xl">
          No hay partidas en el historial.
        </div>
      )}

      {/* Edit Modal */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="glass-card sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar Resultado</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className="text-red-500">Puntos Cortos</Label>
                <Input
                  type="number"
                  value={formData.shortosScore}
                  onChange={e => setFormData({ ...formData, shortosScore: parseInt(e.target.value) || 0 })}
                  className="bg-background text-center text-xl"
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-blue-500">Puntos Largos</Label>
                <Input
                  type="number"
                  value={formData.largosScore}
                  onChange={e => setFormData({ ...formData, largosScore: parseInt(e.target.value) || 0 })}
                  className="bg-background text-center text-xl"
                />
              </div>
            </div>
            <div className="grid gap-2 mt-4 pt-4 border-t border-border">
              <Label>Código de Admin</Label>
              <Input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                value={adminCode}
                onChange={e => setAdminCode(e.target.value)}
                placeholder="******"
                className="bg-background"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleEdit} disabled={updateMatch.isPending || !adminCode} className="w-full">
              {updateMatch.isPending ? "Guardando..." : "Guardar Modificación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Modal */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="glass-card sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>¿Eliminar Partida?</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <p className="text-muted-foreground text-sm">Esta acción eliminará el registro permanentemente. Ingresa el código de admin para confirmar.</p>
            <div className="grid gap-2">
              <Label>Código de Admin</Label>
              <Input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                value={adminCode}
                onChange={e => setAdminCode(e.target.value)}
                placeholder="******"
                className="bg-background"
              />
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)} className="flex-1">Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={!adminCode} className="flex-1">
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import JSON Modal */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleFileSelect}
      />
      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="glass-card sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Importar Partidas (JSON)
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* File selector */}
            <div
              className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-primary/60 hover:bg-white/5 transition-all"
              onClick={() => fileInputRef.current?.click()}
            >
              {importFile ? (
                <div className="flex items-center justify-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="font-medium">{importFile.name}</span>
                </div>
              ) : (
                <div className="text-muted-foreground text-sm space-y-1">
                  <Upload className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p>Haz clic para seleccionar un archivo .json</p>
                </div>
              )}
            </div>

            {/* Parse error */}
            {importParseError && (
              <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{importParseError}</span>
              </div>
            )}

            {/* Parsed preview */}
            {importParsed && !importParseError && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-sm">
                <div className="flex items-center gap-2 text-green-400 font-medium mb-1">
                  <CheckCircle2 className="h-4 w-4" />
                  Archivo válido
                </div>
                <p className="text-muted-foreground">
                  {importParsed.partidas.length} partida{importParsed.partidas.length !== 1 ? "s" : ""} detectada{importParsed.partidas.length !== 1 ? "s" : ""} para importar.
                </p>
              </div>
            )}

            {/* Import result */}
            {importResult && (
              <div className={`rounded-lg p-3 text-sm border ${importResult.imported > 0 ? "bg-green-500/10 border-green-500/30" : "bg-muted border-border"}`}>
                <p className="font-medium mb-1">
                  {importResult.imported > 0 ? "✅ Partidas importadas correctamente" : "Sin cambios"}
                </p>
                <ul className="text-muted-foreground space-y-0.5">
                  <li>✔ Importadas: <span className="text-foreground font-semibold">{importResult.imported}</span></li>
                  <li>⟳ Omitidas (duplicadas): <span className="text-foreground font-semibold">{importResult.skipped}</span></li>
                  {importResult.errors.length > 0 && (
                    <li className="text-destructive">⚠ Errores: {importResult.errors.length}</li>
                  )}
                </ul>
                {importResult.errors.length > 0 && (
                  <ul className="mt-2 space-y-1 text-destructive text-xs">
                    {importResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                )}
              </div>
            )}

            {/* Admin code */}
            {!importResult && (
              <div className="grid gap-2 pt-2 border-t border-border">
                <Label>Código de Admin</Label>
                <Input
                  type="password"
                  value={importAdminCode}
                  onChange={e => setImportAdminCode(e.target.value)}
                  placeholder="******"
                  className="bg-background"
                />
              </div>
            )}
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setIsImportOpen(false)} className="flex-1">
              {importResult ? "Cerrar" : "Cancelar"}
            </Button>
            {!importResult && (
              <Button
                onClick={handleImport}
                disabled={!importParsed || !importAdminCode || isImporting || !!importParseError}
                className="flex-1"
              >
                {isImporting ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" />Importando...</>
                ) : (
                  "Importar"
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ScrollToTop />
    </div>
  );
}
