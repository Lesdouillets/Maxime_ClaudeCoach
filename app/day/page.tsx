"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Badge from "@/components/Badge";
import { getSessions, getCancelledDays, cancelDay, uncancelDay, rescheduleDay, unrescheduleDay, getRescheduledDays } from "@/lib/storage";
import { getCoachWorkouts, getCoachRuns } from "@/lib/coachPlan";
import { WEEKLY_PLAN, toLocalDateStr } from "@/lib/plan";
import type { WorkoutSession, CancelledDay as CancelledDayType } from "@/lib/types";
import type { CoachWorkout, CoachRun } from "@/lib/coachPlan";

function fmtPaceSec(sec: number) {
  return `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}/km`;
}
function fmtDuration(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${m} min`;
}

const StravaIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="#ff6b00">
    <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066l-2.084 4.116zM11.648 13.828L8.966 8H6.58l5.069 10 5.069-10h-2.386z"/>
  </svg>
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

  // Action states
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleDate, setRescheduleDateState] = useState("");
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const load = (d: string) => {
    const sessions = getSessions();
    const s = sessions.find((s) => s.date.slice(0, 10) === d) ?? null;
    setSession(s);
    const workouts = getCoachWorkouts();
    setCoachWorkout(workouts.find((w) => w.date === d) ?? null);
    const runs = getCoachRuns();
    setCoachRun(runs.find((r) => r.date === d) ?? null);
    const cancelled = getCancelledDays();
    setCancelledDay(cancelled.find((c) => c.date === d) ?? null);
    const rescheduled = getRescheduledDays();
    setReschedule(rescheduled.find((r) => r.from === d) ?? null);
  };

  useEffect(() => {
    setMounted(true);
    const params = new URLSearchParams(window.location.search);
    const d = params.get("date") ?? toLocalDateStr(new Date());
    setDate(d);
    load(d);
  }, []);

  const handleCancelConfirm = () => {
    cancelDay(date, cancelReason.trim());
    setShowCancel(false); setCancelReason("");
    load(date);
  };
  const handleUncancel = () => { uncancelDay(date); load(date); };
  const handleReschedule = () => {
    if (!rescheduleDate) return;
    rescheduleDay(date, rescheduleDate);
    setShowReschedule(false); setRescheduleDateState("");
    load(date);
  };
  const handleUnreschedule = () => { unrescheduleDay(date); load(date); };

  if (!mounted || !date) return null;

  const dateObj = new Date(date + "T12:00:00");
  const dateLabel = dateObj.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const dow = dateObj.getDay();
  const genericPlan = WEEKLY_PLAN.find((p) => p.dayOfWeek === dow) ?? null;
  const today = toLocalDateStr(new Date());
  const isPast = date < today;
  const isToday = date === today;
  const isCancelled = !!cancelledDay;

  // Effective plan type
  const planType = coachRun ? "run" : coachWorkout ? "fitness" : genericPlan?.type ?? null;
  const hasPlan = !!(coachRun || coachWorkout || genericPlan);
  const isDone = !!session;

  const canAct = hasPlan && !isDone && !isCancelled && !reschedule;

  // Title
  let title = "REPOS";
  if (session) {
    title = session.type === "run" ? "RUN" : session.category === "upper" ? "HAUT DU CORPS" : "BAS DU CORPS";
  } else if (coachRun) {
    title = coachRun.label;
  } else if (coachWorkout) {
    title = coachWorkout.label;
  } else if (genericPlan) {
    title = genericPlan.label;
  }

  return (
    <div className="max-w-md mx-auto animate-fade-in pb-24">

      {/* Header */}
      <div className="px-5 pt-5 pb-4">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-xs mb-5 press-effect"
          style={{ color: "#555" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Retour
        </button>

        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "#555" }}>
          {dateLabel}
        </p>
        <div className="flex items-center justify-between">
          <h1 className="font-display text-4xl leading-none">{title}</h1>
          <div className="flex flex-col items-end gap-1">
            {isDone && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold tracking-widest"
                style={{ background: "rgba(57,255,20,0.15)", color: "#39ff14", border: "1px solid rgba(57,255,20,0.3)" }}>
                FAIT ✓
              </span>
            )}
            {isCancelled && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold tracking-widest"
                style={{ background: "#111", color: "#555", border: "1px solid #222" }}>
                ANNULÉ
              </span>
            )}
            {reschedule && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold tracking-widest"
                style={{ background: "rgba(255,107,0,0.12)", color: "#ff6b00", border: "1px solid rgba(255,107,0,0.3)" }}>
                DÉCALÉ
              </span>
            )}
            {!isDone && !isCancelled && !reschedule && hasPlan && isToday && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold tracking-widest"
                style={{ background: "rgba(57,255,20,0.1)", color: "#39ff14", border: "1px solid rgba(57,255,20,0.2)" }}>
                AUJOURD'HUI
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="px-5 space-y-4">

        {/* ── Coach run plan ── */}
        {coachRun && (
          <div className="rounded-2xl p-4" style={{ background: "rgba(57,255,20,0.04)", border: "1px solid rgba(57,255,20,0.15)" }}>
            <p className="text-[10px] font-bold tracking-widest mb-3" style={{ color: "#39ff14" }}>
              PLAN COACH
            </p>
            {coachRun.coachNote && (
              <p className="text-xs italic mb-4" style={{ color: "#888" }}>"{coachRun.coachNote}"</p>
            )}
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

        {/* ── Coach workout plan (read-only exercises) ── */}
        {coachWorkout && (
          <div className="rounded-2xl p-4" style={{ background: "rgba(57,255,20,0.04)", border: "1px solid rgba(57,255,20,0.15)" }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-bold tracking-widest" style={{ color: "#39ff14" }}>PLAN COACH</p>
              <Badge label={coachWorkout.category === "upper" ? "Haut du corps" : "Bas du corps"} variant="orange" />
            </div>
            {coachWorkout.coachNote && (
              <p className="text-xs italic mb-4" style={{ color: "#888" }}>"{coachWorkout.coachNote}"</p>
            )}
            <div className="space-y-3">
              {coachWorkout.exercises.map((ex, i) => (
                <div key={i} className="space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{ex.name}</span>
                    <span className="text-sm font-mono" style={{ color: "#39ff14" }}>
                      {ex.sets}×{ex.reps}
                      {ex.weight > 0 ? <span className="text-muted text-xs"> · {ex.weight}kg</span> : null}
                    </span>
                  </div>
                  {ex.restSeconds && (
                    <p className="text-xs" style={{ color: "#444" }}>Repos : {ex.restSeconds}s</p>
                  )}
                  {ex.coachNote && (
                    <p className="text-xs italic" style={{ color: "#666" }}>↳ {ex.coachNote}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Generic plan (no coach data) ── */}
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
                  <span className="font-display text-2xl" style={{ color: "#39ff14" }}>
                    {fmtPaceSec(genericPlan.targetPaceSecPerKm)}
                  </span>
                )}
                {genericPlan.targetZone && <Badge label={genericPlan.targetZone} variant="neon" />}
              </div>
            )}
          </div>
        )}

        {/* ── Session: run results ── */}
        {session?.type === "run" && (
          <div className="space-y-3">
            {session.importedFromStrava && (
              <div className="flex items-center gap-1.5 text-xs" style={{ color: "#ff6b00" }}>
                <StravaIcon /> Importé depuis Strava
              </div>
            )}
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

        {/* ── Session: fitness results ── */}
        {session?.type === "fitness" && (
          <div className="space-y-3">
            {session.importedFromStrava && (
              <div className="flex items-center gap-1.5 text-xs" style={{ color: "#ff6b00" }}>
                <StravaIcon /> Importé depuis Strava
              </div>
            )}
            {session.exercises.length > 0 && (
              <div className="rounded-2xl p-4" style={{ background: "#1a1a1a" }}>
                <p className="text-[10px] font-bold tracking-widest mb-3" style={{ color: "#555" }}>
                  EXERCICES RÉALISÉS
                </p>
                <div className="space-y-2.5">
                  {session.exercises.map((ex) => (
                    <div key={ex.id} className="space-y-0.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{ex.name}</span>
                        <span className="font-mono text-muted">
                          {ex.sets}×{ex.reps}{ex.weight > 0 ? ` · ${ex.weight}kg` : ""}
                        </span>
                      </div>
                      {ex.comment && (
                        <p className="text-xs italic" style={{ color: "#666" }}>↳ {ex.comment}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {session.exercises.length === 0 && (
              <div className="rounded-2xl p-4" style={{ background: "#1a1a1a" }}>
                <p className="text-sm text-muted">Activité enregistrée via Strava.</p>
              </div>
            )}
            {session.comment && (
              <div className="rounded-2xl p-4" style={{ background: "#1a1a1a" }}>
                <p className="text-xs text-muted mb-1">Ressenti</p>
                <p className="text-sm italic" style={{ color: "#aaa" }}>"{session.comment}"</p>
              </div>
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

        {/* ── Cancelled info ── */}
        {isCancelled && cancelledDay?.reason && (
          <div className="rounded-2xl px-4 py-3" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
            <p className="text-xs" style={{ color: "#555" }}>
              Raison annulation : <span style={{ color: "#777" }}>{cancelledDay.reason}</span>
            </p>
          </div>
        )}

        {/* ── Rescheduled info ── */}
        {reschedule && (
          <div className="rounded-2xl px-4 py-3 flex items-center justify-between"
            style={{ background: "rgba(255,107,0,0.06)", border: "1px solid rgba(255,107,0,0.2)" }}>
            <p className="text-xs" style={{ color: "#ff6b00" }}>
              Décalé au <strong>
                {new Date(reschedule.to + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}
              </strong>
            </p>
            <button
              onClick={handleUnreschedule}
              className="text-xs px-2 py-1 rounded-lg press-effect"
              style={{ background: "#1a1a1a", color: "#555" }}
            >Annuler le décalage</button>
          </div>
        )}

        {/* ── Valider manuellement ── */}
        {hasPlan && !isDone && !isCancelled && !reschedule && (isPast || isToday) && planType && (
          <Link
            href={`/log/${planType === "fitness" ? "fitness" : "run"}?date=${date}`}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl text-sm font-bold press-effect"
            style={{ background: "rgba(57,255,20,0.12)", border: "1px solid rgba(57,255,20,0.3)", color: "#39ff14" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Valider manuellement
          </Link>
        )}

        {/* ── Actions : Décaler / Annuler ── */}
        {canAct && (
          <div className="space-y-2">

            {/* Reschedule */}
            {showReschedule ? (
              <div className="flex gap-2">
                <input
                  type="date"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDateState(e.target.value)}
                  min={toLocalDateStr(new Date())}
                  className="flex-1 rounded-xl px-3 py-2.5 text-xs focus:outline-none"
                  style={{ background: "#111", border: "1px solid rgba(255,107,0,0.3)", color: "white" }}
                />
                <button
                  onClick={handleReschedule}
                  disabled={!rescheduleDate}
                  className="px-3 py-2.5 rounded-xl text-xs font-bold press-effect disabled:opacity-40"
                  style={{ background: "#ff6b00", color: "white" }}
                >OK</button>
                <button
                  onClick={() => setShowReschedule(false)}
                  className="px-3 py-2.5 rounded-xl text-xs press-effect"
                  style={{ background: "#1a1a1a", color: "#555" }}
                >✕</button>
              </div>
            ) : (
              <button
                onClick={() => { setShowReschedule(true); setShowCancel(false); }}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm press-effect"
                style={{ background: "transparent", border: "1px solid #222", color: "#555" }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <path d="M8 7H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M8 7h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
                Décaler
              </button>
            )}

            {/* Cancel */}
            {showCancel ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Raison de l'annulation…"
                  className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none"
                  style={{ background: "#111", border: "1px solid #333", color: "white" }}
                  onKeyDown={(e) => { if (e.key === "Enter") handleCancelConfirm(); }}
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleCancelConfirm}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold press-effect"
                    style={{ background: "#1a1a1a", color: "#aaa", border: "1px solid #333" }}
                  >Confirmer l'annulation</button>
                  <button
                    onClick={() => setShowCancel(false)}
                    className="px-4 py-2.5 rounded-xl text-sm press-effect"
                    style={{ background: "transparent", color: "#555" }}
                  >✕</button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => { setShowCancel(true); setShowReschedule(false); }}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm press-effect"
                style={{ background: "transparent", border: "1px solid #1a1a1a", color: "#333" }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                Annuler la séance
              </button>
            )}

            {isCancelled && (
              <button
                onClick={handleUncancel}
                className="w-full py-2.5 rounded-xl text-xs press-effect"
                style={{ background: "#111", color: "#555", border: "1px solid #222" }}
              >Rétablir la séance</button>
            )}
          </div>
        )}

        {isCancelled && (
          <button
            onClick={handleUncancel}
            className="w-full py-2.5 rounded-xl text-xs press-effect"
            style={{ background: "#111", color: "#555", border: "1px solid #222" }}
          >Rétablir la séance</button>
        )}

      </div>
    </div>
  );
}
