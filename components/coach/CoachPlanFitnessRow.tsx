import type { CSSProperties } from "react";
import type { CoachWorkout } from "@/lib/coachPlan";
import { formatPlanDate } from "@/lib/formatting";

interface Props {
  plan: CoachWorkout;
  onDetailClick: (plan: CoachWorkout) => void;
}

const DATE_STYLE: CSSProperties = {
  fontFamily: "var(--font-mono, monospace)",
  fontSize: 12,
  fontWeight: 500,
  letterSpacing: "0.1em",
  color: "var(--color-secondary)",
  flexShrink: 0,
};

const LABEL_STYLE: CSSProperties = {
  fontSize: 12,
  color: "var(--color-neon-text)",
  textTransform: "uppercase",
  textAlign: "right",
};

const DETAIL_STYLE: CSSProperties = {
  fontFamily: "var(--font-mono, monospace)",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.1em",
  color: "var(--color-text)",
  textAlign: "right",
};


export default function CoachPlanFitnessRow({ plan, onDetailClick }: Props) {
  const exoCount = plan.exercises.length;
  const exoLabel = `${exoCount} exo${exoCount > 1 ? "s" : ""}`;

  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <span style={DATE_STYLE}>{formatPlanDate(plan.date)}</span>
      <div className="flex flex-col items-end gap-0.5">
        <span className="font-mono font-bold tracking-widest" style={LABEL_STYLE}>
          {plan.label}
        </span>
        <button
          onClick={() => onDetailClick(plan)}
          style={{ ...DETAIL_STYLE, background: "none", border: "none", padding: 0, cursor: "pointer" }}
        >
          {exoLabel} | Détail &gt;
        </button>
      </div>
    </div>
  );
}
