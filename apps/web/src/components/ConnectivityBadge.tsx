"use client";
import { useSyncQueue } from "@/lib/offline";

export default function ConnectivityBadge({ compact = false }: { compact?: boolean }) {
  const { queue, online, syncing, retryNow } = useSyncQueue();
  const failed = queue.filter((q) => q.status === "failed").length;
  const pending = queue.length - failed;

  let label = online ? "Online" : "Offline";
  let color = online ? "#16a34a" : "#dc2626";

  if (!online && queue.length > 0) {
    label = `Offline · ${queue.length} pending sync`;
    color = "#d97706";
  } else if (online && syncing) {
    label = "Syncing…";
    color = "#2563eb";
  } else if (online && failed > 0) {
    label = `Sync failed (${failed})`;
    color = "#dc2626";
  } else if (online && pending > 0) {
    label = `Pending sync (${pending})`;
    color = "#d97706";
  }

  return (
    <button
      onClick={failed > 0 ? retryNow : undefined}
      className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
      style={compact ? { color: "#fff", background: "rgba(255,255,255,0.12)" } : { color, background: `${color}1a`, border: `1px solid ${color}33` }}
      title={queue.length > 0 ? queue.map((q) => `${q.label} — ${q.status}`).join("\n") : undefined}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: compact ? "#fff" : color }} />
      {label}
    </button>
  );
}
