import React, { useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  useListEvents,
  useCreateEvent,
  useUpdateEvent,
  useDeleteEvent,
  getListEventsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Calendar as CalendarIcon, MapPin, Clock, Users, Plus, Pencil, Trash2, Clipboard, Share2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import html2canvas from "html2canvas";

type EventType = {
  id: number;
  title: string;
  description?: string | null;
  date: string;
  time?: string | null;
  location?: string | null;
  mapsUrl?: string | null;
  attendees?: string[] | null;
};

const EMPTY_FORM = { title: "", description: "", date: "", time: "", location: "", mapsUrl: "" };

function MapsUrlInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const { toast } = useToast();

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      onChange(text.trim());
      toast({ title: "Pegado", description: "URL de Google Maps pegada." });
    } catch {
      toast({
        title: "Sin acceso al portapapeles",
        description: "Permiso denegado. Pega manualmente.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex gap-2">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://maps.app.goo.gl/..."
        className="bg-background flex-1"
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={handlePaste}
        title="Pegar desde portapapeles"
        className="shrink-0"
      >
        <Clipboard className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default function Events() {
  const { data: events, isLoading } = useListEvents();
  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();
  const deleteEvent = useDeleteEvent();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const shareRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const handleShareEvent = async (event: EventType) => {
    const el = shareRefs.current[event.id];
    if (!el) return;
    try {
      const canvas = await html2canvas(el, {
        backgroundColor: "#0f0f13",
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
      });
      const url = canvas.toDataURL("image/jpeg", 0.92);
      const a = document.createElement("a");
      a.href = url;
      a.download = `jurones_evento_${event.id}.jpg`;
      a.click();
      toast({ title: "¡Imagen generada!", description: `Tarjeta del evento "${event.title}" descargada.` });
    } catch {
      toast({ title: "Error", description: "No se pudo generar la imagen.", variant: "destructive" });
    }
  };

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);

  const [editTarget, setEditTarget] = useState<EventType | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);

  const [deleteTarget, setDeleteTarget] = useState<EventType | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListEventsQueryKey() });

  const handleCreate = () => {
    if (!formData.title || !formData.date) {
      toast({ title: "Error", description: "Título y fecha son obligatorios", variant: "destructive" });
      return;
    }
    createEvent.mutate(
      { data: formData },
      {
        onSuccess: () => {
          invalidate();
          setIsCreateOpen(false);
          setFormData(EMPTY_FORM);
          toast({ title: "Evento creado", description: "El evento ha sido programado." });
        },
      }
    );
  };

  const openEdit = (ev: EventType) => {
    setEditTarget(ev);
    setEditForm({
      title: ev.title,
      description: ev.description ?? "",
      date: ev.date,
      time: ev.time ?? "",
      location: ev.location ?? "",
      mapsUrl: ev.mapsUrl ?? "",
    });
  };

  const handleEdit = () => {
    if (!editTarget) return;
    if (!editForm.title || !editForm.date) {
      toast({ title: "Error", description: "Título y fecha son obligatorios", variant: "destructive" });
      return;
    }
    updateEvent.mutate(
      { id: editTarget.id, data: editForm },
      {
        onSuccess: () => {
          invalidate();
          setEditTarget(null);
          toast({ title: "Evento actualizado" });
        },
      }
    );
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteEvent.mutate(
      { id: deleteTarget.id },
      {
        onSuccess: () => {
          invalidate();
          setDeleteTarget(null);
          toast({ title: "Evento eliminado" });
        },
      }
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Eventos</h1>
          <p className="text-muted-foreground mt-1">Torneos y reuniones del club.</p>
        </div>

        <Button className="rounded-full shadow-lg font-bold" onClick={() => setIsCreateOpen(true)}>
          <Plus className="mr-2 h-5 w-5" /> Nuevo Evento
        </Button>
      </div>

      {/* ── Event Cards ─────────────────────────────────────────────── */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <div className="col-span-full text-center py-20 text-muted-foreground">Cargando eventos...</div>
        ) : events && events.length > 0 ? (
          events.map((event, index) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="glass-card h-full flex flex-col hover:border-primary/50 transition-colors">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-xl leading-tight">{event.title}</CardTitle>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        title="Compartir evento"
                        onClick={() => handleShareEvent(event as EventType)}
                      >
                        <Share2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        title="Editar evento"
                        onClick={() => openEdit(event as EventType)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        title="Eliminar evento"
                        onClick={() => setDeleteTarget(event as EventType)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 space-y-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CalendarIcon className="h-4 w-4 text-primary" />
                      {format(new Date(event.date), "EEEE d 'de' MMMM, yyyy", { locale: es })}
                    </div>
                    {event.time && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-4 w-4 text-primary" />
                        {event.time}
                      </div>
                    )}
                    {event.location && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="h-4 w-4 text-primary" />
                        {event.mapsUrl ? (
                          <a href={event.mapsUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                            {event.location}
                          </a>
                        ) : (
                          event.location
                        )}
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Users className="h-4 w-4 text-primary" />
                      {event.attendees?.length || 0} asistentes confirmados
                    </div>
                  </div>
                  {event.description && (
                    <p className="text-sm text-muted-foreground border-t border-border pt-4 mt-4">
                      {event.description}
                    </p>
                  )}
                </CardContent>
                <CardFooter className="pt-0">
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={() => toast({ title: "Asistencia", description: "Función de asistencia próximamente..." })}
                  >
                    Asistiré
                  </Button>
                </CardFooter>
              </Card>

              {/* Hidden share card per event */}
              <div className="absolute left-[-9999px] top-0 pointer-events-none" aria-hidden>
                <div
                  ref={(el) => { shareRefs.current[(event as EventType).id] = el; }}
                  style={{
                    width: 480,
                    background: "#0f0f13",
                    borderRadius: 20,
                    padding: "28px 28px 22px",
                    fontFamily: "Inter, system-ui, sans-serif",
                  }}
                >
                  {/* Club tag */}
                  <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 700, letterSpacing: "0.18em", marginBottom: 14 }}>
                    LOS JURONES DOMINO CLUB
                  </div>
                  {/* Title */}
                  <div style={{ fontSize: 24, fontWeight: 900, color: "#f3f4f6", lineHeight: 1.2, marginBottom: 16 }}>
                    {(event as EventType).title}
                  </div>
                  {/* Divider */}
                  <div style={{ height: 1, background: "rgba(255,255,255,0.08)", marginBottom: 16 }} />
                  {/* Date */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 14, color: "#a78bfa" }}>📅</span>
                    <span style={{ fontSize: 14, color: "#d1d5db", fontWeight: 600 }}>
                      {format(new Date((event as EventType).date), "EEEE d 'de' MMMM, yyyy", { locale: es })}
                    </span>
                  </div>
                  {(event as EventType).time && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <span style={{ fontSize: 14, color: "#a78bfa" }}>🕐</span>
                      <span style={{ fontSize: 14, color: "#d1d5db", fontWeight: 600 }}>{(event as EventType).time}</span>
                    </div>
                  )}
                  {(event as EventType).location && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <span style={{ fontSize: 14, color: "#a78bfa" }}>📍</span>
                      <span style={{ fontSize: 14, color: "#d1d5db", fontWeight: 600 }}>{(event as EventType).location}</span>
                    </div>
                  )}
                  {(event as EventType).description && (
                    <div style={{ marginTop: 14, padding: "12px 14px", background: "rgba(255,255,255,0.04)", borderRadius: 10, fontSize: 13, color: "#9ca3af", lineHeight: 1.5 }}>
                      {(event as EventType).description}
                    </div>
                  )}
                  <div style={{ marginTop: 18, textAlign: "center", fontSize: 10, color: "#374151", letterSpacing: "0.15em", fontWeight: 700 }}>
                    LOSJURONESDOMINOCLUB.COM
                  </div>
                </div>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="col-span-full text-center py-20 text-muted-foreground glass-card rounded-2xl">
            No hay eventos programados.
          </div>
        )}
      </div>

      {/* ── Create Dialog ────────────────────────────────────────────── */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="glass-card sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Programar Evento</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Título</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="bg-background"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Fecha</Label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="bg-background [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
                />
              </div>
              <div className="grid gap-2">
                <Label>Hora (Opcional)</Label>
                <Input
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  className="bg-background [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Ubicación</Label>
              <Input
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="Ej. Casa de Juan"
                className="bg-background"
              />
            </div>
            <div className="grid gap-2">
              <Label>Google Maps URL (Opcional)</Label>
              <MapsUrlInput
                value={formData.mapsUrl}
                onChange={(v) => setFormData({ ...formData, mapsUrl: v })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Descripción</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="bg-background"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreate} disabled={createEvent.isPending} className="w-full">
              {createEvent.isPending ? "Creando..." : "Crear Evento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ──────────────────────────────────────────────── */}
      <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) setEditTarget(null); }}>
        <DialogContent className="glass-card sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar Evento</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Título</Label>
              <Input
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                className="bg-background"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Fecha</Label>
                <Input
                  type="date"
                  value={editForm.date}
                  onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                  className="bg-background [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
                />
              </div>
              <div className="grid gap-2">
                <Label>Hora (Opcional)</Label>
                <Input
                  type="time"
                  value={editForm.time}
                  onChange={(e) => setEditForm({ ...editForm, time: e.target.value })}
                  className="bg-background [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Ubicación</Label>
              <Input
                value={editForm.location}
                onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                placeholder="Ej. Casa de Juan"
                className="bg-background"
              />
            </div>
            <div className="grid gap-2">
              <Label>Google Maps URL (Opcional)</Label>
              <MapsUrlInput
                value={editForm.mapsUrl}
                onChange={(v) => setEditForm({ ...editForm, mapsUrl: v })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Descripción</Label>
              <Textarea
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                className="bg-background"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleEdit} disabled={updateEvent.isPending} className="w-full">
              {updateEvent.isPending ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ───────────────────────────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent className="glass-card">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar evento?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará <span className="font-semibold text-foreground">"{deleteTarget?.title}"</span> permanentemente.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteEvent.isPending ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
