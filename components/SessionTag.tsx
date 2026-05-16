import { RunIcon } from "./icons/RunIcon";
import { WeightIcon } from "./icons/WeightIcon";
import { RestIcon } from "./icons/RestIcon";

export type SessionType   = "run" | "fitness" | "rest";
export type SessionStatus = "planned" | "today" | "done" | "missed";
export type SessionTagSize = "sm" | "md" | "lg";

export interface SessionTagProps {
  type: SessionType;
  status: SessionStatus;
  size?: SessionTagSize;
  tooltip?: string;
  className?: string;
  onClick?: () => void;
}

const SIZE_MAP: Record<SessionTagSize, { dim: number; iconSize: number; radius: number }> = {
  sm: { dim: 32, iconSize: 16, radius: 6 },
  md: { dim: 44, iconSize: 22, radius: 8 },
  lg: { dim: 60, iconSize: 30, radius: 12 },
};

const TYPE_BORDER_COLOR: Record<SessionType, string> = {
  run:     "var(--color-blue)",
  fitness: "var(--color-orange)",
  rest:    "var(--color-muted)",
};

function getStyles(type: SessionType, status: SessionStatus): {
  background: string;
  border: string;
  iconColor: string;
} {
  const typeBorder = TYPE_BORDER_COLOR[type];

  switch (status) {
    case "planned":
      return {
        background: "var(--color-surface-3)",
        border: `2px solid ${typeBorder}`,
        iconColor: "#ffffff",
      };
    case "today":
      return {
        background: "#ffffff",
        border: `2px solid ${typeBorder}`,
        iconColor: "var(--color-surface-3)",
      };
    case "done":
      return {
        background: "var(--color-neon)",
        border: `2px solid var(--color-neon)`,
        iconColor: "var(--color-surface-3)",
      };
    case "missed":
      return {
        background: "var(--color-error-bg)",
        border: "2px solid var(--color-error-border)",
        iconColor: "#ffffff",
      };
  }
}

export function SessionTag({
  type,
  status,
  size = "md",
  tooltip,
  className,
  onClick,
}: SessionTagProps) {
  const { dim, iconSize, radius } = SIZE_MAP[size];
  const { background, border, iconColor } = getStyles(type, status);

  const Icon = type === "run" ? RunIcon : type === "fitness" ? WeightIcon : RestIcon;

  return (
    <div
      title={tooltip}
      onClick={onClick}
      className={className}
      style={{
        width: dim,
        height: dim,
        borderRadius: radius,
        background,
        border,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <Icon size={iconSize} color={iconColor} />
    </div>
  );
}
