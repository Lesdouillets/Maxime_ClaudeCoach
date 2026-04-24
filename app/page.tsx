"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toLocalDateStr, formatPace } from "@/lib/plan";
import { getSessions, getStravaTokens, addSession, getRescheduledDays } from "@/lib/storage";
import { fetchNewActivitiesSinceLastVisit, autoImportActivity } from "@/lib/strava";
import { analyzeSession, getStoredCoachAnalysis } from "@/lib/coachAnalyzer";
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
  upper: "linear-gradient(160deg, #1a0800 0%, #0d0d0d 50%, #000 100%)",
  lower: "linear-gradient(160deg, #000a1a 0%, #0d0d0d 50%, #000 100%)",
  run:   "linear-gradient(160deg, #001020 0%, #0d0d0d 50%, #000 100%)",
  rest:  "linear-gradient(160deg, #0d0d0d 0%, #000 100%)",
};

const ACCENT: Record<BgType, string> = {
  upper: "#FF9F0A",
  lower: "#FF9F0A",
  run:   "#0A84FF",
  rest:  "rgba(235,235,245,0.25)",
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
          if (s) {
            addSession(s);
            count++;
            if (s.type === "run" && !getStoredCoachAnalysis(s.date.slice(0, 10))) {
              analyzeSession(s).catch(() => {});
            }
          }
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

  const sessionLabel = todayCoachRun?.label
    ?? todayCoachWorkout?.label
    ?? (todaySession?.type === "run" ? "Run"
      : todaySession?.category === "upper" ? "Haut du corps" : "Bas du corps");

  return (
    <div
      className="fixed inset-0"
      style={{ zIndex: 0, background: BG_FALLBACK[bgType] }}
    >
      {/* Background image */}
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
            "linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.05) 25%, rgba(0,0,0,0.3) 55%, rgba(0,0,0,0.65) 75%, rgba(0,0,0,0.82) 100%)",
        }}
      />

      {/* Header */}
      <div
        className="absolute left-0 right-0 px-5 z-10"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 20px)" }}
      >
        <p className="text-xs font-semibold tracking-wider uppercase mb-1" style={{ color: accent === "rgba(235,235,245,0.25)" ? "rgba(235,235,245,0.5)" : accent }}>
          {dateLabel}
        </p>
        <h1 className="font-display text-5xl leading-none tracking-tight">Claude Coach</h1>
      </div>

      {/* Toast import Strava */}
      {importedCount > 0 && (
        <div
          className="absolute left-4 right-4 rounded-2xl p-3 flex items-center gap-3 z-10"
          style={{ top: "calc(env(safe-area-inset-top, 0px) + 80px)", background: "rgba(48,209,88,0.12)", border: "1px solid rgba(48,209,88,0.35)", backdropFilter: "blur(16px)" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M5 13L9 17L19 7" stroke="#30D158" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <p className="text-sm font-semibold" style={{ color: "#30D158" }}>
            {importedCount} activité{importedCount > 1 ? "s" : ""} importée{importedCount > 1 ? "s" : ""} depuis Strava
          </p>
        </div>
      )}

      {/* Carte du bas */}
      <div
        className="absolute left-0 right-0 px-4 pb-2"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 88px)" }}
      >
        {hasActivity ? (
          <button
            className="w-full text-left p-5 rounded-2xl press-effect"
            onClick={() => {
              const isFitnessDay =
                !!todayCoachWorkout || todaySession?.type === "fitness";
              router.push(
                isFitnessDay
                  ? `/log/fitness?date=${todayStr}`
                  : `/day?date=${todayStr}`
              );
            }}
            style={{
              background: "rgba(10,10,10,0.35)",
              backdropFilter: "blur(40px) saturate(1.4)",
              WebkitBackdropFilter: "blur(40px) saturate(1.4)",
              border: isDone
                ? "1px solid rgba(48,209,88,0.3)"
                : `1px solid ${accent}55`,
              boxShadow: "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)",
            }}
          >
            {/* Badge + chevron */}
            <div className="flex items-center justify-between mb-3">
              <span
                className="text-[10px] px-2.5 py-0.5 rounded-full font-semibold tracking-wide"
                style={isDone
                  ? { background: "rgba(48,209,88,0.15)", color: "#30D158", border: "1px solid rgba(48,209,88,0.3)" }
                  : { background: `${accent === "rgba(235,235,245,0.25)" ? "rgba(235,235,245,0.08)" : accent + "18"}`, color: accent === "rgba(235,235,245,0.25)" ? "rgba(235,235,245,0.5)" : accent, border: `1px solid ${accent === "rgba(235,235,245,0.25)" ? "rgba(255,255,255,0.12)" : accent + "40"}` }
                }
              >
                {isDone ? "FAIT ✓" : "AUJOURD'HUI"}
              </span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M9 18L15 12L9 6" stroke="rgba(235,235,245,0.3)" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>

            {/* Titre */}
            <h2
              className="font-display text-4xl leading-none mb-1 tracking-tight"
              style={{ color: isDone ? "#30D158" : "#fff" }}
            >
              {sessionLabel}
            </h2>

            {/* Stats plan (pas encore fait) */}
            {!isDone && todayCoachRun && (
              <div className="flex gap-4 mt-2 items-end">
                {todayCoachRun.distanceKm && (
                  <span className="font-display text-xl" style={{ color: accent }}>
                    {todayCoachRun.distanceKm} <span className="text-sm font-body font-normal" style={{ color: "rgba(235,235,245,0.4)" }}>km</span>
                  </span>
                )}
                {todayCoachRun.pace && (
                  <span className="font-display text-lg" style={{ color: accent }}>{todayCoachRun.pace}/km</span>
                )}
                {todayCoachRun.targetZone && (
                  <span className="text-xs font-semibold self-center px-2 py-0.5 rounded-lg"
                    style={{ background: `${accent}20`, color: accent }}>
                    {todayCoachRun.targetZone}
                  </span>
                )}
              </div>
            )}
            {!isDone && todayCoachWorkout && (
              <p className="text-sm mt-1" style={{ color: "rgba(235,235,245,0.5)" }}>
                {todayCoachWorkout.exercises.length} exercices
                {todayCoachWorkout.coachNote ? ` · ${todayCoachWorkout.coachNote}` : ""}
              </p>
            )}

            {/* Stats session (fait) */}
            {isDone && todaySession?.type === "run" && (
              <div className="flex gap-4 mt-2 items-end">
                <span className="font-display text-xl" style={{ color: "#30D158" }}>
                  {todaySession.distanceKm.toFixed(1)} <span className="text-sm font-body font-normal" style={{ color: "rgba(235,235,245,0.4)" }}>km</span>
                </span>
                {todaySession.avgPaceSecPerKm > 0 && (
                  <span className="font-display text-xl" style={{ color: "#30D158" }}>
                    {formatPace(todaySession.avgPaceSecPerKm).replace("/km", "")} <span className="text-sm font-body font-normal" style={{ color: "rgba(235,235,245,0.4)" }}>/km</span>
                  </span>
                )}
              </div>
            )}
            {isDone && todaySession?.type === "fitness" && (
              <p className="text-sm mt-1" style={{ color: "rgba(235,235,245,0.5)" }}>
                {todaySession.exercises.length > 0 ? `${todaySession.exercises.length} exercices` : "Séance validée"}
              </p>
            )}
          </button>
        ) : (
          // Jour de repos
          <div
            className="w-full p-5 rounded-2xl"
            style={{
              background: "rgba(10,10,10,0.35)",
              backdropFilter: "blur(40px) saturate(1.4)",
              WebkitBackdropFilter: "blur(40px) saturate(1.4)",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)",
            }}
          >
            <p className="font-display text-4xl leading-none mb-1 tracking-tight" style={{ color: "rgba(235,235,245,0.3)" }}>Repos</p>
            <p className="text-sm" style={{ color: "rgba(235,235,245,0.35)" }}>Récupération — profite bien.</p>
          </div>
        )}
      </div>
    </div>
  );
}
