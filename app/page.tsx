"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toLocalDateStr, formatPace } from "@/lib/plan";
import { getSessions, getStravaTokens, addSession, getRescheduledDays } from "@/lib/storage";
import { fetchNewActivitiesSinceLastVisit, autoImportActivity } from "@/lib/strava";
import { getCoachWorkouts, getCoachRuns } from "@/lib/coachPlan";
import type { WorkoutSession } from "@/lib/types";
import type { CoachWorkout, CoachRun } from "@/lib/coachPlan";

type BgType = "upper" | "lower" | "run" | "rest";

const BG_IMAGES: Record<BgType, string> = {
  upper: "/images/bg-upper.jpg",
  lower: "/images/bg-lower.jpg",
  run:   "/images/bg-run.jpg",
  rest:  "/images/bg-rest.jpg",
};

const BG_FALLBACK: Record<BgType, string> = {
  upper: "linear-gradient(160deg, #1a0a00 0%, #0d0d0d 50%, #000 100%)",
  lower: "linear-gradient(160deg, #0a0a1a 0%, #0d0d0d 50%, #000 100%)",
  run:   "linear-gradient(160deg, #001020 0%, #0d0d0d 50%, #000 100%)",
  rest:  "linear-gradient(160deg, #111 0%, #0a0a0a 50%, #000 100%)",
};

const ACCENT: Record<BgType, string> = {
  upper: "#ff6b00",
  lower: "#ff6b00",
  run:   "#4f9cf9",
  rest:  "#444",
};

