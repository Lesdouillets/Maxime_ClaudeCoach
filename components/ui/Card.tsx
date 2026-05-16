import type { CSSProperties } from "react";

interface CardProps {
  children: React.ReactNode;
  variant?: "surface" | "surface-2" | "neon-bg";
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
}

const BG_MAP = {
  "surface":   "var(--color-surface)",
  "surface-2": "var(--color-surface-2)",
  "neon-bg":   "var(--color-neon-bg)",
};

const BORDER_MAP = {
  "surface":   "1px solid var(--color-surface-3)",
  "surface-2": "1px solid var(--color-subtle)",
  "neon-bg":   "1px solid var(--color-neon-08)",
};

export default function Card({ children, variant = "surface-2", className = "", style, onClick }: CardProps) {
  const isInteractive = !!onClick;

  return (
    <div
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onKeyDown={isInteractive ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(); } : undefined}
      className={`rounded-2xl ${isInteractive ? "press-effect card-hover cursor-pointer" : ""} ${className}`}
      style={{ background: BG_MAP[variant], border: BORDER_MAP[variant], ...style }}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
