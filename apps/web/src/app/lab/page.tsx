"use client";
import { useEffect, useState } from "react";
import PortalShell from "@/components/PortalShell";
import { useRequireRole } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";

const STATUSES = ["REQUESTED", "COLLECTED", "SENT", "RECEIVED", "TESTING", "RESULT_AVAILABLE"];
const NEXT_STATUS: Record<string, string> = {
  REQUESTED: "COLLECTED", COLLECTED: "SENT", SENT: "RECEIVED", RECEIVED: "TESTING",
};

export default function LabQueuePage() {
  const { user, loading } = useRequireRole(["LAB_STAFF", "STATE_ADMIN", "DISTRICT_ADMIN", "SUPER_ADMIN"]);
  const [samples, setSamples] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [resultDraft, setResultDraft] = useState<Record<string, string>>({});

  async function refresh() {
    try {
      setSamples(await api.get("/api/v1/lab/samples"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load samples — check your connection.");
    }
  }
  useEffect(() => { if (user) refresh(); }, [user]);

  async function advance(sampleId: string, status: string) {
    try {
      await api.post(`/api/v1/lab/samples/${sampleId}/status`, { status });
      refresh();
    } catch (err) { setError(err instanceof ApiError ? err.message : "Failed"); }
  }

  async function submitResult(sampleId: string) {
    const result = resultDraft[sampleId];
    if (!result) return;
    try {
      await api.post(`/api/v1/lab/samples/${sampleId}/result`, { result });
      refresh();
    } catch (err) { setError(err instanceof ApiError ? err.message : "Failed"); }
  }

  if (loading || !user) return null;

  return (
    <PortalShell>
      <h1 className="font-display text-3xl mb-1" style={{ color: "var(--ink)" }}>Laboratory Sample Queue</h1>
      <p className="text-sm mb-6" style={{ color: "var(--ink-soft)" }}>REQUESTED → COLLECTED → SENT → RECEIVED → TESTING → RESULT AVAILABLE</p>
      {error && <p className="text-sm mb-4" style={{ color: "var(--risk-critical)" }}>{error}</p>}

      <div className="space-y-3">
        {samples.map((s) => (
          <div key={s.id} className="bg-white rounded-xl border p-4" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between mb-2">
              <p className="font-semibold text-sm">{s.test_type} sample</p>
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: "var(--surface-alt)" }}>{s.status.replaceAll("_", " ")}</span>
            </div>
            {s.notes && <p className="text-xs mb-2" style={{ color: "var(--ink-soft)" }}>{s.notes}</p>}

            {NEXT_STATUS[s.status] && (
              <button onClick={() => advance(s.id, NEXT_STATUS[s.status])} className="text-xs px-3 py-1.5 rounded-md text-white font-semibold" style={{ background: "var(--brand)" }}>
                Mark as {NEXT_STATUS[s.status].replaceAll("_", " ")}
              </button>
            )}

            {s.status === "TESTING" && (
              <div className="flex gap-2 mt-2">
                <input
                  placeholder="Enter result…"
                  value={resultDraft[s.id] || ""}
                  onChange={(e) => setResultDraft((d) => ({ ...d, [s.id]: e.target.value }))}
                  className="flex-1 rounded-lg border px-3 py-1.5 text-sm" style={{ borderColor: "var(--border)" }}
                />
                <button onClick={() => submitResult(s.id)} className="text-xs px-3 py-1.5 rounded-md text-white font-semibold" style={{ background: "var(--gold)" }}>
                  Save Result
                </button>
              </div>
            )}

            {s.result && (
              <p className="text-sm mt-2 font-medium" style={{ color: "var(--brand-dark)" }}>Result: {s.result}</p>
            )}
          </div>
        ))}
        {samples.length === 0 && <p className="text-sm" style={{ color: "var(--ink-soft)" }}>No samples in the queue.</p>}
      </div>
    </PortalShell>
  );
}
