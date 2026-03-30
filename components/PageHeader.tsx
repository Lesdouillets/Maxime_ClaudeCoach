interface PageHeaderProps {
  title: string;
  subtitle?: string;
  accent?: "neon" | "orange";
  right?: React.ReactNode;
}

export default function PageHeader({
  title,
  subtitle,
  accent = "neon",
  right,
}: PageHeaderProps) {
  return (
    <header className="px-5 pt-12 pb-4 flex items-end justify-between">
      <div>
        {subtitle && (
          <p className="text-xs font-medium tracking-[0.2em] uppercase mb-1"
             style={{ color: accent === "neon" ? "#39ff14" : "#ff6b00" }}>
            {subtitle}
          </p>
        )}
        <h1
          className="font-display text-5xl leading-none"
          style={{
            textShadow: accent === "neon"
              ? "0 0 30px rgba(57,255,20,0.3)"
              : "0 0 30px rgba(255,107,0,0.3)",
          }}
        >
          {title}
        </h1>
      </div>
      {right && <div>{right}</div>}
    </header>
  );
}
