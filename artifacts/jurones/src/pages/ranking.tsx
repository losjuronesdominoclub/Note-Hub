import React, { useState, useRef } from "react";
import ScrollToTop from "@/components/scroll-to-top";
import { motion } from "framer-motion";
import { useGetRanking, getGetRankingQueryKey, getListPlayersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Trophy, Medal, Flame, Download, Upload, CheckCircle2, AlertCircle, Loader2, Share2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import html2canvas from "html2canvas";

function avatarSrc(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http")) return path;
  const slug = path.startsWith("/objects/") ? path.slice("/objects/".length) : path;
  return `/api/storage/objects/${slug}`;
}

export default function Ranking() {
  const { data: ranking, isLoading } = useGetRanking();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const shareRef = useRef<HTMLDivElement | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importAdminCode, setImportAdminCode] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importParsed, setImportParsed] = useState<any>(null);
  const [importParseError, setImportParseError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ updated: number; notFound: number; errors: string[] } | null>(null);

  const getPositionColor = (position: number) => {
    switch (position) {
      case 1: return "text-yellow-500 bg-yellow-500/10 border-yellow-500/50";
      case 2: return "text-slate-300 bg-slate-300/10 border-slate-300/50";
      case 3: return "text-amber-600 bg-amber-600/10 border-amber-600/50";
      default: return "text-muted-foreground bg-muted border-border";
    }
  };

  const handleShare = async () => {
    const el = shareRef.current;
    if (!el || !ranking || ranking.length === 0) return;
    try {
      const canvas = await html2canvas(el, {
        backgroundColor: "#0f0f13",
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
      });
      const fileName = `jurones_ranking_${new Date().toISOString().slice(0, 10)}.jpg`;
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Canvas empty"))), "image/jpeg", 0.92);
      });
      const file = new File([blob], fileName, { type: "image/jpeg" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Global Ranking — Los Jurones" });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast({ title: "Descargado", description: "Top 10 del Global Ranking guardado." });
      }
    } catch {
      toast({ title: "Error", description: "No se pudo generar la imagen.", variant: "destructive" });
    }
  };

  const handleExport = () => {
    if (!ranking || ranking.length === 0) return;
    const jugadores = ranking.map((item) => ({
      nombre: item.player.name,
      victorias: item.player.wins,
      derrotas: item.player.losses,
      winRate: (Number(item.player.winRate) * 100).toFixed(0),
      racha: item.player.currentStreak,
    }));
    const blob = new Blob([JSON.stringify({ jugadores }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `jurones_ranking_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exportado", description: `${jugadores.length} jugadores descargados como JSON.` });
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
        if (!json.jugadores || !Array.isArray(json.jugadores)) {
          setImportParseError('El JSON debe tener un campo "jugadores" como lista.');
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
    try {
      const res = await fetch("/api/players/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminCode: importAdminCode, jugadores: importParsed.jugadores }),
      });
      const data = await res.json();
      if (res.status === 403) {
        toast({ title: "Acceso denegado", description: "Código de administrador inválido.", variant: "destructive" });
        setIsImporting(false);
        return;
      }
      if (!res.ok) {
        toast({ title: "Error", description: data?.error ?? "Error desconocido.", variant: "destructive" });
        setIsImporting(false);
        return;
      }
      setImportResult(data);
      queryClient.invalidateQueries({ queryKey: getGetRankingQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() });
    } catch {
      toast({ title: "Error de red", description: "No se pudo conectar con el servidor.", variant: "destructive" });
    }
    setIsImporting(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="text-center space-y-4 mb-6">
        <Trophy className="w-16 h-16 mx-auto text-primary" />
        <h1 className="text-4xl font-black tracking-tighter uppercase">Global Ranking</h1>
        <p className="text-muted-foreground">Los mejores jugadores del club, clasificados por tasa de victoria.</p>
      </div>

      {/* Action buttons */}
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={handleShare}
          disabled={!ranking || ranking.length === 0}
          className="border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
          title="Compartir"
        >
          <Share2 className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          onClick={handleExport}
          disabled={!ranking || ranking.length === 0}
          className="flex items-center gap-2 border-border hover:border-primary"
        >
          <Download className="h-4 w-4" />
          Exportar JSON
        </Button>
        <Button
          variant="outline"
          onClick={openImport}
          className="flex items-center gap-2 border-primary/40 hover:border-primary"
        >
          <Upload className="h-4 w-4" />
          Importar JSON
        </Button>
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
                <AvatarImage src={avatarSrc(item.player.avatarUrl)} className="object-cover" />
                <AvatarFallback className="bg-primary/20 text-primary font-bold">
                  {item.player.name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-lg truncate">{item.player.name}</h3>
                <div className="flex items-center gap-4 text-sm mt-1">
                  <span className="text-muted-foreground font-medium">{(Number(item.player.winRate) * 100).toFixed(0)}% WR</span>
                  {item.player.currentStreak > 2 && (
                    <span className="flex items-center text-orange-500 font-medium text-xs bg-orange-500/10 px-2 py-0.5 rounded">
                      <Flame className="w-3 h-3 mr-1" /> Racha x{item.player.currentStreak}
                    </span>
                  )}
                </div>
              </div>

              <div className="text-right pl-4 border-l border-border">
                <div className="text-2xl font-black">
                  <span className="text-red-500">{item.player.wins}V</span>
                  <span className="text-muted-foreground mx-1 text-lg">-</span>
                  <span className="text-gray-500">{item.player.losses}D</span>
                </div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">V - D</div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 text-muted-foreground glass-card rounded-2xl">
          Aún no hay suficientes datos para generar el ranking.
        </div>
      )}

      {/* Hidden share card for html2canvas */}
      <div className="absolute left-[-9999px] top-0 pointer-events-none" aria-hidden>
        <div
          ref={shareRef}
          style={{
            width: 480,
            background: "#0f0f13",
            borderRadius: 20,
            padding: "24px 24px 20px",
            fontFamily: "Inter, system-ui, sans-serif",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#f59e0b", letterSpacing: "-0.3px" }}>
              🏆 Global Ranking
            </div>
            <div style={{ flex: 1 }} />
            <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 700, letterSpacing: "0.12em" }}>
              LOS JURONES
            </div>
          </div>
          {(ranking ?? []).slice(0, 10).map((item, index) => (
            <div
              key={item.player.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: index === 0 ? "rgba(245,158,11,0.10)" : index === 1 ? "rgba(203,213,225,0.06)" : index === 2 ? "rgba(180,83,9,0.08)" : "rgba(255,255,255,0.03)",
                borderRadius: 10,
                padding: "8px 12px",
                marginBottom: 5,
                border: `1px solid ${index === 0 ? "rgba(245,158,11,0.25)" : index === 1 ? "rgba(203,213,225,0.15)" : index === 2 ? "rgba(180,83,9,0.20)" : "rgba(255,255,255,0.06)"}`,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 900, color: index === 0 ? "#f59e0b" : index === 1 ? "#cbd5e1" : index === 2 ? "#b45309" : "#6b7280", width: 22, textAlign: "center" }}>
                {index < 3 ? ["🥇","🥈","🥉"][index] : `#${index + 1}`}
              </span>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: "#f3f4f6", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {item.player.name}
              </span>
              <span style={{ fontSize: 12, color: "#9ca3af", marginRight: 8 }}>
                {item.player.wins}V – {item.player.losses}D
              </span>
              <span style={{ fontSize: 16, fontWeight: 900, color: index === 0 ? "#f59e0b" : "#a78bfa", minWidth: 44, textAlign: "right" }}>
                {(Number(item.player.winRate) * 100).toFixed(0)}%
              </span>
            </div>
          ))}
          <div style={{ marginTop: 14, textAlign: "center", fontSize: 10, color: "#374151", letterSpacing: "0.15em", fontWeight: 700 }}>
            LOSJURONESDOMINOCLUB.COM
          </div>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Import Modal */}
      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="glass-card sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Importar Estadísticas (JSON)
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground">
              Formato esperado: <code className="bg-muted px-1 rounded">{"{ \"jugadores\": [{ \"nombre\", \"victorias\", \"derrotas\", \"racha\"? }] }"}</code>
            </p>

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

            {importParseError && (
              <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{importParseError}</span>
              </div>
            )}

            {importParsed && !importParseError && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-sm">
                <div className="flex items-center gap-2 text-green-400 font-medium mb-1">
                  <CheckCircle2 className="h-4 w-4" />
                  Archivo válido
                </div>
                <p className="text-muted-foreground">
                  {importParsed.jugadores.length} jugador{importParsed.jugadores.length !== 1 ? "es" : ""} para actualizar.
                </p>
              </div>
            )}

            {importResult && (
              <div className={`rounded-lg p-3 text-sm border ${importResult.updated > 0 ? "bg-green-500/10 border-green-500/30" : "bg-muted border-border"}`}>
                <p className="font-medium mb-1">
                  {importResult.updated > 0 ? "✅ Estadísticas actualizadas" : "Sin cambios"}
                </p>
                <ul className="text-muted-foreground space-y-0.5">
                  <li>✔ Actualizados: <span className="text-foreground font-semibold">{importResult.updated}</span></li>
                  {importResult.notFound > 0 && (
                    <li>⚠ No encontrados: <span className="text-foreground font-semibold">{importResult.notFound}</span></li>
                  )}
                </ul>
                {importResult.errors.length > 0 && (
                  <ul className="mt-2 space-y-1 text-destructive text-xs">
                    {importResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                )}
              </div>
            )}

            {!importResult && (
              <div className="grid gap-2 pt-2 border-t border-border">
                <Label>Código de Admin</Label>
                <Input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={importAdminCode}
                  onChange={(e) => setImportAdminCode(e.target.value)}
                  placeholder="••••••"
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
