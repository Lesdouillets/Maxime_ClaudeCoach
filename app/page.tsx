"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import Badge from "@/components/Badge";
import { getTodayPlan, getThisWeekDays, formatPace } from "@/lib/plan";
import { getSessions, getStravaTokens, addSession } from "@/lib/storage";
import { fetchNewActivitiesSinceLastVisit, formatDuration, speedToPace, autoImportActivity, getStravaAuthUrl } from "@/lib/strava";
import { downloadExport, copyExportToClipboard } from "@/lib/export";
import type { WorkoutSession } from "@/lib/types";

export default function Dashboard() {
  const [mounted, setMounted] = useState(false);
  const [todayPlan] = useState(() => getTodayPlan());
  const [weekDays] = useState(() => getThisWeekDays());
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [isStravaConnected, setIsStravaConnected] = useState(false);
  const [fetchingStrava, setFetchingStrava] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await copyExportToClipboard();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const refreshSessions = useCallback(() => {
    setSessions(getSessions());
  }, []);

  useEffect(() => {
    setMounted(true);
    refreshSessions();
    const tokens = getStravaTokens();
    setIsStravaConnected(!!tokens);

    if (!tokens) return;

    // Auto-fetch and auto-import on every app open
    setFetchingStrava(true);
    fetchNewActivitiesSinceLastVisit()
      .then((activities) => {
        if (activities.length === 0) return;
        let count = 0;
        activities.forEach((activity) => {
          const session = autoImportActivity(activity);
          if (session) {
            addSession(session);
            count++;
          }
        });
        if (count > 0) {
          setImportedCount(count);
          refreshSessions();
          // Hide notification after 4s
          setTimeout(() => setImportedCount(0), 4000);
        }
      })
      .catch(() => {})
      .finally(() => setFetchingStrava(false));
  }, [refreshSessions]);

  if (!mounted) return null;

  const thisWeekDates = weekDays.map((d) => d.date.toISOString().slice(0, 10));
  const thisWeekSessions = sessions.filter((s) =>
    thisWeekDates.includes(s.date.slice(0, 10))
  );
  const plannedThisWeek = weekDays.filter((d) => d.plan).length;
  const completedThisWeek = thisWeekSessions.length;

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
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide press-effect"
              style={{
                background: copied ? "rgba(57,255,20,0.15)" : "rgba(57,255,20,0.1)",
                border: "1px solid rgba(57,255,20,0.3)",
                color: "#39ff14",
                minWidth: "100px",
              }}
            >
              {copied ? (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                    <path d="M5 13L9 17L19 7" stroke="#39ff14" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Copié !
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
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
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M12 15L8 11M12 15L16 11M12 15V3M5 21H19" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        }
      />

      <div className="px-5 space-y-5">

        {/* Auto-import toast */}
        {importedCount > 0 && (
          <div
            className="rounded-2xl p-4 flex items-center gap-3 animate-slide-up"
            style={{
              background: "rgba(57,255,20,0.06)",
              border: "1px solid rgba(57,255,20,0.3)",
            }}
          >
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(57,255,20,0.15)" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M5 13L9 17L19 7" stroke="#39ff14" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: "#39ff14" }}>
                {importedCount} activité{importedCount > 1 ? "s" : ""} importée{importedCount > 1 ? "s" : ""} depuis Strava
              </p>
              <p className="text-xs text-muted">Type et catégorie détectés automatiquement</p>
            </div>
          </div>
        )}

        {/* Today's Session */}
        {todayPlan ? (
          <div
            className="rounded-2xl p-5 relative overflow-hidden card-hover"
            style={{
              background: "linear-gradient(135deg, #111 0%, #1a1a1a 100%)",
              border: "1px solid rgba(57,255,20,0.2)",
            }}
          >
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
              let bg = "#111", border = "#222", dotColor = "transparent";
              if (hasSession) {
                bg = "rgba(57,255,20,0.08)"; border = "rgba(57,255,20,0.4)"; dotColor = "#39ff14";
              } else if (isPlanned && !day.isPast) {
                bg = "#111"; border = "#333"; dotColor = "#333";
              } else if (isPlanned && day.isPast) {
                bg = "rgba(255,107,0,0.05)"; border = "rgba(255,107,0,0.2)"; dotColor = "#ff6b00";
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
                  <span className="text-[10px] font-bold tracking-wide" style={{ color: day.isToday ? "#39ff14" : "#555" }}>
                    {day.label}
                  </span>
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: dotColor }} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent sessions */}
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
              <p className="text-sm text-muted">Commence par logger ta première séance.</p>
              <Link
                href="/log/fitness"
                className="mt-1 px-5 py-2.5 rounded-xl text-sm font-bold press-effect"
                style={{ background: "linear-gradient(135deg, #39ff14, #1a7a09)", color: "#0a0a0a" }}
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

        {/* Strava status */}
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
                  ? fetchingStrava ? "Synchronisation en cours..." : "Import auto à chaque ouverture"
                  : "Import automatique des activités"}
              </p>
            </div>
          </div>
          {!isStravaConnected && (
            <a
              href={getStravaAuthUrl()}
              className="px-3 py-1.5 rounded-xl text-xs font-bold press-effect"
              style={{ background: "#ff6b00", color: "white" }}
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
  const dateLabel = date.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });

  if (session.type === "run") {
    return (
      <div className="rounded-2xl p-4 flex items-center gap-4 card-hover" style={{ background: "#111", border: "1px solid #1a1a1a" }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(57,255,20,0.1)" }}>
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
            {session.distanceKm.toFixed(1)}<span className="text-xs text-muted ml-1">km</span>
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
    <div className="rounded-2xl p-4 flex items-center gap-4 card-hover" style={{ background: "#111", border: "1px solid #1a1a1a" }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,107,0,0.1)" }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M6.5 6.5h11M6.5 17.5h11M3 10h18M3 14h18" stroke="#ff6b00" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm">{session.category === "upper" ? "Haut du corps" : "Bas du corps"}</p>
        <p className="text-xs text-muted truncate">{dateLabel}</p>
      </div>
      <div className="text-right">
        <p className="font-display text-xl" style={{ color: "#ff6b00" }}>
          {session.exercises.length}<span className="text-xs text-muted ml-1">exos</span>
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
