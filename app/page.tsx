"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import Badge from "@/components/Badge";
import { getTodayPlan, getThisWeekDays, formatPace, getDayName } from "@/lib/plan";
import { getSessions, getStravaTokens, getPendingStravaActivities, setPendingStravaActivities, addSession, generateId } from "@/lib/storage";
import { fetchNewActivitiesSinceLastVisit, formatDistance, formatDuration, speedToPace, mapStravaTypeToSession, getStravaAuthUrl } from "@/lib/strava";
import { downloadExport } from "@/lib/export";
import type { StravaActivity, WorkoutSession } from "@/lib/types";

export default function Dashboard() {
  const [mounted, setMounted] = useState(false);
  const [todayPlan] = useState(() => getTodayPlan());
  const [weekDays] = useState(() => getThisWeekDays());
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [newStravaActivities, setNewStravaActivities] = useState<StravaActivity[]>([]);
  const [isStravaConnected, setIsStravaConnected] = useState(false);
  const [fetchingStrava, setFetchingStrava] = useState(false);

  const refreshSessions = useCallback(() => {
    setSessions(getSessions());
  }, []);

  useEffect(() => {
    setMounted(true);
    refreshSessions();
    const tokens = getStravaTokens();
    setIsStravaConnected(!!tokens);

    // Check for pending strava activities
    const pending = getPendingStravaActivities();
    if (pending.length > 0) {
      setNewStravaActivities(pending);
    } else if (tokens) {
      // Silently fetch new activities
      setFetchingStrava(true);
      fetchNewActivitiesSinceLastVisit()
        .then((activities) => {
          if (activities.length > 0) {
            setPendingStravaActivities(activities);
            setNewStravaActivities(activities);
          }
        })
        .catch(() => {})
        .finally(() => setFetchingStrava(false));
    }
  }, [refreshSessions]);

  const importStravaActivity = (activity: StravaActivity) => {
    const sessionType = mapStravaTypeToSession(activity.type);
    if (!sessionType) return;

    let session: WorkoutSession;
    if (sessionType === "run") {
      session = {
        id: generateId(),
        type: "run",
        date: activity.start_date,
        distanceKm: activity.distance / 1000,
        durationSeconds: activity.moving_time,
        avgPaceSecPerKm: activity.distance > 0 ? (activity.moving_time / (activity.distance / 1000)) : 0,
        avgHeartRate: activity.average_heartrate,
        elevationGainM: activity.total_elevation_gain,
        comment: "",
        stravaActivityId: activity.id,
        importedFromStrava: true,
      };
    } else {
      session = {
        id: generateId(),
        type: "fitness",
        date: activity.start_date,
        category: "upper",
        exercises: [],
        stravaActivityId: activity.id,
        importedFromStrava: true,
      };
    }

    addSession(session);
    const remaining = newStravaActivities.filter((a) => a.id !== activity.id);
    setNewStravaActivities(remaining);
    setPendingStravaActivities(remaining);
    refreshSessions();
  };

  const dismissStravaActivity = (activityId: number) => {
    const remaining = newStravaActivities.filter((a) => a.id !== activityId);
    setNewStravaActivities(remaining);
    setPendingStravaActivities(remaining);
  };

  if (!mounted) return null;

  // Week stats
  const thisWeekDates = weekDays.map((d) => d.date.toISOString().slice(0, 10));
  const thisWeekSessions = sessions.filter((s) =>
    thisWeekDates.includes(s.date.slice(0, 10))
  );
  const plannedThisWeek = weekDays.filter((d) => d.plan).length;
  const completedThisWeek = thisWeekSessions.length;

  // Last run
  const lastRun = sessions.find((s) => s.type === "run");
  // Last fitness
  const lastFitness = sessions.find((s) => s.type === "fitness");

  const today = new Date();
  const dateStr = today.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="max-w-md mx-auto animate-fade-in">
      <PageHeader
        title="CLAUDE COACH"
        subtitle={dateStr}
        accent="neon"
        right={
          <button
            onClick={() => downloadExport()}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide press-effect"
            style={{
              background: "rgba(57,255,20,0.1)",
              border: "1px solid rgba(57,255,20,0.3)",
              color: "#39ff14",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 15L8 11M12 15L16 11M12 15V3M5 21H19" stroke="#39ff14" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Export
          </button>
        }
      />

      <div className="px-5 space-y-5">

        {/* Today's Session */}
        {todayPlan ? (
          <div
            className="rounded-2xl p-5 relative overflow-hidden card-hover"
            style={{
              background: "linear-gradient(135deg, #111 0%, #1a1a1a 100%)",
              border: "1px solid rgba(57,255,20,0.2)",
            }}
          >
            {/* Glow blob */}
            <div
              className="absolute -top-6 -right-6 w-32 h-32 rounded-full pointer-events-none"
              style={{
                background: "radial-gradient(circle, rgba(57,255,20,0.08) 0%, transparent 70%)",
              }}
            />
            <div className="flex items-start justify-between mb-3">
              <Badge label="Séance du jour" variant="neon" />
              <Badge
                label={todayPlan.type === "fitness" ? (todayPlan.category === "upper" ? "Haut" : "Bas") : "Run"}
                variant="surface"
              />
            </div>
            <h2 className="font-display text-4xl mb-1 leading-none">{todayPlan.label}</h2>
            <p className="text-sm text-gray-400 mb-4">{todayPlan.targetDescription}</p>
            {todayPlan.type === "run" && todayPlan.targetDistanceKm && (
              <div className="flex gap-4 mb-4">
                <div>
                  <span className="font-display text-2xl text-neon">{todayPlan.targetDistanceKm}</span>
                  <span className="text-xs text-muted ml-1">km</span>
                </div>
                {todayPlan.targetPaceSecPerKm && (
                  <div>
                    <span className="font-display text-2xl text-neon">
                      {formatPace(todayPlan.targetPaceSecPerKm)}
                    </span>
                  </div>
                )}
                {todayPlan.targetZone && (
                  <Badge label={todayPlan.targetZone} variant="neon" />
                )}
              </div>
            )}
            <Link
              href={todayPlan.type === "fitness" ? "/log/fitness" : "/log/run"}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-bold text-sm tracking-wide press-effect"
              style={{
                background: "linear-gradient(135deg, #39ff14, #1a7a09)",
                color: "#0a0a0a",
              }}
            >
              C'EST PARTI
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M5 12H19M13 6L19 12L13 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
          </div>
        ) : (
          <div
            className="rounded-2xl p-5 flex items-center gap-4"
            style={{ background: "#111", border: "1px solid #222" }}
          >
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: "#1a1a1a" }}
            >
              <span className="text-2xl">😴</span>
            </div>
            <div>
              <p className="font-bold">Jour de repos</p>
              <p className="text-sm text-muted">Récupère bien — la progression se passe au repos.</p>
            </div>
          </div>
        )}

        {/* Strava new activities */}
        {newStravaActivities.map((activity) => (
          <div
            key={activity.id}
            className="rounded-2xl p-4 animate-slide-up"
            style={{
              background: "rgba(252,76,2,0.05)",
              border: "1px solid rgba(252,76,2,0.3)",
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#ff6b00">
                <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066l-2.084 4.116zM11.648 13.828L8.966 8H6.58l5.069 10 5.069-10h-2.386z"/>
              </svg>
              <span className="text-sm font-bold" style={{ color: "#ff6b00" }}>
                Nouvelle activité Strava
              </span>
            </div>
            <p className="font-semibold mb-1">{activity.name}</p>
            <div className="flex gap-3 text-sm text-gray-400 mb-3">
              {activity.distance > 0 && (
                <span>{formatDistance(activity.distance)} km</span>
              )}
              <span>{formatDuration(activity.moving_time)}</span>
              {activity.average_speed > 0 && activity.type === "Run" && (
                <span>{speedToPace(activity.average_speed)} /km</span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => importStravaActivity(activity)}
                className="flex-1 py-2 rounded-xl text-sm font-bold press-effect"
                style={{
                  background: "rgba(255,107,0,0.2)",
                  border: "1px solid rgba(255,107,0,0.4)",
                  color: "#ff6b00",
                }}
              >
                Importer
              </button>
              <button
                onClick={() => dismissStravaActivity(activity.id)}
                className="px-3 py-2 rounded-xl text-sm press-effect"
                style={{ background: "#1a1a1a", color: "#666" }}
              >
                Ignorer
              </button>
            </div>
          </div>
        ))}

        {/* Week overview */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-sm tracking-wide uppercase text-muted">
              Cette semaine
            </h2>
            <span className="font-display text-lg" style={{ color: completedThisWeek >= plannedThisWeek ? "#39ff14" : "#ff6b00" }}>
              {completedThisWeek}/{plannedThisWeek}
            </span>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {weekDays.map((day) => {
              const hasSession = sessions.some(
                (s) => s.date.slice(0, 10) === day.date.toISOString().slice(0, 10)
              );
              const isPlanned = !!day.plan;

              let bg = "#111";
              let border = "#222";
              let dotColor = "transparent";

              if (hasSession) {
                bg = "rgba(57,255,20,0.08)";
                border = "rgba(57,255,20,0.4)";
                dotColor = "#39ff14";
              } else if (isPlanned && !day.isPast) {
                bg = "#111";
                border = "#333";
                dotColor = "#333";
              } else if (isPlanned && day.isPast) {
                bg = "rgba(255,107,0,0.05)";
                border = "rgba(255,107,0,0.2)";
                dotColor = "#ff6b00";
              }

              return (
                <div
                  key={day.dow}
                  className="rounded-xl p-2 flex flex-col items-center gap-1.5"
                  style={{
                    background: day.isToday ? "rgba(57,255,20,0.05)" : bg,
                    border: `1px solid ${day.isToday ? "rgba(57,255,20,0.4)" : border}`,
                    boxShadow: day.isToday ? "0 0 12px rgba(57,255,20,0.1)" : "none",
                  }}
                >
                  <span
                    className="text-[10px] font-bold tracking-wide"
                    style={{ color: day.isToday ? "#39ff14" : "#555" }}
                  >
                    {day.label}
                  </span>
                  <div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: dotColor }}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent activity */}
        <div>
          <h2 className="font-bold text-sm tracking-wide uppercase text-muted mb-3">
            Dernières séances
          </h2>
          {sessions.length === 0 ? (
            <div
              className="rounded-2xl p-6 flex flex-col items-center gap-3 text-center"
              style={{ background: "#111", border: "1px dashed #222" }}
            >
              <span className="text-3xl">🏃</span>
              <p className="font-bold">Aucune séance enregistrée</p>
              <p className="text-sm text-muted">
                Commence par logger ta première séance.
              </p>
              <Link
                href="/log/fitness"
                className="mt-1 px-5 py-2.5 rounded-xl text-sm font-bold press-effect"
                style={{
                  background: "linear-gradient(135deg, #39ff14, #1a7a09)",
                  color: "#0a0a0a",
                }}
              >
                Logger une séance
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.slice(0, 5).map((session) => (
                <SessionRow key={session.id} session={session} />
              ))}
            </div>
          )}
        </div>

        {/* Strava Connection */}
        <div
          className="rounded-2xl p-4 flex items-center justify-between"
          style={{ background: "#111", border: "1px solid #1a1a1a" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: isStravaConnected ? "rgba(252,76,2,0.15)" : "#1a1a1a" }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill={isStravaConnected ? "#ff6b00" : "#555"}>
                <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066l-2.084 4.116zM11.648 13.828L8.966 8H6.58l5.069 10 5.069-10h-2.386z"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold">
                {isStravaConnected ? "Strava connecté" : "Connecter Strava"}
              </p>
              <p className="text-xs text-muted">
                {isStravaConnected
                  ? fetchingStrava ? "Synchronisation..." : "Activités synchronisées"
                  : "Importe tes activités auto"}
              </p>
            </div>
          </div>
          {!isStravaConnected && (
            <a
              href={getStravaAuthUrl()}
              className="px-3 py-1.5 rounded-xl text-xs font-bold press-effect"
              style={{
                background: "#ff6b00",
                color: "white",
              }}
            >
              Connecter
            </a>
          )}
        </div>

      </div>
    </div>
  );
}

function SessionRow({ session }: { session: WorkoutSession }) {
  const date = new Date(session.date);
  const dateLabel = date.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  if (session.type === "run") {
    return (
      <div
        className="rounded-2xl p-4 flex items-center gap-4 card-hover"
        style={{ background: "#111", border: "1px solid #1a1a1a" }}
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(57,255,20,0.1)" }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M13 4a1 1 0 1 0 2 0 1 1 0 0 0-2 0M5.5 16.5l2.5-3.5 3 2.5 3.5-5L17 14M3 20h18" stroke="#39ff14" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm">Run</p>
          <p className="text-xs text-muted truncate">{dateLabel}</p>
        </div>
        <div className="text-right">
          <p className="font-display text-xl" style={{ color: "#39ff14" }}>
            {session.distanceKm.toFixed(1)}
            <span className="text-xs text-muted ml-1">km</span>
          </p>
          {session.avgPaceSecPerKm > 0 && (
            <p className="text-xs text-muted">
              {Math.floor(session.avgPaceSecPerKm / 60)}:{String(Math.round(session.avgPaceSecPerKm % 60)).padStart(2, "0")}/km
            </p>
          )}
        </div>
        {session.importedFromStrava && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#ff6b00" className="flex-shrink-0">
            <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066l-2.084 4.116zM11.648 13.828L8.966 8H6.58l5.069 10 5.069-10h-2.386z"/>
          </svg>
        )}
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl p-4 flex items-center gap-4 card-hover"
      style={{ background: "#111", border: "1px solid #1a1a1a" }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: "rgba(255,107,0,0.1)" }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M6.5 6.5h11M6.5 17.5h11M3 10h18M3 14h18" stroke="#ff6b00" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm capitalize">
          {session.category === "upper" ? "Haut du corps" : "Bas du corps"}
        </p>
        <p className="text-xs text-muted truncate">{dateLabel}</p>
      </div>
      <div className="text-right">
        <p className="font-display text-xl" style={{ color: "#ff6b00" }}>
          {session.exercises.length}
          <span className="text-xs text-muted ml-1">exos</span>
        </p>
      </div>
      {session.importedFromStrava && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="#ff6b00" className="flex-shrink-0">
          <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066l-2.084 4.116zM11.648 13.828L8.966 8H6.58l5.069 10 5.069-10h-2.386z"/>
        </svg>
      )}
    </div>
  );
}
