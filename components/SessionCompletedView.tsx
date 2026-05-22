// components/SessionCompletedView.tsx
"use client";

import { FitnessCard } from "@/components/SessionCard";
import CoachFeedbackCard from "@/components/CoachFeedbackCard";
import PlannedExerciseRow from "@/components/PlannedExerciseRow";
import { JETBRAINS_MONO_LABEL } from "@/lib/typography";
import type { FinishingState } from "@/contexts/SessionContext";
import type { CoachWorkout } from "@/lib/coachPlan";

interface Props {
  finishing: FinishingState;
  sessionCoachWorkout: CoachWorkout | null;
  onRetry: () => void;
  onContinue: () => void;
}

export default function SessionCompletedView({ finishing, sessionCoachWorkout, onRetry, onContinue }: Props) {
  const fitnessSession = finishing.session ?? null;
  const coachState: "analyzing" | "done" =
    finishing.status === "done" || finishing.status === "error" ? "done" : "analyzing";
  const showContinue = finishing.status === "done" || finishing.status === "error";
  const exercises = fitnessSession?.exercises ?? [];

  return (
    <div className="flex-1 overflow-y-auto px-3 pt-2 pb-32 space-y-3">
      <FitnessCard
        todayCoachWorkout={sessionCoachWorkout}
        todaySession={fitnessSession}
        onOpenSession={() => {}}
        variant="embedded"
      />

      <CoachFeedbackCard
        state={coachState}
        result={finishing.result ?? null}
        onRetry={finishing.status === "error" ? onRetry : undefined}
      />

      {exercises.length > 0 && (
        <>
          <p className="px-1 pt-1" style={{ ...JETBRAINS_MONO_LABEL, color: "#555" }}>
            RAPPEL DE LA SÉANCE
          </p>
          {exercises.map((ex) => (
            <PlannedExerciseRow
              key={ex.id}
              name={ex.name}
              sets={ex.setLogs?.length ?? ex.sets}
              reps={ex.reps}
              weight={ex.weight}
            />
          ))}
        </>
      )}

      {showContinue && (
        <div
          className="fixed left-0 right-0 px-4 pt-3"
          style={{
            bottom: 0,
            paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
            background: "linear-gradient(to top, #0a0a0a 70%, transparent)",
            zIndex: 10,
          }}
        >
          <button
            type="button"
            onClick={onContinue}
            className="w-full flex items-center justify-center gap-2 press-effect"
            style={{
              background: "rgba(205,255,0,0.12)",
              border: "1px solid rgba(205,255,0,0.4)",
              color: "var(--color-neon)",
              borderRadius: "12px",
              padding: "15px 24px",
              fontWeight: 600,
              fontSize: "15px",
            }}
          >
            Continuer →
          </button>
        </div>
      )}
    </div>
  );
}
