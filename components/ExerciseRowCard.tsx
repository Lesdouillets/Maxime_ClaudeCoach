import { CheckIcon } from "@/components/icons";
import { ARCHIVO_WIDE_BOLD, JETBRAINS_MONO_DATA } from "@/lib/typography";

const ROW_NAME_STYLE = { ...ARCHIVO_WIDE_BOLD, fontSize: 16, lineHeight: "20px" };

interface Props {
  name: string;
  sets: number;
  reps: number;
  weight: number;
  variant: "planned" | "upcoming" | "completed" | "in_progress";
  doneSets?: number;
  onTap?: () => void;
}

const STYLES = {
  planned:     { bg: "#141414",                   border: "1px solid #1d1d1d",                    nameColor: "#fff", dashColor: "#2a2a2a" },
  upcoming:    { bg: "#141414",                   border: "1px solid #1d1d1d",                    nameColor: "#fff", dashColor: "#2a2a2a" },
  completed:   { bg: "var(--color-neon-bg)",      border: "1px solid var(--color-neon-08)",        nameColor: "#555", dashColor: "#CDFF00" },
  in_progress: { bg: "#141414",                   border: "1px solid #1d1d1d",                    nameColor: "#fff", dashColor: "#2a2a2a" },
} as const;

function SetDashes({ count, color, doneSets }: { count: number; color: string; doneSets?: number }) {
  if (count <= 0) return <span style={{ color: "#333" }}>—</span>;
  const total = Math.min(count, 8);
  const done = Math.min(doneSets ?? 0, total);
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className="inline-block rounded-full"
          style={{ width: 18, height: 4, background: i < done ? "var(--color-neon)" : color }}
        />
      ))}
    </div>
  );
}

export default function ExerciseRowCard({ name, sets, reps, weight, variant, doneSets, onTap }: Props) {
  const s = STYLES[variant];
  const isCompleted = variant === "completed";

  return (
    <div
      onClick={onTap}
      className={`rounded-2xl px-4 py-3${onTap ? " press-effect" : ""}`}
      style={{ background: s.bg, border: s.border }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p style={{ ...ROW_NAME_STYLE, color: s.nameColor }}>{name}</p>
          <div className="flex items-center gap-2 mt-2">
            <SetDashes count={sets} color={s.dashColor} doneSets={variant === "in_progress" ? doneSets : undefined} />
            <span style={{ ...JETBRAINS_MONO_DATA, color: isCompleted ? "#444" : "#7A7C7E" }}>
              · {reps} reps{weight > 0 ? ` · ${weight} kg` : ""}
            </span>
          </div>
        </div>
        {isCompleted && (
          <div className="flex-shrink-0">
            <CheckIcon size={20} color="#CDFF00" />
          </div>
        )}
      </div>
    </div>
  );
}
