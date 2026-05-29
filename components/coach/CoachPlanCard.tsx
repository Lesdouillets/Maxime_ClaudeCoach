import type { CSSProperties } from "react";
import type { CoachPlan, CoachWorkout, CoachRun } from "@/lib/coachPlan";
import CoachPlanRunRow from "./CoachPlanRunRow";
import CoachPlanFitnessRow from "./CoachPlanFitnessRow";

interface Props {
  plans?: CoachPlan[];
  validated?: boolean;
  applying?: boolean;
  onApply: () => void;
  onAdapt: () => void;
  onDetailClick: (plan: CoachWorkout) => void;
}

const CONTAINER_BASE: CSSProperties = {
  background: "var(--color-surface-2)",
  borderRadius: 16,
  transition: "border-color 0.3s ease",
  overflow: "hidden",
};

const SEPARATOR_STYLE: CSSProperties = {
  borderTop: "1px solid rgba(255,255,255,0.06)",
  margin: 0,
};

const ADAPT_BUTTON_STYLE: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.15)",
  background: "transparent",
  color: "var(--color-secondary)",
  borderRadius: 12,
  fontSize: 13,
  fontWeight: 600,
  padding: "8px 16px",
  cursor: "pointer",
  flex: 1,
};

const BADGE_STYLE: CSSProperties = {
  color: "var(--color-neon)",
  fontSize: 13,
  fontWeight: 600,
};

export default function CoachPlanCard({
  plans,
  validated = false,
  applying = false,
  onApply,
  onAdapt,
  onDetailClick,
}: Props) {
  if (validated) {
    return (
      <div
        style={{
          ...CONTAINER_BASE,
          border: "1px solid var(--color-neon-40)",
          padding: 12,
        }}
      >
        <span style={BADGE_STYLE}>Programme appliqué ✓</span>
      </div>
    );
  }

  const sortedPlans = plans
    ? [...plans].sort((a, b) => a.date.localeCompare(b.date))
    : [];

  const applyButtonStyle: CSSProperties = applying
    ? { opacity: 0.5, pointerEvents: "none" }
    : {};

  return (
    <div
      style={{
        ...CONTAINER_BASE,
        border: "1px solid rgba(255,255,255,0.06)",
        padding: "10px 12px",
      }}
    >
      <div>
        {sortedPlans.map((plan, index) => (
          <div key={plan.id}>
            {index > 0 && <hr style={SEPARATOR_STYLE} />}
            {plan.type === "run" ? (
              <CoachPlanRunRow plan={plan as CoachRun} />
            ) : (
              <CoachPlanFitnessRow
                plan={plan as CoachWorkout}
                onDetailClick={onDetailClick}
              />
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2 mt-3">
        <button
          style={ADAPT_BUTTON_STYLE}
          className="press-effect"
          onClick={onAdapt}
        >
          Adapter
        </button>
        <button
          className="btn-neon-ghost press-effect flex-1"
          style={applyButtonStyle}
          onClick={onApply}
        >
          {applying ? "Application…" : "Valider"}
        </button>
      </div>
    </div>
  );
}
