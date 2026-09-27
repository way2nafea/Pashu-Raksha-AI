const RISK_STYLES: Record<string, { bg: string; label: string }> = {
  LOW: { bg: "var(--risk-low)", label: "Low" },
  MODERATE: { bg: "var(--risk-moderate)", label: "Moderate" },
  HIGH: { bg: "var(--risk-high)", label: "High" },
  CRITICAL: { bg: "var(--risk-critical)", label: "Critical" },
};

export default function RiskBadge({ level, size = "md" }: { level: string; size?: "sm" | "md" }) {
  const style = RISK_STYLES[level] || { bg: "#888", label: level };
  const px = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-xs";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold text-white uppercase tracking-wide ${px}`}
      style={{ background: style.bg }}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-white/80" />
      {style.label}
    </span>
  );
}
