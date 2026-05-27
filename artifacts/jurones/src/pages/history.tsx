import React, { useState } from "react";
import { motion } from "framer-motion";
import { useListMatches, useUpdateMatch, useDeleteMatch, getListMatchesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { History as HistoryIcon, Edit2, Trash2, Trophy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function History() {
  const { data: matches, isLoading } = useListMatches({ status: "finished" });
  const updateMatch = useUpdateMatch();
  const deleteMatch = useDeleteMatch();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [selectedMatch, setSelectedMatch] = useState<any>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [adminCode, setAdminCode] = useState("");
  const [formData, setFormData] = useState({ shortosScore: 0, largosScore: 0 });

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
        winnerTeam: formData.shortosScore >= 200 ? 'cortos' : formData.largosScore >= 200 ? 'largos' : selectedMatch.winnerTeam
      } 
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListMatchesQueryKey({ status: "finished" }) });
        setIsEditOpen(false);
        toast({ title: "Partida actualizada", description: "Los cambios han sido guardados." });
      },
      onError: () => {
        toast({ title: "Error", description: "Código de administrador inválido o error al guardar.", variant: "destructive" });
      }
    });
  };

  const handleDelete = () => {
    if (!selectedMatch || !adminCode) return;
    // Assuming backend delete endpoint accepts adminCode in body
    fetch(`/api/matches/${selectedMatch.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminCode })
    }).then(res => {
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: getListMatchesQueryKey({ status: "finished" }) });
        setIsDeleteOpen(false);
        toast({ title: "Partida eliminada", description: "El registro ha sido borrado." });
      } else {
        toast({ title: "Error", description: "Código de administrador inválido.", variant: "destructive" });
      }
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-muted rounded-full">
          <HistoryIcon className="h-6 w-6 text-foreground" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Records</h1>
          <p className="text-muted-foreground">Historial de partidas finalizadas.</p>
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
                <CardContent className="p-6 flex flex-col sm:flex-row items-center justify-between gap-6">
                  <div className="flex flex-col items-center sm:items-start text-center sm:text-left min-w-[120px]">
                    <span className="text-sm text-muted-foreground">Partida #{match.matchNumber}</span>
                    <span className="text-xs text-muted-foreground">{new Date(match.finishedAt || match.createdAt).toLocaleDateString()}</span>
                  </div>

                  <div className="flex items-center gap-8 flex-1 justify-center">
                    <div className={`flex flex-col items-center ${match.winnerTeam === 'cortos' ? 'text-red-500 scale-110 font-bold' : 'text-muted-foreground'}`}>
                      <span className="uppercase text-xs tracking-widest mb-1">Cortos</span>
                      <span className="text-4xl tabular-nums">{match.shortosScore}</span>
                      {match.winnerTeam === 'cortos' && <Trophy className="h-4 w-4 mt-1" />}
                    </div>
                    
                    <div className="text-muted-foreground font-light text-xl">VS</div>

                    <div className={`flex flex-col items-center ${match.winnerTeam === 'largos' ? 'text-blue-500 scale-110 font-bold' : 'text-muted-foreground'}`}>
                      <span className="uppercase text-xs tracking-widest mb-1">Largos</span>
                      <span className="text-4xl tabular-nums">{match.largosScore}</span>
                      {match.winnerTeam === 'largos' && <Trophy className="h-4 w-4 mt-1" />}
                    </div>
                  </div>

                  <div className="flex opacity-0 group-hover:opacity-100 transition-opacity gap-2">
                    <Button variant="ghost" size="icon" className="hover:text-primary" onClick={() => openEdit(match)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="hover:text-destructive" onClick={() => openDelete(match)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
                  onChange={e => setFormData({...formData, shortosScore: parseInt(e.target.value) || 0})}
                  className="bg-background text-center text-xl"
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-blue-500">Puntos Largos</Label>
                <Input 
                  type="number" 
                  value={formData.largosScore} 
                  onChange={e => setFormData({...formData, largosScore: parseInt(e.target.value) || 0})}
                  className="bg-background text-center text-xl"
                />
              </div>
            </div>
            <div className="grid gap-2 mt-4 pt-4 border-t border-border">
              <Label>Código de Admin</Label>
              <Input 
                type="password" 
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
    </div>
  );
}
