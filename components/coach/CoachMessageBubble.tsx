"use client";

import { useState } from "react";
import type { ChatMessage } from "@/lib/coachChat";
import type { CoachPlan, CoachWorkout } from "@/lib/coachPlan";
import CoachPlanCard from "./CoachPlanCard";
import CoachExerciseDetailModal from "./CoachExerciseDetailModal";

interface Props {
  message: ChatMessage;
  applying: boolean;
  onApply: () => void;
  onAdapt: () => void;
}

export default function CoachMessageBubble({ message, applying, onApply, onAdapt }: Props) {
  const [detailWorkout, setDetailWorkout] = useState<CoachWorkout | null>(null);

  // Cast explicite — pendingPlans est unknown[] dans ChatMessage
  const allPlans = (message.pendingPlans ?? []) as CoachPlan[];
  const runPlans = allPlans.filter((p) => p.type === "run");
  const fitnessPlans = allPlans.filter((p) => p.type === "fitness");
  const isValidated = !!(message.modifiedCount || message.deletedCount);

  // Sauvegarde des plans au premier rendu — ils disparaissent de pendingPlans après application
  const [savedRunPlans] = useState<CoachPlan[]>(() => runPlans);
  const [savedFitnessPlans] = useState<CoachPlan[]>(() => fitnessPlans);

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div
          style={{
            background: "rgba(255,255,255,0.10)",
            borderRadius: 20,
            borderBottomRightRadius: 6,
            maxWidth: "80%",
            padding: "12px 16px",
          }}
        >
          <p style={{ color: "#ddd", fontSize: 15, whiteSpace: "pre-wrap", margin: 0 }}>
            {message.content}
          </p>
        </div>
      </div>
    );
  }

  // Message assistant : texte en serif + cards de plans dessous
  return (
    <>
      <div className="flex justify-start flex-col gap-3">
        <p
          style={{
            color: "#ffffff",
            fontSize: 16,
            fontFamily: "Georgia, 'Times New Roman', serif",
            lineHeight: 1.65,
            whiteSpace: "pre-wrap",
            margin: 0,
          }}
        >
          {message.content}
        </p>

        {/* Plans en attente de validation */}
        {allPlans.length > 0 && (
          <>
            {runPlans.length > 0 && (
              <CoachPlanCard
                plans={runPlans}
                applying={applying}
                onApply={onApply}
                onAdapt={onAdapt}
                onDetailClick={setDetailWorkout}
              />
            )}
            {fitnessPlans.length > 0 && (
              <CoachPlanCard
                plans={fitnessPlans as CoachWorkout[]}
                applying={applying}
                onApply={onApply}
                onAdapt={onAdapt}
                onDetailClick={setDetailWorkout}
              />
            )}
          </>
        )}

        {/* Plans validés — bordure verte, rows visibles, sans boutons */}
        {isValidated && allPlans.length === 0 && (
          <>
            {savedRunPlans.length > 0 && (
              <CoachPlanCard
                plans={savedRunPlans}
                validated
                onApply={onApply}
                onAdapt={onAdapt}
                onDetailClick={setDetailWorkout}
              />
            )}
            {savedFitnessPlans.length > 0 && (
              <CoachPlanCard
                plans={savedFitnessPlans as CoachWorkout[]}
                validated
                onApply={onApply}
                onAdapt={onAdapt}
                onDetailClick={setDetailWorkout}
              />
            )}
          </>
        )}
      </div>

      {/* Modal de détail des exercices — rendu hors de la bulle pour éviter le clipping */}
      <CoachExerciseDetailModal
        workout={detailWorkout}
        onClose={() => setDetailWorkout(null)}
      />
    </>
  );
}
