"use client";

import { useState } from "react";
import type { ChatMessage } from "@/lib/coachChat";
import type { CoachWorkout } from "@/lib/coachPlan";
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

  const allPlans = message.card?.plans ?? [];
  const runPlans = allPlans.filter((p) => p.type === "run");
  const fitnessPlans = allPlans.filter((p) => p.type === "fitness");
  const isValidated = message.card?.status === "validated";

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div
          style={{
            background: "var(--color-white-10)",
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

        {/* Plans de la carte — pending ou validés */}
        {allPlans.length > 0 && (
          <>
            {runPlans.length > 0 && (
              <CoachPlanCard
                plans={runPlans}
                validated={isValidated}
                applying={applying}
                onApply={onApply}
                onAdapt={onAdapt}
                onDetailClick={setDetailWorkout}
              />
            )}
            {fitnessPlans.length > 0 && (
              <CoachPlanCard
                plans={fitnessPlans as CoachWorkout[]}
                validated={isValidated}
                applying={applying}
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
