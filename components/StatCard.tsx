interface StatCardProps {
  value: string;
  unit?: string;
  label: string;
  accent?: "primary" | "success" | "warning" | "white" | "neon" | "orange";
  className?: string;
}

const ACCENT_COLORS: Record<string, string> = {
  primary: "#0A84FF",
  success: "#30D158",
  warning: "#FF9F0A",
  white: "#ffffff",
  neon: "#30D158",
  orange: "#FF9F0A",
};

export default function StatCard({
  value,
  unit,
  label,
  accent = "white",
  className = "",
}: StatCardProps) {
  const color = ACCENT_COLORS[accent] ?? "#ffffff";

  return (
    <div
      className={`rounded-2xl p-4 card-hover ${className}`}
      style={{
        background: "#1C1C1E",
        boxShadow: "0 2px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)",
      }}
    >
      <div className="flex items-end gap-1 mb-1">
        <span
          className="font-display text-4xl leading-none"
          style={{ color }}
        >
          {value}
        </span>
        {unit && (
          <span className="text-sm font-medium pb-1" style={{ color, opacity: 0.6 }}>
            {unit}
          </span>
        )}
      </div>
      <p className="text-xs font-medium tracking-wide uppercase" style={{ color: "rgba(235,235,245,0.4)" }}>
        {label}
      </p>
    </div>
  );
}
