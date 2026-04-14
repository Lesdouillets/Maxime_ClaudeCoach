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
import type { Exercise, FitnessCategory, FitnessSession, SetLog } from "@/lib/types";
import type { CoachWorkout } from "@/lib/coachPlan";

function coachToExercise(ce: CoachWorkout["exercises"][0]): Exercise {
  // If the coach plan specifies per-set variations, use them.
  // Otherwise generate N identical sets from the flat sets/reps/weight.
  const setLogs: SetLog[] = ce.setPlans && ce.setPlans.length > 0
    ? ce.setPlans.map((sp) => ({ weight: sp.weight, reps: sp.reps, done: false }))
    : Array.from({ length: ce.sets }, () => ({
        weight: ce.weight,
        reps: ce.reps,
        done: false,
      }));
  return {
    id: generateId(),
    name: ce.name,
    sets: setLogs.length,
    reps: ce.reps,
    weight: ce.weight,
    comment: "",
    setLogs,
  };
}

export default function LogFitness() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [sessionDate, setSessionDate] = useState<string | null>(null);
  const [coachWorkout, setCoachWorkout] = useState<CoachWorkout | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [category, setCategory] = useState<FitnessCategory>("upper");
  const [activeExIdx, setActiveExIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [coachState, setCoachState] = useState<"analyzing" | "done">("analyzing");
  const [coachResult, setCoachResult] = useState<CoachAnalysisResult | null>(null);
  const { timerKey, timerSec, startTimer, stopTimer } = useTimer();

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

  // Auto-advance to next exercise when all sets of the current one are done
  useEffect(() => {
    if (saved || exercises.length === 0) return;
    const currentEx = exercises[activeExIdx];
    if (!currentEx?.setLogs) return;
    if (currentEx.setLogs.every((s) => s.done) && activeExIdx < exercises.length - 1) {
      setActiveExIdx(activeExIdx + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercises]);

  const updateSetLog = useCallback(
    (exId: string, setIdx: number, field: "weight" | "reps", value: number) => {
      setExercises((prev) =>
        prev.map((ex) => {
          if (ex.id !== exId || !ex.setLogs) return ex;
          return {
            ...ex,
            setLogs: ex.setLogs.map((s, i) =>
              i === setIdx ? { ...s, [field]: value } : s
            ),
          };
        })
      );
    },
    []
  );

  const validateSet = useCallback(
    (exId: string, setIdx: number) => {
      setExercises((prev) =>
        prev.map((ex) => {
          if (ex.id !== exId || !ex.setLogs) return ex;
          return {
            ...ex,
            setLogs: ex.setLogs.map((s, i) =>
              i === setIdx ? { ...s, done: true } : s
            ),
          };
        })
      );

      // Start rest timer from coach plan
      const exIdx = exercises.findIndex((e) => e.id === exId);
      const restSecs = coachWorkout?.exercises[exIdx]?.restSeconds ?? 90;
      startTimer(exId + "-set-" + setIdx, restSecs);
    },
    [exercises, coachWorkout, startTimer]
  );

  const updateComment = useCallback(
    (exId: string, value: string) => {
      setExercises((prev) =>
        prev.map((ex) => ex.id === exId ? { ...ex, comment: value } : ex)
      );
    },
    []
  );

  const handleSave = useCallback(async () => {
    if (exercises.length === 0 && coachWorkout !== null) return;
    setSaving(true);

    // Compute summary sets/reps/weight from setLogs for backward compat
    const finalExercises = exercises.map((ex) => {
      if (!ex.setLogs?.length) return ex;
      const done = ex.setLogs.filter((s) => s.done);
      if (done.length === 0) return ex;
      const avgWeight = done.reduce((sum, s) => sum + s.weight, 0) / done.length;
      const avgReps = done.reduce((sum, s) => sum + s.reps, 0) / done.length;
      return { ...ex, sets: done.length, reps: Math.round(avgReps), weight: Math.round(avgWeight * 2) / 2 };
    });

    const session: FitnessSession = {
      id: generateId(),
      type: "fitness",
      date: sessionDate ? new Date(sessionDate + "T12:00:00").toISOString() : new Date().toISOString(),
      category,
      comment: "",
      exercises: finalExercises,
      ...(coachWorkout ? { coachWorkoutId: coachWorkout.id } : {}),
    };
    addSession(session);
    autoSyncPush();
    setSaving(false);
    setSaved(true);
    setCoachState("analyzing");

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

        {exercises.map((ex, exIdx) => {
          const coachEx = coachWorkout?.exercises[exIdx];
          const isActive = exIdx === activeExIdx && !saved;
          const allDone = ex.setLogs?.every((s) => s.done) ?? false;

          return (
            <div
              key={ex.id}
              className="rounded-2xl overflow-hidden"
              style={{
                border: isActive
                  ? "1px solid rgba(255,107,0,0.6)"
                  : allDone
                  ? "1px solid rgba(57,255,20,0.25)"
                  : "1px solid #1a1a1a",
                boxShadow: isActive ? "0 0 24px rgba(255,107,0,0.12)" : "none",
              }}
              onClick={() => !saved && setActiveExIdx(exIdx)}
            >
              {/* Exercise header */}
              <div
                className="px-4 py-3 flex items-center gap-3"
                style={{ background: isActive ? "rgba(255,107,0,0.07)" : "#111" }}
              >
                <span
                  className="font-display text-2xl leading-none w-7 text-center flex-shrink-0"
                  style={{ color: isActive ? "#ff6b00" : allDone ? "#39ff14" : "#555" }}
                >
                  {exIdx + 1}
                </span>
                <span className="flex-1 font-bold text-xs tracking-widest">
                  {ex.name.toUpperCase()}
                </span>
                {isActive && (
                  <span
                    className="text-[9px] font-bold tracking-widest px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{
                      background: "rgba(255,107,0,0.15)",
                      color: "#ff6b00",
                      border: "1px solid rgba(255,107,0,0.35)",
                    }}
                  >
                    EN COURS
                  </span>
                )}
                {allDone && !isActive && (
                  <span className="text-base flex-shrink-0" style={{ color: "#39ff14" }}>✓</span>
                )}
              </div>

              {/* Coach note */}
              {coachEx?.coachNote && (
                <div
                  className="px-4 py-2"
                  style={{ background: "rgba(57,255,20,0.02)", borderTop: "1px solid #1a1a1a" }}
                >
                  <p className="text-xs italic" style={{ color: "#555" }}>
                    ↳ {coachEx.coachNote}
                  </p>
                </div>
              )}

              {/* Per-set table */}
              {ex.setLogs && ex.setLogs.length > 0 && (
                <div style={{ borderTop: "1px solid #1a1a1a" }}>
                  {/* Column headers */}
                  <div
                    className="grid px-4 py-1.5"
                    style={{
                      gridTemplateColumns: "32px 1fr 1fr 52px",
                      background: "#0a0a0a",
                      borderBottom: "1px solid #1a1a1a",
                    }}
                  >
                    {["SÉR.", "KG", "REPS", ""].map((h, i) => (
                      <span
                        key={i}
                        className="text-[9px] font-bold tracking-widest text-center"
                        style={{ color: "#3a3a3a" }}
                      >
                        {h}
                      </span>
                    ))}
                  </div>

                  {/* Set rows */}
                  {ex.setLogs.map((set, setIdx) => {
                    const setTimerKey = ex.id + "-set-" + setIdx;
                    const isTimerActive = timerKey === setTimerKey;

                    return (
                      <div
                        key={setIdx}
                        className="grid px-4 py-2.5 items-center"
                        style={{
                          gridTemplateColumns: "32px 1fr 1fr 52px",
                          background: set.done
                            ? "rgba(57,255,20,0.03)"
                            : isActive
                            ? "rgba(255,107,0,0.02)"
                            : "#0f0f0f",
                          borderBottom:
                            setIdx < (ex.setLogs?.length ?? 0) - 1
                              ? "1px solid #151515"
                              : "none",
                          opacity: set.done && !isTimerActive ? 0.65 : 1,
                        }}
                      >
                        {/* Set number */}
                        <span
                          className="font-display text-xl leading-none text-center"
                          style={{ color: set.done ? "#39ff14" : "#444" }}
                        >
                          {setIdx + 1}
                        </span>

                        {/* KG input */}
                        <div className="flex items-end justify-center gap-0.5">
                          <input
                            type="number"
                            value={set.weight}
                            onChange={(e) =>
                              updateSetLog(ex.id, setIdx, "weight", parseFloat(e.target.value) || 0)
                            }
                            disabled={set.done || saved}
                            onClick={(e) => e.stopPropagation()}
                            className="w-14 text-center bg-transparent border-none p-0 font-display text-2xl leading-none focus:outline-none disabled:cursor-default"
                            style={{ color: set.done ? "#39ff14" : "white" }}
                            min="0"
                            step="0.5"
                          />
                          <span className="text-[9px] pb-1" style={{ color: "#3a3a3a" }}>
                            kg
                          </span>
                        </div>

                        {/* REPS input */}
                        <div className="flex items-end justify-center gap-0.5">
                          <input
                            type="number"
                            value={set.reps}
                            onChange={(e) =>
                              updateSetLog(ex.id, setIdx, "reps", parseInt(e.target.value) || 0)
                            }
                            disabled={set.done || saved}
                            onClick={(e) => e.stopPropagation()}
                            className="w-10 text-center bg-transparent border-none p-0 font-display text-2xl leading-none focus:outline-none disabled:cursor-default"
                            style={{ color: set.done ? "#39ff14" : "white" }}
                            min="0"
                            step="1"
                          />
                          <span className="text-[9px] pb-1" style={{ color: "#3a3a3a" }}>
                            ×
                          </span>
                        </div>

                        {/* Validate / Timer */}
                        <div className="flex justify-center">
                          {isTimerActive ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); stopTimer(); }}
                              className="flex flex-col items-center press-effect"
                            >
                              <span
                                className="font-display text-xl leading-none"
                                style={{
                                  color:
                                    timerSec > 10
                                      ? "#39ff14"
                                      : timerSec > 3
                                      ? "#ff6b00"
                                      : "#ff4444",
                                }}
                              >
                                {timerSec}s
                              </span>
                              <span className="text-[8px]" style={{ color: "#555" }}>
                                ■
                              </span>
                            </button>
                          ) : set.done ? (
                            <span className="text-base" style={{ color: "#39ff14" }}>
                              ✓
                            </span>
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); validateSet(ex.id, setIdx); }}
                              disabled={saved}
                              className="w-9 h-9 rounded-xl flex items-center justify-center press-effect disabled:opacity-30"
                              style={{
                                background: "rgba(255,107,0,0.12)",
                                border: "1px solid rgba(255,107,0,0.4)",
                              }}
                            >
                              <span className="text-sm" style={{ color: "#ff6b00" }}>✓</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Rest time label */}
              {coachEx?.restSeconds && (
                <div
                  className="px-4 py-1.5 flex items-center gap-2"
                  style={{ background: "#0a0a0a", borderTop: "1px solid #1a1a1a" }}
                >
                  <span className="text-[9px] font-bold tracking-widest" style={{ color: "#2a2a2a" }}>
                    ⏱ RÉCUP {coachEx.restSeconds}s
                  </span>
                </div>
              )}

              {/* Comment — shown only on active exercise */}
              {isActive && (
                <div style={{ background: "#0f0f0f", borderTop: "1px solid #1a1a1a" }}>
                  <textarea
                    value={ex.comment}
                    onChange={(e) => updateComment(ex.id, e.target.value)}
                    placeholder="Ressenti sur cet exercice…"
                    rows={2}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full bg-transparent border-none px-4 py-3 text-xs resize-none focus:outline-none"
                    style={{ color: "#888" }}
                  />
                </div>
              )}
            </div>
          );
        })}

        {/* Coach feedback — appears after save */}
        {saved && <CoachFeedbackCard state={coachState} result={coachResult} />}
      </div>

      {/* Bottom action */}
      <div
        className="fixed bottom-0 left-0 right-0 px-5 pb-6 pt-3"
        style={{ background: "linear-gradient(to top, #0a0a0a 70%, transparent)" }}
      >
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
