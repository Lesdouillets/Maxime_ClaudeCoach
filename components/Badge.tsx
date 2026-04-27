interface BadgeProps {
  label: string;
  variant?: "neon" | "orange" | "muted" | "surface";
  size?: "sm" | "md";
}

export default function Badge({ label, variant = "muted", size = "md" }: BadgeProps) {
  const styles = {
    neon: { background: "rgba(57,255,20,0.1)", color: "#39ff14", border: "1px solid rgba(57,255,20,0.3)" },
    orange: { background: "rgba(255,107,0,0.1)", color: "#ff6b00", border: "1px solid rgba(255,107,0,0.3)" },
    muted: { background: "#1a1a1a", color: "#888", border: "1px solid #2a2a2a" },
    surface: { background: "#222", color: "#fff", border: "1px solid #333" },
  };

  const sizes = {
    sm: "text-[10px] px-2 py-0.5",
    md: "text-xs px-3 py-1",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold tracking-wider uppercase ${sizes[size]}`}
      style={styles[variant]}
    >
      {label}
    </span>
  );
}
