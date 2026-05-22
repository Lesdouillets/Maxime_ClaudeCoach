import { JETBRAINS_MONO_LABEL } from "@/lib/typography";

interface CardIconHeaderProps {
  icon: React.ReactNode;
  label: string;
  trailing?: React.ReactNode;
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
      <span style={{ ...JETBRAINS_MONO_LABEL, color: "var(--color-neon)" }}>
        {label}
      </span>
      {trailing !== undefined && <div className="ml-auto">{trailing}</div>}
    </div>
  );
}
