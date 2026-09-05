import { useState } from "react";
import { Redirect } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useDevMode } from "@/contexts/dev-mode-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

const AREAS = [
  ["players", "Jugadores", "Incluye jugadores, turnos y todas las columnas cacheadas de ranking y puntos."],
  ["matches", "Partidas", "Incluye partidas, jugadores de partida y registro de puntos; representa records, puntuación y el historial de lisas."],
  ["events", "Eventos", "Calendario y asistentes."],
  ["rules", "Reglas", "Configuración de reglas."],
  ["tournaments", "Torneos", "Torneos, equipos y partidas de torneo."],
] as const;
type Group = (typeof AREAS)[number][0];
const api = async (url: string, code: string, options?: RequestInit) => {
  const response = await fetch(`/api/backup${url}`, { ...options, headers: { ...options?.headers, "x-admin-code": code } });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error ?? "La operación falló.");
  return value;
};

export default function Backup() {
  const { isDevMode } = useDevMode();
  const client = useQueryClient();
  const [selected, setSelected] = useState<Group[]>(AREAS.map(([id]) => id));
  const [automatic, setAutomatic] = useState<Group[]>(AREAS.map(([id]) => id));
  const [files, setFiles] = useState<any[]>([]);
  const [config, setConfig] = useState<any>();
  const [code, setCode] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const toggle = (id: Group, setter: (value: Group[]) => void, values: Group[]) => setter(values.includes(id) ? values.filter((item) => item !== id) : [...values, id]);
  const refresh = async () => {
    if (!isDevMode || !code.trim()) return;
    try { const [nextConfig, nextFiles] = await Promise.all([api("/config", code), api("/files", code)]); setConfig(nextConfig); setFiles(nextFiles); setAutomatic(nextConfig.automaticGroups ?? []); }
    catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo cargar Drive."); }
  };
  if (!isDevMode) return <Redirect to="/dashboard" />;
  const run = async (action: () => Promise<unknown>, success: string) => {
    try { await action(); setMessage(success); await refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : "Error."); }
  };
  return <main className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
    <header><h1 className="text-3xl font-bold">Respaldo (desarrollo)</h1><p className="text-muted-foreground">Google Drive · carpeta <b>losjuronesbackup</b> · referencia: osjuronesdominoclub@gmail.com</p></header>
    <div className="flex gap-2"><Input value={code} onChange={(event) => setCode(event.target.value)} type="password" placeholder="Código de administrador" /><Button disabled={!code.trim()} onClick={() => void refresh()}>Cargar configuración</Button></div>
    {message && <p className="rounded bg-muted p-3 text-sm">{message}</p>}
    <section className="rounded-lg border p-5 space-y-3"><h2 className="text-xl font-semibold">Respaldo manual</h2>
      {AREAS.map(([id, label, description]) => <label key={id} className="flex gap-3"><Checkbox checked={selected.includes(id)} onCheckedChange={() => toggle(id, setSelected, selected)} /><span><b>{label}</b><small className="block text-muted-foreground">{description}</small></span></label>)}
      <Button disabled={!selected.length || !code.trim()} onClick={() => void run(() => api("/create", code, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ adminCode: code, groups: selected }) }), "Respaldo creado en Drive.")}>Crear respaldo</Button>
    </section>
    <section className="rounded-lg border p-5 space-y-3"><h2 className="text-xl font-semibold">Automático · 2:00 AM America/Santo_Domingo</h2>
      {AREAS.map(([id, label]) => <label key={id} className="mr-5 inline-flex gap-2"><Checkbox checked={automatic.includes(id)} onCheckedChange={() => toggle(id, setAutomatic, automatic)} />{label}</label>)}
       <div><Button disabled={!automatic.length || !code.trim()} variant="secondary" onClick={() => void run(() => api("/config", code, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ adminCode: code, automaticGroups: automatic }) }), "Configuración automática guardada.")}>Guardar selección</Button></div>
      {config && <small className="text-muted-foreground">Último estado: {config.lastStatus ?? "sin ejecuciones"} {config.lastRunAt ? `· ${new Date(config.lastRunAt).toLocaleString()}` : ""} {config.lastError ? `· ${config.lastError}` : ""}</small>}
    </section>
    <section className="rounded-lg border p-5 space-y-3"><h2 className="text-xl font-semibold">Restaurar</h2><p className="text-sm text-destructive">Destructivo: escribe <b>RESTAURAR LOS JURONES</b> y selecciona las áreas a reemplazar. La restauración es una única transacción.</p>
      <Input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="RESTAURAR LOS JURONES" />
      {files.length === 0 ? <p className="text-muted-foreground">Carga la configuración para ver los respaldos disponibles.</p> : files.map((file) => <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3" key={file.id}><span>{file.name}<small className="block text-muted-foreground">{file.createdTime} · {file.size ?? "?"} bytes · Áreas: {file.manifest?.groups?.join(", ") ?? "sin manifiesto"}</small></span><Button variant="destructive" disabled={confirmation !== "RESTAURAR LOS JURONES" || !selected.length || !code.trim()} onClick={() => void run(async () => { const result = await api("/restore", code, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ adminCode: code, confirmation, fileId: file.id, groups: selected }) }); await client.invalidateQueries(); return result; }, "Restauración completada; datos actualizados.")}>Restaurar áreas seleccionadas</Button></div>)}
    </section>
  </main>;
}