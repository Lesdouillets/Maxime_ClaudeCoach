"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { getWeekDays, formatPace, toLocalDateStr } from "@/lib/plan";
import { getSessions, getStravaTokens, addSession } from "@/lib/storage";
import { fetchNewActivitiesSinceLastVisit, autoImportActivity, getStravaAuthUrl, forceResyncRecentActivities } from "@/lib/strava";
import { getCoachWorkouts, getCoachRuns } from "@/lib/coachPlan";
import { getGitHubToken, getGistId, syncData } from "@/lib/sync";
import type { WorkoutSession } from "@/lib/types";
import type { CoachWorkout, CoachRun } from "@/lib/coachPlan";

type ViewMode = "week" | "month";

export default function Dashboard() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [isStravaConnected, setIsStravaConnected] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [resyncing, setResyncing] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [coachWorkouts, setCoachWorkouts] = useState<CoachWorkout[]>([]);
  const [coachRuns, setCoachRuns] = useState<CoachRun[]>([]);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "done" | "error">("idle");

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

  const refreshSessions = useCallback(() => {
    setSessions(getSessions());
    setCoachWorkouts(getCoachWorkouts());
    setCoachRuns(getCoachRuns());
  }, []);

  useEffect(() => {
    setMounted(true);

    // Auto-sync with GitHub Gist if configured
    const ghToken = getGitHubToken();
    const gistId = getGistId();
    if (ghToken && gistId) {
      setSyncStatus("syncing");
      syncData(ghToken, gistId)
        .then((result) => {
          if (result.ok) { setSyncStatus("done"); refreshSessions(); }
          else setSyncStatus("error");
          setTimeout(() => setSyncStatus("idle"), 3000);
        })
        .catch(() => { setSyncStatus("error"); setTimeout(() => setSyncStatus("idle"), 3000); });
    }

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

  const todayCoachWorkout = coachWorkouts.find((w) => w.date === todayStr) ?? null;
  const todayCoachRun = coachRuns.find((r) => r.date === todayStr) ?? null;
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
      <PageHeader
        title="CLAUDE COACH"
        subtitle={dateLabel}
        accent="neon"
        right={
          <div className="flex items-center gap-2">
            {/* Sync indicator */}
            {syncStatus !== "idle" && (
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{
                background: syncStatus === "syncing" ? "#ff6b00" : syncStatus === "done" ? "#39ff14" : "#ff4444",
                boxShadow: syncStatus === "done" ? "0 0 6px #39ff14" : syncStatus === "syncing" ? "0 0 6px #ff6b00" : "none",
                animation: syncStatus === "syncing" ? "pulse 1s infinite" : "none",
              }} />
            )}
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
              : (todayCoachWorkout || todayCoachRun)
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
            <>
              <div className="flex items-start justify-between mb-3">
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold tracking-widest"
                  style={{ background: "rgba(57,255,20,0.1)", color: "#39ff14", border: "1px solid rgba(57,255,20,0.2)" }}>
                  AUJOURD'HUI
                </span>
              </div>
              <h2 className="font-display text-4xl mb-1 leading-none">{todayCoachWorkout.label}</h2>
              {todayCoachWorkout.coachNote && (
                <p className="text-sm text-gray-400">{todayCoachWorkout.coachNote}</p>
              )}
              <p className="text-xs mt-2" style={{ color: "#555" }}>{todayCoachWorkout.exercises.length} exercices</p>
            </>
          ) : todayCoachRun ? (
            <>
              <div className="flex items-start justify-between mb-3">
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold tracking-widest"
                  style={{ background: "rgba(57,255,20,0.1)", color: "#39ff14", border: "1px solid rgba(57,255,20,0.2)" }}>
                  AUJOURD'HUI
                </span>
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
                const isPlanned = coachWorkouts.some((w) => w.date === dateStr) || coachRuns.some((r) => r.date === dateStr);
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
                    onClick={() => router.push(`/day?date=${dateStr}`)}
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
                  const isPlanned = coachWorkouts.some((w) => w.date === dateStr) || coachRuns.some((r) => r.date === dateStr);
                  const isPast = date < today;
                  const isToday = dateStr === todayStr;

                  let dotColor = "transparent";
                  if (hasSession) dotColor = "#39ff14";
                  else if (isPlanned && isPast) dotColor = "#ff6b00";
                  else if (isPlanned) dotColor = "#333";

                  return (
                    <button
                      key={dateStr}
                      onClick={() => router.push(`/day?date=${dateStr}`)}
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

    </div>
  );
}
