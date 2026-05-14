"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { toLocalDateStr, formatPace } from "@/lib/plan";
import { getCurrentUser } from "@/lib/sync";
import type { User } from "@supabase/supabase-js";
import { getSessions, getRescheduledDays } from "@/lib/storage";
import { useSession } from "@/contexts/SessionContext";
import { useRunSheet } from "@/contexts/RunSheetContext";
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
  const session = useSession();
  const runSheet = useRunSheet();
  const [mounted, setMounted] = useState(false);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [coachWorkouts, setCoachWorkouts] = useState<CoachWorkout[]>([]);
  const [coachRuns, setCoachRuns] = useState<CoachRun[]>([]);
  const [rescheduledDays, setRescheduledDays] = useState<{ from: string; to: string }[]>([]);
  const [authUser, setAuthUser] = useState<User | null>(null);

  const refresh = useCallback(() => {
    setSessions(getSessions());
    setCoachWorkouts(getCoachWorkouts());
    setCoachRuns(getCoachRuns());
    setRescheduledDays(getRescheduledDays());
  }, []);

  useEffect(() => { setAuthUser(getCurrentUser()); }, []);

  useEffect(() => {
    setMounted(true);
    refresh();
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
  // When a run session is done but no coach run exists for today (e.g. user ran on a rest day),
  // skip todayCoachWorkout.label (which would show "Repos ...") and fall through to "RUN".
  const sessionLabel = todayCoachRun?.label?.toUpperCase()
    ?? (isDone && todaySession?.type === "run"
      ? "RUN"
      : todayCoachWorkout?.label?.toUpperCase())
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
            "linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.05) 25%, rgba(0,0,0,0.3) 55%, rgba(0,0,0,0.6) 75%, rgba(0,0,0,0.75) 100%)",
        }}
      />

      {/* Top header — matches PageHeader style */}
      <div
        className="absolute left-0 right-0 px-5 z-10 flex justify-between items-start"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 20px)" }}
      >
        <div>
          <p className="text-xs font-medium tracking-[0.2em] uppercase mb-1" style={{ color: "#39ff14" }}>
            {dateLabel}
          </p>
          <h1 className="font-display text-5xl leading-none">CLAUDE COACH</h1>
        </div>
        <Link
          href="/settings"
          className="press-effect flex items-center justify-center relative flex-shrink-0"
          style={{
            width: 40, height: 40, borderRadius: "50%",
            background: "rgba(0,0,0,0.4)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.08)",
            marginTop: 4,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="8" r="4" stroke="#aaa" strokeWidth="1.8"/>
            <path d="M4 20c0-4.418 3.582-8 8-8s8 3.582 8 8" stroke="#aaa" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          <span style={{
            position: "absolute", bottom: 2, right: 2,
            width: 8, height: 8, borderRadius: "50%",
            background: authUser ? "#39ff14" : "#333",
            border: "1.5px solid rgba(0,0,0,0.8)",
            boxShadow: authUser ? "0 0 4px #39ff14" : "none",
          }} />
        </Link>
      </div>

      {/* Bottom card — above floating nav */}
      <div
        className="absolute left-0 right-0 px-4 pb-2"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 96px)" }}
      >
        {hasActivity ? (
          <button
            className="w-full text-left p-5 rounded-2xl press-effect"
            onClick={() => {
              // Runs (planned or done) → run sheet
              if (todaySession?.type === "run" || (!todaySession && todayCoachRun)) {
                runSheet.open(todayStr, { originRoute: "/" });
                return;
              }
              // Fitness (planned, in-progress, or done archive) → session sheet
              if (todaySession?.type === "fitness" || todayCoachWorkout) {
                session.open(todayStr, { originRoute: "/" });
              }
            }}
            style={{
              background: "rgba(15,15,15,0.3)",
              backdropFilter: "blur(40px) saturate(1.5)",
              WebkitBackdropFilter: "blur(40px) saturate(1.5)",
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
                  <span className="font-display text-xl" style={{ color: "#39ff14" }}>
                    {formatPace(todaySession.avgPaceSecPerKm).replace("/km", "")} <span className="text-sm font-body font-normal text-muted">/km</span>
                  </span>
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
              background: "rgba(15,15,15,0.3)",
              backdropFilter: "blur(40px) saturate(1.5)",
              WebkitBackdropFilter: "blur(40px) saturate(1.5)",
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
