"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import PortalShell from "@/components/PortalShell";
import RiskBadge from "@/components/RiskBadge";
import { Section, Input, TextArea, SubmitButton } from "@/components/FormControls";
import { useRequireRole } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import { enqueueForSync } from "@/lib/offline";

export default function FieldWorkerCaseDetail() {
  useRequireRole(["FIELD_WORKER"]);
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<any>(null);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState<{ kind: "ok" | "offline" | "error"; text: string } | null>(null);

  async function load() {
    try {
      const d = await api.get(`/api/v1/cases/${id}`);
      setDetail(d);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Could not load this case — you may be offline.");
    }
  }
  useEffect(() => { load(); }, [id]);

  async function submitVisit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const payload = {
      case_id: id,
      observations: String(form.get("observations") || ""),
      clinical_notes: String(form.get("clinical_notes") || ""),
      symptoms_observed: String(form.get("symptoms_observed") || "").split(",").map((s) => s.trim()).filter(Boolean),
      mortality_observed: Number(form.get("mortality_observed") || 0),
      actions_taken: String(form.get("actions_taken") || ""),
      sample_collected: form.get("sample_collected") === "on",
    };
    try {
      await api.post("/api/v1/visits", payload);
      setNotice({ kind: "ok", text: "Field visit recorded." });
      (e.target as HTMLFormElement).reset();
      load();
    } catch (err) {
      if (err instanceof ApiError) {
        setNotice({ kind: "error", text: err.message });
      } else {
        enqueueForSync(`Field visit — case ${id}`, "/api/v1/visits", payload);
        setNotice({ kind: "offline", text: "You're offline. Saved on this device — it will sync automatically once you're back online." });
        (e.target as HTMLFormElement).reset();
      }
    }
  }

  async function submitVaccination(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const payload = {
      animal_id: detail?.animal?.id,
      vaccine_name: String(form.get("vaccine_name") || ""),
      dose: String(form.get("dose") || "1"),
      next_due_date: String(form.get("next_due_date") || "") || null,
      notes: String(form.get("notes") || ""),
    };
    try {
      await api.post("/api/v1/vaccinations", payload);
      setNotice({ kind: "ok", text: "Vaccination recorded." });
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      if (err instanceof ApiError) {
        setNotice({ kind: "error", text: err.message });
      } else {
        enqueueForSync(`Vaccination — animal ${detail?.animal?.id}`, "/api/v1/vaccinations", payload);
        setNotice({ kind: "offline", text: "You're offline. Vaccination saved on this device and will sync automatically." });
        (e.target as HTMLFormElement).reset();
      }
    }
  }

  async function markSample(sampleId: string, status: "COLLECTED" | "SENT") {
    try {
      await api.post(`/api/v1/lab/samples/${sampleId}/status`, { status });
      setNotice({ kind: "ok", text: `Sample marked ${status.toLowerCase()}.` });
      load();
    } catch (err) {
      if (err instanceof ApiError) {
        setNotice({ kind: "error", text: err.message });
      } else {
        enqueueForSync(`Sample ${status}`, `/api/v1/lab/samples/${sampleId}/status`, { status });
        setNotice({ kind: "offline", text: "You're offline. This will sync automatically once you're back online." });
      }
    }
  }

  if (loadError && !detail) {
    return (
      <PortalShell>
        <div className="rounded-lg border p-4 text-sm max-w-lg" style={{ borderColor: "var(--border)", background: "#fef2f2", color: "#991b1b" }}>
          {loadError}
        </div>
      </PortalShell>
    );
  }
  if (!detail) {
    return <PortalShell><p className="text-sm" style={{ color: "var(--ink-soft)" }}>Loading case…</p></PortalShell>;
  }

  return (
    <PortalShell>
      <div className="max-w-2xl space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            {detail.risk_level && <RiskBadge level={detail.risk_level} />}
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ink-soft)" }}>
              {detail.status?.replace(/_/g, " ")}
            </span>
          </div>
          <h1 className="font-display text-2xl capitalize" style={{ color: "var(--ink)" }}>{detail.species} case</h1>
          <p className="text-sm" style={{ color: "var(--ink-soft)" }}>{detail.village}, {detail.district}</p>
        </div>

        {notice && (
          <div className="rounded-lg border p-3 text-sm" style={{
            borderColor: "var(--border)",
            background: notice.kind === "ok" ? "#f0fdf4" : notice.kind === "offline" ? "#fff7ed" : "#fef2f2",
            color: notice.kind === "ok" ? "#166534" : notice.kind === "offline" ? "#9a3412" : "#991b1b",
          }}>
            {notice.text}
          </div>
        )}

        <div className="rounded-xl border bg-white p-4 space-y-3" style={{ borderColor: "var(--border)" }}>
          <Section title="Animal & Farm">
            <p className="text-sm" style={{ color: "var(--ink)" }}>
              {detail.animal?.species} · {detail.animal?.breed} · Tag {detail.animal?.tag_id}
            </p>
            <p className="text-sm" style={{ color: "var(--ink-soft)" }}>{detail.farm?.farm_name}</p>
          </Section>
          {detail.farmer && (
            <Section title="Farmer">
              <p className="text-sm" style={{ color: "var(--ink)" }}>{detail.farmer.name} · {detail.farmer.phone}</p>
            </Section>
          )}
          {detail.report && (
            <Section title="Reported symptoms">
              <p className="text-sm" style={{ color: "var(--ink)" }}>{(detail.report.symptoms || []).join(", ")}</p>
            </Section>
          )}
        </div>

        {detail.samples?.length > 0 && (
          <div className="rounded-xl border bg-white p-4" style={{ borderColor: "var(--border)" }}>
            <h2 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--ink-soft)" }}>Sample collection</h2>
            <div className="space-y-2">
              {detail.samples.map((s: any) => (
                <div key={s.id} className="flex items-center justify-between gap-3 text-sm">
                  <span style={{ color: "var(--ink)" }}>{s.test_type} — <span style={{ color: "var(--ink-soft)" }}>{s.status}</span></span>
                  {s.status === "REQUESTED" && (
                    <button onClick={() => markSample(s.id, "COLLECTED")} className="text-xs font-semibold px-2.5 py-1 rounded-md border" style={{ borderColor: "var(--brand)", color: "var(--brand)" }}>
                      Mark collected
                    </button>
                  )}
                  {s.status === "COLLECTED" && (
                    <button onClick={() => markSample(s.id, "SENT")} className="text-xs font-semibold px-2.5 py-1 rounded-md border" style={{ borderColor: "var(--brand)", color: "var(--brand)" }}>
                      Mark sent to lab
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={submitVisit} className="rounded-xl border bg-white p-4 space-y-3" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ink-soft)" }}>Record field visit</h2>
          <TextArea name="observations" label="Observations" required />
          <TextArea name="clinical_notes" label="Clinical notes" />
          <Input name="symptoms_observed" label="Symptoms observed (comma separated)" />
          <div className="grid grid-cols-2 gap-3">
            <Input name="mortality_observed" label="Mortality observed" type="number" defaultValue={0} />
            <label className="flex items-center gap-2 text-sm pt-6" style={{ color: "var(--ink)" }}>
              <input type="checkbox" name="sample_collected" /> Sample collected during visit
            </label>
          </div>
          <TextArea name="actions_taken" label="Actions taken" />
          <SubmitButton>Save field visit</SubmitButton>
        </form>

        <form onSubmit={submitVaccination} className="rounded-xl border bg-white p-4 space-y-3" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ink-soft)" }}>Record vaccination</h2>
          <Input name="vaccine_name" label="Vaccine name" required />
          <div className="grid grid-cols-2 gap-3">
            <Input name="dose" label="Dose" defaultValue="1" />
            <Input name="next_due_date" label="Next due date" type="date" />
          </div>
          <TextArea name="notes" label="Notes" />
          <SubmitButton>Save vaccination</SubmitButton>
        </form>
      </div>
    </PortalShell>
  );
}
