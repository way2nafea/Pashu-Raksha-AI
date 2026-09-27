"use client";
import { useEffect, useState } from "react";
import PortalShell from "@/components/PortalShell";
import RiskBadge from "@/components/RiskBadge";
import { useRequireRole } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import { speak, speechSupport } from "@/lib/voice";
import { enqueueForSync } from "@/lib/offline";

const SYMPTOMS = [
  { id: "fever", label: "Fever" },
  { id: "reduced_appetite", label: "Reduced appetite" },
  { id: "lethargy", label: "Lethargy / weakness" },
  { id: "nasal_discharge", label: "Nasal discharge" },
  { id: "coughing", label: "Coughing" },
  { id: "diarrhea", label: "Diarrhea" },
  { id: "skin_lesions", label: "Skin lesions / sores" },
  { id: "swelling", label: "Swelling" },
  { id: "respiratory_difficulty", label: "Difficulty breathing" },
  { id: "sudden_mortality", label: "Sudden death in herd" },
];

const STEPS = ["Animal", "Symptoms", "Severity", "Location", "Review"];

export default function ReportPage() {
  const { user, loading } = useRequireRole(["FARMER", "FIELD_WORKER"]);
  const [step, setStep] = useState(0);
  const [farms, setFarms] = useState<any[]>([]);
  const [animals, setAnimals] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [result, setResult] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadNotice, setLoadNotice] = useState("");
  const [queuedOffline, setQueuedOffline] = useState(false);

  const [form, setForm] = useState({
    farm_id: "", animal_id: "", species: "cattle",
    symptoms: [] as string[], symptom_duration_days: 2, severity: "moderate",
    affected_head_count: 1, mortality_count: 0, vaccination_status: "unknown",
    latitude: 19.3006, longitude: 72.8508, village: "", district: "Thane",
    image_url: null as string | null, notes: "",
  });

  useEffect(() => {
    if (!user) return;
    api.get("/api/v1/farms")
      .then(setFarms)
      .catch((err) => setLoadNotice(
        err instanceof ApiError
          ? `Could not load your farms: ${err.message}`
          : "You're offline — your farms couldn't be loaded. You can still fill in this form; it will be saved locally if you submit while offline."
      ));
  }, [user]);

  useEffect(() => {
    if (!form.farm_id) { setAnimals([]); return; }
    api.get(`/api/v1/animals?farm_id=${form.farm_id}`)
      .then(setAnimals)
      .catch((err) => setLoadNotice(
        err instanceof ApiError
          ? `Could not load animals for this farm: ${err.message}`
          : "You're offline — animals for this farm couldn't be loaded."
      ));
  }, [form.farm_id]);

  function toggleSymptom(id: string) {
    setForm((f) => ({
      ...f,
      symptoms: f.symptoms.includes(id) ? f.symptoms.filter((s) => s !== id) : [...f.symptoms, id],
    }));
  }

  function useDeviceLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setForm((f) => ({ ...f, latitude: pos.coords.latitude, longitude: pos.coords.longitude })),
      () => {} // fallback: keep demo coordinates already set
    );
  }

  async function submit() {
    setSubmitting(true);
    setError("");
    try {
      const res = await api.post("/api/v1/reports", form);
      setResult(res);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        // Network failure, not a server error: never lose the farmer's
        // report — queue it via the purpose-built offline-sync endpoint
        // (app/sync/router.py), which runs it through the exact same
        // AI/weather/outbreak pipeline as a normal submission once synced.
        // The risk assessment can only be computed once it reaches the
        // server, so we're honest that it isn't available yet rather than
        // faking one.
        enqueueForSync(`Disease report — ${form.species} at ${form.village || form.district}`, "/api/v1/sync/reports", [form]);
        setQueuedOffline(true);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !user) return null;

  if (queuedOffline) {
    return (
      <PortalShell>
        <div className="max-w-xl mx-auto text-center">
          <div className="rounded-2xl border-2 p-6" style={{ borderColor: "#d97706", background: "#fff7ed" }}>
            <p className="font-semibold mb-2" style={{ color: "#9a3412" }}>Saved offline</p>
            <p className="text-sm" style={{ color: "#9a3412" }}>
              You're offline, so this report has been saved on your device. It will be submitted
              automatically — and the AI risk assessment generated — once you're back online.
            </p>
          </div>
          <button
            onClick={() => { setQueuedOffline(false); setStep(0); setForm((f) => ({ ...f, symptoms: [], notes: "" })); }}
            className="w-full mt-4 rounded-lg py-2.5 font-semibold text-white"
            style={{ background: "var(--brand)" }}
          >
            Report another animal
          </button>
        </div>
      </PortalShell>
    );
  }

  if (result) {
    return (
      <PortalShell>
        <div className="max-w-xl mx-auto">
          <div className="text-center mb-6">
            <p className="text-xs uppercase tracking-widest font-semibold mb-1" style={{ color: "var(--gold)" }}>Report Submitted</p>
            <h1 className="font-display text-2xl" style={{ color: "var(--ink)" }}>AI-Assisted Risk Assessment</h1>
          </div>

          <div className="bg-white rounded-2xl border p-6 mb-4 text-center" style={{ borderColor: "var(--border)" }}>
            <div className="mb-3"><RiskBadge level={result.risk_assessment.risk_level} /></div>
            <p className="text-3xl font-display mb-1">{Math.round(result.risk_assessment.risk_score * 100)}%</p>
            <p className="text-sm mb-4" style={{ color: "var(--ink-soft)" }}>{result.risk_assessment.disease_category}</p>
            <p className="text-sm font-medium p-3 rounded-lg" style={{ background: "var(--surface-alt)" }}>
              {result.risk_assessment.recommended_action}
            </p>
            {speechSupport().synthesisSupported && (
              <button
                onClick={() => speak(
                  `Risk level: ${result.risk_assessment.risk_level}. ${result.risk_assessment.recommended_action}`,
                  "en"
                )}
                className="mt-3 text-xs font-semibold px-3 py-1.5 rounded-md border inline-flex items-center gap-1.5"
                style={{ borderColor: "var(--brand)", color: "var(--brand)" }}
              >
                🔊 Listen to this result
              </button>
            )}
          </div>

          {result.risk_assessment.weather_context && (
            <p className="text-xs text-center mb-4" style={{ color: "var(--ink-soft)" }}>
              {result.risk_assessment.weather_context.note}
            </p>
          )}

          {result.outbreak && (
            <div className="rounded-2xl border-2 p-5 mb-4" style={{ borderColor: "var(--risk-critical)", background: "#FBEAE7" }}>
              <p className="font-semibold" style={{ color: "var(--risk-critical)" }}>⚠ Potential Outbreak Cluster Detected</p>
              <p className="text-sm mt-1" style={{ color: "var(--ink-soft)" }}>
                {result.outbreak.case_count} similar cases found nearby within {result.outbreak.radius_km}km.
                District animal husbandry office has been alerted.
              </p>
            </div>
          )}

          {result.nearby_similar_cases > 0 && (
            <p className="text-sm text-center mb-4" style={{ color: "var(--ink-soft)" }}>
              {result.nearby_similar_cases} nearby similar case(s) detected in the surveillance system.
            </p>
          )}

          <p className="text-xs text-center mb-6 italic" style={{ color: "var(--ink-soft)" }}>
            {result.risk_assessment.disclaimer}
          </p>

          <button
            onClick={() => { setResult(null); setStep(0); setForm((f) => ({ ...f, symptoms: [], notes: "" })); }}
            className="w-full rounded-lg py-2.5 font-semibold text-white"
            style={{ background: "var(--brand)" }}
          >
            Submit Another Report
          </button>
        </div>
      </PortalShell>
    );
  }

  return (
    <PortalShell>
      <div className="max-w-xl mx-auto">
        <h1 className="font-display text-2xl mb-1" style={{ color: "var(--ink)" }}>Report Health Issue</h1>
        <p className="text-sm mb-6" style={{ color: "var(--ink-soft)" }}>Step {step + 1} of {STEPS.length}: {STEPS[step]}</p>

        <div className="flex gap-1 mb-6">
          {STEPS.map((_, i) => (
            <div key={i} className="h-1 flex-1 rounded-full" style={{ background: i <= step ? "var(--brand)" : "var(--border)" }} />
          ))}
        </div>

        {loadNotice && (
          <p className="text-xs mb-4 rounded-lg p-3" style={{ background: "#fff7ed", color: "#9a3412" }}>{loadNotice}</p>
        )}

        <div className="bg-white rounded-2xl border p-6 mb-4" style={{ borderColor: "var(--border)" }}>
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: "var(--ink-soft)" }}>Farm</label>
                <select
                  value={form.farm_id}
                  onChange={(e) => setForm((f) => ({ ...f, farm_id: e.target.value, animal_id: "" }))}
                  className="w-full rounded-lg border px-3 py-2.5" style={{ borderColor: "var(--border)" }}
                >
                  <option value="">Select a farm…</option>
                  {farms.map((f) => <option key={f.id} value={f.id}>{f.farm_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: "var(--ink-soft)" }}>Animal</label>
                <select
                  value={form.animal_id}
                  onChange={(e) => {
                    const a = animals.find((x) => x.id === e.target.value);
                    setForm((f) => ({ ...f, animal_id: e.target.value, species: a?.species || f.species }));
                  }}
                  className="w-full rounded-lg border px-3 py-2.5" style={{ borderColor: "var(--border)" }}
                >
                  <option value="">Select an animal…</option>
                  {animals.map((a) => <option key={a.id} value={a.id}>{a.tag_id} ({a.species})</option>)}
                </select>
                {form.farm_id && animals.length === 0 && (
                  <p className="text-xs mt-1" style={{ color: "var(--ink-soft)" }}>No animals registered on this farm yet.</p>
                )}
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <p className="text-sm mb-3" style={{ color: "var(--ink-soft)" }}>Select all symptoms observed (this list is illustrative, not exhaustive):</p>
              <div className="grid grid-cols-2 gap-2">
                {SYMPTOMS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleSymptom(s.id)}
                    className="text-left text-sm px-3 py-2.5 rounded-lg border transition-colors"
                    style={{
                      borderColor: form.symptoms.includes(s.id) ? "var(--brand)" : "var(--border)",
                      background: form.symptoms.includes(s.id) ? "var(--surface-alt)" : "white",
                      fontWeight: form.symptoms.includes(s.id) ? 600 : 400,
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: "var(--ink-soft)" }}>Severity</label>
                <div className="grid grid-cols-4 gap-2">
                  {["mild", "moderate", "severe", "critical"].map((s) => (
                    <button key={s} type="button" onClick={() => setForm((f) => ({ ...f, severity: s }))}
                      className="text-xs py-2 rounded-lg border capitalize"
                      style={{ borderColor: form.severity === s ? "var(--brand)" : "var(--border)", background: form.severity === s ? "var(--surface-alt)" : "white", fontWeight: form.severity === s ? 600 : 400 }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <NumField label="Symptom duration (days)" value={form.symptom_duration_days} onChange={(v: number) => setForm((f) => ({ ...f, symptom_duration_days: v }))} />
                <NumField label="Affected head count" value={form.affected_head_count} onChange={(v: number) => setForm((f) => ({ ...f, affected_head_count: v }))} />
                <NumField label="Mortality count" value={form.mortality_count} onChange={(v: number) => setForm((f) => ({ ...f, mortality_count: v }))} />
                <div>
                  <label className="block text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: "var(--ink-soft)" }}>Vaccination status</label>
                  <select value={form.vaccination_status} onChange={(e) => setForm((f) => ({ ...f, vaccination_status: e.target.value }))} className="w-full rounded-lg border px-3 py-2" style={{ borderColor: "var(--border)" }}>
                    <option value="unknown">Unknown</option>
                    <option value="vaccinated">Vaccinated</option>
                    <option value="unvaccinated">Unvaccinated</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <button type="button" onClick={useDeviceLocation} className="text-sm px-3 py-2 rounded-lg border font-semibold" style={{ borderColor: "var(--brand)", color: "var(--brand)" }}>
                📍 Use my current location
              </button>
              <div className="grid grid-cols-2 gap-3">
                <NumField label="Latitude" value={form.latitude} step="any" onChange={(v: number) => setForm((f) => ({ ...f, latitude: v }))} />
                <NumField label="Longitude" value={form.longitude} step="any" onChange={(v: number) => setForm((f) => ({ ...f, longitude: v }))} />
              </div>
              <p className="text-xs" style={{ color: "var(--ink-soft)" }}>
                Demo coordinates pre-filled near Bhayandar, Maharashtra. Use the button above to capture your device's real location where available.
              </p>
              <div>
                <label className="block text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: "var(--ink-soft)" }}>Additional notes</label>
                <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={3} className="w-full rounded-lg border px-3 py-2" style={{ borderColor: "var(--border)" }} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: "var(--ink-soft)" }}>Photo (optional evidence)</label>
                <input type="file" accept="image/*" className="text-sm" onChange={() => setForm((f) => ({ ...f, image_url: "uploaded-demo-image.jpg" }))} />
                <p className="text-xs mt-1" style={{ color: "var(--ink-soft)" }}>
                  Photos are evidence for veterinary review — they are not automatically diagnosed by the AI.
                </p>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3 text-sm">
              <SummaryRow label="Symptoms" value={form.symptoms.map((s) => s.replaceAll("_", " ")).join(", ") || "None selected"} />
              <SummaryRow label="Severity" value={form.severity} />
              <SummaryRow label="Duration" value={`${form.symptom_duration_days} day(s)`} />
              <SummaryRow label="Affected / Mortality" value={`${form.affected_head_count} affected, ${form.mortality_count} deaths`} />
              <SummaryRow label="Location" value={`${form.latitude.toFixed(4)}, ${form.longitude.toFixed(4)}`} />
              {error && <p style={{ color: "var(--risk-critical)" }}>{error}</p>}
            </div>
          )}
        </div>

        <div className="flex justify-between">
          <button
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            className="px-4 py-2 text-sm font-semibold rounded-lg disabled:opacity-40"
            style={{ color: "var(--ink-soft)" }}
          >
            Back
          </button>
          {step < STEPS.length - 1 ? (
            <button
              disabled={step === 0 && !form.animal_id}
              onClick={() => setStep((s) => s + 1)}
              className="px-5 py-2 text-sm font-semibold rounded-lg text-white disabled:opacity-40"
              style={{ background: "var(--brand)" }}
            >
              Next
            </button>
          ) : (
            <button
              disabled={submitting || form.symptoms.length === 0}
              onClick={submit}
              className="px-5 py-2 text-sm font-semibold rounded-lg text-white disabled:opacity-40"
              style={{ background: "var(--gold)" }}
            >
              {submitting ? "Submitting…" : "Submit Report"}
            </button>
          )}
        </div>
      </div>
    </PortalShell>
  );
}

function NumField({ label, value, onChange, step }: any) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: "var(--ink-soft)" }}>{label}</label>
      <input type="number" step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full rounded-lg border px-3 py-2" style={{ borderColor: "var(--border)" }} />
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b pb-2" style={{ borderColor: "var(--border)" }}>
      <span style={{ color: "var(--ink-soft)" }}>{label}</span>
      <span className="font-medium text-right capitalize">{value}</span>
    </div>
  );
}
