"use client";

import { useState, useCallback, useEffect } from "react";
import { useTimer } from "@/contexts/TimerContext";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import CoachFeedbackCard from "@/components/CoachFeedbackCard";
import FitnessSessionResults from "@/components/FitnessSessionResults";
import { addSession, deleteSession, generateId, getSessions, cancelDay } from "@/lib/storage";
import { getCoachWorkouts, deleteCoachWorkout } from "@/lib/coachPlan";
import { autoSyncPush } from "@/lib/sync";
import { analyzeSession, getStoredCoachAnalysis, type CoachAnalysisResult } from "@/lib/coachAnalyzer";
import type { Exercise, FitnessSession, SetLog } from "@/lib/types";
import type { CoachWorkout } from "@/lib/coachPlan";

function coachToExercise(ce: CoachWorkout["exercises"][0]): Exercise {
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
  const [activeExIdx, setActiveExIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [coachState, setCoachState] = useState<"analyzing" | "done">("analyzing");
  const [coachResult, setCoachResult] = useState<CoachAnalysisResult | null>(null);
  const [existingSession, setExistingSession] = useState<FitnessSession | null>(null);
  const { timerKey, timerSec, startTimer, stopTimer } = useTimer();

  useEffect(() => {
    setMounted(true);
    const params = new URLSearchParams(window.location.search);
    const d = params.get("date");
    if (d) setSessionDate(d);

    const targetDate = d ?? new Date().toISOString().slice(0, 10);

    const existing = getSessions().find(
      (s): s is FitnessSession =>
        s.type === "fitness" && s.date.slice(0, 10) === targetDate
    );
    if (existing) {
      setExistingSession(existing);
      setSaved(true);
      setCoachState("done");
      setCoachResult(getStoredCoachAnalysis(targetDate));
      return;
    }

    const allWorkouts = getCoachWorkouts();
    const plan = allWorkouts.find((w) => w.date === targetDate) ?? null;
    if (plan) {
      setCoachWorkout(plan);
      setExercises(plan.exercises.map(coachToExercise));
    }
  }, []);

  const handleDelete = useCallback(() => {
    if (!existingSession) return;
    deleteSession(existingSession.id);
    autoSyncPush();
    router.push("/");
  }, [existingSession, router]);

  const handleCancel = useCallback(() => {
    const date = sessionDate ?? new Date().toISOString().slice(0, 10);
    cancelDay(date, "");
    if (coachWorkout) deleteCoachWorkout(coachWorkout.id);
    autoSyncPush();
    router.back();
  }, [sessionDate, coachWorkout, router]);

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
    if (!coachWorkout || exercises.length === 0) return;
    setSaving(true);

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
      category: coachWorkout.category,
      comment: "",
      exercises: finalExercises,
      coachWorkoutId: coachWorkout.id,
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
  }, [exercises, coachWorkout, sessionDate]);

  useEffect(() => {
    if (saved || saving || !coachWorkout || exercises.length === 0) return;
    const allDone = exercises.every(
      (ex) => ex.setLogs && ex.setLogs.length > 0 && ex.setLogs.every((s) => s.done)
    );
    if (allDone) handleSave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercises, saved, saving, coachWorkout]);

  if (!mounted) return null;

  const dateLabel = sessionDate
    ? new Date(sessionDate + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })
    : "Aujourd'hui";

  return (
    <div className="max-w-md mx-auto animate-fade-in pb-52">
      <PageHeader title="Séance Salle" subtitle={dateLabel} accent="orange" />

      <div className="px-4 space-y-3">

        {existingSession && (
          <>
            <CoachFeedbackCard state={coachState} result={coachResult} />
            <FitnessSessionResults session={existingSession} />
          </>
        )}

        {!existingSession && !coachWorkout && (
          <div className="rounded-2xl p-4" style={{ background: "#1C1C1E", border: "1px solid rgba(255,255,255,0.08)" }}>
            <p className="text-sm" style={{ color: "rgba(235,235,245,0.4)" }}>Aucun plan coach pour cette date.</p>
          </div>
        )}

        {!existingSession && exercises.map((ex, exIdx) => {
          const coachEx = coachWorkout?.exercises[exIdx];
          const isActive = exIdx === activeExIdx && !saved;
          const allDone = ex.setLogs?.every((s) => s.done) ?? false;

          return (
            <div
              key={ex.id}
              className="rounded-2xl overflow-hidden"
              style={{
                background: "#1C1C1E",
                border: isActive
                  ? "1px solid rgba(255,159,10,0.5)"
                  : allDone
                  ? "1px solid rgba(48,209,88,0.25)"
                  : "1px solid rgba(255,255,255,0.08)",
                boxShadow: isActive
                  ? "0 4px 20px rgba(255,159,10,0.08)"
                  : "0 2px 8px rgba(0,0,0,0.3)",
              }}
              onClick={() => !saved && setActiveExIdx(exIdx)}
            >
              {/* Exercise header — nom + numéro + statut */}
              <div
                className="px-4 py-3 flex items-center gap-3"
                style={{
                  background: isActive
                    ? "rgba(255,159,10,0.06)"
                    : allDone
                    ? "rgba(48,209,88,0.04)"
                    : "transparent",
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                {/* Numéro d'exercice */}
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
                  style={{
                    background: isActive
                      ? "rgba(255,159,10,0.15)"
                      : allDone
                      ? "rgba(48,209,88,0.15)"
                      : "rgba(255,255,255,0.08)",
                    color: isActive ? "#FF9F0A" : allDone ? "#30D158" : "rgba(235,235,245,0.4)",
                  }}
                >
                  {allDone ? "✓" : exIdx + 1}
                </span>

                {/* Nom de l'exercice */}
                <span className="flex-1 font-semibold text-sm" style={{ color: isActive ? "#fff" : allDone ? "rgba(235,235,245,0.6)" : "rgba(235,235,245,0.85)" }}>
                  {ex.name}
                </span>

                {/* Badge EN COURS */}
                {isActive && (
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{
                      background: "rgba(255,159,10,0.15)",
                      color: "#FF9F0A",
                      border: "1px solid rgba(255,159,10,0.3)",
                    }}
                  >
                    En cours
                  </span>
                )}
              </div>

              {/* Note du coach */}
              {coachEx?.coachNote && (
                <div
                  className="px-4 py-2"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <p className="text-xs italic" style={{ color: "rgba(235,235,245,0.35)" }}>
                    {coachEx.coachNote}
                  </p>
                </div>
              )}

              {/* Tableau des séries */}
              {ex.setLogs && ex.setLogs.length > 0 && (
                <div>
                  {/* En-têtes colonnes */}
                  <div
                    className="grid px-4 py-2"
                    style={{
                      gridTemplateColumns: "28px 1fr 1fr 52px",
                      borderBottom: "1px solid rgba(255,255,255,0.05)",
                    }}
                  >
                    {["SÉR.", "KG", "REPS", ""].map((h, i) => (
                      <span
                        key={i}
                        className="text-[9px] font-semibold tracking-widest text-center"
                        style={{ color: "rgba(235,235,245,0.2)" }}
                      >
                        {h}
                      </span>
                    ))}
                  </div>

                  {/* Lignes de séries */}
                  {ex.setLogs.map((set, setIdx) => {
                    const setTimerKey = ex.id + "-set-" + setIdx;
                    const isTimerActive = timerKey === setTimerKey;

                    return (
                      <div
                        key={setIdx}
                        className="grid px-4 py-2.5 items-center"
                        style={{
                          gridTemplateColumns: "28px 1fr 1fr 52px",
                          background: set.done
                            ? "rgba(48,209,88,0.03)"
                            : "transparent",
                          borderBottom:
                            setIdx < (ex.setLogs?.length ?? 0) - 1
                              ? "1px solid rgba(255,255,255,0.04)"
                              : "none",
                          opacity: set.done && !isTimerActive ? 0.6 : 1,
                        }}
                      >
                        {/* Numéro de série */}
                        <span
                          className="font-display text-lg leading-none text-center"
                          style={{ color: set.done ? "#30D158" : "rgba(235,235,245,0.3)" }}
                        >
                          {setIdx + 1}
                        </span>

                        {/* Input KG */}
                        <div className="flex items-end justify-center gap-0.5">
                          <input
                            type="number"
                            value={set.weight === 0 ? "" : set.weight}
                            onChange={(e) =>
                              updateSetLog(ex.id, setIdx, "weight", parseFloat(e.target.value) || 0)
                            }
                            disabled={set.done || saved}
                            onClick={(e) => e.stopPropagation()}
                            className="w-14 text-center bg-transparent border-none p-0 font-display text-2xl leading-none focus:outline-none disabled:cursor-default"
                            style={{ color: set.done ? "#30D158" : "white", boxShadow: "none" }}
                            min="0"
                            step="0.5"
                          />
                          <span className="text-[9px] pb-1" style={{ color: "rgba(235,235,245,0.2)" }}>
                            kg
                          </span>
                        </div>

                        {/* Input REPS */}
                        <div className="flex items-end justify-center gap-0.5">
                          <input
                            type="number"
                            value={set.reps === 0 ? "" : set.reps}
                            onChange={(e) =>
                              updateSetLog(ex.id, setIdx, "reps", parseInt(e.target.value) || 0)
                            }
                            disabled={set.done || saved}
                            onClick={(e) => e.stopPropagation()}
                            className="w-10 text-center bg-transparent border-none p-0 font-display text-2xl leading-none focus:outline-none disabled:cursor-default"
                            style={{ color: set.done ? "#30D158" : "white", boxShadow: "none" }}
                            min="0"
                            step="1"
                          />
                          <span className="text-[9px] pb-1" style={{ color: "rgba(235,235,245,0.2)" }}>
                            ×
                          </span>
                        </div>

                        {/* Bouton valider / Timer */}
                        <div className="flex justify-center">
                          {isTimerActive ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); stopTimer(); }}
                              className="flex flex-col items-center press-effect"
                            >
                              <span
                                className="font-display text-xl leading-none"
                                style={{
                                  color: timerSec > 10 ? "#30D158" : timerSec > 3 ? "#FF9F0A" : "#FF453A",
                                }}
                              >
                                {timerSec}s
                              </span>
                              <span className="text-[8px]" style={{ color: "rgba(235,235,245,0.3)" }}>
                                stop
                              </span>
                            </button>
                          ) : set.done ? (
                            <span className="text-base" style={{ color: "#30D158" }}>✓</span>
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); validateSet(ex.id, setIdx); }}
                              disabled={saved}
                              className="w-9 h-9 rounded-xl flex items-center justify-center press-effect disabled:opacity-30"
                              style={{
                                background: "rgba(10,132,255,0.12)",
                                border: "1px solid rgba(10,132,255,0.35)",
                              }}
                            >
                              <span className="text-sm" style={{ color: "#0A84FF" }}>✓</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Temps de récup */}
              {coachEx?.restSeconds && (
                <div
                  className="px-4 py-2 flex items-center gap-2"
                  style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
                >
                  <span className="text-[10px] font-medium" style={{ color: "rgba(235,235,245,0.2)" }}>
                    ⏱ Récup {coachEx.restSeconds}s
                  </span>
                </div>
              )}

              {/* Commentaire */}
              {!saved && (
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <textarea
                    value={ex.comment}
                    onChange={(e) => updateComment(ex.id, e.target.value)}
                    placeholder="Ressenti sur cet exercice…"
                    rows={2}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full bg-transparent border-none px-4 py-3 text-xs resize-none focus:outline-none"
                    style={{ color: "rgba(235,235,245,0.5)", boxShadow: "none" }}
                  />
                </div>
              )}
            </div>
          );
        })}

        {/* Coach feedback post-save */}
        {saved && !existingSession && <CoachFeedbackCard state={coachState} result={coachResult} />}
      </div>

      {/* Action bas de page */}
      <div
        className="fixed bottom-0 left-0 right-0 px-4 pt-4"
        style={{
          background: "linear-gradient(to top, #000 65%, transparent)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 88px)",
        }}
      >
        {existingSession ? null : saved ? (
          <button
            onClick={() => router.push("/")}
            className="w-full py-4 rounded-2xl font-semibold text-base press-effect"
            style={{
              background: "rgba(48,209,88,0.12)",
              color: "#30D158",
              border: "1px solid rgba(48,209,88,0.3)",
            }}
          >
            Continuer →
          </button>
        ) : (
          <div className="space-y-2">
            <button
              onClick={handleSave}
              disabled={saving || !coachWorkout || exercises.length === 0}
              className="w-full py-4 rounded-2xl font-semibold text-base press-effect disabled:opacity-40"
              style={{
                background: "#FF9F0A",
                color: "#000",
              }}
            >
              {saving ? "Sauvegarde…" : "Finaliser la séance"}
            </button>
            <button
              onClick={handleCancel}
              className="w-full py-2.5 rounded-xl text-sm press-effect"
              style={{
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "rgba(235,235,245,0.4)",
              }}
            >
              Annuler la séance
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
