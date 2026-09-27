"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import PortalShell from "@/components/PortalShell";
import { useRequireRole } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";

const GisMap = dynamic(() => import("@/components/GisMap"), { ssr: false });

export default function MapPage() {
  const { user, loading } = useRequireRole(["DISTRICT_ADMIN", "STATE_ADMIN", "SUPER_ADMIN"]);
  const [data, setData] = useState<{ farms: any[]; cases: any[]; outbreaks: any[] }>({ farms: [], cases: [], outbreaks: [] });
  const [riskFilter, setRiskFilter] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    const q = riskFilter ? `?risk_level=${riskFilter}` : "";
    api.get(`/api/v1/gis/map-data${q}`)
      .then((d) => { setData(d); setError(""); })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load map data."));
  }, [user, riskFilter]);

  if (loading || !user) return null;

  return (
    <PortalShell>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="font-display text-3xl" style={{ color: "var(--ink)" }}>GIS Risk Map</h1>
        <div className="flex gap-2">
          {["", "CRITICAL", "HIGH", "MODERATE", "LOW"].map((lvl) => (
            <button key={lvl} onClick={() => setRiskFilter(lvl)}
              className="text-xs px-3 py-1.5 rounded-full border font-semibold"
              style={{ borderColor: riskFilter === lvl ? "var(--brand)" : "var(--border)", background: riskFilter === lvl ? "var(--surface-alt)" : "white" }}>
              {lvl || "All Risk Levels"}
            </button>
          ))}
        </div>
      </div>
      {error && (
        <p className="text-sm mb-3 px-3 py-2 rounded-lg inline-block" style={{ color: "var(--risk-critical)", background: "#FBEAE7" }}>
          {error}
        </p>
      )}
      <div className="rounded-2xl border overflow-hidden" style={{ height: "70vh", borderColor: "var(--border)" }}>
        <GisMap farms={data.farms} cases={data.cases} outbreaks={data.outbreaks} />
      </div>
      <div className="flex gap-4 mt-3 text-xs" style={{ color: "var(--ink-soft)" }}>
        <span>🟢 Farms</span>
        <span>● Cases (colored by risk)</span>
        <span>⭕ Outbreak cluster radius</span>
      </div>
    </PortalShell>
  );
}
