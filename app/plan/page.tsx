"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import PageHeader from "@/components/PageHeader";
import Badge from "@/components/Badge";
import { WEEKLY_PLAN, getWeekDays, formatPace, toLocalDateStr } from "@/lib/plan";
import {
  getSessions, getCancelledDays, cancelDay, uncancelDay,
  rescheduleDay, unrescheduleDay, getRescheduledDays,
} from "@/lib/storage";
import { getCoachWorkouts, getCoachRuns } from "@/lib/coachPlan";
import type { WorkoutSession, CancelledDay as CancelledDayType } from "@/lib/types";
import type { CoachWorkout, CoachRun } from "@/lib/coachPlan";

const DayDetailSheet = dynamic(() => import("@/components/DayDetailSheet"), { ssr: false });

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
  const [rescheduleTarget, setRescheduleTarget] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [detailDate, setDetailDate] = useState<string | null>(null);
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

  const handleCancelConfirm = (date: string) => {
    cancelDay(date, cancelReason.trim());
    setCancelTarget(null); setCancelReason(""); refresh();
  };
  const handleUncancel = (date: string) => { uncancelDay(date); refresh(); };
  const handleReschedule = (fromDate: string) => {
    if (!rescheduleDate) return;
    rescheduleDay(fromDate, rescheduleDate);
    setRescheduleTarget(null); setRescheduleDate(""); refresh();
  };
  const handleUnreschedule = (fromDate: string) => { unrescheduleDay(fromDate); refresh(); };

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

          // Coach-specific plan for this date (overrides generic weekly template)
          const coachWorkout = coachWorkouts.find((w) => w.date === dateStr) ?? null;
          const coachRun = coachRuns.find((r) => r.date === dateStr) ?? null;

          // Effective plan: coach data takes priority, fallback to weekly template
          const hasCoachPlan = !!(coachWorkout || coachRun);
          const genericPlan = day.plan; // from WEEKLY_PLAN (day-of-week template)
          const hasPlan = hasCoachPlan || !!genericPlan;

          // Derive display data from coach plan or generic
          const planType: "run" | "fitness" | null = coachRun ? "run" : coachWorkout ? "fitness" : genericPlan?.type ?? null;
          const planLabel = coachRun?.label ?? coachWorkout?.label ?? genericPlan?.label ?? "";
          const planNote = coachRun?.coachNote ?? coachWorkout?.coachNote ?? genericPlan?.targetDescription ?? "";
          const planCategory = coachWorkout?.category ?? (genericPlan?.type === "fitness" ? genericPlan.category : null);
          // Run metrics: prefer coach run data, fallback generic
          const planDistanceKm = coachRun?.distanceKm ?? (genericPlan?.type === "run" ? genericPlan.targetDistanceKm : null);
          const planPaceStr = coachRun?.pace ?? null; // "5:55" string from coach
          const planPaceSec = genericPlan?.type === "run" ? genericPlan.targetPaceSecPerKm : null;
          const planZone = coachRun?.targetZone ?? (genericPlan?.type === "run" ? genericPlan.targetZone : null);
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

          const canAct = hasPlan && status !== "done" && status !== "rest";

          return (
            <div
              key={dateStr}
              className="rounded-2xl overflow-hidden"
              style={{
                border: `1px solid ${statusConfig.border}`,
                background: statusConfig.bg,
                boxShadow: day.isToday ? "0 0 20px rgba(57,255,20,0.06)" : "none",
                opacity: isCancelled ? 0.55 : 1,
              }}
            >
              <div className="p-4">
                {/* Day header */}
                <div className="flex items-start justify-between mb-2">
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
                  <span className="text-xs font-medium" style={{ color: statusConfig.color }}>
                    {statusConfig.label}
                  </span>
                </div>

                {hasPlan ? (
                  <>
                    <h3 className="font-bold text-base mb-1">{planLabel}</h3>
                    {planNote && <p className="text-sm text-muted mb-3">{planNote}</p>}

                    {/* Run metrics */}
                    {planType === "run" && (
                      <div className="flex gap-3 flex-wrap items-end mb-3">
                        {planDistanceKm && (
                          <div className="flex items-end gap-1">
                            <span className="font-display text-2xl" style={{ color: "#39ff14" }}>{planDistanceKm}</span>
                            <span className="text-xs text-muted mb-0.5">km</span>
                          </div>
                        )}
                        {planPaceStr && (
                          <span className="font-display text-2xl" style={{ color: "#39ff14" }}>{planPaceStr}/km</span>
                        )}
                        {!planPaceStr && planPaceSec && (
                          <span className="font-display text-2xl" style={{ color: "#39ff14" }}>{formatPace(planPaceSec)}</span>
                        )}
                        {planHR && (
                          <span className="text-xs self-end mb-0.5" style={{ color: "#ff6b00" }}>FC {planHR}</span>
                        )}
                        {planZone && <Badge label={planZone} variant="neon" />}
                      </div>
                    )}

                    {/* Fitness category */}
                    {planType === "fitness" && planCategory && (
                      <div className="mb-3">
                        <Badge label={planCategory === "upper" ? "Haut du corps" : "Bas du corps"} variant="orange" />
                        {coachWorkout && (
                          <span className="text-xs text-muted ml-2">{coachWorkout.exercises.length} exercices</span>
                        )}
                      </div>
                    )}

                    {/* Session result — clickable */}
                    {session && status === "done" && (
                      <button
                        className="w-full text-left rounded-xl p-3 mb-3 press-effect"
                        style={{ background: "rgba(57,255,20,0.05)", border: "1px solid rgba(57,255,20,0.1)" }}
                        onClick={() => setDetailDate(dateStr)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
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
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="flex-shrink-0 ml-2">
                            <path d="M9 18L15 12L9 6" stroke="#555" strokeWidth="2" strokeLinecap="round"/>
                          </svg>
                        </div>
                      </button>
                    )}

                    {/* Manual log */}
                    {!session && !isCancelled && !reschedule && (status === "missed" || status === "today-planned" || status === "upcoming") && (
                      <div className="mb-3">
                        <Link
                          href={`/log/${planType === "fitness" ? "fitness" : "run"}?date=${dateStr}`}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs press-effect"
                          style={{ background: "#1a1a1a", color: "#555", border: "1px solid #222" }}
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                          </svg>
                          Valider manuellement
                        </Link>
                      </div>
                    )}

                    {/* Cancelled reason */}
                    {isCancelled && cancelledDay?.reason && (
                      <p className="text-xs italic mb-2" style={{ color: "#555" }}>Raison : {cancelledDay.reason}</p>
                    )}

                    {/* Rescheduled info */}
                    {reschedule && (
                      <div className="flex items-center justify-between mb-3 px-3 py-2 rounded-xl"
                        style={{ background: "rgba(255,107,0,0.08)", border: "1px solid rgba(255,107,0,0.2)" }}>
                        <p className="text-xs" style={{ color: "#ff6b00" }}>
                          Décalé au <strong>{new Date(reschedule.to + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}</strong>
                        </p>
                        <button onClick={() => handleUnreschedule(dateStr)}
                          className="text-xs press-effect px-2 py-0.5 rounded-lg"
                          style={{ color: "#666", background: "#1a1a1a" }}>
                          Annuler
                        </button>
                      </div>
                    )}

                    {/* Action buttons */}
                    {canAct && !isCancelled && !reschedule && (
                      <div className="flex gap-2 flex-wrap">
                        {rescheduleTarget === dateStr ? (
                          <div className="flex-1 flex gap-1.5">
                            <input type="date" value={rescheduleDate}
                              onChange={(e) => setRescheduleDate(e.target.value)}
                              className="flex-1 text-xs rounded-lg px-2 py-1.5 focus:outline-none"
                              style={{ background: "#1a1a1a", border: "1px solid rgba(255,107,0,0.3)", color: "white" }}
                              min={toLocalDateStr(new Date())}
                            />
                            <button onClick={() => handleReschedule(dateStr)} disabled={!rescheduleDate}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-bold press-effect disabled:opacity-40"
                              style={{ background: "#ff6b00", color: "white" }}>OK</button>
                            <button onClick={() => setRescheduleTarget(null)}
                              className="px-2 py-1.5 rounded-lg text-xs press-effect"
                              style={{ background: "#1a1a1a", color: "#555" }}>✕</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setRescheduleTarget(dateStr); setRescheduleDate(""); setCancelTarget(null); }}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs press-effect"
                            style={{ background: "transparent", color: "#555", border: "1px solid #222" }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                              <path d="M8 7H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M8 7h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                            </svg>
                            Décaler
                          </button>
                        )}

                        {cancelTarget === dateStr ? (
                          <div className="flex-1 flex gap-1.5">
                            <input type="text" value={cancelReason}
                              onChange={(e) => setCancelReason(e.target.value)}
                              placeholder="Raison ?"
                              className="flex-1 text-xs rounded-lg px-2 py-1.5 focus:outline-none"
                              style={{ background: "#1a1a1a", border: "1px solid #333", color: "white" }}
                              onKeyDown={(e) => { if (e.key === "Enter") handleCancelConfirm(dateStr); }}
                              autoFocus
                            />
                            <button onClick={() => handleCancelConfirm(dateStr)}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-bold press-effect"
                              style={{ background: "#333", color: "#aaa" }}>OK</button>
                            <button onClick={() => setCancelTarget(null)}
                              className="px-2 py-1.5 rounded-lg text-xs press-effect"
                              style={{ background: "#1a1a1a", color: "#555" }}>✕</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setCancelTarget(dateStr); setCancelReason(""); setRescheduleTarget(null); }}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs press-effect"
                            style={{ background: "transparent", color: "#555", border: "1px solid #222" }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                            </svg>
                            Annuler
                          </button>
                        )}
                      </div>
                    )}

                    {isCancelled && (
                      <button onClick={() => handleUncancel(dateStr)}
                        className="text-xs px-2.5 py-1.5 rounded-lg press-effect"
                        style={{ background: "#1a1a1a", color: "#555", border: "1px solid #222" }}>
                        Rétablir
                      </button>
                    )}
                  </>
                ) : (
                  <p className="text-sm" style={{ color: "#2a2a2a" }}>Récupération active</p>
                )}
              </div>
            </div>
          );
        })}
        <div className="h-4" />
      </div>

      {detailDate && (() => {
        const detailSession = sessions.find((s) => s.date.slice(0, 10) === detailDate);
        const detailDow = new Date(detailDate + "T12:00:00").getDay();
        const detailPlan = WEEKLY_PLAN.find((p) => p.dayOfWeek === detailDow) ?? null;
        const detailCoachWorkout = coachWorkouts.find((w) => w.date === detailDate) ?? null;
        const detailCoachRun = coachRuns.find((r) => r.date === detailDate) ?? null;
        return (
          <DayDetailSheet
            date={detailDate}
            session={detailSession}
            plan={detailPlan}
            coachWorkout={detailCoachWorkout}
            coachRun={detailCoachRun}
            onClose={() => setDetailDate(null)}
          />
        );
      })()}
    </div>
  );
}
