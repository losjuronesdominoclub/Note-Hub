import React, { useState } from "react";
import { motion } from "framer-motion";
import { useListEvents, useCreateEvent, getListEventsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Calendar as CalendarIcon, MapPin, Clock, Users, Plus } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

export default function Events() {
  const { data: events, isLoading } = useListEvents();
  const createEvent = useCreateEvent();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formData, setFormData] = useState({ title: "", description: "", date: "", time: "", location: "", mapsUrl: "" });

  const handleCreate = () => {
    if (!formData.title || !formData.date) {
      toast({ title: "Error", description: "Título y fecha son obligatorios", variant: "destructive" });
      return;
    }

    createEvent.mutate({ data: formData }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListEventsQueryKey() });
        setIsCreateOpen(false);
        setFormData({ title: "", description: "", date: "", time: "", location: "", mapsUrl: "" });
        toast({ title: "Evento creado", description: "El evento ha sido programado." });
      }
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Eventos</h1>
          <p className="text-muted-foreground mt-1">Torneos y reuniones del club.</p>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-full shadow-lg font-bold">
              <Plus className="mr-2 h-5 w-5" /> Nuevo Evento
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-card sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Programar Evento</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Título</Label>
                <Input 
                  value={formData.title} 
                  onChange={e => setFormData({...formData, title: e.target.value})} 
                  className="bg-background"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Fecha</Label>
                  <Input 
                    type="date" 
                    value={formData.date} 
                    onChange={e => setFormData({...formData, date: e.target.value})} 
                    className="bg-background [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Hora (Opcional)</Label>
                  <Input 
                    type="time" 
                    value={formData.time} 
                    onChange={e => setFormData({...formData, time: e.target.value})} 
                    className="bg-background [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Ubicación</Label>
                <Input 
                  value={formData.location} 
                  onChange={e => setFormData({...formData, location: e.target.value})} 
                  placeholder="Ej. Casa de Juan"
                  className="bg-background"
                />
              </div>
              <div className="grid gap-2">
                <Label>Google Maps URL (Opcional)</Label>
                <Input 
                  value={formData.mapsUrl} 
                  onChange={e => setFormData({...formData, mapsUrl: e.target.value})} 
                  placeholder="https://maps.app.goo.gl/..."
                  className="bg-background"
                />
              </div>
              <div className="grid gap-2">
                <Label>Descripción</Label>
                <Textarea 
                  value={formData.description} 
                  onChange={e => setFormData({...formData, description: e.target.value})} 
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
      </div>

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
                <CardHeader>
                  <CardTitle className="text-xl">{event.title}</CardTitle>
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
                  <Button variant="secondary" className="w-full" onClick={() => {
                    // For demo purposes, not implementing full auth-attendee logic here,
                    // just a simple interaction. 
                    toast({ title: "Asistencia", description: "Función de asistencia próximamente..." });
                  }}>
                    Asistiré
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          ))
        ) : (
          <div className="col-span-full text-center py-20 text-muted-foreground glass-card rounded-2xl">
            No hay eventos programados.
          </div>
        )}
      </div>
    </div>
  );
}
