"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Badge from "@/components/Badge";
import {
  getSessions, getCancelledDays, cancelDay, uncancelDay,
  rescheduleDay, unrescheduleDay, getRescheduledDays, updateSession, deleteSession,
} from "@/lib/storage";
import { getCoachWorkouts, getCoachRuns, addCoachWorkout, deleteCoachWorkout, addCoachRun, deleteCoachRun } from "@/lib/coachPlan";
import { autoSyncPush } from "@/lib/sync";
import { WEEKLY_PLAN, toLocalDateStr } from "@/lib/plan";
import type { WorkoutSession, FitnessSession, CancelledDay as CancelledDayType } from "@/lib/types";
import type { CoachWorkout, CoachRun } from "@/lib/coachPlan";

function fmtPaceSec(sec: number) {
  return `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}/km`;
}
function fmtDuration(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${m} min`;
}

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

  // Exercise notes: index → comment
  const [exerciseNotes, setExerciseNotes] = useState<Record<number, string>>({});
  const [notesDirty, setNotesDirty] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);

  // Rest timer
  const [timerExIndex, setTimerExIndex] = useState<number | null>(null);
  const [timerSec, setTimerSec] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Action states
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleDate, setRescheduleDateState] = useState("");
  const [rescheduleTarget, setRescheduleTarget] = useState<"run" | "workout" | null>(null);
  const [activeTab, setActiveTab] = useState<"run" | "workout">("run");
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const load = (d: string) => {
    const sessions = getSessions();
    const s = sessions.find((s) => s.date.slice(0, 10) === d) ?? null;
    setSession(s);
    const workouts = getCoachWorkouts();
    const runs = getCoachRuns();
    const rescheduled = getRescheduledDays();
    // Check if this date was rescheduled AWAY — if so, show nothing here
    const rescheduledAway = rescheduled.some((r) => r.from === d);
    // Check if a plan was rescheduled TO this date from another date
    const rescheduledHere = rescheduled.find((r) => r.to === d);
    const reschFromWorkout = rescheduledHere ? workouts.find((w) => w.date === rescheduledHere.from) ?? null : null;
    const reschFromRun = rescheduledHere ? runs.find((r) => r.date === rescheduledHere.from) ?? null : null;
    setCoachWorkout(rescheduledAway ? null : (workouts.find((w) => w.date === d) ?? reschFromWorkout));
    setCoachRun(rescheduledAway ? null : (runs.find((r) => r.date === d) ?? reschFromRun));
    const cancelled = getCancelledDays();
    setCancelledDay(cancelled.find((c) => c.date === d) ?? null);
    setReschedule(rescheduled.find((r) => r.from === d) ?? null);
    // Init notes: session notes first, then standalone localStorage notes
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
  };

  useEffect(() => {
    setMounted(true);
    const params = new URLSearchParams(window.location.search);
    const d = params.get("date") ?? toLocalDateStr(new Date());
    setDate(d);
    load(d);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const handleNoteChange = (index: number, value: string) => {
    setExerciseNotes((prev) => ({ ...prev, [index]: value }));
    setNotesDirty(true);
    setNotesSaved(false);
  };

  const handleSaveNotes = () => {
    // Always persist standalone notes to localStorage
    try { localStorage.setItem(`cc_ex_notes_${date}`, JSON.stringify(exerciseNotes)); } catch {}

    // If session exists, also update it
    if (session && session.type === "fitness") {
      let updatedExercises = [...session.exercises];
      if (updatedExercises.length === 0 && coachWorkout) {
        updatedExercises = coachWorkout.exercises.map((ce, i) => ({
          id: `${session.id}-ex-${i}`,
          name: ce.name, sets: ce.sets, reps: ce.reps, weight: ce.weight,
          comment: exerciseNotes[i] ?? "",
        }));
      } else {
        updatedExercises = updatedExercises.map((ex, i) => ({ ...ex, comment: exerciseNotes[i] ?? ex.comment }));
      }
      const updated: FitnessSession = { ...session, exercises: updatedExercises };
      updateSession(updated);
      setSession(updated);
    }
    setNotesDirty(false);
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 2000);
    autoSyncPush();
  };

  const startTimer = (exIndex: number, seconds: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimerExIndex(exIndex);
    setTimerSec(seconds);
    timerRef.current = setInterval(() => {
      setTimerSec((s) => {
        if (s <= 1) { clearInterval(timerRef.current!); timerRef.current = null; setTimerExIndex(null); return 0; }
        return s - 1;
      });
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setTimerExIndex(null);
  };

  const handleCancelConfirm = () => {
    cancelDay(date, cancelReason.trim());
    setShowCancel(false); setCancelReason(""); load(date);
    autoSyncPush();
  };
  const handleUncancel = () => { uncancelDay(date); load(date); autoSyncPush(); };
  const handleReschedule = () => {
    if (!rescheduleDate) return;
    if (rescheduleTarget === "run" && coachRun) {
      deleteCoachRun(coachRun.id);
      addCoachRun({ ...coachRun, date: rescheduleDate });
    } else if (rescheduleTarget === "workout" && coachWorkout) {
      deleteCoachWorkout(coachWorkout.id);
      addCoachWorkout({ ...coachWorkout, date: rescheduleDate });
    } else {
      rescheduleDay(date, rescheduleDate);
    }
    setShowReschedule(false); setRescheduleDateState(""); setRescheduleTarget(null); load(date);
    autoSyncPush();
  };
  const handleUnreschedule = () => { unrescheduleDay(date); load(date); autoSyncPush(); };

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
  const hasDouble = !!(coachRun && coachWorkout); // two plans on same day

  // Title
  let titleLine = "REPOS";
  if (session) {
    titleLine = session.type === "run" ? "RUN" : session.category === "upper" ? "HAUT DU CORPS" : "BAS DU CORPS";
  } else if (hasDouble) {
    titleLine = `${coachRun!.label} · ${coachWorkout!.label}`;
  } else if (coachRun) { titleLine = coachRun.label; }
  else if (coachWorkout) { titleLine = coachWorkout.label; }
  else if (genericPlan) { titleLine = genericPlan.label; }

  // Build merged exercise list: coach plan as template, session data fills in actual values + notes
  const mergedExercises = coachWorkout
    ? coachWorkout.exercises.map((ce, i) => {
        const se = session?.type === "fitness"
          ? (session.exercises.find((e) => e.name === ce.name) ?? session.exercises[i])
          : null;
        return {
          index: i,
          name: ce.name,
          sets: se?.sets ?? ce.sets,
          reps: se?.reps ?? ce.reps,
          weight: se?.weight ?? ce.weight,
          restSeconds: ce.restSeconds,
          coachNote: ce.coachNote,
          comment: exerciseNotes[i] ?? se?.comment ?? "",
        };
      })
    : [];

  const canEditNotes = !!coachWorkout;

  const renderRescheduleInline = (target: "run" | "workout", label: string) =>
    showReschedule && rescheduleTarget === target ? (
      <div className="flex gap-2">
        <input type="date" value={rescheduleDate} onChange={(e) => setRescheduleDateState(e.target.value)}
          min={toLocalDateStr(new Date())} autoFocus
          className="flex-1 rounded-xl px-3 py-2.5 text-xs focus:outline-none"
          style={{ background: "#111", border: "1px solid rgba(255,107,0,0.3)", color: "white" }} />
        <button onClick={handleReschedule} disabled={!rescheduleDate}
          className="px-3 py-2.5 rounded-xl text-xs font-bold press-effect disabled:opacity-40"
          style={{ background: "#ff6b00", color: "white" }}>OK</button>
        <button onClick={() => { setShowReschedule(false); setRescheduleDateState(""); setRescheduleTarget(null); }}
          className="px-3 py-2.5 rounded-xl text-xs press-effect" style={{ background: "#1a1a1a", color: "#555" }}>✕</button>
      </div>
    ) : (
      <button onClick={() => { setRescheduleTarget(target); setShowReschedule(true); setShowCancel(false); }}
        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm press-effect"
        style={{ background: "transparent", border: "1px solid #222", color: "#555" }}>
        {label}
      </button>
    );

  return (
    <div className="max-w-md mx-auto animate-fade-in pb-24">

      {/* Header */}
      <div className="px-5 pt-5 pb-4">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-xs mb-5 press-effect" style={{ color: "#555" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Retour
        </button>

        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "#555" }}>{dateLabel}</p>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-4xl leading-none">{titleLine}</h1>
          </div>
          <div className="flex flex-col items-end gap-1">
            {isDone && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold tracking-widest"
                style={{ background: "rgba(57,255,20,0.15)", color: "#39ff14", border: "1px solid rgba(57,255,20,0.3)" }}>
                FAIT ✓
              </span>
            )}
            {isCancelled && <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: "#111", color: "#555", border: "1px solid #222" }}>ANNULÉ</span>}
            {reschedule && <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: "rgba(255,107,0,0.12)", color: "#ff6b00", border: "1px solid rgba(255,107,0,0.3)" }}>DÉCALÉ</span>}
            {!isDone && !isCancelled && !reschedule && hasPlan && isToday && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: "rgba(57,255,20,0.1)", color: "#39ff14", border: "1px solid rgba(57,255,20,0.2)" }}>AUJOURD'HUI</span>
            )}
          </div>
        </div>
      </div>

      <div className="px-5 space-y-4">

        {/* ── Cancelled: subtle restore banner ── */}
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

        {/* Strava badge */}
        {session?.importedFromStrava && (
          <div className="flex items-center gap-1.5 text-xs" style={{ color: "#ff6b00" }}>
            <StravaIcon /> Importé depuis Strava
          </div>
        )}

        {/* ── Tab bar — double days only ── */}
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

        {/* ── COACH RUN PLAN ── */}
        {coachRun && (!hasDouble || activeTab === "run") && (
          <div className="rounded-2xl p-4" style={{ background: "rgba(57,255,20,0.04)", border: "1px solid rgba(57,255,20,0.15)" }}>
            <p className="text-[10px] font-bold tracking-widest mb-3" style={{ color: "#39ff14" }}>PLAN COACH</p>
            {coachRun.intervals ? (
              <div className="space-y-2.5">
                {coachRun.intervals.map((seg, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {seg.label ?? (seg.reps
                        ? `${seg.reps}×${seg.distanceKm < 1 ? `${seg.distanceKm * 1000}m` : `${seg.distanceKm}km`}`
                        : `${seg.distanceKm}km`)}
                    </span>
                    <div className="text-right text-xs" style={{ color: "#666" }}>
                      <span>{seg.pace}/km</span>
                      {seg.targetHR && <span className="ml-2">♥ {seg.targetHR}</span>}
                      {seg.restSeconds && <span className="ml-2">récup {seg.restSeconds}s</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex gap-4 items-end">
                <div>
                  <span className="font-display text-3xl" style={{ color: "#39ff14" }}>{coachRun.distanceKm}</span>
                  <span className="text-xs text-muted ml-1">km</span>
                </div>
                <span className="font-display text-2xl" style={{ color: "#39ff14" }}>{coachRun.pace}/km</span>
                {coachRun.targetHR && <span className="text-sm text-muted self-end mb-1">♥ {coachRun.targetHR}</span>}
                {coachRun.targetZone && <Badge label={coachRun.targetZone} variant="neon" />}
              </div>
            )}
          </div>
        )}
        {/* Per-tab actions — Run */}
        {hasDouble && activeTab === "run" && !isDone && !isCancelled && (isPast || isToday) && (
          <div className="space-y-2">
            <Link href={`/log/run?date=${date}`}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl text-sm font-bold press-effect"
              style={{ background: "rgba(57,255,20,0.12)", border: "1px solid rgba(57,255,20,0.3)", color: "#39ff14" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              Valider le Run
            </Link>
            {renderRescheduleInline("run", "Décaler le Run")}
            <button onClick={() => { if (coachRun) { deleteCoachRun(coachRun.id); setCoachRun(null); autoSyncPush(); } }}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm press-effect"
              style={{ background: "transparent", border: "1px solid #1a1a1a", color: "#333" }}>
              Annuler le Run
            </button>
          </div>
        )}

        {/* ── COACH WORKOUT — one card per exercise ── */}
        {coachWorkout && (!hasDouble || activeTab === "workout") && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold tracking-widest" style={{ color: "#39ff14" }}>PLAN COACH</p>
              <Badge label={coachWorkout.category === "upper" ? "Haut du corps" : "Bas du corps"} variant="orange" />
            </div>
            {mergedExercises.map((ex) => (
              <div
                key={ex.index}
                className="rounded-2xl overflow-hidden"
                style={{ background: "#111", border: "1px solid #1a1a1a" }}
              >
                {/* Exercise header: name + metrics + timer */}
                <div className="px-4 pt-4 pb-3">
                  <p className="font-bold text-xs tracking-widest mb-3">{ex.name.toUpperCase()}</p>
                  <div className="flex items-end justify-between">
                    <div className="flex items-end gap-5">
                      {ex.weight > 0 && (
                        <div className="flex items-end gap-0.5">
                          <span className="font-display text-2xl leading-none" style={{ color: "#39ff14" }}>{ex.weight}</span>
                          <span className="text-xs text-muted mb-0.5 ml-0.5">kg</span>
                        </div>
                      )}
                      <div className="flex items-end gap-0.5">
                        <span className="font-display text-2xl leading-none" style={{ color: "#39ff14" }}>{ex.sets}</span>
                        <span className="text-xs text-muted mb-0.5 ml-0.5">séries</span>
                      </div>
                      <div className="flex items-end gap-0.5">
                        <span className="font-display text-2xl leading-none" style={{ color: "#39ff14" }}>{ex.reps}</span>
                        <span className="text-xs text-muted mb-0.5 ml-0.5">rep</span>
                      </div>
                    </div>
                    {/* Rest timer */}
                    {ex.restSeconds && (
                      timerExIndex === ex.index ? (
                        <button onClick={stopTimer} className="flex items-center gap-2 press-effect">
                          <span className="font-display text-2xl leading-none"
                            style={{ color: timerSec > 10 ? "#39ff14" : timerSec > 3 ? "#ff6b00" : "#ff4444" }}>
                            {timerSec}s
                          </span>
                          <span className="text-sm" style={{ color: "#555" }}>■</span>
                        </button>
                      ) : (
                        <button onClick={() => startTimer(ex.index, ex.restSeconds!)} className="flex items-center gap-2 press-effect">
                          <span className="text-xs font-bold tracking-wide" style={{ color: "#333" }}>RÉCUP {ex.restSeconds}s</span>
                          <span className="text-sm" style={{ color: "#555" }}>▶</span>
                        </button>
                      )
                    )}
                  </div>
                </div>

                {/* Coach note */}
                {ex.coachNote && (
                  <div className="px-4 py-2.5" style={{ borderTop: "1px solid #1a1a1a", background: "rgba(57,255,20,0.02)" }}>
                    <p className="text-[10px] font-bold tracking-widest mb-1" style={{ color: "#2a4a1a" }}>COACH</p>
                    <p className="text-xs italic" style={{ color: "#666" }}>{ex.coachNote}</p>
                  </div>
                )}

                {/* User note — always editable */}
                <div className="px-4 py-3" style={{ borderTop: "1px solid #1a1a1a" }}>
                  <p className="text-[10px] font-bold tracking-widest mb-1.5" style={{ color: "#333" }}>RESSENTI</p>
                  <textarea
                    value={exerciseNotes[ex.index] ?? ""}
                    onChange={(e) => handleNoteChange(ex.index, e.target.value)}
                    placeholder="Charge, fatigue, forme…"
                    rows={2}
                    className="w-full rounded-lg px-2.5 py-2 text-xs resize-none focus:outline-none"
                    style={{ background: "#0d0d0d", border: "1px solid #1a1a1a", color: "#aaa" }}
                  />
                </div>
              </div>
            ))}

            {/* Save notes button */}
            {canEditNotes && notesDirty && (
              <button
                onClick={handleSaveNotes}
                className="w-full py-2.5 rounded-xl text-sm font-bold press-effect"
                style={{ background: "rgba(57,255,20,0.12)", border: "1px solid rgba(57,255,20,0.3)", color: "#39ff14" }}
              >
                Sauvegarder les notes
              </button>
            )}
            {notesSaved && (
              <p className="text-xs text-center" style={{ color: "#39ff14" }}>Notes sauvegardées ✓</p>
            )}
          </div>
        )}
        {/* Per-tab actions — Muscu */}
        {hasDouble && activeTab === "workout" && !isDone && !isCancelled && (isPast || isToday) && (
          <div className="space-y-2">
            <Link href={`/log/fitness?date=${date}`}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl text-sm font-bold press-effect"
              style={{ background: "rgba(57,255,20,0.12)", border: "1px solid rgba(57,255,20,0.3)", color: "#39ff14" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              Valider la Muscu
            </Link>
            {renderRescheduleInline("workout", "Décaler la Muscu")}
            <button onClick={() => { if (coachWorkout) { deleteCoachWorkout(coachWorkout.id); setCoachWorkout(null); autoSyncPush(); } }}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm press-effect"
              style={{ background: "transparent", border: "1px solid #1a1a1a", color: "#333" }}>
              Annuler la Muscu
            </button>
          </div>
        )}

        {/* ── No coach data, show generic plan ── */}
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
                  <span className="font-display text-2xl" style={{ color: "#39ff14" }}>{fmtPaceSec(genericPlan.targetPaceSecPerKm)}</span>
                )}
                {genericPlan.targetZone && <Badge label={genericPlan.targetZone} variant="neon" />}
              </div>
            )}
          </div>
        )}

        {/* ── RUN SESSION RESULTS ── */}
        {session?.type === "run" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl p-4" style={{ background: "#1a1a1a" }}>
                <p className="text-xs text-muted mb-1">Distance</p>
                <p className="font-display text-3xl" style={{ color: "#39ff14" }}>
                  {session.distanceKm.toFixed(2)}<span className="text-sm text-muted ml-1">km</span>
                </p>
              </div>
              <div className="rounded-2xl p-4" style={{ background: "#1a1a1a" }}>
                <p className="text-xs text-muted mb-1">Allure</p>
                <p className="font-display text-3xl" style={{ color: "#39ff14" }}>
                  {session.avgPaceSecPerKm > 0 ? fmtPaceSec(session.avgPaceSecPerKm) : "--"}
                </p>
              </div>
              {session.durationSeconds > 0 && (
                <div className="rounded-2xl p-4" style={{ background: "#1a1a1a" }}>
                  <p className="text-xs text-muted mb-1">Durée</p>
                  <p className="font-display text-2xl">{fmtDuration(session.durationSeconds)}</p>
                </div>
              )}
              {session.avgHeartRate && (
                <div className="rounded-2xl p-4" style={{ background: "#1a1a1a" }}>
                  <p className="text-xs text-muted mb-1">FC moyenne</p>
                  <p className="font-display text-2xl">{session.avgHeartRate}<span className="text-sm text-muted ml-1">bpm</span></p>
                </div>
              )}
              {session.elevationGainM != null && session.elevationGainM > 0 && (
                <div className="rounded-2xl p-4" style={{ background: "#1a1a1a" }}>
                  <p className="text-xs text-muted mb-1">Dénivelé</p>
                  <p className="font-display text-2xl">{Math.round(session.elevationGainM)}<span className="text-sm text-muted ml-1">m</span></p>
                </div>
              )}
            </div>
            {session.comment && (
              <div className="rounded-2xl p-4" style={{ background: "#1a1a1a" }}>
                <p className="text-xs text-muted mb-1">Ressenti</p>
                <p className="text-sm italic" style={{ color: "#aaa" }}>"{session.comment}"</p>
              </div>
            )}
          </div>
        )}

        {/* ── FITNESS SESSION: session without coach plan ── */}
        {session?.type === "fitness" && !coachWorkout && (
          <div className="rounded-2xl p-4" style={{ background: "#1a1a1a" }}>
            {session.exercises.length > 0 ? (
              <>
                <p className="text-[10px] font-bold tracking-widest mb-3" style={{ color: "#555" }}>EXERCICES</p>
                <div className="space-y-2">
                  {session.exercises.map((ex) => (
                    <div key={ex.id} className="flex items-center justify-between text-sm">
                      <span>{ex.name}</span>
                      <span className="font-mono text-muted">{ex.sets}×{ex.reps}{ex.weight > 0 ? ` · ${ex.weight}kg` : ""}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted">Activité enregistrée via Strava.</p>
            )}
            {session.comment && (
              <p className="text-xs italic mt-3" style={{ color: "#888" }}>"{session.comment}"</p>
            )}
          </div>
        )}

        {/* ── Rest day ── */}
        {!hasPlan && !session && (
          <div className="flex items-center gap-3 rounded-2xl p-4" style={{ background: "#111" }}>
            <span className="text-2xl">😴</span>
            <p className="text-sm text-muted">Jour de repos — récupération active.</p>
          </div>
        )}

        {/* ── Rescheduled info ── */}
        {reschedule && (
          <div className="rounded-2xl px-4 py-3 flex items-center justify-between"
            style={{ background: "rgba(255,107,0,0.06)", border: "1px solid rgba(255,107,0,0.2)" }}>
            <p className="text-xs" style={{ color: "#ff6b00" }}>
              Décalé au <strong>{new Date(reschedule.to + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}</strong>
            </p>
            <button onClick={handleUnreschedule} className="text-xs px-2 py-1 rounded-lg press-effect" style={{ background: "#1a1a1a", color: "#555" }}>
              Annuler le décalage
            </button>
          </div>
        )}

        {/* ── Valider manuellement — single plan days only ── */}
        {!hasDouble && hasPlan && !isDone && !isCancelled && !reschedule && (isPast || isToday) && (
          <Link
            href={`/log/${coachRun || genericPlan?.type === "run" ? "run" : "fitness"}?date=${date}`}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl text-sm font-bold press-effect"
            style={{ background: "rgba(57,255,20,0.12)", border: "1px solid rgba(57,255,20,0.3)", color: "#39ff14" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Valider manuellement
          </Link>
        )}

        {/* ── Actions: Décaler / Annuler — single plan days only ── */}
        {canAct && !hasDouble && (
          <div className="space-y-2">
            {showReschedule ? (
              <div className="flex gap-2">
                <input type="date" value={rescheduleDate}
                  onChange={(e) => setRescheduleDateState(e.target.value)}
                  min={toLocalDateStr(new Date())}
                  className="flex-1 rounded-xl px-3 py-2.5 text-xs focus:outline-none"
                  style={{ background: "#111", border: "1px solid rgba(255,107,0,0.3)", color: "white" }}
                  autoFocus
                />
                <button onClick={handleReschedule} disabled={!rescheduleDate}
                  className="px-3 py-2.5 rounded-xl text-xs font-bold press-effect disabled:opacity-40"
                  style={{ background: "#ff6b00", color: "white" }}>OK</button>
                <button onClick={() => { setShowReschedule(false); setRescheduleDateState(""); setRescheduleTarget(null); }}
                  className="px-3 py-2.5 rounded-xl text-xs press-effect"
                  style={{ background: "#1a1a1a", color: "#555" }}>✕</button>
              </div>
            ) : (
              <button onClick={() => { setShowReschedule(true); setShowCancel(false); }}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm press-effect"
                style={{ background: "transparent", border: "1px solid #222", color: "#555" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <path d="M8 7H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M8 7h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
                Décaler
              </button>
            )}

            {showCancel ? (
              <div className="space-y-2">
                <input type="text" value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Raison de l'annulation…"
                  className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none"
                  style={{ background: "#111", border: "1px solid #333", color: "white" }}
                  onKeyDown={(e) => { if (e.key === "Enter") handleCancelConfirm(); }}
                  autoFocus
                />
                <div className="flex gap-2">
                  <button onClick={handleCancelConfirm}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold press-effect"
                    style={{ background: "#1a1a1a", color: "#aaa", border: "1px solid #333" }}>
                    Confirmer l'annulation
                  </button>
                  <button onClick={() => setShowCancel(false)}
                    className="px-4 py-2.5 rounded-xl text-sm press-effect"
                    style={{ background: "transparent", color: "#555" }}>✕</button>
                </div>
              </div>
            ) : (
              <button onClick={() => { setShowCancel(true); setShowReschedule(false); }}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm press-effect"
                style={{ background: "transparent", border: "1px solid #1a1a1a", color: "#333" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                Annuler la séance
              </button>
            )}
          </div>
        )}

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
