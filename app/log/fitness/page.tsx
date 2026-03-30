"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import Badge from "@/components/Badge";
import { addSession, generateId } from "@/lib/storage";
import type { Exercise, FitnessCategory } from "@/lib/types";

const EXERCISE_LIBRARY = {
  upper: [
    "Développé couché",
    "Développé incliné",
    "Écarté poulie",
    "Tractions",
    "Rowing barre",
    "Rowing haltère",
    "Développé militaire",
    "Élévations latérales",
    "Curl biceps",
    "Extension triceps",
    "Dips",
    "Facepull",
  ],
  lower: [
    "Squat barre",
    "Leg press",
    "Fentes",
    "Soulevé de terre",
    "Romanian deadlift",
    "Leg extension",
    "Leg curl",
    "Hip thrust",
    "Mollets",
    "Goblet squat",
    "Step up",
  ],
};

const FINISHER_ABS: Omit<Exercise, "id">[] = [
  { name: "Ab wheel", sets: 3, reps: 12, weight: 0, comment: "" },
  { name: "Planche", sets: 3, reps: 60, weight: 0, comment: "" },
  { name: "Russian twist", sets: 3, reps: 20, weight: 0, comment: "" },
  { name: "Crunch", sets: 3, reps: 20, weight: 0, comment: "" },
];

function newExercise(name = ""): Exercise {
  return { id: generateId(), name, sets: 3, reps: 10, weight: 0, comment: "" };
}

export default function LogFitness() {
  const router = useRouter();
  const [category, setCategory] = useState<FitnessCategory>("upper");
  const [exercises, setExercises] = useState<Exercise[]>([newExercise()]);
  const [showLibrary, setShowLibrary] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const updateExercise = useCallback(
    (id: string, field: keyof Exercise, value: string | number) => {
      setExercises((prev) =>
        prev.map((ex) => (ex.id === id ? { ...ex, [field]: value } : ex))
      );
    },
    []
  );

  const removeExercise = useCallback((id: string) => {
    setExercises((prev) => prev.filter((ex) => ex.id !== id));
  }, []);

  const addExercise = useCallback(() => {
    setExercises((prev) => [...prev, newExercise()]);
  }, []);

  const addFromLibrary = useCallback((name: string, forId: string) => {
    setExercises((prev) =>
      prev.map((ex) => (ex.id === forId ? { ...ex, name } : ex))
    );
    setShowLibrary(null);
  }, []);

  const addFinisher = useCallback(() => {
    const finisherExercises = FINISHER_ABS.map((ex) => ({
      ...ex,
      id: generateId(),
    }));
    setExercises((prev) => [...prev, ...finisherExercises]);
  }, []);

  const handleSave = useCallback(async () => {
    const validExercises = exercises.filter((ex) => ex.name.trim());
    if (validExercises.length === 0) return;

    setSaving(true);
    addSession({
      id: generateId(),
      type: "fitness",
      date: new Date().toISOString(),
      category,
      exercises: validExercises,
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => router.push("/"), 1200);
  }, [exercises, category, router]);

  const library = EXERCISE_LIBRARY[category];

  return (
    <div className="max-w-md mx-auto animate-fade-in">
      <PageHeader
        title="SÉANCE SALLE"
        subtitle="Logger"
        accent="orange"
        right={
          <button
            onClick={handleSave}
            disabled={saving || saved}
            className="px-4 py-2 rounded-xl text-sm font-bold press-effect disabled:opacity-50"
            style={{
              background: saved
                ? "rgba(57,255,20,0.2)"
                : "linear-gradient(135deg, #ff6b00, #7a3300)",
              color: saved ? "#39ff14" : "white",
              border: saved ? "1px solid rgba(57,255,20,0.4)" : "none",
            }}
          >
            {saved ? "✓ Sauvé" : saving ? "..." : "Sauver"}
          </button>
        }
      />

      <div className="px-5 space-y-5">
        {/* Category selector */}
        <div
          className="flex rounded-2xl p-1"
          style={{ background: "#111", border: "1px solid #1a1a1a" }}
        >
          {(["upper", "lower"] as FitnessCategory[]).map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className="flex-1 py-3 rounded-xl text-sm font-bold tracking-wide press-effect transition-all"
              style={{
                background: category === cat
                  ? "linear-gradient(135deg, #ff6b00, #7a3300)"
                  : "transparent",
                color: category === cat ? "white" : "#555",
              }}
            >
              {cat === "upper" ? "HAUT DU CORPS" : "BAS DU CORPS"}
            </button>
          ))}
        </div>

        {/* Exercises */}
        <div className="space-y-4">
          {exercises.map((exercise, idx) => (
            <ExerciseCard
              key={exercise.id}
              exercise={exercise}
              index={idx}
              onUpdate={updateExercise}
              onRemove={removeExercise}
              onOpenLibrary={() => setShowLibrary(exercise.id)}
              library={library}
              showLibrary={showLibrary === exercise.id}
              onLibrarySelect={(name) => addFromLibrary(name, exercise.id)}
              onCloseLibrary={() => setShowLibrary(null)}
            />
          ))}
        </div>

        {/* Add exercise buttons */}
        <div className="flex gap-3">
          <button
            onClick={addExercise}
            className="flex-1 py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 press-effect"
            style={{
              background: "#111",
              border: "1px dashed #333",
              color: "#888",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 5V19M5 12H19" stroke="#888" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Exercice
          </button>
          <button
            onClick={addFinisher}
            className="flex-1 py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 press-effect"
            style={{
              background: "rgba(255,107,0,0.05)",
              border: "1px dashed rgba(255,107,0,0.3)",
              color: "#ff6b00",
            }}
          >
            <span>⚡</span>
            Finisher abdos
          </button>
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving || saved || exercises.filter((e) => e.name.trim()).length === 0}
          className="w-full py-4 rounded-2xl font-bold text-base tracking-wide press-effect disabled:opacity-40"
          style={{
            background: saved
              ? "rgba(57,255,20,0.1)"
              : "linear-gradient(135deg, #ff6b00, #7a3300)",
            color: saved ? "#39ff14" : "white",
            border: saved ? "1px solid rgba(57,255,20,0.4)" : "none",
          }}
        >
          {saved ? "✓ SÉANCE SAUVEGARDÉE" : saving ? "Sauvegarde..." : "TERMINER LA SÉANCE"}
        </button>

        <div className="h-4" />
      </div>
    </div>
  );
}

