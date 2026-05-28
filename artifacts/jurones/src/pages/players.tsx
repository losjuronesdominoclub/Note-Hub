import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Edit2, Trash2, Trophy, Flame, Camera, Upload, X, BarChart2, CheckCircle2, XCircle } from "lucide-react";
import { useListPlayers, useCreatePlayer, useUpdatePlayer, useDeletePlayer, getListPlayersQueryKey, getGetRankingQueryKey } from "@workspace/api-client-react";
import { useUpload } from "@workspace/object-storage-web";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

function avatarSrc(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http")) return path;
  const slug = path.startsWith("/objects/") ? path.slice("/objects/".length) : path;
  return `/api/storage/objects/${slug}`;
}

interface AvatarPickerProps {
  value: string;
  onChange: (path: string) => void;
  initials: string;
}

function AvatarPicker({ value, onChange, initials }: AvatarPickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const { toast } = useToast();

  const { uploadFile, isUploading, progress } = useUpload({
    onSuccess: (res) => {
      onChange(res.objectPath);
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo subir la foto.", variant: "destructive" });
    },
  });

  const handleFile = async (file: File) => {
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    await uploadFile(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const displaySrc = preview ?? avatarSrc(value);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative group cursor-pointer">
        <Avatar className="h-24 w-24 border-2 border-dashed border-border group-hover:border-primary transition-colors">
          <AvatarImage src={displaySrc} className="object-cover" />
          <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
            {initials || "?"}
          </AvatarFallback>
        </Avatar>
        {isUploading && (
          <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center">
            <span className="text-white text-xs font-bold">{progress}%</span>
          </div>
        )}
        {(preview || value) && !isUploading && (
          <button
            type="button"
            onClick={() => { setPreview(null); onChange(""); }}
            className="absolute -top-1 -right-1 bg-destructive rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="h-3 w-3 text-white" />
          </button>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isUploading}
          onClick={() => fileInputRef.current?.click()}
          className="gap-1.5 text-xs"
        >
          <Upload className="h-3.5 w-3.5" /> Subir foto
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isUploading}
          onClick={() => cameraInputRef.current?.click()}
          className="gap-1.5 text-xs"
        >
          <Camera className="h-3.5 w-3.5" /> Tomar foto
        </Button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleInputChange}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleInputChange}
      />
    </div>
  );
}

