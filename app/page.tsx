"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { getWeekDays, formatPace, toLocalDateStr } from "@/lib/plan";
import { getSessions, getStravaTokens, addSession, getRescheduledDays } from "@/lib/storage";
import { fetchNewActivitiesSinceLastVisit, autoImportActivity } from "@/lib/strava";
import { getCoachWorkouts, getCoachRuns } from "@/lib/coachPlan";
import type { WorkoutSession } from "@/lib/types";
import type { CoachWorkout, CoachRun } from "@/lib/coachPlan";

type ViewMode = "week" | "month";

export default function Dashboard() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [importedCount, setImportedCount] = useState(0);
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [coachWorkouts, setCoachWorkouts] = useState<CoachWorkout[]>([]);
  const [coachRuns, setCoachRuns] = useState<CoachRun[]>([]);
  const [rescheduledDays, setRescheduledDays] = useState<{ from: string; to: string }[]>([]);

  const refreshSessions = useCallback(() => {
    setSessions(getSessions());
    setCoachWorkouts(getCoachWorkouts());
    setCoachRuns(getCoachRuns());
    setRescheduledDays(getRescheduledDays());
  }, []);

  useEffect(() => {
    setMounted(true);

    refreshSessions();
    const tokens = getStravaTokens();
    if (!tokens) return;

    fetchNewActivitiesSinceLastVisit()
      .then((activities) => {
        if (activities.length === 0) return;
        let count = 0;
        activities.forEach((activity) => {
          const session = autoImportActivity(activity);
          if (session) { addSession(session); count++; }
        });
        if (count > 0) {
          setImportedCount(count);
          refreshSessions();
          setTimeout(() => setImportedCount(0), 4000);
        }
      })
      .catch(() => {});
  }, [refreshSessions]);

  if (!mounted) return null;

  const weekDays = getWeekDays(weekOffset);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = toLocalDateStr(today);

  const todayReschAway = rescheduledDays.some((r) => r.from === todayStr);
  const todayReschHere = rescheduledDays.find((r) => r.to === todayStr);
  const todayCoachWorkout = (!todayReschAway ? coachWorkouts.find((w) => w.date === todayStr) : null)
    ?? (todayReschHere ? coachWorkouts.find((w) => w.date === todayReschHere.from) ?? null : null);
  const todayCoachRun = (!todayReschAway ? coachRuns.find((r) => r.date === todayStr) : null)
    ?? (todayReschHere ? coachRuns.find((r) => r.date === todayReschHere.from) ?? null : null);
  const todaySession = sessions.find((s) => s.date.slice(0, 10) === todayStr);

  // Week range label
  const weekStart = weekDays[0].date;
  const weekEnd = weekDays[6].date;
  const isCurrentWeek = weekOffset === 0;
  const weekLabel = isCurrentWeek
    ? "Cette semaine"
    : `${weekStart.getDate()} – ${weekEnd.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`;

  // Month view data
  const displayMonth = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const year = displayMonth.getFullYear();
  const month = displayMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  // Pad to start on Monday
  const startPad = (firstDay.getDay() + 6) % 7; // Mon=0
  const monthDays: (Date | null)[] = [
    ...Array(startPad).fill(null),
    ...Array.from({ length: lastDay.getDate() }, (_, i) => new Date(year, month, i + 1)),
  ];
  // Pad to complete last row
  while (monthDays.length % 7 !== 0) monthDays.push(null);

  const completedThisWeek = weekDays.filter((d) =>
    sessions.some((s) => s.date.slice(0, 10) === toLocalDateStr(d.date))
  ).length;
  const plannedThisWeek = weekDays.filter((d) => {
    const ds = toLocalDateStr(d.date);
    return coachWorkouts.some((w) => w.date === ds) || coachRuns.some((r) => r.date === ds);
  }).length;

  const dateLabel = today.toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long",
  });

  return (
    <div className="max-w-md mx-auto animate-fade-in">
      <PageHeader title="CLAUDE COACH" subtitle={dateLabel} accent="neon" />

      <div className="px-5 space-y-5">

        {/* Import toast */}
        {importedCount > 0 && (
          <div className="rounded-2xl p-3 flex items-center gap-3 animate-slide-up"
            style={{ background: "rgba(57,255,20,0.06)", border: "1px solid rgba(57,255,20,0.3)" }}>
            <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(57,255,20,0.15)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M5 13L9 17L19 7" stroke="#39ff14" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <p className="text-sm font-semibold" style={{ color: "#39ff14" }}>
              {importedCount} activité{importedCount > 1 ? "s" : ""} importée{importedCount > 1 ? "s" : ""} depuis Strava
            </p>
          </div>
        )}

        {/* Today's card */}
        <div
          className="rounded-2xl p-5 relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, #111 0%, #1a1a1a 100%)",
            border: todaySession
              ? "1px solid rgba(57,255,20,0.3)"
              : todayCoachRun
                ? "1px solid rgba(79,156,249,0.3)"
                : todayCoachWorkout
                  ? "1px solid rgba(255,107,0,0.3)"
                  : "1px solid #1a1a1a",
          }}
        >
          <div
            className="absolute -top-6 -right-6 w-32 h-32 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(57,255,20,0.06) 0%, transparent 70%)" }}
          />

          {/* Completed today */}
          {todaySession ? (
            <button
              className="w-full text-left"
              onClick={() => router.push(`/day?date=${todayStr}`)}
            >
              <div className="flex items-start justify-between mb-2">
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold tracking-widest"
                  style={{ background: "rgba(57,255,20,0.15)", color: "#39ff14", border: "1px solid rgba(57,255,20,0.3)" }}>
                  FAIT ✓
                </span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M9 18L15 12L9 6" stroke="#555" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <h2 className="font-display text-3xl mb-1" style={{ color: "#39ff14" }}>
                {todaySession.type === "run"
                  ? "RUN"
                  : todaySession.category === "upper" ? "HAUT DU CORPS" : "BAS DU CORPS"}
              </h2>
              {todaySession.type === "run" && (
                <div className="flex gap-4">
                  <span className="font-display text-xl">{todaySession.distanceKm.toFixed(1)} <span className="text-xs text-muted">km</span></span>
                  {todaySession.avgPaceSecPerKm > 0 && (
                    <span className="text-sm text-muted self-end mb-0.5">{formatPace(todaySession.avgPaceSecPerKm)}</span>
                  )}
                </div>
              )}
              {todaySession.type === "fitness" && (
                <p className="text-sm text-muted">
                  {todaySession.exercises.length > 0
                    ? `${todaySession.exercises.length} exercices`
                    : "Activité Strava"}
                </p>
              )}
              <p className="text-xs mt-2" style={{ color: "#555" }}>Appuyer pour voir le détail →</p>
            </button>
          ) : todayCoachWorkout ? (
            <button className="w-full text-left" onClick={() => router.push(`/day?date=${todayStr}`)}>
              <div className="flex items-start justify-between mb-3">
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold tracking-widest"
                  style={{ background: "rgba(255,107,0,0.1)", color: "#ff6b00", border: "1px solid rgba(255,107,0,0.2)" }}>
                  AUJOURD'HUI
                </span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M9 18L15 12L9 6" stroke="#555" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <h2 className="font-display text-4xl mb-1 leading-none">{todayCoachWorkout.label}</h2>
              {todayCoachWorkout.coachNote && (
                <p className="text-sm text-gray-400">{todayCoachWorkout.coachNote}</p>
              )}
              <p className="text-xs mt-2" style={{ color: "#555" }}>{todayCoachWorkout.exercises.length} exercices</p>
            </button>
          ) : todayCoachRun ? (
            <button className="w-full text-left" onClick={() => router.push(`/day?date=${todayStr}`)}>
              <div className="flex items-start justify-between mb-3">
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold tracking-widest"
                  style={{ background: "rgba(79,156,249,0.1)", color: "#4f9cf9", border: "1px solid rgba(79,156,249,0.2)" }}>
                  AUJOURD'HUI
                </span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M9 18L15 12L9 6" stroke="#555" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <h2 className="font-display text-4xl mb-1 leading-none">{todayCoachRun.label}</h2>
              <div className="flex gap-4 mt-3 items-end">
                {todayCoachRun.distanceKm && (
                  <div>
                    <span className="font-display text-2xl text-neon">{todayCoachRun.distanceKm}</span>
                    <span className="text-xs text-muted ml-1">km</span>
                  </div>
                )}
                {todayCoachRun.pace && (
                  <span className="font-display text-2xl text-neon">{todayCoachRun.pace}/km</span>
                )}
                {todayCoachRun.targetZone && (
                  <span className="self-center px-2 py-0.5 rounded-lg text-xs font-bold"
                    style={{ background: "rgba(57,255,20,0.15)", color: "#39ff14" }}>
                    {todayCoachRun.targetZone}
                  </span>
                )}
              </div>
            </button>
          ) : (
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: "#1a1a1a" }}>
                <span className="text-2xl">😴</span>
              </div>
              <div>
                <p className="font-bold">Jour de repos</p>
                <p className="text-sm text-muted">Récupère bien.</p>
              </div>
            </div>
          )}
        </div>

        {/* View toggle + week nav */}
        <div>
          <div className="flex items-center justify-between mb-3">
            {/* Week nav */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => viewMode === "week" ? setWeekOffset((o) => o - 1) : setMonthOffset((o) => o - 1)}
                className="w-7 h-7 rounded-lg flex items-center justify-center press-effect"
                style={{ background: "#1a1a1a", border: "1px solid #222" }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path d="M15 18L9 12L15 6" stroke="#555" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
              <span className="text-xs font-semibold tracking-wide" style={{ color: "#555", minWidth: "120px", textAlign: "center" }}>
                {viewMode === "week"
                  ? weekLabel.toUpperCase()
                  : displayMonth.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }).toUpperCase()}
              </span>
              <button
                onClick={() => viewMode === "week" ? setWeekOffset((o) => o + 1) : setMonthOffset((o) => o + 1)}
                className="w-7 h-7 rounded-lg flex items-center justify-center press-effect"
                style={{ background: "#1a1a1a", border: "1px solid #222" }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path d="M9 18L15 12L9 6" stroke="#555" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            {/* Week/Month toggle */}
            <div className="flex rounded-xl overflow-hidden" style={{ border: "1px solid #222" }}>
              {(["week", "month"] as ViewMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className="px-3 py-1.5 text-[10px] font-bold tracking-wide uppercase press-effect"
                  style={{
                    background: viewMode === mode ? "#1a1a1a" : "transparent",
                    color: viewMode === mode ? "#39ff14" : "#444",
                  }}
                >
                  {mode === "week" ? "Sem" : "Mois"}
                </button>
              ))}
            </div>
          </div>

          {/* Aujourd'hui reset */}
          {(weekOffset !== 0 || monthOffset !== 0) && (
            <div className="flex justify-center mb-2">
              <button
                onClick={() => { setWeekOffset(0); setMonthOffset(0); }}
                className="text-[10px] press-effect px-3 py-1 rounded-lg"
                style={{ color: "#39ff14", background: "rgba(57,255,20,0.08)", border: "1px solid rgba(57,255,20,0.2)" }}
              >
                Aujourd'hui
              </button>
            </div>
          )}

          {/* Completion counter (week mode) */}
          {viewMode === "week" && (
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-muted">{completedThisWeek}/{plannedThisWeek} séances</span>
              {isCurrentWeek && completedThisWeek >= plannedThisWeek && plannedThisWeek > 0 && (
                <span className="text-[10px] font-bold" style={{ color: "#39ff14" }}>SEMAINE COMPLÈTE ✓</span>
              )}
            </div>
          )}

          {/* Week grid */}
          {viewMode === "week" && (
            <div className="grid grid-cols-7 gap-1.5">
              {weekDays.map((day) => {
                const dateStr = toLocalDateStr(day.date);
                const hasSession = sessions.some((s) => s.date.slice(0, 10) === dateStr);
                const reschAway = rescheduledDays.some((r) => r.from === dateStr);
                const reschHere = rescheduledDays.find((r) => r.to === dateStr);
                const isRunDay = (!reschAway && coachRuns.some((r) => r.date === dateStr))
                  || (!!reschHere && coachRuns.some((r) => r.date === reschHere.from));
                const isMuscuDay = (!reschAway && coachWorkouts.some((w) => w.date === dateStr))
                  || (!!reschHere && coachWorkouts.some((w) => w.date === reschHere.from));
                const isPlanned = isRunDay || isMuscuDay;
                const isToday = day.isToday && weekOffset === 0;
                const planColor = isRunDay ? "#4f9cf9" : "#ff6b00";

                let bg = "#111", border = "#1a1a1a", dotColor = "transparent", shadow = "none", labelColor = "#555";
                if (hasSession) {
                  bg = "rgba(57,255,20,0.08)"; border = "rgba(57,255,20,0.4)";
                  dotColor = "#39ff14"; shadow = "0 0 12px rgba(57,255,20,0.1)";
                  if (isToday) labelColor = "#39ff14";
                } else if (isPlanned) {
                  dotColor = planColor;
                  if (isToday) {
                    border = isRunDay ? "rgba(79,156,249,0.5)" : "rgba(255,107,0,0.5)";
                    bg = isRunDay ? "rgba(79,156,249,0.05)" : "rgba(255,107,0,0.05)";
                    shadow = isRunDay ? "0 0 12px rgba(79,156,249,0.1)" : "0 0 12px rgba(255,107,0,0.1)";
                    labelColor = planColor;
                  }
                } else if (isToday) {
                  border = "rgba(57,255,20,0.4)";
                  bg = "rgba(57,255,20,0.05)";
                  shadow = "0 0 12px rgba(57,255,20,0.1)";
                  labelColor = "#39ff14";
                }

                return (
                  <button
                    key={dateStr}
                    onClick={() => router.push(`/day?date=${dateStr}`)}
                    className="rounded-xl p-2 flex flex-col items-center gap-1.5 press-effect"
                    style={{ background: bg, border: `1px solid ${border}`, boxShadow: shadow }}
                  >
                    <span className="text-[10px] font-bold tracking-wide" style={{ color: labelColor }}>
                      {day.label}
                    </span>
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: dotColor }} />
                  </button>
                );
              })}
            </div>
          )}

          {/* Month grid */}
          {viewMode === "month" && (
            <div>
              {/* Day labels */}
              <div className="grid grid-cols-7 mb-1">
                {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
                  <div key={i} className="text-center text-[10px] font-bold py-1" style={{ color: "#444" }}>
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {monthDays.map((date, i) => {
                  if (!date) return <div key={`pad-${i}`} />;
                  const dateStr = toLocalDateStr(date);
                  const hasSession = sessions.some((s) => s.date.slice(0, 10) === dateStr);
                  const mReschAway = rescheduledDays.some((r) => r.from === dateStr);
                  const mReschHere = rescheduledDays.find((r) => r.to === dateStr);
                  const mIsRunDay = (!mReschAway && coachRuns.some((r) => r.date === dateStr))
                    || (!!mReschHere && coachRuns.some((r) => r.date === mReschHere.from));
                  const mIsMuscuDay = (!mReschAway && coachWorkouts.some((w) => w.date === dateStr))
                    || (!!mReschHere && coachWorkouts.some((w) => w.date === mReschHere.from));
                  const isPlanned = mIsRunDay || mIsMuscuDay;
                  const isToday = dateStr === todayStr;
                  const mPlanColor = mIsRunDay ? "#4f9cf9" : "#ff6b00";

                  let dotColor = "transparent";
                  if (hasSession) dotColor = "#39ff14";
                  else if (isPlanned) dotColor = mPlanColor;

                  const todayBg = isToday ? (hasSession ? "rgba(57,255,20,0.08)" : mIsRunDay ? "rgba(79,156,249,0.08)" : mIsMuscuDay ? "rgba(255,107,0,0.08)" : "rgba(57,255,20,0.08)") : "transparent";
                  const todayBorder = isToday ? (hasSession ? "rgba(57,255,20,0.3)" : mIsRunDay ? "rgba(79,156,249,0.4)" : mIsMuscuDay ? "rgba(255,107,0,0.4)" : "rgba(57,255,20,0.3)") : "transparent";
                  const numberColor = isToday ? (hasSession ? "#39ff14" : isPlanned ? mPlanColor : "#39ff14") : "#666";

                  return (
                    <button
                      key={dateStr}
                      onClick={() => router.push(`/day?date=${dateStr}`)}
                      className="rounded-lg py-1.5 flex flex-col items-center gap-0.5 press-effect"
                      style={{ background: todayBg, border: `1px solid ${todayBorder}` }}
                    >
                      <span className="text-xs font-medium" style={{ color: numberColor }}>
                        {date.getDate()}
                      </span>
                      <div className="w-1 h-1 rounded-full" style={{ background: dotColor }} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
