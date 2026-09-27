"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import PortalShell from "@/components/PortalShell";
import RiskBadge from "@/components/RiskBadge";
import { Section, Input, TextArea, SubmitButton } from "@/components/FormControls";
import { useRequireRole, useAuth } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";

const STATUSES = ["REPORTED", "AI_TRIAGE", "VET_ASSIGNED", "FIELD_VISIT", "DIAGNOSIS_LAB_TEST", "TREATMENT", "FOLLOW_UP", "RESOLVED", "ESCALATED"];
const TEST_TYPES = ["PCR", "ELISA", "MICROSCOPY"];

export default function CaseDetailPage() {
  const { user, loading } = useRequireRole(["VETERINARIAN", "FIELD_WORKER", "DISTRICT_ADMIN", "STATE_ADMIN", "SUPER_ADMIN"]);
  const canManageCase = user?.role !== "FIELD_WORKER"; // assign/status/treatment/lab are vet+admin only server-side
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<any>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"overview" | "visit" | "treatment" | "lab">("overview");

  async function refresh() {
    try {
      const d = await api.get(`/api/v1/cases/${id}`);
      setDetail(d);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load this case — check your connection.");
    }
  }
  useEffect(() => { if (user) refresh(); }, [user, id]);

  async function assignToMe() {
    try {
      await api.post(`/api/v1/cases/${id}/assign`, { vet_id: user!.id });
      refresh();
    } catch (err) { setError(err instanceof ApiError ? err.message : "Failed"); }
  }

  async function setStatus(status: string) {
    try {
      await api.post(`/api/v1/cases/${id}/status`, { status });
      refresh();
    } catch (err) { setError(err instanceof ApiError ? err.message : "Failed"); }
  }

  async function submitVisit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await api.post("/api/v1/visits", {
        case_id: id, observations: fd.get("observations"), clinical_notes: fd.get("clinical_notes"),
        mortality_observed: Number(fd.get("mortality_observed") || 0),
        actions_taken: fd.get("actions_taken"), sample_collected: false,
      });
      (e.target as HTMLFormElement).reset();
      refresh();
    } catch (err) { setError(err instanceof ApiError ? err.message : "Failed"); }
  }

  async function submitTreatment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await api.post("/api/v1/treatments", {
        case_id: id, animal_id: detail.animal_id, diagnosis: fd.get("diagnosis"),
        medication: fd.get("medication"), dosage: fd.get("dosage"), treatment_notes: fd.get("treatment_notes"),
        final: fd.get("final") === "on",
      });
      (e.target as HTMLFormElement).reset();
      refresh();
    } catch (err) { setError(err instanceof ApiError ? err.message : "Failed"); }
  }

  async function requestLab(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await api.post("/api/v1/lab/samples", {
        case_id: id, animal_id: detail.animal_id, test_type: fd.get("test_type"), notes: fd.get("notes"),
      });
      (e.target as HTMLFormElement).reset();
      refresh();
    } catch (err) { setError(err instanceof ApiError ? err.message : "Failed"); }
  }

  if (loading || !user) return null;

  if (!detail) {
    return (
      <PortalShell>
        {error ? (
          <div className="rounded-lg border p-4 text-sm max-w-lg" style={{ borderColor: "var(--border)", background: "#fef2f2", color: "#991b1b" }}>
            {error}
          </div>
        ) : (
          <p className="text-sm" style={{ color: "var(--ink-soft)" }}>Loading case…</p>
        )}
      </PortalShell>
    );
  }

  return (
    <PortalShell>
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <RiskBadge level={detail.risk_level} />
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: "var(--surface-alt)" }}>{detail.status}</span>
          </div>
          <h1 className="font-display text-2xl capitalize" style={{ color: "var(--ink)" }}>{detail.species} — {detail.disease_category}</h1>
        </div>
        {canManageCase && (
          <div className="flex gap-2">
            {!detail.assigned_vet_id && (
              <button onClick={assignToMe} className="text-sm px-4 py-2 rounded-lg text-white font-semibold" style={{ background: "var(--brand)" }}>Assign to me</button>
            )}
            <select onChange={(e) => e.target.value && setStatus(e.target.value)} defaultValue="" className="text-sm px-3 py-2 rounded-lg border" style={{ borderColor: "var(--border)" }}>
              <option value="" disabled>Update status…</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s.replaceAll("_", " ")}</option>)}
            </select>
          </div>
        )}
      </div>

      {detail.outbreak && (
        <div className="rounded-xl border-2 p-4 mb-6" style={{ borderColor: "var(--risk-critical)", background: "#FBEAE7" }}>
          <p className="font-semibold text-sm" style={{ color: "var(--risk-critical)" }}>⚠ Part of an active outbreak cluster</p>
          <p className="text-xs mt-1" style={{ color: "var(--ink-soft)" }}>
            {detail.outbreak.case_count} cases within {detail.outbreak.radius_km}km · Severity: {detail.outbreak.severity}
          </p>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="flex gap-1 mb-4 border-b" style={{ borderColor: "var(--border)" }}>
            {(canManageCase ? (["overview", "visit", "treatment", "lab"] as const) : (["overview", "visit"] as const)).map((t) => (
              <button key={t} onClick={() => setTab(t)} className="px-4 py-2 text-sm font-semibold capitalize border-b-2"
                style={{ borderColor: tab === t ? "var(--brand)" : "transparent", color: tab === t ? "var(--brand)" : "var(--ink-soft)" }}>
                {t === "visit" ? "Field Visit" : t === "lab" ? "Lab Request" : t}
              </button>
            ))}
          </div>

          {error && <p className="text-sm mb-3" style={{ color: "var(--risk-critical)" }}>{error}</p>}

          {tab === "overview" && (
            <div className="bg-white rounded-xl border p-5 space-y-4" style={{ borderColor: "var(--border)" }}>
              <Section title="Reported Symptoms">
                <p className="text-sm capitalize">{detail.report?.symptoms?.join(", ").replaceAll("_", " ")}</p>
                <p className="text-xs mt-1" style={{ color: "var(--ink-soft)" }}>
                  Severity: {detail.report?.severity} · Duration: {detail.report?.symptom_duration_days}d ·
                  Affected: {detail.report?.affected_head_count} · Mortality: {detail.report?.mortality_count}
                </p>
              </Section>
              <Section title="Farmer & Farm">
                <p className="text-sm">{detail.farmer?.name} · {detail.farm?.farm_name}</p>
                <p className="text-xs" style={{ color: "var(--ink-soft)" }}>{detail.farm?.village}, {detail.farm?.district}</p>
              </Section>
              <Section title="Animal History">
                <p className="text-sm">{detail.animal?.tag_id} · {detail.animal?.species} · {detail.animal?.age_months}mo</p>
              </Section>
              {detail.field_visits?.length > 0 && (
                <Section title="Field Visits">
                  {detail.field_visits.map((v: any, i: number) => (
                    <p key={i} className="text-sm mb-1">{v.observations}</p>
                  ))}
                </Section>
              )}
              {detail.treatments?.length > 0 && (
                <Section title="Treatment History">
                  {detail.treatments.map((t: any, i: number) => (
                    <p key={i} className="text-sm mb-1">{t.diagnosis} — {t.medication}</p>
                  ))}
                </Section>
              )}
              {detail.samples?.length > 0 && (
                <Section title="Lab Samples">
                  {detail.samples.map((s: any, i: number) => (
                    <p key={i} className="text-sm mb-1">{s.test_type} — {s.status} {s.result ? `→ ${s.result}` : ""}</p>
                  ))}
                </Section>
              )}
            </div>
          )}

          {tab === "visit" && (
            <form onSubmit={submitVisit} className="bg-white rounded-xl border p-5 space-y-3" style={{ borderColor: "var(--border)" }}>
              <TextArea name="observations" label="Observations" required />
              <TextArea name="clinical_notes" label="Clinical notes" />
              <div className="grid grid-cols-2 gap-3">
                <Input name="mortality_observed" label="Mortality observed" type="number" defaultValue={0} />
                <Input name="actions_taken" label="Actions taken" />
              </div>
              <SubmitButton>Record Field Visit</SubmitButton>
            </form>
          )}

          {tab === "treatment" && (
            <form onSubmit={submitTreatment} className="bg-white rounded-xl border p-5 space-y-3" style={{ borderColor: "var(--border)" }}>
              <Input name="diagnosis" label="Diagnosis" required />
              <div className="grid grid-cols-2 gap-3">
                <Input name="medication" label="Medication" />
                <Input name="dosage" label="Dosage / instructions" />
              </div>
              <TextArea name="treatment_notes" label="Treatment notes" />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="final" /> Mark case as resolved
              </label>
              <SubmitButton>Record Treatment</SubmitButton>
            </form>
          )}

          {tab === "lab" && (
            <form onSubmit={requestLab} className="bg-white rounded-xl border p-5 space-y-3" style={{ borderColor: "var(--border)" }}>
              <div>
                <label className="block text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: "var(--ink-soft)" }}>Test type</label>
                <select name="test_type" className="w-full rounded-lg border px-3 py-2" style={{ borderColor: "var(--border)" }}>
                  {TEST_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <TextArea name="notes" label="Notes for lab" />
              <SubmitButton>Request Lab Test</SubmitButton>
            </form>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl border p-4" style={{ borderColor: "var(--border)" }}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--ink-soft)" }}>AI Risk Assessment</p>
            <p className="text-2xl font-display">{Math.round(detail.risk_score * 100)}%</p>
            <p className="text-xs mt-1" style={{ color: "var(--ink-soft)" }}>Decision-support only. Not a confirmed diagnosis.</p>
          </div>

          {detail.disease_prediction && (
            <div className="bg-white rounded-xl border p-4" style={{ borderColor: "var(--border)" }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ink-soft)" }}>Disease Prediction</p>
                <span
                  className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                  style={detail.disease_prediction.engine === "ML"
                    ? { background: "#dbeafe", color: "#1e40af" }
                    : { background: "#fef3c7", color: "#92400e" }}
                >
                  {detail.disease_prediction.engine === "ML" ? "Trained ML model" : "Rule-based fallback"}
                </span>
              </div>
              <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>{detail.disease_prediction.predicted_disease}</p>
              {detail.disease_prediction.confidence != null && (
                <p className="text-xs mt-1" style={{ color: "var(--ink-soft)" }}>
                  Confidence: {Math.round(detail.disease_prediction.confidence * 100)}%
                </p>
              )}
              {detail.disease_prediction.engine !== "ML" && (
                <p className="text-xs mt-2" style={{ color: "var(--ink-soft)" }}>
                  No trained ML model is loaded — this is a transparent rule-based estimate, not a machine-learning prediction.
                </p>
              )}
            </div>
          )}

          {detail.weather_at_report && (
            <div className="bg-white rounded-xl border p-4" style={{ borderColor: "var(--border)" }}>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--ink-soft)" }}>Weather at report time</p>
              {detail.weather_at_report.available ? (
                <>
                  <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
                    {detail.weather_at_report.current.condition} · {detail.weather_at_report.current.temperature_c}°C
                  </p>
                  <p className="text-xs mt-1" style={{ color: "var(--ink-soft)" }}>
                    Humidity {detail.weather_at_report.current.humidity_pct}% · Precipitation {detail.weather_at_report.current.precipitation_mm}mm
                  </p>
                  {detail.weather_at_report.air_quality && (
                    <p className="text-xs mt-1" style={{ color: "var(--ink-soft)" }}>
                      Air quality: AQI {detail.weather_at_report.air_quality.aqi ?? "—"} · {detail.weather_at_report.air_quality.category ?? "Unavailable"}
                    </p>
                  )}
                  {detail.weather_at_report.animal_health?.alerts?.length > 0 && (
                    <p className="text-xs mt-1" style={{ color: "var(--risk-high)" }}>
                      Animal health: {detail.weather_at_report.animal_health.alerts.join("; ")}
                    </p>
                  )}
                  <p className="text-[10px] mt-2" style={{ color: "var(--ink-soft)" }}>Source: {detail.weather_at_report.source}</p>
                </>
              ) : (
                <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
                  Weather unavailable at report time ({detail.weather_at_report.reason})
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </PortalShell>
  );
}
