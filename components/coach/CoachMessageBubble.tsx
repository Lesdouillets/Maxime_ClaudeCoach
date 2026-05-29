"use client";

import { useState } from "react";
import type { ChatMessage } from "@/lib/coachChat";
import type { CoachPlan, CoachWorkout } from "@/lib/coachPlan";
import CoachPlanCard from "./CoachPlanCard";
import CoachExerciseDetailSheet from "./CoachExerciseDetailSheet";

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
          <p
            style={{
              color: "#ddd",
              fontSize: 15,
              whiteSpace: "pre-wrap",
              margin: 0,
            }}
          >
            {message.content}
          </p>
        </div>
      </div>
    );
  }

  // Message assistant : pas de bulle, texte libre suivi des cards de plans
  return (
    <>
      <div className="flex justify-start flex-col gap-2">
        <p
          style={{
            color: "#ffffff",
            fontSize: 15,
            whiteSpace: "pre-wrap",
            margin: 0,
          }}
        >
          {message.content}
        </p>

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

        {/* Cas où les plans ont déjà été appliqués (plus de pending) */}
        {isValidated && allPlans.length === 0 && (
          <CoachPlanCard
            validated
            onApply={onApply}
            onAdapt={onAdapt}
            onDetailClick={setDetailWorkout}
          />
        )}
      </div>

      {/* Sheet de détail des exercices — rendu hors de la bulle pour éviter le clipping */}
      <CoachExerciseDetailSheet
        workout={detailWorkout}
        onClose={() => setDetailWorkout(null)}
      />
    </>
  );
}
