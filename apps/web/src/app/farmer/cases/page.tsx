"use client";
import PortalShell from "@/components/PortalShell";
import ApiStateNotice from "@/components/ApiStateNotice";
import { useRequireRole } from "@/lib/auth";
import { useApiList } from "@/lib/api";

export default function MyCasesPage() {
  const { user, loading } = useRequireRole(["FARMER", "FIELD_WORKER"]);
  const { data: reports, state, error } = useApiList<any>(user ? "/api/v1/reports" : null, [user]);

  if (loading || !user) return null;

  return (
    <PortalShell>
      <h1 className="font-display text-3xl mb-6" style={{ color: "var(--ink)" }}>My Reports</h1>
      <ApiStateNotice state={state} error={error} resource="your reports" />
      {state === "ready" && (
        <div className="space-y-3">
          {reports.map((r) => (
            <div key={r.id} className="bg-white rounded-xl border p-4" style={{ borderColor: "var(--border)" }}>
              <div className="flex items-center justify-between mb-1">
                <p className="font-semibold text-sm capitalize">{r.species} — {r.village || r.district}</p>
                <p className="text-xs" style={{ color: "var(--ink-soft)" }}>{new Date(r.created_at).toLocaleDateString()}</p>
              </div>
              <p className="text-xs mb-2" style={{ color: "var(--ink-soft)" }}>
                {r.symptoms?.join(", ").replaceAll("_", " ")}
              </p>
              <div className="flex gap-3 text-xs" style={{ color: "var(--ink-soft)" }}>
                <span>Severity: <b className="capitalize">{r.severity}</b></span>
                <span>Affected: <b>{r.affected_head_count}</b></span>
                <span>Mortality: <b>{r.mortality_count}</b></span>
              </div>
            </div>
          ))}
          {reports.length === 0 && <p className="text-sm" style={{ color: "var(--ink-soft)" }}>No reports submitted yet.</p>}
        </div>
      )}
    </PortalShell>
  );
}
