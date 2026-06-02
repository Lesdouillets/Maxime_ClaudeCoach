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
  isError?: boolean;
  onRetry?: () => void;
}

export default function CoachMessageBubble({ message, applying, onApply, onAdapt, isError, onRetry }: Props) {
  const [detailWorkout, setDetailWorkout] = useState<CoachWorkout | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const allPlans = message.card?.plans ?? [];
  const runPlans = allPlans.filter((p) => p.type === "run");
  const fitnessPlans = allPlans.filter((p) => p.type === "fitness");
  const isValidated = message.card?.status === "validated";

  if (message.role === "user") {
    return (
      <>
        <div className="flex justify-end">
          <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end", maxWidth: "80%" }}>
            {message.imageBase64 && (
              // eslint-disable-next-line @next/next/no-img-element
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
            )}
            {message.content && (
              <div
                style={{
                  background: "var(--color-white-10)",
                  borderRadius: 20,
                  borderBottomRightRadius: 6,
                  padding: "12px 16px",
                  ...(isError && { border: "1.5px solid var(--color-error-border)" }),
                }}
              >
                <p style={{ color: "#ddd", fontSize: 15, whiteSpace: "pre-wrap", margin: 0 }}>
                  {message.content}
                </p>
              </div>
            )}
            {isError && onRetry && (
              <button
                onClick={onRetry}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  color: "var(--color-error)",
                  fontSize: 12,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M1 4v6h6"/>
                  <path d="M23 20v-6h-6"/>
                  <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15"/>
                </svg>
                Erreur · Réessayer
              </button>
            )}
          </div>
        </div>
        {/* Lightbox — rendu hors de la bulle pour éviter le clipping overflow:hidden */}
        {lightboxOpen && message.imageBase64 && (
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
              onClick={(e) => e.stopPropagation()}
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
