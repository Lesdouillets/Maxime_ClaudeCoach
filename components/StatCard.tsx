interface StatCardProps {
  value: string;
  unit?: string;
  label: string;
  accent?: "neon" | "orange" | "white";
  className?: string;
}

export default function StatCard({
  value,
  unit,
  label,
  accent = "white",
  className = "",
}: StatCardProps) {
  const colors = {
    neon: "#39ff14",
    orange: "#ff6b00",
    white: "#ffffff",
  };

  return (
    <div
      className={`rounded-2xl p-4 card-hover ${className}`}
      style={{ background: "#111111" }}
    >
      <div className="flex items-end gap-1 mb-1">
        <span
          className="font-display text-4xl leading-none"
          style={{ color: colors[accent] }}
        >
          {value}
        </span>
        {unit && (
          <span className="text-sm font-medium pb-1" style={{ color: colors[accent], opacity: 0.7 }}>
            {unit}
          </span>
        )}
      </div>
      <p className="text-xs text-muted font-medium tracking-wide uppercase">
        {label}
      </p>
    </div>
  );
}