export default function Players() {
  const { data: players, isLoading } = useListPlayers();
  const createPlayer = useCreatePlayer();
  const updatePlayer = useUpdatePlayer();
  const deletePlayer = useDeletePlayer();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);

  const [formData, setFormData] = useState({ name: "", avatarUrl: "" });

  // Stats edit state — two steps: code verification → fields
  const [statsStep, setStatsStep] = useState<"code" | "fields">("code");
  const [statsCode, setStatsCode] = useState("");
  const [statsCodeError, setStatsCodeError] = useState(false);
  const [statsData, setStatsData] = useState({ wins: 0, losses: 0 });

  const handleCreate = () => {
    if (!formData.name.trim()) return;
    createPlayer.mutate({ data: { name: formData.name, avatarUrl: formData.avatarUrl || undefined } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() });
        setIsCreateOpen(false);
        setFormData({ name: "", avatarUrl: "" });
        toast({ title: "Jugador creado", description: "El jugador ha sido creado exitosamente." });
      },
    });
  };

  const handleEdit = () => {
    if (!formData.name.trim() || !selectedPlayer) return;
    updatePlayer.mutate({ id: selectedPlayer.id, data: { name: formData.name, avatarUrl: formData.avatarUrl || undefined } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() });
        setIsEditOpen(false);
        toast({ title: "Jugador actualizado", description: "El jugador ha sido actualizado." });
      },
    });
  };

  const handleDelete = () => {
    if (!selectedPlayer) return;
    deletePlayer.mutate({ id: selectedPlayer.id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() });
        setIsDeleteOpen(false);
        toast({ title: "Jugador eliminado", description: "El jugador ha sido eliminado." });
      },
    });
  };

  const openEdit = (player: any) => {
    setSelectedPlayer(player);
    setFormData({ name: player.name, avatarUrl: player.avatarUrl || "" });
    setIsEditOpen(true);
  };

  const openDelete = (player: any) => {
    setSelectedPlayer(player);
    setIsDeleteOpen(true);
  };

  const openStats = (player: any) => {
    setSelectedPlayer(player);
    setStatsStep("code");
    setStatsCode("");
    setStatsCodeError(false);
    setStatsData({ wins: player.wins ?? 0, losses: player.losses ?? 0 });
    setIsStatsOpen(true);
  };

  const handleVerifyCode = () => {
    if (statsCode === "110880") {
      setStatsCodeError(false);
      setStatsStep("fields");
    } else {
      setStatsCodeError(true);
    }
  };

  const handleSaveStats = () => {
    if (!selectedPlayer) return;
    updatePlayer.mutate(
      { id: selectedPlayer.id, data: { wins: statsData.wins, losses: statsData.losses } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetRankingQueryKey() });
          setIsStatsOpen(false);
          toast({ title: "Estadísticas actualizadas", description: `${selectedPlayer.name} — ${statsData.wins}V / ${statsData.losses}D` });
        },
        onError: () => {
          toast({ title: "Error", description: "No se pudieron guardar los cambios.", variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Jugadores</h1>
          <p className="text-muted-foreground mt-1">Gestiona los miembros del club.</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={(o) => { setIsCreateOpen(o); if (!o) setFormData({ name: "", avatarUrl: "" }); }}>
          <DialogTrigger asChild>
            <Button className="rounded-full shadow-lg font-bold">
              <Plus className="mr-2 h-5 w-5" /> Nuevo Jugador
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-card sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Crear Jugador</DialogTitle>
            </DialogHeader>
            <div className="grid gap-5 py-4">
              <AvatarPicker
                value={formData.avatarUrl}
                onChange={(p) => setFormData({ ...formData, avatarUrl: p })}
                initials={formData.name.substring(0, 2).toUpperCase()}
              />
              <div className="grid gap-2">
                <Label htmlFor="name">Nombre</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej. Juan Pérez"
                  className="bg-background"
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={createPlayer.isPending || !formData.name.trim()} className="w-full">
                {createPlayer.isPending ? "Creando..." : "Crear Jugador"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence>
          {isLoading ? (
            <div className="col-span-full text-center py-12 text-muted-foreground">Cargando jugadores...</div>
          ) : players?.length === 0 ? (
            <div className="col-span-full text-center py-12 text-muted-foreground">No hay jugadores registrados.</div>
          ) : (
            players?.map((player, index) => (
              <motion.div
                key={player.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="glass-card overflow-hidden group">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-16 w-16 border-2 border-primary/20">
                          <AvatarImage src={avatarSrc(player.avatarUrl)} className="object-cover" />
                          <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
                            {player.name.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-bold text-lg">{player.name}</h3>
                          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1"><Trophy className="h-3 w-3 text-yellow-500" /> {player.wins}V - {player.losses}D</span>
                            <span className="flex items-center gap-1"><Flame className="h-3 w-3 text-orange-500" /> Racha: {player.currentStreak}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => openEdit(player)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => openDelete(player)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-border flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Win Rate</span>
                      <span className="font-bold text-primary">{(Number(player.winRate) * 100).toFixed(2)}%</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-3 gap-2 text-xs border-border hover:border-primary hover:text-primary"
                      onClick={() => openStats(player)}
                    >
                      <BarChart2 className="h-3.5 w-3.5" />
                      Editar Estadísticas
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Edit dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="glass-card sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar Jugador</DialogTitle>
          </DialogHeader>
          <div className="grid gap-5 py-4">
            <AvatarPicker
              value={formData.avatarUrl}
              onChange={(p) => setFormData({ ...formData, avatarUrl: p })}
              initials={formData.name.substring(0, 2).toUpperCase()}
            />
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Nombre</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="bg-background"
                onKeyDown={(e) => e.key === "Enter" && handleEdit()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleEdit} disabled={updatePlayer.isPending || !formData.name.trim()} className="w-full">
              {updatePlayer.isPending ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="glass-card sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>¿Eliminar jugador?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground py-4">
            Esta acción no se puede deshacer. ¿Estás seguro de que deseas eliminar a {selectedPlayer?.name}?
          </p>
          <DialogFooter className="flex gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deletePlayer.isPending}>
              {deletePlayer.isPending ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stats edit dialog */}
      <Dialog open={isStatsOpen} onOpenChange={(o) => { setIsStatsOpen(o); if (!o) { setStatsCode(""); setStatsCodeError(false); setStatsStep("code"); } }}>
        <DialogContent className="glass-card sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart2 className="h-5 w-5 text-primary" />
              Editar Estadísticas — {selectedPlayer?.name}
            </DialogTitle>
          </DialogHeader>

          {statsStep === "code" ? (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">Ingresa el código de administrador para modificar las estadísticas.</p>
              <div className="grid gap-2">
                <Label>Código secreto</Label>
                <Input
                  type="password"
                  value={statsCode}
                  onChange={(e) => { setStatsCode(e.target.value); setStatsCodeError(false); }}
                  placeholder="••••••"
                  className="bg-background text-center text-xl tracking-widest"
                  onKeyDown={(e) => e.key === "Enter" && handleVerifyCode()}
                  autoFocus
                />
                {statsCodeError && (
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <XCircle className="h-4 w-4 shrink-0" />
                    Código incorrecto
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsStatsOpen(false)} className="flex-1">Cancelar</Button>
                <Button onClick={handleVerifyCode} disabled={!statsCode} className="flex-1">Verificar</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-2 text-sm text-green-400 mb-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Código verificado correctamente
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label className="text-green-400 font-semibold">Victorias</Label>
                  <Input
                    type="number"
                    min={0}
                    value={statsData.wins}
                    onChange={(e) => setStatsData({ ...statsData, wins: parseInt(e.target.value) || 0 })}
                    className="bg-background text-center text-2xl font-bold"
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-red-400 font-semibold">Derrotas</Label>
                  <Input
                    type="number"
                    min={0}
                    value={statsData.losses}
                    onChange={(e) => setStatsData({ ...statsData, losses: parseInt(e.target.value) || 0 })}
                    className="bg-background text-center text-2xl font-bold"
                  />
                </div>
              </div>
              <div className="rounded-lg bg-muted/40 p-3 text-center text-sm text-muted-foreground">
                Win Rate resultante:{" "}
                <span className="font-bold text-primary">
                  {statsData.wins + statsData.losses > 0
                    ? ((statsData.wins / (statsData.wins + statsData.losses)) * 100).toFixed(2)
                    : "0.00"}%
                </span>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsStatsOpen(false)} className="flex-1">Cancelar</Button>
                <Button onClick={handleSaveStats} disabled={updatePlayer.isPending} className="flex-1">
                  {updatePlayer.isPending ? "Guardando..." : "Guardar Cambios"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
