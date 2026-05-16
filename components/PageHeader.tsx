interface PageHeaderProps {
  title: string;
  subtitle?: string;
  accent?: "neon" | "orange";
  right?: React.ReactNode;
}

const ACCENT_COLOR = {
  neon:   "var(--color-neon)",
  orange: "var(--color-orange)",
};

const ACCENT_GLOW = {
  neon:   "0 0 30px var(--color-neon-shadow)",
  orange: "0 0 30px var(--color-orange-shadow)",
};

export default function PageHeader({ title, subtitle, accent = "neon", right }: PageHeaderProps) {
  return (
    <header className="px-5 pb-4 flex items-end justify-between" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 20px)" }}>
      <div>
        {subtitle && (
          <p className="text-xs font-medium tracking-[0.2em] uppercase mb-1" style={{ color: ACCENT_COLOR[accent] }}>
            {subtitle}
          </p>
        )}
        <h1 className="font-display text-5xl leading-none" style={{ textShadow: ACCENT_GLOW[accent] }}>
          {title}
        </h1>
      </div>
      {right}
    </header>
  );
}
