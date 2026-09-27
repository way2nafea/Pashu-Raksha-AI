"use client";
import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

const QUEUE_KEY = "pr_pending_sync_queue";
const QUEUE_EVENT = "pr-sync-queue-changed";

export type QueueStatus = "pending" | "syncing" | "failed";

export type QueuedItem = {
  id: string;
  label: string; // human-readable, e.g. "Field visit — Farm #A12"
  endpoint: string;
  payload: any;
  createdAt: string;
  status: QueueStatus;
};

function readQueue(): QueuedItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeQueue(items: QueuedItem[]) {
  window.localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(QUEUE_EVENT));
}

/** Save a create/update action locally instead of losing it when offline.
 * Never silently drops data — it stays in the queue until it syncs or the
 * user explicitly discards it. */
export function enqueueForSync(label: string, endpoint: string, payload: any) {
  const items = readQueue();
  items.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    label,
    endpoint,
    payload,
    createdAt: new Date().toISOString(),
    status: "pending",
  });
  writeQueue(items);
}

export async function flushSyncQueue(): Promise<{ synced: number; failed: number }> {
  let items = readQueue();
  if (items.length === 0) return { synced: 0, failed: 0 };

  let synced = 0, failed = 0;
  for (const item of items) {
    items = readQueue().map((i) => (i.id === item.id ? { ...i, status: "syncing" as QueueStatus } : i));
    writeQueue(items);
    try {
      await api.post(item.endpoint, item.payload);
      items = readQueue().filter((i) => i.id !== item.id);
      writeQueue(items);
      synced++;
    } catch {
      items = readQueue().map((i) => (i.id === item.id ? { ...i, status: "failed" as QueueStatus } : i));
      writeQueue(items);
      failed++;
    }
  }
  return { synced, failed };
}

export function useOnlineStatus() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);
  return online;
}

export function useSyncQueue() {
  const [queue, setQueue] = useState<QueuedItem[]>([]);
  const online = useOnlineStatus();
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(() => setQueue(readQueue()), []);

  useEffect(() => {
    refresh();
    window.addEventListener(QUEUE_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(QUEUE_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [refresh]);

  useEffect(() => {
    if (online && readQueue().length > 0 && !syncing) {
      setSyncing(true);
      flushSyncQueue().finally(() => {
        setSyncing(false);
        refresh();
      });
    }
  }, [online]); // eslint-disable-line react-hooks/exhaustive-deps

  return { queue, online, syncing, retryNow: async () => { setSyncing(true); await flushSyncQueue(); setSyncing(false); refresh(); } };
}
