"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import PageHeader from "@/components/PageHeader";
import { getWeekDays, formatPace, WEEKLY_PLAN, toLocalDateStr } from "@/lib/plan";
import { getSessions, getStravaTokens, addSession } from "@/lib/storage";
import { fetchNewActivitiesSinceLastVisit, autoImportActivity, getStravaAuthUrl, forceResyncRecentActivities } from "@/lib/strava";
import { copyExportToClipboard, downloadExport } from "@/lib/export";
import { getCoachWorkouts } from "@/lib/coachPlan";
import type { WorkoutSession, PlannedDay } from "@/lib/types";
import type { CoachWorkout } from "@/lib/coachPlan";

const DayDetailSheet = dynamic(() => import("@/components/DayDetailSheet"), { ssr: false });

type ViewMode = "week" | "month";

export default function Dashboard() {
  const [mounted, setMounted] = useState(false);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [isStravaConnected, setIsStravaConnected] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [resyncing, setResyncing] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [coachWorkouts, setCoachWorkouts] = useState<CoachWorkout[]>([]);

  const handleResync = async () => {
    if (resyncing) return;
    setResyncing(true);
    try {
      const activities = await forceResyncRecentActivities(14);
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
    } catch {
      // silent fail
    } finally {
      setResyncing(false);
    }
  };

  const handleCopy = async () => {
    await copyExportToClipboard();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const refreshSessions = useCallback(() => {
    setSessions(getSessions());
    setCoachWorkouts(getCoachWorkouts());
  }, []);

  useEffect(() => {
    setMounted(true);
    refreshSessions();
    const tokens = getStravaTokens();
    setIsStravaConnected(!!tokens);
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

  const todayPlan = WEEKLY_PLAN.find((p) => p.dayOfWeek === today.getDay()) ?? null;
  const todaySession = sessions.find((s) => s.date.slice(0, 10) === todayStr);

  // Week range label
  const weekStart = weekDays[0].date;
  const weekEnd = weekDays[6].date;
  const isCurrentWeek = weekOffset === 0;
  const weekLabel = isCurrentWeek
    ? "Cette semaine"
    : `${weekStart.getDate()} – ${weekEnd.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`;

  // Month view data
  const year = today.getFullYear();
  const month = today.getMonth();
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

  // Selected day data
  const selectedSession = selectedDate
    ? sessions.find((s) => s.date.slice(0, 10) === selectedDate)
    : undefined;
  const selectedDow = selectedDate ? new Date(selectedDate + "T12:00:00").getDay() : -1;
  const selectedPlan = selectedDate
    ? (WEEKLY_PLAN.find((p) => p.dayOfWeek === selectedDow) ?? null)
    : null;
  const selectedCoachWorkout = selectedSession?.type === "fitness" && selectedSession.coachWorkoutId
    ? coachWorkouts.find((w) => w.id === selectedSession.coachWorkoutId) ?? null
    : null;

  const completedThisWeek = weekDays.filter((d) =>
    sessions.some((s) => s.date.slice(0, 10) === toLocalDateStr(d.date))
  ).length;
  const plannedThisWeek = weekDays.filter((d) => d.plan).length;

  const dateLabel = today.toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long",
  });

  return (
    <div className="max-w-md mx-auto animate-fade-in">
      <PageHeader
        title="CLAUDE COACH"
        subtitle={dateLabel}
        accent="neon"
        right={
          <div className="flex items-center gap-2">
            {/* Strava icon */}
            {isStravaConnected ? (
              <button
                onClick={handleResync}
                disabled={resyncing}
                className="p-2 rounded-xl press-effect disabled:opacity-60"
                style={{ background: resyncing ? "rgba(255,107,0,0.05)" : "rgba(255,107,0,0.1)" }}
                title="Resynchroniser Strava (14 derniers jours)"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill={resyncing ? "#884400" : "#ff6b00"}
                  className={resyncing ? "animate-spin" : ""}>
                  {resyncing
                    ? <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="#ff6b00" strokeWidth="2" strokeLinecap="round" fill="none"/>
                    : <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066l-2.084 4.116zM11.648 13.828L8.966 8H6.58l5.069 10 5.069-10h-2.386z"/>
                  }
                </svg>
              </button>
            ) : (
              <a
                href={getStravaAuthUrl()}
                className="p-2 rounded-xl press-effect"
                style={{ background: "#1a1a1a", border: "1px solid #222" }}
                title="Connecter Strava"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#444">
                  <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066l-2.084 4.116zM11.648 13.828L8.966 8H6.58l5.069 10 5.069-10h-2.386z"/>
                </svg>
              </a>
            )}

            {/* Pour Alex */}
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide press-effect"
              style={{
                background: copied ? "rgba(57,255,20,0.15)" : "rgba(57,255,20,0.1)",
                border: "1px solid rgba(57,255,20,0.3)",
                color: "#39ff14",
              }}
            >
              {copied ? (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path d="M5 13L9 17L19 7" stroke="#39ff14" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Copié !
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path d="M8 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1M8 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M8 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m0 0h2a2 2 0 0 1 2 2v3" stroke="#39ff14" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                  Pour Alex
                </>
              )}
            </button>
            <button
              onClick={() => downloadExport()}
              className="p-2 rounded-xl press-effect"
              style={{ background: "#111", border: "1px solid #222" }}
              title="Télécharger sessions.json"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path d="M12 15L8 11M12 15L16 11M12 15V3M5 21H19" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        }
      />

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
              : todayPlan
                ? "1px solid rgba(57,255,20,0.15)"
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
              onClick={() => setSelectedDate(todayStr)}
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
          ) : todayPlan ? (
            <>
              <div className="flex items-start justify-between mb-3">
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold tracking-widest"
                  style={{ background: "rgba(57,255,20,0.1)", color: "#39ff14", border: "1px solid rgba(57,255,20,0.2)" }}>
                  AUJOURD'HUI
                </span>
                <span className="text-xs px-2 py-0.5 rounded-lg font-medium"
                  style={{ background: "#1a1a1a", color: "#555" }}>
                  {todayPlan.type === "fitness"
                    ? (todayPlan.category === "upper" ? "Haut" : "Bas")
                    : "Run"}
                </span>
              </div>
              <h2 className="font-display text-4xl mb-1 leading-none">{todayPlan.label}</h2>
              <p className="text-sm text-gray-400">{todayPlan.targetDescription}</p>
              {todayPlan.type === "run" && todayPlan.targetDistanceKm && (
                <div className="flex gap-4 mt-3">
                  <div>
                    <span className="font-display text-2xl text-neon">{todayPlan.targetDistanceKm}</span>
                    <span className="text-xs text-muted ml-1">km</span>
                  </div>
                  {todayPlan.targetPaceSecPerKm && (
                    <span className="font-display text-2xl text-neon">
                      {formatPace(todayPlan.targetPaceSecPerKm)}
                    </span>
                  )}
                  {todayPlan.targetZone && (
                    <span className="self-center px-2 py-0.5 rounded-lg text-xs font-bold"
                      style={{ background: "rgba(57,255,20,0.15)", color: "#39ff14" }}>
                      {todayPlan.targetZone}
                    </span>
                  )}
                </div>
              )}
            </>
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
                onClick={() => setWeekOffset((o) => o - 1)}
                className="w-7 h-7 rounded-lg flex items-center justify-center press-effect"
                style={{ background: "#1a1a1a", border: "1px solid #222" }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path d="M15 18L9 12L15 6" stroke="#555" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
              <span className="text-xs font-semibold tracking-wide" style={{ color: "#555", minWidth: "120px", textAlign: "center" }}>
                {viewMode === "week" ? weekLabel.toUpperCase() : today.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }).toUpperCase()}
              </span>
              <button
                onClick={() => setWeekOffset((o) => Math.min(0, o + 1))}
                disabled={weekOffset === 0}
                className="w-7 h-7 rounded-lg flex items-center justify-center press-effect disabled:opacity-30"
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
                const isPlanned = !!day.plan;
                const isToday = day.isToday && weekOffset === 0;

                let bg = "#111", border = "#1a1a1a", dotColor = "transparent";
                if (hasSession) {
                  bg = "rgba(57,255,20,0.08)"; border = "rgba(57,255,20,0.4)"; dotColor = "#39ff14";
                } else if (isPlanned && !day.isPast) {
                  bg = "#111"; border = "#333"; dotColor = "#333";
                } else if (isPlanned && day.isPast) {
                  bg = "rgba(255,107,0,0.05)"; border = "rgba(255,107,0,0.2)"; dotColor = "#ff6b00";
                }

                return (
                  <button
                    key={dateStr}
                    onClick={() => setSelectedDate(dateStr)}
                    className="rounded-xl p-2 flex flex-col items-center gap-1.5 press-effect"
                    style={{
                      background: isToday ? "rgba(57,255,20,0.05)" : bg,
                      border: `1px solid ${isToday ? "rgba(57,255,20,0.4)" : border}`,
                      boxShadow: isToday ? "0 0 12px rgba(57,255,20,0.1)" : "none",
                    }}
                  >
                    <span className="text-[10px] font-bold tracking-wide"
                      style={{ color: isToday ? "#39ff14" : "#555" }}>
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
                  const dow = date.getDay();
                  const isPlanned = WEEKLY_PLAN.some((p) => p.dayOfWeek === dow);
                  const isPast = date < today;
                  const isToday = dateStr === todayStr;

                  let dotColor = "transparent";
                  if (hasSession) dotColor = "#39ff14";
                  else if (isPlanned && isPast) dotColor = "#ff6b00";
                  else if (isPlanned) dotColor = "#333";

                  return (
                    <button
                      key={dateStr}
                      onClick={() => setSelectedDate(dateStr)}
                      className="rounded-lg py-1.5 flex flex-col items-center gap-0.5 press-effect"
                      style={{
                        background: isToday ? "rgba(57,255,20,0.08)" : "transparent",
                        border: isToday ? "1px solid rgba(57,255,20,0.3)" : "1px solid transparent",
                      }}
                    >
                      <span className="text-xs font-medium" style={{ color: isToday ? "#39ff14" : "#666" }}>
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

      {/* Day detail sheet */}
      {selectedDate && (
        <DayDetailSheet
          date={selectedDate}
          session={selectedSession}
          plan={selectedPlan}
          coachWorkout={selectedCoachWorkout}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </div>
  );
}
