"use client";

import { useEffect, useState } from "react";
import { useTimer } from "@/contexts/TimerContext";
import { useRouter } from "next/navigation";
import Badge from "@/components/Badge";
import DayHeader from "@/components/DayHeader";
import CoachRunPlan from "@/components/CoachRunPlan";
import ExerciseCardReadonly from "@/components/ExerciseCardReadonly";
import RunSessionResults from "@/components/RunSessionResults";
import FitnessSessionResults from "@/components/FitnessSessionResults";
import DayActions from "@/components/DayActions";
import CoachFeedbackCard from "@/components/CoachFeedbackCard";
import {
  getSessions, getCancelledDays, cancelDay, uncancelDay,
  rescheduleDay, unrescheduleDay, getRescheduledDays, deleteSession,
  addSession, generateId,
} from "@/lib/storage";
import { getCoachWorkouts, getCoachRuns, addCoachWorkout, deleteCoachWorkout, addCoachRun, deleteCoachRun } from "@/lib/coachPlan";
import { autoSyncPush } from "@/lib/sync";
import { analyzeSession, getStoredCoachAnalysis, type CoachAnalysisResult } from "@/lib/coachAnalyzer";
import { WEEKLY_PLAN, toLocalDateStr, formatPace } from "@/lib/plan";
import type { WorkoutSession, FitnessSession, RunSession, CancelledDay as CancelledDayType } from "@/lib/types";
import type { CoachWorkout, CoachRun } from "@/lib/coachPlan";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const StravaIcon = () => (
  <img src={`${BASE}/strava.svg`} width={12} height={12} alt="Strava" style={{ filter: "invert(50%) sepia(100%) saturate(500%) hue-rotate(350deg)" }} />
);

