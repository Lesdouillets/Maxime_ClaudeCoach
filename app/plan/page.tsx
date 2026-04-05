"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import Badge from "@/components/Badge";
import { getWeekDays, toLocalDateStr } from "@/lib/plan";
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
  const [weekOffset, setWeekOffset] = useState(() => {
    try {
      const stored = parseInt(sessionStorage.getItem("plan_week_offset") ?? "0", 10) || 0;
      if (stored === 0) return 0;
      const todayStr = toLocalDateStr(new Date());
      const inWeek = getWeekDays(stored).some((d) => toLocalDateStr(d.date) === todayStr);
      return inWeek ? stored : 0;
    } catch { return 0; }
  });
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
          onClick={() => setWeekOffset(o => { const n = o - 1; try { sessionStorage.setItem("plan_week_offset", String(n)); } catch {} return n; })}
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
            onClick={() => { try { sessionStorage.setItem("plan_week_offset", "0"); } catch {} setWeekOffset(0); }}
            className="text-xs press-effect px-2 py-1 rounded-lg"
            style={{ color: "#39ff14", background: "rgba(57,255,20,0.08)", border: "1px solid rgba(57,255,20,0.2)" }}
          >
            Aujourd'hui
          </button>
        )}
        <button
          onClick={() => setWeekOffset(o => { const n = o + 1; try { sessionStorage.setItem("plan_week_offset", String(n)); } catch {} return n; })}
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

          // Skip cancelled days entirely in plan view
          if (isCancelled) return null;

          const reschedule = rescheduledDays.find((r) => r.from === dateStr);
          const coachWorkout = coachWorkouts.find((w) => w.date === dateStr) ?? null;
          const coachRun = coachRuns.find((r) => r.date === dateStr) ?? null;

          // Plan rescheduled TO this date from another date
          const rescheduledHere = rescheduledDays.find((r) => r.to === dateStr);
          const reschFromWorkout = rescheduledHere ? coachWorkouts.find((w) => w.date === rescheduledHere.from) ?? null : null;
          const reschFromRun = rescheduledHere ? coachRuns.find((r) => r.date === rescheduledHere.from) ?? null : null;

          // If plan was moved away from this date, treat as rest; show plans rescheduled here
          const effectiveWorkout = reschedule ? reschFromWorkout : (coachWorkout ?? reschFromWorkout);
          const effectiveRun = reschedule ? reschFromRun : (coachRun ?? reschFromRun);

          const hasCoachPlan = !!(effectiveWorkout || effectiveRun);
          const hasPlan = hasCoachPlan;

          const planType = effectiveRun ? "run" : effectiveWorkout ? "fitness" : null;
          const planLabel = effectiveRun?.label ?? effectiveWorkout?.label ?? "";
          const planDistanceKm = effectiveRun?.distanceKm ?? null;
          const planPaceStr = effectiveRun?.pace ?? null;
          const planZone = effectiveRun?.targetZone ?? null;
          const planHR = effectiveRun?.targetHR ?? null;

          let status: "done" | "missed" | "upcoming" | "today-planned" | "rest";
          if (session) status = "done";
          else if (!hasPlan) status = "rest";
          else if (day.isToday) status = "today-planned";
          else if (day.isPast) status = "missed";
          else status = "upcoming";

          const planColor  = planType === "run" ? "#4f9cf9" : "#ff6b00";
          const planBorder = planType === "run" ? "rgba(79,156,249,0.35)" : "rgba(255,107,0,0.35)";
          const planBg     = planType === "run" ? "rgba(79,156,249,0.03)" : "rgba(255,107,0,0.03)";

          const statusConfig = {
            done:            { color: "#39ff14", label: "Fait ✓",      border: "rgba(57,255,20,0.3)",  bg: "rgba(57,255,20,0.04)" },
            missed:          { color: "#ff6b00", label: "Manqué",      border: "rgba(255,107,0,0.25)", bg: "rgba(255,107,0,0.03)" },
            upcoming:        { color: planColor, label: "À venir",     border: planBorder,             bg: "#111" },
            "today-planned": { color: planColor, label: "Aujourd'hui", border: planBorder,             bg: planBg },
            rest:            { color: "#2a2a2a", label: "Repos",       border: "#1a1a1a",              bg: "#0d0d0d" },
          }[status];

          const isClickable = hasPlan || !!session;

          // Today gets a large card, other days get a compact card
          const inner = day.isToday ? (
            /* ── Large card for today ── */
            <div className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-display text-2xl" style={{ color: statusConfig.color }}>
                    {DAY_FULL_FR[day.dow].toUpperCase()}
                  </span>
                  <span className="text-[9px] px-2 py-0.5 rounded-full font-bold tracking-widest"
                    style={{ background: `${planColor}20`, color: planColor, border: `1px solid ${planColor}50` }}>
                    TODAY
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium" style={{ color: statusConfig.color }}>
                    {statusConfig.label}
                  </span>
                  {isClickable && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M9 18L15 12L9 6" stroke="#555" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  )}
                </div>
              </div>

              {hasPlan ? (
                <>
                  <h3 className="font-bold text-xl mb-2">{planLabel}</h3>

                  {planType === "run" && (
                    <div className="flex gap-4 flex-wrap items-end mt-2">
                      {planDistanceKm && (
                        <div className="flex items-end gap-1">
                          <span className="font-display text-3xl" style={{ color: "#39ff14" }}>{planDistanceKm}</span>
                          <span className="text-sm text-muted mb-1">km</span>
                        </div>
                      )}
                      {planPaceStr && (
                        <span className="font-display text-2xl" style={{ color: "#39ff14" }}>{planPaceStr}/km</span>
                      )}
                      {planHR && <span className="text-sm self-end mb-0.5" style={{ color: "#ff6b00" }}>♥ {planHR}</span>}
                      {planZone && <Badge label={planZone} variant="neon" />}
                    </div>
                  )}

                  {planType === "fitness" && effectiveWorkout && (
                    <span className="text-xs text-muted">{effectiveWorkout.exercises.length} exercices</span>
                  )}

                  {session && (
                    <div className="mt-4 pt-4" style={{ borderTop: "1px solid #1a1a1a" }}>
                      {session.type === "run" ? (
                        <div className="flex gap-4 text-sm">
                          <span style={{ color: "#39ff14" }}>
                            <span className="font-display text-xl">{session.distanceKm.toFixed(1)}</span>
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
                    </div>
                  )}
                </>
              ) : (
                <p className="text-base" style={{ color: "#2a2a2a" }}>Récupération active</p>
              )}
            </div>
          ) : (
            /* ── Compact card for other days ── */
            <div className="px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-display text-base w-8 flex-shrink-0" style={{ color: statusConfig.color }}>
                  {DAY_FULL_FR[day.dow].slice(0, 3).toUpperCase()}
                </span>
                <span className="text-[11px] flex-shrink-0" style={{ color: "#333" }}>
                  {day.date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                </span>
                {hasPlan ? (
                  <span className="text-sm font-medium truncate">{planLabel}</span>
                ) : (
                  <span className="text-xs" style={{ color: "#2a2a2a" }}>Repos</span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                <span className="text-xs" style={{ color: statusConfig.color }}>{statusConfig.label}</span>
                {isClickable && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                    <path d="M9 18L15 12L9 6" stroke="#333" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                )}
              </div>
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
