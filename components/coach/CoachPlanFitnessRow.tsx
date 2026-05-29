import type { CSSProperties } from "react";
import type { CoachWorkout } from "@/lib/coachPlan";

interface Props {
  plan: CoachWorkout;
  onDetailClick: (plan: CoachWorkout) => void;
}

const DATE_STYLE: CSSProperties = {
  fontFamily: "var(--font-mono, monospace)",
  fontSize: 12,
  color: "var(--color-secondary)",
  flexShrink: 0,
};

const CATEGORY_STYLE: CSSProperties = {
  fontSize: 12,
  color: "var(--color-neon)",
  textTransform: "uppercase",
};

const COUNT_STYLE: CSSProperties = {
  fontFamily: "var(--font-mono, monospace)",
  fontSize: 12,
  color: "var(--color-secondary)",
};

const DETAIL_BUTTON_STYLE: CSSProperties = {
  fontFamily: "var(--font-mono, monospace)",
  fontSize: 12,
  color: "var(--color-neon)",
  background: "none",
  border: "none",
  padding: 0,
  cursor: "pointer",
};

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatCategory(category: CoachWorkout["category"]): string {
  return category === "upper" ? "HAUT DU CORPS" : "BAS DU CORPS";
}

export default function CoachPlanFitnessRow({ plan, onDetailClick }: Props) {
  const exoCount = plan.exercises.length;
  const exoLabel = `${exoCount} exo${exoCount > 1 ? "s" : ""}`;

  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span style={DATE_STYLE}>{formatDate(plan.date)}</span>
      <span className="font-mono font-bold tracking-widest" style={CATEGORY_STYLE}>{formatCategory(plan.category)}</span>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span style={COUNT_STYLE}>{exoLabel}</span>
        <button style={DETAIL_BUTTON_STYLE} onClick={() => onDetailClick(plan)}>
          Détail &gt;
        </button>
      </div>
    </div>
  );
}
