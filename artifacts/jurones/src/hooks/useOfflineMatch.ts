import { useState, useEffect, useCallback, useRef } from "react";

export type SyncStatus = "synced" | "local" | "offline";

export interface PendingOp {
  id: string;
  endpoint: string;
  method: string;
  body: unknown;
  label: string;
  createdAt: string;
}

export interface MatchSession {
  matchId: number;
  matchNumber?: string;
  updatedAt: string;
  pendingOps: PendingOp[];
  snapshot?: unknown;
}

const ACTIVE_KEY = "jurones_active_match";

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function loadActiveSession(): MatchSession | null {
  try {
    const raw = localStorage.getItem(ACTIVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as MatchSession;
  } catch {
    return null;
  }
}

function saveActiveSession(session: MatchSession): void {
  localStorage.setItem(ACTIVE_KEY, JSON.stringify(session));
}

export function clearActiveSession(): void {
  localStorage.removeItem(ACTIVE_KEY);
}

export function getPendingCount(): number {
  const s = loadActiveSession();
  return s ? s.pendingOps.length : 0;
}

export function useOfflineMatch(
  matchId: number,
  options?: { onSyncComplete?: () => void }
) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingOps, setPendingOps] = useState<PendingOp[]>(() => {
    const s = loadActiveSession();
    return s?.matchId === matchId ? s.pendingOps : [];
  });
  const syncingRef = useRef(false);
  const onSyncCompleteRef = useRef(options?.onSyncComplete);
  onSyncCompleteRef.current = options?.onSyncComplete;

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    const existing = loadActiveSession();
    const base: MatchSession = existing?.matchId === matchId
      ? existing
      : { matchId, updatedAt: new Date().toISOString(), pendingOps: [] };
    saveActiveSession({ ...base, pendingOps, updatedAt: new Date().toISOString() });
  }, [matchId, pendingOps]);

  const syncQueue = useCallback(async (): Promise<boolean> => {
    if (syncingRef.current) return false;
    const ops = pendingOps;
    if (ops.length === 0) { onSyncCompleteRef.current?.(); return true; }
    syncingRef.current = true;
    setIsSyncing(true);
    try {
      for (const op of ops) {
        const res = await fetch(op.endpoint, {
          method: op.method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(op.body),
        });
        if (!res.ok) return false;
      }
      setPendingOps([]);
      clearActiveSession();
      onSyncCompleteRef.current?.();
      return true;
    } catch {
      return false;
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
    }
  }, [pendingOps]);

  useEffect(() => {
    if (isOnline && pendingOps.length > 0 && !syncingRef.current) {
      syncQueue();
    }
  }, [isOnline]);

  const enqueueOp = useCallback((op: Omit<PendingOp, "id" | "createdAt">) => {
    const full: PendingOp = { ...op, id: genId(), createdAt: new Date().toISOString() };
    setPendingOps(prev => [...prev, full]);
  }, []);

  const saveSnapshot = useCallback((snapshot: unknown) => {
    const existing = loadActiveSession();
    const base: MatchSession = existing?.matchId === matchId
      ? existing
      : { matchId, updatedAt: new Date().toISOString(), pendingOps };
    saveActiveSession({ ...base, snapshot, updatedAt: new Date().toISOString() });
  }, [matchId, pendingOps]);

  const clearSession = useCallback(() => {
    setPendingOps([]);
    clearActiveSession();
  }, []);

  const syncStatus: SyncStatus = !isOnline
    ? "offline"
    : pendingOps.length > 0
    ? "local"
    : "synced";

  return {
    isOnline,
    syncStatus,
    isSyncing,
    pendingOps,
    pendingOpsCount: pendingOps.length,
    enqueueOp,
    saveSnapshot,
    syncQueue,
    clearSession,
  };
}

export function useMatchRecovery() {
  const [recovery, setRecovery] = useState<MatchSession | null>(null);

  useEffect(() => {
    const s = loadActiveSession();
    if (s && s.pendingOps.length > 0) setRecovery(s);
  }, []);

  const dismiss = useCallback(() => {
    setRecovery(null);
    clearActiveSession();
  }, []);

  return { recovery, dismiss };
}
