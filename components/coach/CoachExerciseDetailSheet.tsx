"use client";

import type { CoachWorkout, CoachExercise } from "@/lib/coachPlan";

interface Props {
  workout: CoachWorkout | null; // null = sheet fermé
  onClose: () => void;
}

// Affiche les métriques d'un exercice sous forme de tirets lisibles
function ExerciseMetrics({ exercise }: { exercise: CoachExercise }) {
  return (
    <div style={{ color: "var(--color-secondary)", fontSize: 13 }}>
      <div>{`— ${exercise.sets} séries × ${exercise.reps} reps`}</div>
      {exercise.weight > 0 && <div>{`— ${exercise.weight} kg`}</div>}
      {exercise.restSeconds !== undefined && (
        <div>{`— Repos : ${exercise.restSeconds}s`}</div>
      )}
    </div>
  );
}

// Card individuelle pour un exercice
function ExerciseCard({ exercise }: { exercise: CoachExercise }) {
  return (
    <div
      style={{
        background: "var(--color-surface-2)",
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
      }}
    >
      <div
        style={{
          color: "#ffffff",
          fontWeight: 600,
          fontSize: 14,
          marginBottom: 4,
        }}
      >
        {exercise.name}
      </div>
      <ExerciseMetrics exercise={exercise} />
      {exercise.coachNote && (
        <div
          style={{
            color: "var(--color-secondary)",
            fontSize: 12,
            fontStyle: "italic",
            marginTop: 4,
          }}
        >
          {exercise.coachNote}
        </div>
      )}
    </div>
  );
}

export default function CoachExerciseDetailSheet({ workout, onClose }: Props) {
  // Le parent contrôle l'ouverture via la prop workout — pas de state interne
  if (workout === null) return null;

  return (
    <>
      {/* Overlay sombre — ferme le sheet au tap */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "var(--color-overlay)",
          zIndex: 69,
        }}
      />

      {/* Sheet slide-up */}
      <div
        className="animate-slide-up"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "var(--color-surface)",
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          maxHeight: "70vh",
          overflowY: "auto",
          zIndex: 70,
        }}
      >
        {/* Header sticky pour rester visible au scroll */}
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 1,
            background: "var(--color-surface)",
            padding: 16,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ color: "#ffffff", fontWeight: 700, fontSize: 17 }}>
            Détail
          </span>
          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "var(--color-surface-2)",
              border: "none",
              color: "#ffffff",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              flexShrink: 0,
            }}
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        {/* Liste des exercices scrollable */}
        <div style={{ padding: "0 16px 24px" }}>
          {workout.exercises.map((exercise, index) => (
            <ExerciseCard key={index} exercise={exercise} />
          ))}
        </div>
      </div>
    </>
  );
}
