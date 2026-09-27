"use client";
import PortalShell from "@/components/PortalShell";
import ApiStateNotice from "@/components/ApiStateNotice";
import { useRequireRole } from "@/lib/auth";
import { useApiList } from "@/lib/api";

export default function AuditPage() {
  const { user, loading } = useRequireRole(["SUPER_ADMIN", "STATE_ADMIN"]);
  const { data: logs, state, error } = useApiList<any>(user ? "/api/v1/audit" : null, [user]);

  if (loading || !user) return null;

  return (
    <PortalShell>
      <h1 className="font-display text-3xl mb-6" style={{ color: "var(--ink)" }}>Audit Log</h1>
      <ApiStateNotice state={state} error={error} resource="the audit log" />
      {state === "ready" && (
        <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b" style={{ borderColor: "var(--border)", background: "var(--surface-alt)" }}>
                <th className="p-3">Time</th><th className="p-3">User</th><th className="p-3">Action</th><th className="p-3">Entity</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l, i) => (
                <tr key={i} className="border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
                  <td className="p-3 text-xs">{new Date(l.timestamp).toLocaleString()}</td>
                  <td className="p-3">{l.user_email}</td>
                  <td className="p-3">{l.action}</td>
                  <td className="p-3">{l.entity}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr><td colSpan={4} className="p-3 text-sm" style={{ color: "var(--ink-soft)" }}>No audit entries yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </PortalShell>
  );
}
