"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import Badge from "@/components/Badge";
import { WEEKLY_PLAN, getThisWeekDays, formatPace } from "@/lib/plan";
import {
  getSessions, getCancelledDays, cancelDay, uncancelDay,
  rescheduleDay, unrescheduleDay, getRescheduledDays,
} from "@/lib/storage";
import type { WorkoutSession, CancelledDay as CancelledDayType } from "@/lib/types";

const DAY_FULL_FR = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

export default function PlanPage() {
  const [mounted, setMounted] = useState(false);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [cancelledDays, setCancelledDays] = useState<CancelledDayType[]>([]);
  const [rescheduledDays, setRescheduledDays] = useState<{ from: string; to: string }[]>([]);
  const [rescheduleTarget, setRescheduleTarget] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  // Cancel reason state: dateStr → reason being typed
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const weekDays = getThisWeekDays();

  const refresh = () => {
    setSessions(getSessions());
    setCancelledDays(getCancelledDays());
    setRescheduledDays(getRescheduledDays());
  };

  useEffect(() => {
    setMounted(true);
    refresh();
  }, []);

  const handleCancelConfirm = (date: string) => {
    cancelDay(date, cancelReason.trim());
    setCancelTarget(null);
    setCancelReason("");
    refresh();
  };

  const handleUncancel = (date: string) => {
    uncancelDay(date);
    refresh();
  };

  const handleReschedule = (fromDate: string) => {
    if (!rescheduleDate) return;
    rescheduleDay(fromDate, rescheduleDate);
    setRescheduleTarget(null);
    setRescheduleDate("");
    refresh();
  };

  const handleUnreschedule = (fromDate: string) => {
    unrescheduleDay(fromDate);
    refresh();
  };

  if (!mounted) return null;

  return (
    <div className="max-w-md mx-auto animate-fade-in">
      <PageHeader title="PLAN HEBDO" subtitle="Cette semaine" accent="neon" />

      <div className="px-5 space-y-3">
        {weekDays.map((day) => {
          const dateStr = day.date.toISOString().slice(0, 10);
          const session = sessions.find((s) => s.date.slice(0, 10) === dateStr);
          const plan = day.plan;
          const cancelledDay = cancelledDays.find((d) => d.date === dateStr);
          const isCancelled = !!cancelledDay;
          const reschedule = rescheduledDays.find((r) => r.from === dateStr);

          let status: "done" | "cancelled" | "rescheduled" | "missed" | "upcoming" | "today-planned" | "rest";
          if (session) status = "done";
          else if (isCancelled) status = "cancelled";
          else if (reschedule) status = "rescheduled";
          else if (!plan) status = "rest";
          else if (day.isToday) status = "today-planned";
          else if (day.isPast) status = "missed";
          else status = "upcoming";

          const statusConfig = {
            done:           { color: "#39ff14", label: "Fait ✓",     border: "rgba(57,255,20,0.3)",  bg: "rgba(57,255,20,0.04)" },
            cancelled:      { color: "#444",    label: "Annulé",     border: "#222",                  bg: "#0d0d0d" },
            rescheduled:    { color: "#ff6b00", label: "Décalé",     border: "rgba(255,107,0,0.3)",   bg: "rgba(255,107,0,0.03)" },
            missed:         { color: "#ff6b00", label: "Manqué",     border: "rgba(255,107,0,0.25)",  bg: "rgba(255,107,0,0.03)" },
            upcoming:       { color: "#555",    label: "À venir",    border: "#1a1a1a",               bg: "#111" },
            "today-planned":{ color: "#39ff14", label: "Aujourd'hui",border: "rgba(57,255,20,0.5)",   bg: "rgba(57,255,20,0.04)" },
            rest:           { color: "#2a2a2a", label: "Repos",      border: "#1a1a1a",               bg: "#0d0d0d" },
          }[status];

          const canAct = plan && status !== "done" && status !== "rest";

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

                {plan ? (
                  <>
                    <h3 className="font-bold text-base mb-1">{plan.label}</h3>
                    <p className="text-sm text-muted mb-3">{plan.targetDescription}</p>

                    {plan.type === "run" && (
                      <div className="flex gap-3 flex-wrap mb-3">
                        {plan.targetDistanceKm && (
                          <div className="flex items-end gap-1">
                            <span className="font-display text-2xl" style={{ color: "#39ff14" }}>{plan.targetDistanceKm}</span>
                            <span className="text-xs text-muted mb-0.5">km</span>
                          </div>
                        )}
                        {plan.targetPaceSecPerKm && (
                          <span className="font-display text-2xl" style={{ color: "#39ff14" }}>
                            {formatPace(plan.targetPaceSecPerKm)}
                          </span>
                        )}
                        {plan.targetZone && <Badge label={plan.targetZone} variant="neon" />}
                      </div>
                    )}
                    {plan.type === "fitness" && plan.category && (
                      <div className="mb-3">
                        <Badge label={plan.category === "upper" ? "Haut du corps" : "Bas du corps"} variant="orange" />
                      </div>
                    )}

                    {/* Session summary */}
                    {session && status === "done" && (
                      <div className="rounded-xl p-3 mb-3"
                        style={{ background: "rgba(57,255,20,0.05)", border: "1px solid rgba(57,255,20,0.1)" }}>
                        {session.type === "run" ? (
                          <div className="flex gap-4 text-sm">
                            <span style={{ color: "#39ff14" }}>
                              <span className="font-display text-lg">{session.distanceKm.toFixed(1)}</span>
                              <span className="text-xs text-muted ml-1">km</span>
                            </span>
                            {session.avgPaceSecPerKm > 0 && (
                              <span className="text-muted">
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

                    {/* Cancelled reason */}
                    {isCancelled && cancelledDay?.reason && (
                      <p className="text-xs italic mb-2" style={{ color: "#555" }}>
                        Raison : {cancelledDay.reason}
                      </p>
                    )}

                    {/* Rescheduled info */}
                    {reschedule && (
                      <div className="flex items-center justify-between mb-3 px-3 py-2 rounded-xl"
                        style={{ background: "rgba(255,107,0,0.08)", border: "1px solid rgba(255,107,0,0.2)" }}>
                        <p className="text-xs" style={{ color: "#ff6b00" }}>
                          Décalé au <strong>{new Date(reschedule.to).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}</strong>
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
                        {/* Reschedule */}
                        {rescheduleTarget === dateStr ? (
                          <div className="flex-1 flex gap-1.5">
                            <input
                              type="date"
                              value={rescheduleDate}
                              onChange={(e) => setRescheduleDate(e.target.value)}
                              className="flex-1 text-xs rounded-lg px-2 py-1.5 focus:outline-none"
                              style={{ background: "#1a1a1a", border: "1px solid rgba(255,107,0,0.3)", color: "white" }}
                              min={new Date().toISOString().slice(0, 10)}
                            />
                            <button
                              onClick={() => handleReschedule(dateStr)}
                              disabled={!rescheduleDate}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-bold press-effect disabled:opacity-40"
                              style={{ background: "#ff6b00", color: "white" }}>
                              OK
                            </button>
                            <button
                              onClick={() => setRescheduleTarget(null)}
                              className="px-2 py-1.5 rounded-lg text-xs press-effect"
                              style={{ background: "#1a1a1a", color: "#555" }}>
                              ✕
                            </button>
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

                        {/* Cancel */}
                        {cancelTarget === dateStr ? (
                          <div className="flex-1 flex gap-1.5">
                            <input
                              type="text"
                              value={cancelReason}
                              onChange={(e) => setCancelReason(e.target.value)}
                              placeholder="Raison ?"
                              className="flex-1 text-xs rounded-lg px-2 py-1.5 focus:outline-none"
                              style={{ background: "#1a1a1a", border: "1px solid #333", color: "white" }}
                              onKeyDown={(e) => { if (e.key === "Enter") handleCancelConfirm(dateStr); }}
                              autoFocus
                            />
                            <button
                              onClick={() => handleCancelConfirm(dateStr)}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-bold press-effect"
                              style={{ background: "#333", color: "#aaa" }}>
                              OK
                            </button>
                            <button
                              onClick={() => setCancelTarget(null)}
                              className="px-2 py-1.5 rounded-lg text-xs press-effect"
                              style={{ background: "#1a1a1a", color: "#555" }}>
                              ✕
                            </button>
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

                    {/* Restore cancelled */}
                    {isCancelled && (
                      <button
                        onClick={() => handleUncancel(dateStr)}
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
    </div>
  );
}
