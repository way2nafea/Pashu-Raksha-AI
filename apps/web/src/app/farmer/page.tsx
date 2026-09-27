"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import PortalShell from "@/components/PortalShell";
import RiskBadge from "@/components/RiskBadge";
import { useRequireRole } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";

export default function FarmerHome() {
  const { user, loading } = useRequireRole(["FARMER", "FIELD_WORKER"]);
  const [farms, setFarms] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    const onErr = (err: unknown) => setError(err instanceof ApiError ? err.message : "Could not load your data.");
    api.get("/api/v1/farms").then(setFarms).catch(onErr);
    api.get("/api/v1/reports").then(setReports).catch(onErr);
    api.get("/api/v1/alerts").then(setAlerts).catch(onErr);
  }, [user]);

  if (loading || !user) return null;

  return (
    <PortalShell>
      <div className="mb-8">
        <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: "var(--gold)" }}>
          Welcome back
        </p>
        <h1 className="font-display text-3xl" style={{ color: "var(--ink)" }}>{user.name}</h1>
      </div>

      {error && (
        <p className="text-sm mb-4 px-3 py-2 rounded-lg inline-block" style={{ color: "var(--risk-critical)", background: "#FBEAE7" }}>
          {error}
        </p>
      )}

      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        <StatCard label="My Farms" value={farms.length} href="/farmer/farms" />
        <StatCard label="Reports Submitted" value={reports.length} href="/farmer/cases" />
        <StatCard label="Active Alerts" value={alerts.length} href="/farmer/alerts" accent />
      </div>

      <div
        className="rounded-2xl p-6 mb-8 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        style={{ background: "var(--brand)" }}
      >
        <div>
          <h2 className="font-display text-xl mb-1">Notice unusual symptoms in your animal?</h2>
          <p className="text-sm opacity-90">Report it now — get an instant AI-assisted risk assessment.</p>
        </div>
        <Link
          href="/farmer/report"
          className="shrink-0 bg-white rounded-lg px-5 py-2.5 font-semibold text-center"
          style={{ color: "var(--brand-dark)" }}
        >
          Report Symptoms
        </Link>
      </div>

      <h3 className="font-display text-lg mb-3" style={{ color: "var(--ink)" }}>Recent Reports</h3>
      <div className="rounded-xl border overflow-hidden bg-white" style={{ borderColor: "var(--border)" }}>
        {reports.length === 0 && (
          <p className="p-5 text-sm" style={{ color: "var(--ink-soft)" }}>
            No reports yet. Submit your first disease report to see it here.
          </p>
        )}
        {reports.slice(0, 5).map((r) => (
          <div key={r.id} className="flex items-center justify-between p-4 border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
            <div>
              <p className="font-semibold text-sm capitalize">{r.species} · {r.village || r.district}</p>
              <p className="text-xs" style={{ color: "var(--ink-soft)" }}>
                {r.symptoms?.join(", ").replaceAll("_", " ")}
              </p>
            </div>
          </div>
        ))}
      </div>
    </PortalShell>
  );
}

function StatCard({ label, value, href, accent }: { label: string; value: number; href: string; accent?: boolean }) {
  return (
    <Link
      href={href}
      className="rounded-xl p-5 bg-white border hover:shadow-md transition-shadow"
      style={{ borderColor: accent && value > 0 ? "var(--risk-high)" : "var(--border)" }}
    >
      <p className="text-3xl font-display" style={{ color: "var(--brand-dark)" }}>{value}</p>
      <p className="text-xs uppercase tracking-wide font-semibold mt-1" style={{ color: "var(--ink-soft)" }}>{label}</p>
    </Link>
  );
}