export default function DayPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [date, setDate] = useState("");
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [coachWorkout, setCoachWorkout] = useState<CoachWorkout | null>(null);
  const [coachRun, setCoachRun] = useState<CoachRun | null>(null);
  const [cancelledDay, setCancelledDay] = useState<CancelledDayType | null>(null);
  const [reschedule, setReschedule] = useState<{ from: string; to: string } | null>(null);
  const [exerciseNotes, setExerciseNotes] = useState<Record<number, string>>({});
  const [coachState, setCoachState] = useState<"analyzing" | "done">("done");
  const [coachResult, setCoachResult] = useState<CoachAnalysisResult | null>(null);
  const [analysisAttempted, setAnalysisAttempted] = useState(false);
  const [activeTab, setActiveTab] = useState<"run" | "workout">("run");
  const [activeExIdx, setActiveExIdx] = useState(0);

  const { timerKey, timerSec, startTimer, stopTimer } = useTimer();

  const load = (d: string) => {
    const sessions = getSessions();
    const s = sessions.find((s) => s.date.slice(0, 10) === d) ?? null;
    setSession(s);
    const workouts = getCoachWorkouts();
    const runs = getCoachRuns();
    const rescheduled = getRescheduledDays();
    const rescheduledAway = rescheduled.some((r) => r.from === d);
    const rescheduledHere = rescheduled.find((r) => r.to === d);
    const reschFromWorkout = rescheduledHere ? workouts.find((w) => w.date === rescheduledHere.from) ?? null : null;
    const reschFromRun = rescheduledHere ? runs.find((r) => r.date === rescheduledHere.from) ?? null : null;
    setCoachWorkout(rescheduledAway ? null : (workouts.find((w) => w.date === d) ?? reschFromWorkout));
    setCoachRun(rescheduledAway ? null : (runs.find((r) => r.date === d) ?? reschFromRun));
    const cancelled = getCancelledDays();
    setCancelledDay(cancelled.find((c) => c.date === d) ?? null);
    setReschedule(rescheduled.find((r) => r.from === d) ?? null);
    const notesInit: Record<number, string> = {};
    if (s?.type === "fitness") {
      s.exercises.forEach((ex, i) => { if (ex.comment) notesInit[i] = ex.comment; });
    }
    try {
      const stored = localStorage.getItem(`cc_ex_notes_${d}`);
      if (stored) {
        const parsed = JSON.parse(stored) as Record<number, string>;
        Object.entries(parsed).forEach(([k, v]) => {
          if (!notesInit[Number(k)]) notesInit[Number(k)] = v;
        });
      }
    } catch {}
    setExerciseNotes(notesInit);
    const storedAnalysis = getStoredCoachAnalysis(d);
    setCoachResult(storedAnalysis);
    // For Strava runs without a stored analysis, trigger background analysis and show loader.
    // The in-flight guard in analyzeSession prevents double calls if home page already triggered it.
    if (!storedAnalysis && s?.importedFromStrava && s.type === "run") {
      setAnalysisAttempted(true);
      setCoachState("analyzing");
      analyzeSession(s).then((result) => {
        setCoachResult(result);
        setCoachState("done");
      });
    } else {
      setCoachState("done");
    }
  };

  useEffect(() => {
    setMounted(true);
    const params = new URLSearchParams(window.location.search);
    const d = params.get("date") ?? toLocalDateStr(new Date());
    setDate(d);
    load(d);
    return () => {};
  }, []);

  const handleNoteChange = (index: number, value: string) => {
    const updated = { ...exerciseNotes, [index]: value };
    setExerciseNotes(updated);
    try { localStorage.setItem(`cc_ex_notes_${date}`, JSON.stringify(updated)); } catch {}
  };

  const handleValidateFitness = () => {
    if (!coachWorkout) {
      router.push(`/log/fitness?date=${date}`);
      return;
    }
    const exercises = coachWorkout.exercises.map((ce, i) => ({
      id: `${generateId()}-ex-${i}`,
      name: ce.name, sets: ce.sets, reps: ce.reps, weight: ce.weight,
      comment: exerciseNotes[i] ?? "",
    }));
    const savedSession: FitnessSession = {
      id: generateId(),
      type: "fitness",
      date: new Date(date + "T12:00:00").toISOString(),
      category: coachWorkout.category,
      comment: "",
      exercises,
      coachWorkoutId: coachWorkout.id,
    };
    addSession(savedSession);
    load(date);
    autoSyncPush();
    setAnalysisAttempted(true);
    setCoachState("analyzing");
    setCoachResult(null);
    analyzeSession(savedSession).then((result) => {
      setCoachResult(result);
      setCoachState("done");
    });
  };

  const handleUncancel = () => { uncancelDay(date); load(date); autoSyncPush(); };
  const handleUnreschedule = () => { unrescheduleDay(date); load(date); autoSyncPush(); };

  const handleReschedule = (newDate: string, target: "run" | "workout" | null) => {
    if (target === "run" && coachRun) {
      deleteCoachRun(coachRun.id);
      addCoachRun({ ...coachRun, date: newDate });
    } else if (target === "workout" && coachWorkout) {
      deleteCoachWorkout(coachWorkout.id);
      addCoachWorkout({ ...coachWorkout, date: newDate });
    } else {
      rescheduleDay(date, newDate);
    }
    load(date);
    autoSyncPush();
  };

  const handleCancel = (reason: string) => {
    cancelDay(date, reason);
    load(date);
    autoSyncPush();
  };

  const handleDeletePlan = (type: "run" | "workout") => {
    if (type === "run" && coachRun) { deleteCoachRun(coachRun.id); setCoachRun(null); autoSyncPush(); }
    else if (type === "workout" && coachWorkout) { deleteCoachWorkout(coachWorkout.id); setCoachWorkout(null); autoSyncPush(); }
  };

  if (!mounted || !date) return null;

  const dateObj = new Date(date + "T12:00:00");
  const dateLabel = dateObj.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const dow = dateObj.getDay();
  const genericPlan = WEEKLY_PLAN.find((p) => p.dayOfWeek === dow) ?? null;
  const today = toLocalDateStr(new Date());
  const isPast = date < today;
  const isToday = date === today;
  const isCancelled = !!cancelledDay;
  const hasPlan = !!(coachRun || coachWorkout || genericPlan);
  const isDone = !!session;
  const canAct = hasPlan && !isDone && !isCancelled && !reschedule;
  const hasDouble = !!(coachRun && coachWorkout);
  const isRunDay = !!(coachRun || genericPlan?.type === "run");

  let titleLine = "REPOS";
  if (session) {
    titleLine = session.type === "run" ? "RUN" : session.category === "upper" ? "HAUT DU CORPS" : "BAS DU CORPS";
  } else if (hasDouble) {
    titleLine = `${coachRun!.label} · ${coachWorkout!.label}`;
  } else if (coachRun) { titleLine = coachRun.label; }
  else if (coachWorkout) { titleLine = coachWorkout.label; }
  else if (genericPlan) { titleLine = genericPlan.label; }

  const timerExIndex = timerKey !== null ? timerKey : null;

  const mergedExercises = coachWorkout
    ? coachWorkout.exercises.map((ce, i) => {
        const se = session?.type === "fitness"
          ? (session.exercises.find((e) => e.name === ce.name) ?? session.exercises[i])
          : null;
        // Per-set breakdown: session setLogs take priority, then plan setPlans
        let setRows: Array<{ weight: number; reps: number; done?: boolean }> | undefined;
        if (se?.setLogs && se.setLogs.length > 0) {
          setRows = se.setLogs.map((s) => ({ weight: s.weight, reps: s.reps, done: s.done }));
        } else if (ce.setPlans && ce.setPlans.length > 0) {
          setRows = ce.setPlans.map((s) => ({ weight: s.weight, reps: s.reps }));
        }
        return {
          index: i,
          name: ce.name,
          sets: se?.sets ?? ce.sets,
          reps: se?.reps ?? ce.reps,
          weight: se?.weight ?? ce.weight,
          setRows,
          restSeconds: ce.restSeconds,
          coachNote: ce.coachNote,
          note: exerciseNotes[i] ?? se?.comment ?? "",
        };
      })
    : [];

  return (
    <div className="max-w-md mx-auto animate-fade-in pb-24">

      <DayHeader
        dateLabel={dateLabel}
        titleLine={titleLine}
        isDone={isDone}
        isCancelled={isCancelled}
        hasPlan={hasPlan}
        isToday={isToday}
        onBack={() => router.back()}
      />

      <div className="px-5 space-y-4">

        {isDone && (analysisAttempted || coachState === "analyzing" || !!coachResult) && (
          <CoachFeedbackCard state={coachState} result={coachResult} />
        )}

        {isDone && coachState === "done" && !analysisAttempted && session && (
          <button
            onClick={() => {
              setAnalysisAttempted(true);
              setCoachResult(null);
              setCoachState("analyzing");
              analyzeSession(session).then((result) => {
                setCoachResult(result);
                setCoachState("done");
              });
            }}
            className="w-full py-2.5 rounded-xl text-xs font-bold tracking-widest press-effect"
            style={{ background: "rgba(57,255,20,0.06)", border: "1px solid rgba(57,255,20,0.2)", color: "#39ff14" }}
          >
            RELANCER L'ANALYSE COACH →
          </button>
        )}

        {isCancelled && (
          <div className="flex items-center justify-between rounded-xl px-3 py-2.5"
            style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
            <p className="text-xs" style={{ color: "#333" }}>
              Annulé{cancelledDay?.reason ? ` · ${cancelledDay.reason}` : ""}
            </p>
            <button onClick={handleUncancel} className="text-xs press-effect" style={{ color: "#555" }}>
              Rétablir →
            </button>
          </div>
        )}

        {/* Content — dimmed when cancelled */}
        <div style={{ opacity: isCancelled ? 0.18 : 1, pointerEvents: isCancelled ? "none" : undefined }}>
        <div className="space-y-4">

        {session?.importedFromStrava && (
          <div className="flex items-center gap-1.5 text-xs" style={{ color: "#ff6b00" }}>
            <StravaIcon /> Importé depuis Strava
          </div>
        )}

        {/* Tab bar — double days only */}
        {hasDouble && (
          <div className="flex rounded-xl overflow-hidden" style={{ border: "1px solid #1a1a1a" }}>
            {(["run", "workout"] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className="flex-1 py-2 text-xs font-bold tracking-wide uppercase press-effect"
                style={{
                  background: activeTab === tab ? "#1a1a1a" : "transparent",
                  color: activeTab === tab ? "#39ff14" : "#444",
                }}>
                {tab === "run" ? "Run" : "Muscu"}
              </button>
            ))}
          </div>
        )}

        {/* Coach run plan */}
        {coachRun && (!hasDouble || activeTab === "run") && (
          <CoachRunPlan coachRun={coachRun} />
        )}

        {/* Coach workout — one card per exercise */}
        {coachWorkout && (!hasDouble || activeTab === "workout") && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold tracking-widest" style={{ color: "#39ff14" }}>PLAN COACH</p>
              <Badge label={coachWorkout.category === "upper" ? "Haut du corps" : "Bas du corps"} variant="orange" />
            </div>
            {mergedExercises.map((ex) => (
              <ExerciseCardReadonly
                key={ex.index}
                ex={ex}
                isDone={isDone}
                isActive={!isDone && ex.index === activeExIdx}
                isInteractive={!isDone}
                timerExIndex={timerExIndex}
                timerSec={timerSec}
                onStartTimer={startTimer}
                onStopTimer={stopTimer}
                onNoteChange={handleNoteChange}
                onAllSetsDone={() => setActiveExIdx(ex.index + 1)}
              />
            ))}
          </div>
        )}

        {/* No coach data — generic plan */}
        {!coachRun && !coachWorkout && genericPlan && !session && (
          <div className="rounded-2xl p-4" style={{ background: "#111", border: "1px solid #1a1a1a" }}>
            <p className="text-xs text-muted mb-2">{genericPlan.targetDescription}</p>
            {genericPlan.type === "run" && (
              <div className="flex gap-4 mt-2">
                {genericPlan.targetDistanceKm && (
                  <div>
                    <span className="font-display text-2xl" style={{ color: "#39ff14" }}>{genericPlan.targetDistanceKm}</span>
                    <span className="text-xs text-muted ml-1">km</span>
                  </div>
                )}
                {genericPlan.targetPaceSecPerKm && (
                  <span className="font-display text-2xl" style={{ color: "#39ff14" }}>{formatPace(genericPlan.targetPaceSecPerKm)}</span>
                )}
                {genericPlan.targetZone && <Badge label={genericPlan.targetZone} variant="neon" />}
              </div>
            )}
          </div>
        )}

        {/* Run session results */}
        {session && session.type === "run" && (
          <RunSessionResults session={session as RunSession} />
        )}

        {/* Fitness session without coach plan */}
        {session && session.type === "fitness" && !coachWorkout && (
          <FitnessSessionResults session={session as FitnessSession} />
        )}

        {/* Rest day */}
        {!hasPlan && !session && (
          <div className="flex items-center gap-3 rounded-2xl p-4" style={{ background: "#111" }}>
            <span className="text-2xl">😴</span>
            <p className="text-sm text-muted">Jour de repos — récupération active.</p>
          </div>
        )}

        <DayActions
          date={date}
          canAct={canAct}
          hasDouble={hasDouble}
          isDone={isDone}
          isPast={isPast}
          isToday={isToday}
          activeTab={activeTab}
          isRunDay={isRunDay}
          coachRun={coachRun}
          coachWorkout={coachWorkout}
          onReschedule={handleReschedule}
          onCancel={handleCancel}
          onDeletePlan={handleDeletePlan}
          onValidateFitness={handleValidateFitness}
          onDeleteSession={() => { if (session) { deleteSession(session.id); load(date); autoSyncPush(); } }}
        />

        </div>
        </div>{/* end dimming wrapper */}

        {/* Delete session */}
        {isDone && (
          <button
            onClick={() => { if (session) { deleteSession(session.id); load(date); } }}
            className="w-full py-2 rounded-xl text-xs press-effect"
            style={{ background: "transparent", border: "1px solid #111", color: "#2a2a2a" }}
          >
            Supprimer la séance
          </button>
        )}

      </div>
    </div>
  );
}
