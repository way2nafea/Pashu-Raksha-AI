"use client";
import { useEffect, useState } from "react";
import PortalShell from "@/components/PortalShell";
import { useRequireRole } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const RISK_COLORS: Record<string, string> = {
  LOW: "#4B8B5B", MODERATE: "#C98A2B", HIGH: "#D8622E", CRITICAL: "#B23A2E",
};

export default function GovDashboard() {
  const { user, loading } = useRequireRole(["DISTRICT_ADMIN", "STATE_ADMIN", "SUPER_ADMIN"]);
  const [overview, setOverview] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    api.get("/api/v1/dashboard/overview")
      .then((data) => { setOverview(data); setError(""); })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load dashboard data."));
  }, [user]);

  if (loading || !user) return null;
  if (error) {
    return (
      <PortalShell>
        <p className="text-sm px-3 py-2 rounded-lg inline-block" style={{ color: "var(--risk-critical)", background: "#FBEAE7" }}>{error}</p>
      </PortalShell>
    );
  }
  if (!overview) return null;

  const t = overview.totals;
  const riskData = Object.entries(overview.risk_distribution).map(([name, value]) => ({ name, value }));
  const speciesData = Object.entries(overview.species_distribution).map(([name, value]) => ({ name, value }));
  const trendData = overview.case_trend_30d;

  return (
    <PortalShell>
      <div className="mb-8">
        <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: "var(--gold)" }}>Government of Maharashtra</p>
        <h1 className="font-display text-3xl" style={{ color: "var(--ink)" }}>Livestock Disease Surveillance</h1>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <Stat label="Total Farms" value={t.farms} />
        <Stat label="Total Animals" value={t.animals} />
        <Stat label="Active Cases" value={t.active_cases} />
        <Stat label="Active Outbreaks" value={t.active_outbreaks} accent />
        <Stat label="High Risk" value={t.high_risk_cases} color="var(--risk-high)" />
        <Stat label="Critical" value={t.critical_cases} color="var(--risk-critical)" />
        <Stat label="Resolved" value={t.resolved_cases} color="var(--risk-low)" />
        <Stat label="Total Mortality" value={t.total_mortality} />
        <Stat label="Vaccination Coverage" value={`${t.vaccination_coverage_pct}%`} />
      </div>

      <div className="mb-8 bg-white rounded-xl border p-4 flex items-center gap-4 flex-wrap" style={{ borderColor: "var(--border)" }}>
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ink-soft)" }}>Disease prediction source (all cases)</p>
        <span className="text-xs px-2 py-1 rounded-full" style={{ background: "#dbeafe", color: "#1e40af" }}>
          ML model: {overview.disease_prediction_engine_distribution?.ML || 0}
        </span>
        <span className="text-xs px-2 py-1 rounded-full" style={{ background: "#fef3c7", color: "#92400e" }}>
          Rule-based fallback: {overview.disease_prediction_engine_distribution?.RULE_BASED_FALLBACK || 0}
        </span>
        <p className="text-xs w-full mt-1" style={{ color: "var(--ink-soft)" }}>
          {(overview.disease_prediction_engine_distribution?.ML || 0) > 0
            ? "A trained ML model is active for some cases; others fall back to the rule-based engine (e.g. before a model existed, or on a schema mismatch)."
            : "No trained ML model is loaded yet — every case currently uses the transparent rule-based engine. See docs/ml-disease-prediction.md."}
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <ChartCard title="Case Trend (30 days)" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="var(--brand)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Risk Distribution">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={riskData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {riskData.map((entry, i) => (
                  <Cell key={i} fill={RISK_COLORS[entry.name] || "#888"} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Species Distribution" className="lg:col-span-3">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={speciesData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} className="capitalize" />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill="var(--brand)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </PortalShell>
  );
}

function Stat({ label, value, color, accent }: { label: string; value: React.ReactNode; color?: string; accent?: boolean }) {
  return (
    <div className="rounded-xl p-4 bg-white border" style={{ borderColor: accent && Number(value) > 0 ? "var(--risk-critical)" : "var(--border)" }}>
      <p className="text-2xl font-display" style={{ color: color || "var(--brand-dark)" }}>{value}</p>
      <p className="text-[11px] uppercase tracking-wide font-semibold mt-1" style={{ color: "var(--ink-soft)" }}>{label}</p>
    </div>
  );
}

function ChartCard({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl border p-4 ${className || ""}`} style={{ borderColor: "var(--border)" }}>
      <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--ink-soft)" }}>{title}</p>
      {children}
    </div>
  );
}
