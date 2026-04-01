"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import Badge from "@/components/Badge";
import { getWeekDays, formatPace, toLocalDateStr } from "@/lib/plan";
import { getSessions, getCancelledDays, getRescheduledDays } from "@/lib/storage";
import { getCoachWorkouts, getCoachRuns } from "@/lib/coachPlan";
import type { WorkoutSession, CancelledDay as CancelledDayType } from "@/lib/types";
import type { CoachWorkout, CoachRun } from "@/lib/coachPlan";

const DAY_FULL_FR = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

function formatWeekLabel(days: ReturnType<typeof getWeekDays>): string {
  const first = days[0].date;
  const last = days[6].date;
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  return `${first.toLocaleDateString("fr-FR", opts)} – ${last.toLocaleDateString("fr-FR", opts)}`;
}

export default function PlanPage() {
  const [mounted, setMounted] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [cancelledDays, setCancelledDays] = useState<CancelledDayType[]>([]);
  const [rescheduledDays, setRescheduledDays] = useState<{ from: string; to: string }[]>([]);
  const [coachWorkouts, setCoachWorkouts] = useState<CoachWorkout[]>([]);
  const [coachRuns, setCoachRuns] = useState<CoachRun[]>([]);

  const weekDays = getWeekDays(weekOffset);

  const refresh = () => {
    setSessions(getSessions());
    setCancelledDays(getCancelledDays());
    setRescheduledDays(getRescheduledDays());
    setCoachWorkouts(getCoachWorkouts());
    setCoachRuns(getCoachRuns());
  };

  useEffect(() => { setMounted(true); refresh(); }, []);

  if (!mounted) return null;

  return (
    <div className="max-w-md mx-auto animate-fade-in">
      <PageHeader title="PLAN HEBDO" subtitle={formatWeekLabel(weekDays)} accent="neon" />

      {/* Week navigation */}
      <div className="px-5 mb-4 flex items-center justify-between">
        <button
          onClick={() => setWeekOffset(o => o - 1)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs press-effect"
          style={{ background: "#111", border: "1px solid #222", color: "#555" }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Préc.
        </button>
        {weekOffset !== 0 && (
          <button
            onClick={() => setWeekOffset(0)}
            className="text-xs press-effect px-2 py-1 rounded-lg"
            style={{ color: "#39ff14", background: "rgba(57,255,20,0.08)", border: "1px solid rgba(57,255,20,0.2)" }}
          >
            Aujourd'hui
          </button>
        )}
        <button
          onClick={() => setWeekOffset(o => o + 1)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs press-effect"
          style={{ background: "#111", border: "1px solid #222", color: "#555" }}
        >
          Suiv.
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      <div className="px-5 space-y-3">
        {weekDays.map((day) => {
          const dateStr = toLocalDateStr(day.date);
          const session = sessions.find((s) => s.date.slice(0, 10) === dateStr);
          const cancelledDay = cancelledDays.find((d) => d.date === dateStr);
          const isCancelled = !!cancelledDay;
          const reschedule = rescheduledDays.find((r) => r.from === dateStr);
          const coachWorkout = coachWorkouts.find((w) => w.date === dateStr) ?? null;
          const coachRun = coachRuns.find((r) => r.date === dateStr) ?? null;
          const hasCoachPlan = !!(coachWorkout || coachRun);
          const hasPlan = hasCoachPlan || !!day.plan;

          const planType = coachRun ? "run" : coachWorkout ? "fitness" : day.plan?.type ?? null;
          const planLabel = coachRun?.label ?? coachWorkout?.label ?? day.plan?.label ?? "";
          const planCategory = coachWorkout?.category ?? (day.plan?.type === "fitness" ? day.plan.category : null);
          const planDistanceKm = coachRun?.distanceKm ?? (day.plan?.type === "run" ? day.plan.targetDistanceKm : null);
          const planPaceStr = coachRun?.pace ?? null;
          const planPaceSec = day.plan?.type === "run" ? day.plan.targetPaceSecPerKm : null;
          const planZone = coachRun?.targetZone ?? (day.plan?.type === "run" ? day.plan.targetZone : null);
          const planHR = coachRun?.targetHR ?? null;

          let status: "done" | "cancelled" | "rescheduled" | "missed" | "upcoming" | "today-planned" | "rest";
          if (session) status = "done";
          else if (isCancelled) status = "cancelled";
          else if (reschedule) status = "rescheduled";
          else if (!hasPlan) status = "rest";
          else if (day.isToday) status = "today-planned";
          else if (day.isPast) status = "missed";
          else status = "upcoming";

          const statusConfig = {
            done:            { color: "#39ff14", label: "Fait ✓",      border: "rgba(57,255,20,0.3)",  bg: "rgba(57,255,20,0.04)" },
            cancelled:       { color: "#444",    label: "Annulé",      border: "#222",                  bg: "#0d0d0d" },
            rescheduled:     { color: "#ff6b00", label: "Décalé",      border: "rgba(255,107,0,0.3)",   bg: "rgba(255,107,0,0.03)" },
            missed:          { color: "#ff6b00", label: "Manqué",      border: "rgba(255,107,0,0.25)",  bg: "rgba(255,107,0,0.03)" },
            upcoming:        { color: "#555",    label: "À venir",     border: "#1a1a1a",               bg: "#111" },
            "today-planned": { color: "#39ff14", label: "Aujourd'hui", border: "rgba(57,255,20,0.5)",   bg: "rgba(57,255,20,0.04)" },
            rest:            { color: "#2a2a2a", label: "Repos",       border: "#1a1a1a",               bg: "#0d0d0d" },
          }[status];

          const isClickable = hasPlan || !!session;

          const inner = (
            <div className="p-4">
              {/* Day header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-display text-xl" style={{ color: statusConfig.color }}>
                    {DAY_FULL_FR[day.dow].toUpperCase()}
                  </span>
                  <span className="text-xs" style={{ color: "#333" }}>
                    {day.date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                  </span>
                  {day.isToday && (
                    <span className="text-[9px] px-2 py-0.5 rounded-full font-bold tracking-widest"
                      style={{ background: "rgba(57,255,20,0.15)", color: "#39ff14", border: "1px solid rgba(57,255,20,0.3)" }}>
                      TODAY
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium" style={{ color: statusConfig.color }}>
                    {statusConfig.label}
                  </span>
                  {isClickable && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <path d="M9 18L15 12L9 6" stroke="#333" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  )}
                </div>
              </div>

              {hasPlan ? (
                <>
                  <h3 className="font-bold text-base mb-1">{planLabel}</h3>

                  {/* Run metrics */}
                  {planType === "run" && (
                    <div className="flex gap-3 flex-wrap items-end mt-2">
                      {planDistanceKm && (
                        <div className="flex items-end gap-1">
                          <span className="font-display text-xl" style={{ color: "#39ff14" }}>{planDistanceKm}</span>
                          <span className="text-xs text-muted mb-0.5">km</span>
                        </div>
                      )}
                      {planPaceStr && (
                        <span className="font-display text-xl" style={{ color: "#39ff14" }}>{planPaceStr}/km</span>
                      )}
                      {!planPaceStr && planPaceSec && (
                        <span className="font-display text-xl" style={{ color: "#39ff14" }}>{formatPace(planPaceSec)}</span>
                      )}
                      {planHR && <span className="text-xs self-end mb-0.5" style={{ color: "#ff6b00" }}>♥ {planHR}</span>}
                      {planZone && <Badge label={planZone} variant="neon" />}
                    </div>
                  )}

                  {/* Fitness category + exercise count */}
                  {planType === "fitness" && planCategory && (
                    <div className="flex items-center gap-2 mt-1">
                      <Badge label={planCategory === "upper" ? "Haut du corps" : "Bas du corps"} variant="orange" />
                      {coachWorkout && (
                        <span className="text-xs text-muted">{coachWorkout.exercises.length} exercices</span>
                      )}
                    </div>
                  )}

                  {/* Session result snippet */}
                  {session && (
                    <div className="mt-3 pt-3" style={{ borderTop: "1px solid #1a1a1a" }}>
                      {session.type === "run" ? (
                        <div className="flex gap-4 text-sm">
                          <span style={{ color: "#39ff14" }}>
                            <span className="font-display text-lg">{session.distanceKm.toFixed(1)}</span>
                            <span className="text-xs text-muted ml-1">km</span>
                          </span>
                          {session.avgPaceSecPerKm > 0 && (
                            <span className="text-muted self-end text-xs mb-0.5">
                              {Math.floor(session.avgPaceSecPerKm / 60)}:{String(Math.round(session.avgPaceSecPerKm % 60)).padStart(2, "0")}/km
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm" style={{ color: "#ff6b00" }}>
                          {session.exercises.length > 0 ? `${session.exercises.length} exercices` : "Activité Strava"}
                        </span>
                      )}
                      {session.comment && (
                        <p className="text-xs text-muted italic mt-1">"{session.comment}"</p>
                      )}
                    </div>
                  )}

                  {/* Rescheduled target */}
                  {reschedule && (
                    <p className="text-xs mt-2" style={{ color: "#ff6b00" }}>
                      → {new Date(reschedule.to + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}
                    </p>
                  )}

                  {/* Cancelled reason */}
                  {isCancelled && cancelledDay?.reason && (
                    <p className="text-xs mt-1 italic" style={{ color: "#555" }}>{cancelledDay.reason}</p>
                  )}
                </>
              ) : (
                <p className="text-sm" style={{ color: "#2a2a2a" }}>Récupération active</p>
              )}
            </div>
          );

          return isClickable ? (
            <Link
              key={dateStr}
              href={`/day?date=${dateStr}`}
              className="block rounded-2xl overflow-hidden press-effect"
              style={{
                border: `1px solid ${statusConfig.border}`,
                background: statusConfig.bg,
                boxShadow: day.isToday ? "0 0 20px rgba(57,255,20,0.06)" : "none",
                opacity: isCancelled ? 0.55 : 1,
              }}
            >
              {inner}
            </Link>
          ) : (
            <div
              key={dateStr}
              className="rounded-2xl overflow-hidden"
              style={{
                border: `1px solid ${statusConfig.border}`,
                background: statusConfig.bg,
                opacity: isCancelled ? 0.55 : 1,
              }}
            >
              {inner}
            </div>
          );
        })}
        <div className="h-4" />
      </div>
    </div>
  );
}
