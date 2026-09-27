export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b last:border-b-0 pb-3 last:pb-0" style={{ borderColor: "var(--border)" }}>
      <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--ink-soft)" }}>{title}</p>
      {children}
    </div>
  );
}

export function Input({ name, label, type = "text", required, defaultValue }: any) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: "var(--ink-soft)" }}>{label}</label>
      <input name={name} type={type} required={required} defaultValue={defaultValue} className="w-full rounded-lg border px-3 py-2" style={{ borderColor: "var(--border)" }} />
    </div>
  );
}

export function TextArea({ name, label, required }: any) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: "var(--ink-soft)" }}>{label}</label>
      <textarea name={name} required={required} rows={2} className="w-full rounded-lg border px-3 py-2" style={{ borderColor: "var(--border)" }} />
    </div>
  );
}

export function SubmitButton({ children }: { children: React.ReactNode }) {
  return <button className="rounded-lg px-4 py-2 text-white font-semibold text-sm" style={{ background: "var(--brand)" }}>{children}</button>;
}
