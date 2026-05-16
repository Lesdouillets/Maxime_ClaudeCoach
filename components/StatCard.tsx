import Card from "./ui/Card";

interface StatCardProps {
  value: string;
  unit?: string;
  label: string;
  accent?: "neon" | "orange" | "white";
  className?: string;
}

const COLOR_VAR = {
  neon:   "var(--color-neon)",
  orange: "var(--color-orange)",
  white:  "#ffffff",
};

export default function StatCard({ value, unit, label, accent = "white", className = "" }: StatCardProps) {
  const color = COLOR_VAR[accent];

  return (
    <Card variant="surface" className={`p-4 card-hover ${className}`}>
      <div className="flex items-end gap-1 mb-1">
        <span className="font-display text-4xl leading-none" style={{ color }}>
          {value}
        </span>
        {unit && (
          <span className="text-sm font-medium pb-1" style={{ color, opacity: 0.7 }}>
            {unit}
          </span>
        )}
      </div>
      <p className="text-xs text-muted font-medium tracking-wide uppercase">
        {label}
      </p>
    </Card>
  );
}
