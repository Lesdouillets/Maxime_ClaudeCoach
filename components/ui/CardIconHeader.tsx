import type { ReactNode } from "react";
import { JETBRAINS_MONO_LABEL } from "@/lib/typography";

interface CardIconHeaderProps {
  icon: ReactNode;
  label: string;
  trailing?: ReactNode;
}

export default function CardIconHeader({ icon, label, trailing }: CardIconHeaderProps) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="flex items-center justify-center rounded-full flex-shrink-0"
        style={{
          width: 28,
          height: 28,
          background: "rgba(205,255,0,0.12)",
          border: "1px solid rgba(205,255,0,0.25)",
        }}
      >
        {icon}
      </div>
      <span style={{ ...JETBRAINS_MONO_LABEL, color: "var(--color-neon-text)" }}>
        {label}
      </span>
      {trailing !== undefined && <div className="ml-auto">{trailing}</div>}
    </div>
  );
}
