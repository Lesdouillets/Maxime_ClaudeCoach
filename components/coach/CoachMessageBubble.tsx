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
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const allPlans = message.card?.plans ?? [];
  const runPlans = allPlans.filter((p) => p.type === "run");
  const fitnessPlans = allPlans.filter((p) => p.type === "fitness");
  const isValidated = message.card?.status === "validated";

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end", maxWidth: "80%" }}>
          {message.imageBase64 && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`data:image/jpeg;base64,${message.imageBase64}`}
                alt=""
                onClick={() => setLightboxOpen(true)}
                style={{
                  width: 160,
                  height: 110,
                  borderRadius: 14,
                  borderBottomRightRadius: 4,
                  objectFit: "cover",
                  cursor: "pointer",
                }}
              />
              {lightboxOpen && (
                <div
                  onClick={() => setLightboxOpen(false)}
                  style={{
                    position: "fixed",
                    inset: 0,
                    zIndex: 200,
                    background: "rgba(0,0,0,0.9)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`data:image/jpeg;base64,${message.imageBase64}`}
                    alt=""
                    style={{
                      maxWidth: "95vw",
                      maxHeight: "90dvh",
                      borderRadius: 12,
                      objectFit: "contain",
                    }}
                  />
                </div>
              )}
            </>
          )}
          {message.content && (
            <div
              style={{
                background: "var(--color-white-10)",
                borderRadius: 20,
                borderBottomRightRadius: 6,
                padding: "12px 16px",
              }}
            >
              <p style={{ color: "#ddd", fontSize: 15, whiteSpace: "pre-wrap", margin: 0 }}>
                {message.content}
              </p>
            </div>
          )}
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
