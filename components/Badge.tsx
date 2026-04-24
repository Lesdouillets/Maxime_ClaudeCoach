interface BadgeProps {
  label: string;
  variant?: "primary" | "success" | "warning" | "danger" | "muted" | "surface" | "neon" | "orange";
  size?: "sm" | "md";
}

const VARIANT_STYLES: Record<string, React.CSSProperties> = {
  primary: { background: "rgba(10,132,255,0.15)", color: "#0A84FF", border: "1px solid rgba(10,132,255,0.3)" },
  success: { background: "rgba(48,209,88,0.15)", color: "#30D158", border: "1px solid rgba(48,209,88,0.3)" },
  warning: { background: "rgba(255,159,10,0.15)", color: "#FF9F0A", border: "1px solid rgba(255,159,10,0.3)" },
  danger:  { background: "rgba(255,69,58,0.15)",  color: "#FF453A", border: "1px solid rgba(255,69,58,0.3)" },
  muted:   { background: "rgba(255,255,255,0.06)", color: "rgba(235,235,245,0.5)", border: "1px solid rgba(255,255,255,0.1)" },
  surface: { background: "#2C2C2E", color: "#fff", border: "1px solid rgba(255,255,255,0.08)" },
  // Legacy aliases
  neon:    { background: "rgba(48,209,88,0.15)", color: "#30D158", border: "1px solid rgba(48,209,88,0.3)" },
  orange:  { background: "rgba(255,159,10,0.15)", color: "#FF9F0A", border: "1px solid rgba(255,159,10,0.3)" },
};

const SIZE_CLASSES: Record<string, string> = {
  sm: "text-[10px] px-2 py-0.5",
  md: "text-xs px-3 py-1",
};

export default function Badge({ label, variant = "muted", size = "md" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold tracking-wider uppercase ${SIZE_CLASSES[size]}`}
      style={VARIANT_STYLES[variant] ?? VARIANT_STYLES.muted}
    >
      {label}
    </span>
  );
}
