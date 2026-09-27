"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import PortalShell from "@/components/PortalShell";
import RiskBadge from "@/components/RiskBadge";
import { useRequireRole, useAuth } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";

type CaseRow = {
  id: string;
  species: string;
  district: string;
  village: string;
  status: string;
  ai_risk_level?: string;
  assigned_field_worker_id?: string | null;
  created_at?: string;
};

type LoadState = "loading" | "ready" | "error" | "offline";

export default function FieldWorkerDashboard() {
  useRequireRole(["FIELD_WORKER"]);
  const { user } = useAuth();

  const [myTasks, setMyTasks] = useState<CaseRow[]>([]);
  const [nearby, setNearby] = useState<CaseRow[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [claimingId, setClaimingId] = useState<string | null>(null);

  async function load() {
    setState("loading");
    try {
      const [mine, all] = await Promise.all([
        api.get("/api/v1/cases?assigned_to_me=true"),
        api.get("/api/v1/cases"),
      ]);
      setMyTasks(mine);
      setNearby(all.filter((c: CaseRow) => !c.assigned_field_worker_id));
      setState("ready");
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMsg(err.message);
        setState("error");
      } else {
        setState("offline");
      }
    }
  }

  useEffect(() => { load(); }, []);

  async function takeTask(caseId: string) {
    if (!user) return;
    setClaimingId(caseId);
    try {
      await api.post(`/api/v1/cases/${caseId}/assign-field-worker`, { field_worker_id: user.id });
      await load();
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Could not claim this task — check your connection.");
    } finally {
      setClaimingId(null);
    }
  }

  return (
    <PortalShell>
      <div className="max-w-4xl">
        <h1 className="font-display text-2xl mb-1" style={{ color: "var(--ink)" }}>My Tasks</h1>
        <p className="text-sm mb-6" style={{ color: "var(--ink-soft)" }}>
          Cases assigned to you, and unassigned cases nearby you can pick up.
        </p>

        {state === "loading" && <p className="text-sm" style={{ color: "var(--ink-soft)" }}>Loading tasks…</p>}
        {state === "offline" && (
          <div className="rounded-lg border p-4 text-sm" style={{ borderColor: "var(--border)", background: "#fff7ed", color: "#9a3412" }}>
            You appear to be offline. Task lists need a connection to load, but any field visit or
            vaccination you record below will be saved on this device and synced automatically once you're back online.
          </div>
        )}
        {state === "error" && (
          <div className="rounded-lg border p-4 text-sm" style={{ borderColor: "var(--border)", background: "#fef2f2", color: "#991b1b" }}>
            Could not load tasks: {errorMsg}
          </div>
        )}

        {state === "ready" && (
          <>
            <Section title={`Assigned to me (${myTasks.length})`}>
              {myTasks.length === 0 ? (
                <Empty text="No tasks assigned to you yet. Pick one up from the list below, or wait for a vet to assign one." />
              ) : (
                <div className="space-y-3">
                  {myTasks.map((c) => (
                    <CaseCard key={c.id} c={c} action={<Link href={`/field-worker/${c.id}`} className="text-sm font-semibold px-3 py-1.5 rounded-md text-white" style={{ background: "var(--brand)" }}>Open</Link>} />
                  ))}
                </div>
              )}
            </Section>

            <Section title={`Unassigned nearby cases (${nearby.length})`}>
              {nearby.length === 0 ? (
                <Empty text="No unassigned cases right now." />
              ) : (
                <div className="space-y-3">
                  {nearby.map((c) => (
                    <CaseCard key={c.id} c={c} action={
                      <button
                        disabled={claimingId === c.id}
                        onClick={() => takeTask(c.id)}
                        className="text-sm font-semibold px-3 py-1.5 rounded-md border disabled:opacity-60"
                        style={{ borderColor: "var(--brand)", color: "var(--brand)" }}
                      >
                        {claimingId === c.id ? "Claiming…" : "Take this task"}
                      </button>
                    } />
                  ))}
                </div>
              )}
            </Section>
          </>
        )}
      </div>
    </PortalShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--ink-soft)" }}>{title}</h2>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed p-6 text-sm text-center" style={{ borderColor: "var(--border)", color: "var(--ink-soft)" }}>
      {text}
    </div>
  );
}

function CaseCard({ c, action }: { c: CaseRow; action: React.ReactNode }) {
  return (
    <div className="rounded-xl border p-4 flex items-center justify-between gap-4 bg-white" style={{ borderColor: "var(--border)" }}>
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-1">
          {c.ai_risk_level && <RiskBadge level={c.ai_risk_level} />}
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ink-soft)" }}>{c.status.replace(/_/g, " ")}</span>
        </div>
        <div className="font-semibold capitalize" style={{ color: "var(--ink)" }}>{c.species}</div>
        <div className="text-sm truncate" style={{ color: "var(--ink-soft)" }}>{c.village}, {c.district}</div>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}
