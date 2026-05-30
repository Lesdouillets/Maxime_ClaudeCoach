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
  borderTop: "1px solid var(--color-white-06)",
  margin: 0,
};

const ADAPT_BUTTON_STYLE: CSSProperties = {
  border: "1px solid var(--color-white-15)",
  background: "transparent",
  color: "var(--color-secondary)",
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 600,
  height: 50,
  cursor: "pointer",
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
};

function PlanRows({ plans, onDetailClick }: { plans: CoachPlan[]; onDetailClick: (plan: CoachWorkout) => void }) {
  const sorted = [...plans].sort((a, b) => a.date.localeCompare(b.date));
  return (
    <div>
      {sorted.map((plan, index) => (
        <div key={plan.id}>
          {index > 0 && <hr style={SEPARATOR_STYLE} />}
          {plan.type === "run" ? (
            <CoachPlanRunRow plan={plan as CoachRun} />
          ) : (
            <CoachPlanFitnessRow plan={plan as CoachWorkout} onDetailClick={onDetailClick} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function CoachPlanCard({
  plans,
  validated = false,
  applying = false,
  onApply,
  onAdapt,
  onDetailClick,
}: Props) {
  const availablePlans = plans ?? [];

  if (validated) {
    return (
      <div style={{ ...CONTAINER_BASE, border: "1px solid var(--color-neon)", padding: "16px" }}>
        {availablePlans.length > 0 && (
          <PlanRows plans={availablePlans} onDetailClick={onDetailClick} />
        )}
      </div>
    );
  }

  const applyButtonStyle: CSSProperties = applying
    ? { opacity: 0.5, pointerEvents: "none" }
    : {};

  return (
    <div style={{ ...CONTAINER_BASE, border: "1px solid var(--color-white-06)", padding: "16px" }}>
      <PlanRows plans={availablePlans} onDetailClick={onDetailClick} />

      <div className="flex gap-3 mt-4">
        <button style={ADAPT_BUTTON_STYLE} className="press-effect" onClick={onAdapt}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          Adapter
        </button>
        <button
          className="btn-neon-ghost press-effect flex-1"
          style={{ ...applyButtonStyle, borderRadius: 8, height: 50, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
          onClick={onApply}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          {applying ? "Application…" : "Valider"}
        </button>
      </div>
    </div>
  );
}
