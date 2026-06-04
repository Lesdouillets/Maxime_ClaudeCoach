import type { CSSProperties } from "react";
import { JETBRAINS_MONO_LABEL, JETBRAINS_MONO_TINY } from "@/lib/typography";

interface LabelProps {
  children: React.ReactNode;
  size?: "sm" | "xs";
  color?: "muted" | "dim" | "neon" | "white";
  className?: string;
  style?: CSSProperties;
}

const COLOR_MAP = {
  muted: "var(--color-muted)",
  dim:   "var(--color-dim)",
  neon:  "var(--color-neon)",
  white: "var(--color-text)",
};

const SIZE_STYLES = {
  sm: JETBRAINS_MONO_LABEL,
  xs: JETBRAINS_MONO_TINY,
};

export default function Label({ children, size = "sm", color = "muted", className = "", style }: LabelProps) {
  return (
    <span
      className={className}
      style={{
        ...SIZE_STYLES[size],
        color: COLOR_MAP[color],
        ...style,
      }}
    >
      {children}
    </span>
  );
}
