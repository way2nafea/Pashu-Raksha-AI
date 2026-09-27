"use client";
import PortalShell from "@/components/PortalShell";
import ApiStateNotice from "@/components/ApiStateNotice";
import { useAuth } from "@/lib/auth";
import { api, useApiList, ApiError } from "@/lib/api";

const PRIORITY_COLOR: Record<string, string> = {
  LOW: "var(--risk-low)", MEDIUM: "var(--risk-moderate)",
  HIGH: "var(--risk-high)", CRITICAL: "var(--risk-critical)",
};

export default function AlertsPage() {
  const { user, loading } = useAuth();
  const { data: alerts, setData: setAlerts, state, error } = useApiList<any>(user ? "/api/v1/alerts" : null, [user]);

  async function acknowledge(id: string) {
    try {
      await api.post(`/api/v1/alerts/${id}/acknowledge`);
      setAlerts((a) => a.map((x) => (x.id === id ? { ...x, acknowledged: true } : x)));
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Could not acknowledge — check your connection.");
    }
  }

  if (loading || !user) return null;

  return (
    <PortalShell>
      <h1 className="font-display text-3xl mb-6" style={{ color: "var(--ink)" }}>Alerts</h1>
      <ApiStateNotice state={state} error={error} resource="alerts" />
      {state === "ready" && (
        <div className="space-y-3">
          {alerts.map((a) => (
            <div key={a.id} className="bg-white rounded-xl border-l-4 border p-4 flex items-start justify-between gap-4"
              style={{ borderColor: "var(--border)", borderLeftColor: PRIORITY_COLOR[a.priority] || "#888", opacity: a.acknowledged ? 0.6 : 1 }}>
              <div>
                <p className="font-semibold text-sm">{a.title}</p>
                <p className="text-xs mt-1" style={{ color: "var(--ink-soft)" }}>{a.message}</p>
                <p className="text-[10px] mt-2 uppercase tracking-wide font-semibold" style={{ color: PRIORITY_COLOR[a.priority] }}>{a.priority} priority</p>
              </div>
              {!a.acknowledged && (
                <button onClick={() => acknowledge(a.id)} className="text-xs shrink-0 px-3 py-1.5 rounded-md border font-semibold" style={{ borderColor: "var(--border)" }}>
                  Acknowledge
                </button>
              )}
            </div>
          ))}
          {alerts.length === 0 && <p className="text-sm" style={{ color: "var(--ink-soft)" }}>No alerts.</p>}
        </div>
      )}
    </PortalShell>
  );
}
