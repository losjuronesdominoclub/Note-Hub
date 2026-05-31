import React, { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import {
  BookOpen, Search, Share2, Printer, Copy, Pencil, Check, Volume2, VolumeX, ChevronDown, ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useDevMode } from "@/contexts/dev-mode-context";
import ScrollToTop from "@/components/scroll-to-top";
import { jsPDF } from "jspdf";

// ─── Rules data ───────────────────────────────────────────────────────────────

interface Segment {
  id: string;
  title: string;
  items: { text: string; bullet?: boolean }[];
}

const DEFAULT_SEGMENTS: Segment[] = [
  {
    id: "comportamiento",
    title: "Comportamiento y actitud",
    items: [
      { text: "Los jugadores se sentarán en la mesa, cada uno frente a su compañero. Se saludarán al iniciar el encuentro y al finalizarlo." },
      { text: "No podrán hablar durante la jugada. Solo se permite un breve comentario al finalizar la mano." },
      { text: "No se golpeará la mesa al colocar una ficha. Todas las fichas deberán jugarse de forma natural." },
      { text: "No se permiten gestos, alborotos, burlas ni faltas de respeto." },
      { text: "No se permite mentir ni falsear información relacionada con el juego." },
      { text: "Participarán cuatro jugadores en parejas cruzadas utilizando un dominó de 28 fichas." },
      { text: "Cada jugador recibirá siete fichas." },
      { text: "El juego se desarrollará siguiendo el turno hacia la derecha (sentido contrario a las agujas del reloj)." },
      { text: "Solo se juega por dos caras." },
    ],
  },
  {
    id: "posicion",
    title: "Posición y primera salida",
    items: [
      { text: "La salida oficial será con el doble seis (6-6)." },
      { text: "El jugador que baraja será el último en tomar las fichas." },
      { text: "Las fichas se colocarán de pie sobre la mesa y no podrán cambiarse de posición." },
      { text: "El jugador con la salida colocará la ficha inicial en el centro de la mesa." },
      { text: "El segundo jugador continuará el orden de juego establecido." },
      { text: "El tercer y cuarto jugador procederán de la misma manera." },
      { text: "No se permite lanzar las fichas." },
      { text: "Ninguna valla podrá interactuar con un jugador durante una partida en curso." },
    ],
  },
  {
    id: "puntuaciones",
    title: "Puntuaciones",
    items: [
      { text: "Ganará la mano el jugador que se quede sin fichas primero." },
      { text: "Se sumarán los puntos de todas las fichas no jugadas." },
      { text: "Los puntos se registrarán en la aplicación oficial hasta alcanzar 200 puntos." },
      { text: "La pareja contraria verificará las anotaciones." },
      { text: "En caso de tranque, ganará quien tenga menor cantidad de puntos." },
      { text: "En caso de empate, se aplicará el reglamento establecido." },
    ],
  },
  {
    id: "sistema",
    title: "Sistema de puntuaciones",
    items: [
      { text: "30 puntos: salida por una cara.", bullet: true },
      { text: "60 puntos: salida por dos caras.", bullet: true },
      { text: "30 puntos: pase corrido.", bullet: true },
      { text: "30 puntos: salida equivocada.", bullet: true },
      { text: "30 puntos: levantar una ficha incorrectamente.", bullet: true },
      { text: "60 puntos: pase teniendo ficha para jugar.", bullet: true },
      { text: "60 puntos: chivo.", bullet: true },
    ],
  },
  {
    id: "sanciones",
    title: "Reglamento de Sanciones",
    items: [
      { text: "Faltas leves, graves y muy graves según el reglamento aprobado por el club, incluyendo sanciones que van desde advertencias verbales hasta expulsión definitiva del club." },
      { text: "Todo miembro deberá mantener el respeto, aceptar las decisiones arbitrales, promover el juego limpio, cuidar las instalaciones y representar dignamente al club. Las vallas deberán mantenerse neutrales durante las partidas." },
    ],
  },
  {
    id: "directiva",
    title: "Facultad de la Directiva",
    items: [
      { text: "La directiva tendrá la potestad de investigar cualquier incidente y aplicar las sanciones correspondientes garantizando el derecho de defensa del miembro afectado." },
    ],
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function segmentToText(seg: Segment): string {
  const lines = seg.items.map((item, i) =>
    item.bullet ? `• ${item.text}` : `${i + 1}. ${item.text}`
  );
  return `${seg.title}\n\n${lines.join("\n")}`;
}

function allText(segments: Segment[]): string {
  return [
    "LOS JURONES DOMINO CLUB",
    "NORMAS Y REGLAS GENERALES DE JUEGO",
    "",
    ...segments.map((s) => segmentToText(s) + "\n"),
  ].join("\n");
}

// ─── SegmentCard ─────────────────────────────────────────────────────────────

function SegmentCard({
  segment,
  editMode,
  onEdit,
}: {
  segment: Segment;
  editMode: boolean;
  onEdit: (id: string, updated: Segment) => void;
}) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [collapsed, setCollapsed] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(segmentToText(segment));
    toast({ title: "Copiado", description: `"${segment.title}" copiado al portapapeles.` });
  }, [segment, toast]);

  const handleEditOpen = () => {
    setDraft(segmentToText(segment));
    setEditing(true);
  };

  const handleEditSave = () => {
    const lines = draft.split("\n").filter((l) => l.trim() !== "");
    const title = lines[0] ?? segment.title;
    const items = lines.slice(1).map((l) => {
      const bullet = l.startsWith("•");
      const text = l.replace(/^[•\d]+[.)]\s*/, "").trim();
      return { text, bullet };
    });
    onEdit(segment.id, { ...segment, title, items });
    setEditing(false);
    toast({ title: "Guardado", description: "Segmento actualizado." });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border/50 bg-card overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 bg-primary/5 border-b border-border/40">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex-1 flex items-center gap-3 text-left group"
        >
          <span className="text-base font-bold text-primary tracking-tight group-hover:underline">
            {segment.title}
          </span>
          {collapsed ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto" />
          ) : (
            <ChevronUp className="h-4 w-4 text-muted-foreground ml-auto" />
          )}
        </button>

        <div className="flex items-center gap-1 ml-2">
          {editMode && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-yellow-400"
              title="Editar segmento"
              onClick={handleEditOpen}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-primary"
            title="Copiar segmento"
            onClick={handleCopy}
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Body */}
      {!collapsed && (
        <div className="px-5 py-4 space-y-2.5">
          {segment.items.map((item, i) => (
            <div key={i} className="flex gap-3">
              <span className="text-muted-foreground text-sm font-mono mt-0.5 shrink-0 w-6 text-right">
                {item.bullet ? "•" : `${i + 1}.`}
              </span>
              <p className="text-sm text-foreground/90 leading-relaxed">{item.text}</p>
            </div>
          ))}
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-[#141414] border border-border rounded-2xl w-full max-w-lg p-5 space-y-4">
            <h3 className="text-white font-bold text-lg flex items-center gap-2">
              <Pencil className="h-4 w-4 text-yellow-400" /> Editar segmento
            </h3>
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={12}
              className="font-mono text-sm bg-[#1a1a1a] border-[#333] text-gray-200 resize-none"
            />
            <p className="text-xs text-muted-foreground">
              La primera línea es el título. Usa <code>•</code> para viñetas o <code>1.</code> para numerados.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
              <Button onClick={handleEditSave} className="gap-2">
                <Check className="h-4 w-4" /> Guardar
              </Button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Rules() {
  const { toast } = useToast();
  const { isDevMode } = useDevMode();

  const [segments, setSegments] = useState<Segment[]>(DEFAULT_SEGMENTS);
  const [search, setSearch] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const filtered = segments.filter((s) =>
    search.trim() === ""
      ? true
      : s.title.toLowerCase().includes(search.toLowerCase()) ||
        s.items.some((i) => i.text.toLowerCase().includes(search.toLowerCase()))
  );

  const handleEdit = (id: string, updated: Segment) => {
    setSegments((prev) => prev.map((s) => (s.id === id ? updated : s)));
  };

  // ── Print ──
  const handlePrint = () => {
    const content = allText(segments);
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html><head><title>Reglas — Los Jurones</title>
      <style>
        body { font-family: sans-serif; max-width: 700px; margin: 40px auto; color: #111; }
        h1 { font-size: 18px; font-weight: 900; margin-bottom: 4px; }
        h2 { font-size: 14px; font-weight: 700; margin-top: 24px; margin-bottom: 8px; color: #333; }
        p { font-size: 13px; line-height: 1.7; margin: 2px 0; }
        @media print { body { margin: 20px; } }
      </style></head><body>
      <h1>LOS JURONES DOMINO CLUB</h1>
      <p style="color:#666;font-size:12px">NORMAS Y REGLAS GENERALES DE JUEGO</p>
      ${segments.map((s) => `
        <h2>${s.title}</h2>
        ${s.items.map((item, i) => `<p>${item.bullet ? "•" : `${i + 1}.`} ${item.text}</p>`).join("")}
      `).join("")}
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  // ── Share PDF ──
  const handleSharePdf = async () => {
    try {
      const doc = new jsPDF({ unit: "pt", format: "letter" });
      const margin = 50;
      const pageW = doc.internal.pageSize.getWidth();
      const maxW = pageW - margin * 2;
      let y = margin;

      const addText = (text: string, size: number, bold: boolean, color: [number, number, number]) => {
        doc.setFontSize(size);
        doc.setFont("helvetica", bold ? "bold" : "normal");
        doc.setTextColor(...color);
        const lines = doc.splitTextToSize(text, maxW) as string[];
        lines.forEach((line: string) => {
          if (y > doc.internal.pageSize.getHeight() - margin) {
            doc.addPage();
            y = margin;
          }
          doc.text(line, margin, y);
          y += size * 1.4;
        });
      };

      addText("LOS JURONES DOMINO CLUB", 16, true, [30, 30, 30]);
      y += 4;
      addText("NORMAS Y REGLAS GENERALES DE JUEGO", 11, false, [100, 100, 100]);
      y += 16;

      segments.forEach((seg) => {
        y += 10;
        addText(seg.title, 13, true, [80, 40, 160]);
        y += 4;
        seg.items.forEach((item, i) => {
          const prefix = item.bullet ? "•" : `${i + 1}.`;
          addText(`${prefix}  ${item.text}`, 10, false, [50, 50, 50]);
        });
      });

      const pdfBlob = doc.output("blob");
      const fileName = "reglas_los_jurones.pdf";
      const file = new File([pdfBlob], fileName, { type: "application/pdf" });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Reglas — Los Jurones" });
      } else {
        const url = URL.createObjectURL(pdfBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast({ title: "PDF descargado", description: "Reglas guardadas como PDF." });
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        toast({ title: "Error", description: "No se pudo generar el PDF.", variant: "destructive" });
      }
    }
  };

  // ── TTS ──
  const handleTts = () => {
    if (!("speechSynthesis" in window)) {
      toast({ title: "No disponible", description: "Tu navegador no soporta síntesis de voz.", variant: "destructive" });
      return;
    }
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    const text = allText(segments);
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "es-ES";
    utter.rate = 0.95;
    utter.onend = () => setIsSpeaking(false);
    utter.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utter);
    setIsSpeaking(true);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="text-center space-y-2 pb-2">
        <BookOpen className="w-14 h-14 mx-auto text-primary" />
        <h1 className="text-3xl font-black tracking-tighter uppercase">Reglas del Club</h1>
        <p className="text-muted-foreground text-sm">
          LOS JURONES DOMINO CLUB — Normas y Reglamento General
        </p>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar segmento o regla…"
            className="pl-9"
          />
        </div>

        {/* TTS */}
        <Button
          variant="outline"
          onClick={handleTts}
          className={`gap-2 ${isSpeaking ? "border-green-500/50 text-green-400 bg-green-500/10" : ""}`}
          title={isSpeaking ? "Detener narración" : "Narrador TTS"}
        >
          {isSpeaking ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          <span className="hidden sm:inline">{isSpeaking ? "Detener" : "Narrador TTS"}</span>
        </Button>

        {/* Share PDF */}
        <Button
          variant="outline"
          size="icon"
          onClick={handleSharePdf}
          className="border-primary/30 text-primary hover:bg-primary/10"
          title="Compartir PDF"
        >
          <Share2 className="h-4 w-4" />
        </Button>

        {/* Print */}
        <Button
          variant="outline"
          size="icon"
          onClick={handlePrint}
          className="border-border/60 text-muted-foreground hover:text-foreground"
          title="Imprimir"
        >
          <Printer className="h-4 w-4" />
        </Button>

        {/* Edit mode toggle (dev only) */}
        {isDevMode && (
          <Button
            variant={editMode ? "default" : "outline"}
            size="icon"
            onClick={() => setEditMode((m) => !m)}
            title={editMode ? "Desactivar edición" : "Activar edición"}
            className={editMode ? "bg-yellow-500 hover:bg-yellow-600 text-black" : "border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Segments list */}
      <div ref={printRef} className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            No se encontraron segmentos para <strong>"{search}"</strong>.
          </div>
        ) : (
          filtered.map((seg) => (
            <SegmentCard
              key={seg.id}
              segment={seg}
              editMode={editMode}
              onEdit={handleEdit}
            />
          ))
        )}
      </div>

      <ScrollToTop />
    </div>
  );
}