export default function HomePage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [coachWorkouts, setCoachWorkouts] = useState<CoachWorkout[]>([]);
  const [coachRuns, setCoachRuns] = useState<CoachRun[]>([]);
  const [rescheduledDays, setRescheduledDays] = useState<{ from: string; to: string }[]>([]);
  const [importedCount, setImportedCount] = useState(0);

  const refresh = useCallback(() => {
    setSessions(getSessions());
    setCoachWorkouts(getCoachWorkouts());
    setCoachRuns(getCoachRuns());
    setRescheduledDays(getRescheduledDays());
  }, []);

  useEffect(() => {
    setMounted(true);
    refresh();
    const tokens = getStravaTokens();
    if (!tokens) return;
    fetchNewActivitiesSinceLastVisit()
      .then((activities) => {
        if (!activities.length) return;
        let count = 0;
        activities.forEach((act) => {
          const s = autoImportActivity(act);
          if (s) { addSession(s); count++; }
        });
        if (count > 0) {
          setImportedCount(count);
          refresh();
          setTimeout(() => setImportedCount(0), 4000);
        }
      })
      .catch(() => {});
  }, [refresh]);

  if (!mounted) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = toLocalDateStr(today);
  const dateLabel = today.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  const reschAway = rescheduledDays.some((r) => r.from === todayStr);
  const reschHere = rescheduledDays.find((r) => r.to === todayStr);
  const todayCoachWorkout: CoachWorkout | null =
    (!reschAway ? coachWorkouts.find((w) => w.date === todayStr) : undefined)
    ?? (reschHere ? coachWorkouts.find((w) => w.date === reschHere.from) : undefined)
    ?? null;
  const todayCoachRun: CoachRun | null =
    (!reschAway ? coachRuns.find((r) => r.date === todayStr) : undefined)
    ?? (reschHere ? coachRuns.find((r) => r.date === reschHere.from) : undefined)
    ?? null;
  const todaySession = sessions.find((s) => s.date.slice(0, 10) === todayStr);

  // Background type
  let bgType: BgType = "rest";
  if (todaySession) {
    bgType = todaySession.type === "run" ? "run"
      : todaySession.category === "upper" ? "upper" : "lower";
  } else if (todayCoachRun) {
    bgType = "run";
  } else if (todayCoachWorkout) {
    bgType = todayCoachWorkout.category === "upper" ? "upper" : "lower";
  }

  const accent = ACCENT[bgType];
  const isDone = !!todaySession;
  const hasActivity = isDone || !!todayCoachWorkout || !!todayCoachRun;

  // Label for the card title
  const sessionLabel = todayCoachRun?.label?.toUpperCase()
    ?? todayCoachWorkout?.label?.toUpperCase()
    ?? (todaySession?.type === "run" ? "RUN"
      : todaySession?.category === "upper" ? "HAUT DU CORPS" : "BAS DU CORPS");

  return (
    <div
      className="fixed inset-0"
      style={{ zIndex: 0, background: BG_FALLBACK[bgType] }}
    >
      {/* Full-screen background image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${BG_IMAGES[bgType]}`}
        alt=""
        style={{
          position: "absolute", inset: 0,
          width: "100%", height: "100%",
          objectFit: "cover", objectPosition: "center",
        }}
      />

      {/* Gradient overlay */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.1) 30%, rgba(0,0,0,0.4) 60%, rgba(0,0,0,0.85) 80%, rgba(0,0,0,0.97) 100%)",
        }}
      />

      {/* Top header — matches PageHeader style */}
      <div
        className="absolute left-0 right-0 px-5 z-10"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 20px)" }}
      >
        <p className="text-xs font-medium tracking-[0.2em] uppercase mb-1" style={{ color: "#39ff14" }}>
          {dateLabel}
        </p>
        <h1 className="font-display text-5xl leading-none">CLAUDE COACH</h1>
      </div>

      {/* Strava import toast */}
      {importedCount > 0 && (
        <div
          className="absolute left-4 right-4 rounded-2xl p-3 flex items-center gap-3 z-10"
          style={{ top: "calc(env(safe-area-inset-top, 0px) + 80px)", background: "rgba(57,255,20,0.12)", border: "1px solid rgba(57,255,20,0.4)", backdropFilter: "blur(16px)" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M5 13L9 17L19 7" stroke="#39ff14" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <p className="text-sm font-semibold" style={{ color: "#39ff14" }}>
            {importedCount} activité{importedCount > 1 ? "s" : ""} importée{importedCount > 1 ? "s" : ""} depuis Strava
          </p>
        </div>
      )}

      {/* Bottom card — above floating nav */}
      <div
        className="absolute left-0 right-0 px-4 pb-2"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 96px)" }}
      >
        {hasActivity ? (
          <button
            className="w-full text-left p-5 rounded-2xl press-effect"
            onClick={() => router.push(`/day?date=${todayStr}`)}
            style={{
              background: "rgba(8,8,8,0.45)",
              backdropFilter: "blur(40px)",
              WebkitBackdropFilter: "blur(40px)",
              border: isDone
                ? "1px solid rgba(57,255,20,0.35)"
                : `1px solid ${accent}40`,
              boxShadow: isDone
                ? "0 -4px 32px rgba(57,255,20,0.06)"
                : `0 -4px 32px ${accent}12`,
            }}
          >
            {/* Badge + arrow */}
            <div className="flex items-center justify-between mb-3">
              <span
                className="text-[10px] px-2.5 py-0.5 rounded-full font-bold tracking-widest"
                style={isDone
                  ? { background: "rgba(57,255,20,0.15)", color: "#39ff14", border: "1px solid rgba(57,255,20,0.35)" }
                  : { background: `${accent}18`, color: accent, border: `1px solid ${accent}45` }
                }
              >
                {isDone ? "FAIT ✓" : "AUJOURD'HUI"}
              </span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M9 18L15 12L9 6" stroke="#444" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>

            {/* Title */}
            <h2
              className="font-display text-4xl leading-none mb-1"
              style={{ color: isDone ? "#39ff14" : "#fff" }}
            >
              {sessionLabel}
            </h2>

            {/* Plan stats (not yet done) */}
            {!isDone && todayCoachRun && (
              <div className="flex gap-4 mt-2 items-end">
                {todayCoachRun.distanceKm && (
                  <span className="font-display text-xl" style={{ color: accent }}>
                    {todayCoachRun.distanceKm} <span className="text-sm font-body font-normal text-muted">km</span>
                  </span>
                )}
                {todayCoachRun.pace && (
                  <span className="font-display text-lg" style={{ color: accent }}>{todayCoachRun.pace}/km</span>
                )}
                {todayCoachRun.targetZone && (
                  <span className="text-xs font-bold self-center px-2 py-0.5 rounded-lg"
                    style={{ background: `${accent}20`, color: accent }}>
                    {todayCoachRun.targetZone}
                  </span>
                )}
              </div>
            )}
            {!isDone && todayCoachWorkout && (
              <p className="text-sm mt-1" style={{ color: "#888" }}>
                {todayCoachWorkout.exercises.length} exercices
                {todayCoachWorkout.coachNote ? ` · ${todayCoachWorkout.coachNote}` : ""}
              </p>
            )}

            {/* Session stats (done) */}
            {isDone && todaySession?.type === "run" && (
              <div className="flex gap-4 mt-2 items-end">
                <span className="font-display text-xl" style={{ color: "#39ff14" }}>
                  {todaySession.distanceKm.toFixed(1)} <span className="text-sm font-body font-normal text-muted">km</span>
                </span>
                {todaySession.avgPaceSecPerKm > 0 && (
                  <span className="text-sm text-muted self-end">{formatPace(todaySession.avgPaceSecPerKm)}</span>
                )}
              </div>
            )}
            {isDone && todaySession?.type === "fitness" && (
              <p className="text-sm mt-1 text-muted">
                {todaySession.exercises.length > 0 ? `${todaySession.exercises.length} exercices` : "Séance validée"}
              </p>
            )}
          </button>
        ) : (
          // Rest day
          <div
            className="w-full p-5 rounded-2xl"
            style={{
              background: "rgba(8,8,8,0.45)",
              backdropFilter: "blur(40px)",
              WebkitBackdropFilter: "blur(40px)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <p className="font-display text-4xl leading-none mb-1" style={{ color: "#444" }}>REPOS</p>
            <p className="text-sm text-muted">Récupération — profite bien.</p>
          </div>
        )}
      </div>
    </div>
  );
}
