"use client";

import { useState, useCallback, useEffect } from "react";
import { useTimer } from "@/contexts/TimerContext";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import CoachFeedbackCard from "@/components/CoachFeedbackCard";
import { addSession, generateId } from "@/lib/storage";
import { getCoachWorkouts, deleteCoachWorkout } from "@/lib/coachPlan";
import { autoSyncPush } from "@/lib/sync";
import { analyzeSession, type CoachAnalysisResult } from "@/lib/coachAnalyzer";
import type { Exercise, FitnessCategory, FitnessSession } from "@/lib/types";
import type { CoachWorkout } from "@/lib/coachPlan";

function coachToExercise(ce: CoachWorkout["exercises"][0]): Exercise {
  return { id: generateId(), name: ce.name, sets: ce.sets, reps: ce.reps, weight: ce.weight, comment: "" };
}

export default function LogFitness() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [sessionDate, setSessionDate] = useState<string | null>(null);
  const [coachWorkout, setCoachWorkout] = useState<CoachWorkout | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [category, setCategory] = useState<FitnessCategory>("upper");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [coachState, setCoachState] = useState<"analyzing" | "done">("analyzing");
  const [coachResult, setCoachResult] = useState<CoachAnalysisResult | null>(null);
  const { timerKey: timerExId, timerSec, startTimer, stopTimer } = useTimer();

  useEffect(() => {
    setMounted(true);
    const params = new URLSearchParams(window.location.search);
    const d = params.get("date");
    if (d) setSessionDate(d);

    const targetDate = d ?? new Date().toISOString().slice(0, 10);
    const allWorkouts = getCoachWorkouts();
    const plan = allWorkouts.find((w) => w.date === targetDate) ?? null;
    if (plan) {
      setCoachWorkout(plan);
      setCategory(plan.category);
      setExercises(plan.exercises.map(coachToExercise));
    }
  }, []);

  const updateExercise = useCallback(
    (id: string, field: keyof Exercise, value: string | number) => {
      setExercises((prev) => prev.map((ex) => ex.id === id ? { ...ex, [field]: value } : ex));
    }, []
  );

  const handleSave = useCallback(async () => {
    if (exercises.length === 0 && coachWorkout !== null) return;
    setSaving(true);
    const session: FitnessSession = {
      id: generateId(),
      type: "fitness",
      date: sessionDate ? new Date(sessionDate + "T12:00:00").toISOString() : new Date().toISOString(),
      category,
      comment: "",
      exercises,
      ...(coachWorkout ? { coachWorkoutId: coachWorkout.id } : {}),
    };
    addSession(session);
    // Delete the coach workout AFTER analysis so getCoachPlans can still find its plan
    autoSyncPush();
    setSaving(false);
    setSaved(true);
    setCoachState("analyzing");

    // Fire async analysis — result displayed in card, doesn't block navigation
    analyzeSession(session).then((result) => {
      if (coachWorkout) deleteCoachWorkout(coachWorkout.id);
      setCoachResult(result);
      setCoachState("done");
    });
  }, [exercises, category, coachWorkout, sessionDate]);

  if (!mounted) return null;

  const dateLabel = sessionDate
    ? new Date(sessionDate + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })
    : "Aujourd'hui";

  return (
    <div className="max-w-md mx-auto animate-fade-in pb-28">
      <PageHeader title="SÉANCE SALLE" subtitle={dateLabel} accent="orange" />

      <div className="px-5 space-y-4">

        {!coachWorkout && (
          <div className="rounded-2xl p-4" style={{ background: "#111", border: "1px solid #1a1a1a" }}>
            <p className="text-sm text-muted">Aucun plan coach pour cette date.</p>
          </div>
        )}

        {/* Exercises */}
        {exercises.map((ex, idx) => {
          const coachEx = coachWorkout?.exercises[idx];
          return (
            <div key={ex.id} className="rounded-2xl overflow-hidden" style={{ border: "1px solid #1a1a1a" }}>
              {/* Name + number */}
              <div className="px-4 py-3 flex items-center gap-3" style={{ background: "#111" }}>
                <span className="font-display text-2xl leading-none w-7 text-center flex-shrink-0" style={{ color: "#ff6b00" }}>
                  {idx + 1}
                </span>
                <span className="font-bold text-xs tracking-widest">{ex.name.toUpperCase()}</span>
              </div>

              {/* Coach note */}
              {coachEx?.coachNote && (
                <div className="px-4 py-2" style={{ background: "rgba(57,255,20,0.02)", borderTop: "1px solid #1a1a1a" }}>
                  <p className="text-xs italic" style={{ color: "#555" }}>↳ {coachEx.coachNote}</p>
                </div>
              )}

              {/* Sets / Reps / Weight + Timer */}
              <div className="flex" style={{ background: "#0f0f0f", borderTop: "1px solid #1a1a1a" }}>
                {([
                  { label: "Séries", field: "sets" as keyof Exercise, unit: "×", step: "1" },
                  { label: "Reps",   field: "reps" as keyof Exercise, unit: "",  step: "1" },
                  { label: "Poids",  field: "weight" as keyof Exercise, unit: "kg", step: "0.5" },
                ] as const).map(({ label, field, unit, step }) => (
                  <div key={field} className="flex-1 p-3 flex flex-col items-center gap-1" style={{ borderRight: "1px solid #1a1a1a" }}>
                    <span className="text-[10px] text-muted uppercase tracking-wide">{label}</span>
                    <div className="flex items-end gap-0.5">
                      <input
                        type="number"
                        value={ex[field] as number}
                        onChange={(e) => updateExercise(ex.id, field, parseFloat(e.target.value) || 0)}
                        className="w-14 text-center bg-transparent border-none p-0 font-display text-2xl leading-none focus:outline-none"
                        style={{ color: "white" }}
                        min="0"
                        step={step}
                      />
                      {unit && <span className="text-xs text-muted pb-0.5">{unit}</span>}
                    </div>
                  </div>
                ))}
                {/* Timer column */}
                {coachEx?.restSeconds && (
                  <div className="px-3 flex items-center justify-center min-w-[90px]">
                    {timerExId === ex.id ? (
                      <button onClick={stopTimer} className="flex items-center gap-2 press-effect">
                        <span className="font-display text-2xl leading-none"
                          style={{ color: timerSec > 10 ? "#39ff14" : timerSec > 3 ? "#ff6b00" : "#ff4444" }}>
                          {timerSec}s
                        </span>
                        <span className="text-sm" style={{ color: "#555" }}>■</span>
                      </button>
                    ) : (
                      <button onClick={() => startTimer(ex.id, coachEx.restSeconds!)} className="flex items-center gap-2 press-effect">
                        <span className="text-xs font-bold tracking-wide" style={{ color: "#333" }}>RÉCUP {coachEx.restSeconds}s</span>
                        <span className="text-sm" style={{ color: "#555" }}>▶</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Per-exercise note */}
              <div style={{ background: "#0f0f0f", borderTop: "1px solid #1a1a1a" }}>
                <textarea
                  value={ex.comment}
                  onChange={(e) => updateExercise(ex.id, "comment", e.target.value)}
                  placeholder="Ressenti sur cet exercice…"
                  rows={2}
                  className="w-full bg-transparent border-none px-4 py-3 text-xs resize-none focus:outline-none"
                  style={{ color: "#888" }}
                />
              </div>
            </div>
          );
        })}

        {/* Coach feedback card — appears after save */}
        {saved && (
          <CoachFeedbackCard state={coachState} result={coachResult} />
        )}

      </div>

      {/* Finaliser — fixed bottom */}
      <div className="fixed bottom-0 left-0 right-0 px-5 pb-6 pt-3"
        style={{ background: "linear-gradient(to top, #0a0a0a 70%, transparent)" }}>
        {saved ? (
          <button
            onClick={() => router.push("/")}
            className="w-full py-4 rounded-2xl font-bold text-base tracking-wide press-effect"
            style={{
              background: "rgba(57,255,20,0.1)",
              color: "#39ff14",
              border: "1px solid rgba(57,255,20,0.4)",
            }}
          >
            CONTINUER →
          </button>
        ) : (
          <button
            onClick={handleSave}
            disabled={saving || (exercises.length === 0 && coachWorkout !== null)}
            className="w-full py-4 rounded-2xl font-bold text-base tracking-wide press-effect disabled:opacity-40"
            style={{
              background: "linear-gradient(135deg, #ff6b00, #7a3300)",
              color: "white",
            }}
          >
            {saving ? "Sauvegarde…" : "FINALISER LA SÉANCE"}
          </button>
        )}
      </div>
    </div>
  );
}
