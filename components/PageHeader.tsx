interface PageHeaderProps {
  title: string;
  subtitle?: string;
  accent?: "neon" | "orange" | "primary";
  right?: React.ReactNode;
}

const ACCENT_COLORS: Record<string, string> = {
  neon: "#30D158",
  orange: "#FF9F0A",
  primary: "#0A84FF",
};

export default function PageHeader({
  title,
  subtitle,
  accent = "primary",
  right,
}: PageHeaderProps) {
  const accentColor = ACCENT_COLORS[accent] ?? "#0A84FF";

  return (
    <header className="px-5 pb-4 flex items-end justify-between" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 20px)" }}>
      <div>
        {subtitle && (
          <p
            className="text-xs font-semibold tracking-wider uppercase mb-1"
            style={{ color: accentColor, opacity: 0.85 }}
          >
            {subtitle}
          </p>
        )}
        <h1 className="font-display text-5xl leading-none tracking-tight">
          {title}
        </h1>
      </div>
      {right && <div>{right}</div>}
    </header>
  );
}
