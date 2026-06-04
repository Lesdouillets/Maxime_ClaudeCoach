"use client";

import type { CoachWorkout } from "@/lib/coachPlan";
import ExerciseRowCard from "@/components/ExerciseRowCard";
import { JETBRAINS_MONO_LABEL } from "@/lib/typography";

interface Props {
  workout: CoachWorkout | null;
  onClose: () => void;
}

export default function CoachExerciseDetailModal({ workout, onClose }: Props) {
  if (workout === null) return null;

  return (
    <div
      role="dialog"
      aria-modal
      aria-label={`Exercices — ${workout.label}`}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        background: "var(--color-overlay)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        paddingTop: "calc(env(safe-area-inset-top, 0px) + 20px)",
        paddingBottom: 20,
        paddingLeft: 20,
        paddingRight: 20,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="rounded-3xl w-full max-w-md"
        style={{
          background: "var(--color-surface-2)",
          border: "1px solid var(--color-subtle)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.7)",
          maxHeight: "80vh",
          overflowY: "auto",
        }}
      >
        {/* Header sticky — label du workout centré, bouton fermeture à droite */}
        <div
          className="flex items-center justify-between p-4"
          style={{
            position: "sticky",
            top: 0,
            zIndex: 1,
            background: "var(--color-surface-2)",
          }}
        >
          <div style={{ width: 36, height: 36, flexShrink: 0 }} />

          <span style={{ ...JETBRAINS_MONO_LABEL, color: "var(--color-neon-text)" }}>
            {workout.label}
          </span>

          <button
            onClick={onClose}
            className="btn-icon btn-icon-surface press-effect"
            aria-label="Fermer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path
                d="M6 6l12 12M6 18L18 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Liste des exercices */}
        <div className="flex flex-col gap-2" style={{ padding: "0 16px calc(env(safe-area-inset-bottom, 0px) + 24px)" }}>
          {workout.exercises.map((exercise, index) => (
            <ExerciseRowCard
              key={`${exercise.name}-${index}`}
              name={exercise.name}
              sets={exercise.sets}
              reps={exercise.reps}
              weight={exercise.weight}
              variant="planned"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
