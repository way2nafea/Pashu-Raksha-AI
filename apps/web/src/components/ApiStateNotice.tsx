import { ApiListState } from "@/lib/api";

export default function ApiStateNotice({ state, error, resource }: { state: ApiListState; error?: string; resource: string }) {
  if (state === "loading") {
    return <p className="text-sm" style={{ color: "var(--ink-soft)" }}>Loading {resource}…</p>;
  }
  if (state === "offline") {
    return (
      <div className="rounded-lg border p-4 text-sm" style={{ borderColor: "var(--border)", background: "#fff7ed", color: "#9a3412" }}>
        You appear to be offline — {resource} couldn't be loaded. Reconnect and reload the page to try again.
      </div>
    );
  }
  if (state === "error") {
    return (
      <div className="rounded-lg border p-4 text-sm" style={{ borderColor: "var(--border)", background: "#fef2f2", color: "#991b1b" }}>
        Could not load {resource}: {error}
      </div>
    );
  }
  return null;
}
