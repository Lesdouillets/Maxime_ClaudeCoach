"use client";

import { FitnessCard } from "@/components/SessionCard";
import CoachFeedbackCard from "@/components/CoachFeedbackCard";
import PlannedExerciseRow from "@/components/PlannedExerciseRow";
import { JETBRAINS_MONO_LABEL } from "@/lib/typography";
import type { CoachAnalysisResult } from "@/lib/coachAnalyzer";
import type { CoachWorkout } from "@/lib/coachPlan";
import type { FitnessSession } from "@/lib/types";

interface Props {
  session: FitnessSession | null;
  coachWorkout: CoachWorkout | null;
  coachState: "analyzing" | "done";
  coachResult: CoachAnalysisResult | null;
  onRetry?: () => void;
}

export default function SessionCompletedView({ session, coachWorkout, coachState, coachResult, onRetry }: Props) {
  const exercises = session?.exercises ?? [];

  return (
    <div className="flex-1 overflow-y-auto px-3 pt-2 pb-8 space-y-3">
      <FitnessCard
        todayCoachWorkout={coachWorkout}
        todaySession={session}
        onOpenSession={() => {}}
        variant="embedded"
      />

      <CoachFeedbackCard
        state={coachState}
        result={coachResult}
        onRetry={onRetry}
      />

      {exercises.length > 0 && (
        <>
          <p className="px-1 pt-1" style={{ ...JETBRAINS_MONO_LABEL, color: "var(--color-muted)" }}>
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
    </div>
  );
}
