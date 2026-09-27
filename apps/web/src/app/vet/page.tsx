"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import PortalShell from "@/components/PortalShell";
import RiskBadge from "@/components/RiskBadge";
import { useRequireRole } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";

const STATUS_LABEL: Record<string, string> = {
  REPORTED: "Reported", AI_TRIAGE: "AI Triage", VET_ASSIGNED: "Vet Assigned",
  FIELD_VISIT: "Field Visit", DIAGNOSIS_LAB_TEST: "Diagnosis / Lab", TREATMENT: "Treatment",
  FOLLOW_UP: "Follow-up", RESOLVED: "Resolved", ESCALATED: "Escalated",
};

export default function VetQueuePage() {
  const { user, loading } = useRequireRole(["VETERINARIAN", "FIELD_WORKER", "DISTRICT_ADMIN", "STATE_ADMIN", "SUPER_ADMIN"]);
  const [cases, setCases] = useState<any[]>([]);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    api.get("/api/v1/cases")
      .then((data) => { setCases(data); setError(""); })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load cases."));
  }, [user]);

  if (loading || !user) return null;

  const filtered = filter ? cases.filter((c) => c.risk_level === filter) : cases;

  return (
    <PortalShell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl" style={{ color: "var(--ink)" }}>Case Queue</h1>
          <p className="text-sm" style={{ color: "var(--ink-soft)" }}>Prioritized by AI risk, then recency.</p>
        </div>
      </div>

      <div className="flex gap-2 mb-5">
        {["", "CRITICAL", "HIGH", "MODERATE", "LOW"].map((lvl) => (
          <button key={lvl} onClick={() => setFilter(lvl)}
            className="text-xs px-3 py-1.5 rounded-full border font-semibold"
            style={{ borderColor: filter === lvl ? "var(--brand)" : "var(--border)", background: filter === lvl ? "var(--surface-alt)" : "white" }}>
            {lvl || "All"}
          </button>
        ))}
      </div>

      {error && (
        <p className="text-sm mb-4 px-3 py-2 rounded-lg" style={{ color: "var(--risk-critical)", background: "#FBEAE7" }}>
          {error}
        </p>
      )}

      <div className="space-y-3">
        {filtered.map((c) => (
          <Link key={c.id} href={`/vet/${c.id}`} className="block bg-white rounded-xl border p-4 hover:shadow-md transition-shadow" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <RiskBadge level={c.risk_level} size="sm" />
                <span className="text-sm font-semibold capitalize">{c.species}</span>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--surface-alt)" }}>{STATUS_LABEL[c.status] || c.status}</span>
            </div>
            <p className="text-sm" style={{ color: "var(--ink-soft)" }}>{c.disease_category}</p>
            <div className="flex justify-between mt-2 text-xs" style={{ color: "var(--ink-soft)" }}>
              <span>{c.district}</span>
              <span>{c.outbreak_id ? "⚠ Outbreak cluster" : ""}</span>
            </div>
          </Link>
        ))}
        {filtered.length === 0 && <p className="text-sm" style={{ color: "var(--ink-soft)" }}>No cases match this filter.</p>}
      </div>
    </PortalShell>
  );
}