// ─── Exercise Card ─────────────────────────────────────────────────────────────

interface ExerciseCardProps {
  exercise: Exercise;
  index: number;
  onUpdate: (id: string, field: keyof Exercise, value: string | number) => void;
  onRemove: (id: string) => void;
  onOpenLibrary: () => void;
  library: string[];
  showLibrary: boolean;
  onLibrarySelect: (name: string) => void;
  onCloseLibrary: () => void;
}

function ExerciseCard({
  exercise,
  index,
  onUpdate,
  onRemove,
  onOpenLibrary,
  library,
  showLibrary,
  onLibrarySelect,
  onCloseLibrary,
}: ExerciseCardProps) {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ border: "1px solid #1a1a1a" }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center gap-3"
        style={{ background: "#111" }}
      >
        <span
          className="font-display text-2xl leading-none w-7 text-center flex-shrink-0"
          style={{ color: "#ff6b00" }}
        >
          {index + 1}
        </span>
        <input
          type="text"
          value={exercise.name}
          onChange={(e) => onUpdate(exercise.id, "name", e.target.value)}
          placeholder="Nom de l'exercice"
          className="flex-1 bg-transparent border-none p-0 font-semibold text-base focus:outline-none"
          style={{ color: exercise.name ? "white" : "#555" }}
        />
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenLibrary}
            className="p-1.5 rounded-lg press-effect"
            style={{ background: "#1a1a1a" }}
            title="Choisir depuis la bibliothèque"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M4 6h16M4 12h16M4 18h7" stroke="#888" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
          <button
            onClick={() => onRemove(exercise.id)}
            className="p-1.5 rounded-lg press-effect"
            style={{ background: "#1a1a1a" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="#555" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Library dropdown */}
      {showLibrary && (
        <div
          className="px-4 pb-3"
          style={{ background: "#111", borderBottom: "1px solid #1a1a1a" }}
        >
          <div className="flex flex-wrap gap-2 pt-1">
            {library.map((name) => (
              <button
                key={name}
                onClick={() => onLibrarySelect(name)}
                className="text-xs px-3 py-1.5 rounded-xl press-effect"
                style={{
                  background: exercise.name === name ? "rgba(255,107,0,0.2)" : "#1a1a1a",
                  border: exercise.name === name ? "1px solid rgba(255,107,0,0.4)" : "1px solid #222",
                  color: exercise.name === name ? "#ff6b00" : "#aaa",
                }}
              >
                {name}
              </button>
            ))}
          </div>
          <button
            onClick={onCloseLibrary}
            className="mt-2 text-xs text-muted"
          >
            Fermer
          </button>
        </div>
      )}

      {/* Sets/Reps/Weight */}
      <div
        className="grid grid-cols-3 divide-x"
        style={{
          background: "#0f0f0f",
          borderTop: "1px solid #1a1a1a",
          borderColor: "#1a1a1a",
        }}
      >
        {[
          { label: "Séries", field: "sets" as keyof Exercise, unit: "x" },
          { label: "Reps", field: "reps" as keyof Exercise, unit: "reps" },
          { label: "Poids", field: "weight" as keyof Exercise, unit: "kg" },
        ].map(({ label, field, unit }) => (
          <div key={field} className="p-3 flex flex-col items-center gap-1">
            <span className="text-[10px] text-muted uppercase tracking-wide font-medium">
              {label}
            </span>
            <div className="flex items-end gap-1">
              <input
                type="number"
                value={exercise[field] as number}
                onChange={(e) =>
                  onUpdate(exercise.id, field, parseFloat(e.target.value) || 0)
                }
                className="w-14 text-center bg-transparent border-none p-0 font-display text-2xl leading-none focus:outline-none"
                style={{ color: "white" }}
                min="0"
                step={field === "weight" ? "0.5" : "1"}
              />
              <span className="text-xs text-muted pb-0.5">{unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Comment */}
      <div style={{ background: "#0f0f0f", borderTop: "1px solid #1a1a1a" }}>
        <textarea
          value={exercise.comment}
          onChange={(e) => onUpdate(exercise.id, "comment", e.target.value)}
          placeholder="Notes (ex: difficile en fin de série, augmenter la prochaine fois...)"
          className="w-full bg-transparent border-none px-4 py-3 text-xs resize-none focus:outline-none"
          style={{ color: "#888", minHeight: "50px" }}
          rows={2}
        />
      </div>
    </div>
  );
}
