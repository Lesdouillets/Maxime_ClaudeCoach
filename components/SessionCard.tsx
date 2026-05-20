"use client";

import type { CSSProperties } from "react";
import { formatPace } from "@/lib/plan";
import type { CoachWorkout, CoachRun } from "@/lib/coachPlan";
import type { WorkoutSession } from "@/lib/types";
import { ARCHIVO_WIDE_BOLD, STAT_VALUE_STYLE, STAT_UNIT_STYLE } from "@/lib/typography";
import { RaceBadge, RACE_COLOR } from "@/components/RaceBadge";
import { getRunBadge } from "@/lib/coachPlan";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const IMAGES: Record<string, string> = {
  upper: `${BASE}/images/bg-upper.jpg`,
  lower: `${BASE}/images/bg-lower.jpg`,
  run:   `${BASE}/images/bg-run.jpg`,
  rest:  `${BASE}/images/bg-rest.jpg`,
};

const CARD_HEIGHT = 280;
const GRADIENT = "linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.75) 35%, rgba(0,0,0,0.2) 65%, transparent 100%)";

const TITLE_STYLE: CSSProperties = { ...ARCHIVO_WIDE_BOLD, fontSize: 32, lineHeight: "36px", letterSpacing: "-0.03em" };
const CONTENT_COL_STYLE: CSSProperties = { padding: 12, display: "flex", flexDirection: "column", gap: 8 };
const TITLE_ROW_STYLE: CSSProperties = { display: "flex", alignItems: "center", gap: 6 };
const STATS_ROW_STYLE: CSSProperties = { display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "nowrap" };
const STAT_GROUP_STYLE: CSSProperties = { display: "flex", alignItems: "baseline", gap: 4, flexShrink: 0 };
const SEPARATOR_STYLE: CSSProperties = { color: "var(--color-dim)", fontSize: 14, lineHeight: "22px" };
const CHECK_ICON_STYLE: CSSProperties = { display: "inline", verticalAlign: "middle", marginLeft: 8, flexShrink: 0 };
const DIVIDER_STYLE: CSSProperties = { height: 1, background: "rgba(255,255,255,0.12)" };

interface SessionCardProps {
  todayCoachWorkout: CoachWorkout | null;
  todayCoachRun: CoachRun | null;
  todaySession: WorkoutSession | null;
  onOpenSession: () => void;
  onOpenRun: () => void;
}

function Separator() {
  return <span style={SEPARATOR_STYLE}>|</span>;
}

function StatGroup({ value, unit, color }: { value: string | number; unit: string; color?: string }) {
  return (
    <span style={STAT_GROUP_STYLE}>
      <span style={{ ...STAT_VALUE_STYLE, color: color ?? "#fff" }}>{value}</span>
      <span style={STAT_UNIT_STYLE}>{unit}</span>
    </span>
  );
}

function CheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 12 12" fill="none" style={CHECK_ICON_STYLE}>
      <path fillRule="evenodd" clipRule="evenodd" d="M9.61517 2.24038C10.0636 2.61224 10.1297 3.28214 9.76281 3.73663L5.8284 8.61003C5.64084 8.84235 5.36512 8.9835 5.06931 8.99865C4.77349 9.01379 4.48514 8.90151 4.27544 8.68952L2.30824 6.70089C1.89799 6.28618 1.89715 5.61294 2.30636 5.19718C2.71557 4.78142 3.37987 4.78057 3.79012 5.19528L4.93756 6.5L8.13877 2.39001C8.5057 1.93551 9.16671 1.86852 9.61517 2.24038Z" fill="var(--color-neon)" />
    </svg>
  );
}

function RestCard() {
  return (
    <div className="w-full rounded-2xl overflow-hidden relative" style={{ height: CARD_HEIGHT, border: "1px solid rgba(255,255,255,0.06)" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={IMAGES.rest} alt="" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0" style={{ background: GRADIENT }} />
      <div className="absolute bottom-0 left-0 right-0" style={CONTENT_COL_STYLE}>
        <h2 style={{ ...TITLE_STYLE, color: "#fff" }}>Repos</h2>
        <div style={DIVIDER_STYLE} />
        <p className="text-center text-sm font-semibold text-muted">On recharge les batteries</p>
      </div>
    </div>
  );
}

function RunCard({ todayCoachRun, todaySession, onOpenRun }: Pick<SessionCardProps, "todayCoachRun" | "todaySession" | "onOpenRun">) {
  const run = todaySession?.type === "run" ? todaySession : null;
  const isDone = run !== null;
  const isRace = todayCoachRun?.isRace ?? false;
  const accent = isRace ? RACE_COLOR : "var(--color-blue)";
  const runBadge = todayCoachRun ? getRunBadge(todayCoachRun) : null;

  return (
    <button
      className="w-full text-left rounded-2xl overflow-hidden relative press-effect"
      onClick={onOpenRun}
      style={{
        height: CARD_HEIGHT,
        border: `1px solid color-mix(in srgb, ${isRace ? RACE_COLOR : accent} 50%, transparent)`,
        boxShadow: isRace ? `0 0 24px rgba(254,237,0,0.08)` : undefined,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={IMAGES.run} alt="" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0" style={{ background: GRADIENT }} />

      <div className="absolute bottom-0 left-0 right-0" style={CONTENT_COL_STYLE}>
        <div style={TITLE_ROW_STYLE}>
          <span style={{ ...TITLE_STYLE, color: isDone ? "var(--color-neon)" : "#fff" }}>
            {todayCoachRun?.label ?? "Run"}
          </span>
          {isDone && <CheckIcon />}
        </div>

        {!isDone && todayCoachRun && (
          <div style={STATS_ROW_STYLE}>
            {todayCoachRun.distanceKm > 0 && <StatGroup value={todayCoachRun.distanceKm} unit="km" />}
            {todayCoachRun.durationMin && (
              <>
                <Separator />
                <StatGroup value={`~${todayCoachRun.durationMin}`} unit="min" />
              </>
            )}
            {todayCoachRun.pace && (
              <>
                <Separator />
                <StatGroup value={todayCoachRun.pace} unit="/km" />
              </>
            )}
            {isRace ? (
              <>
                <Separator />
                <RaceBadge wingSize={8} fontSize={9} />
              </>
            ) : runBadge ? (
              <>
                <Separator />
                <span style={{ ...STAT_UNIT_STYLE, color: accent, fontSize: 10, letterSpacing: "0.12em" }}>
                  {runBadge}
                </span>
              </>
            ) : null}
          </div>
        )}

        {isDone && run && (
          <div style={STATS_ROW_STYLE}>
            <StatGroup value={run.distanceKm.toFixed(1)} unit="km" />
            {run.durationSeconds > 0 && (
              <>
                <Separator />
                <StatGroup value={Math.round(run.durationSeconds / 60)} unit="min" />
              </>
            )}
            {run.avgPaceSecPerKm > 0 && (
              <>
                <Separator />
                <StatGroup value={formatPace(run.avgPaceSecPerKm)} unit="/km" />
              </>
            )}
          </div>
        )}

        <div style={DIVIDER_STYLE} />
        <p className="text-center text-sm font-semibold" style={{ color: "#aaa" }}>Voir le détail ›</p>
      </div>
    </button>
  );
}

function FitnessCard({ todayCoachWorkout, todaySession, onOpenSession }: Pick<SessionCardProps, "todayCoachWorkout" | "todaySession" | "onOpenSession">) {
  const fitness = todaySession?.type === "fitness" ? todaySession : null;
  const isDone = fitness !== null;
  const isUpper = isDone ? fitness?.category === "upper" : todayCoachWorkout?.category === "upper";
  const accent = "var(--color-orange)";

  const titleBase = isUpper ? "Haut du corps" : "Bas du corps";
  const plannedCount = todayCoachWorkout?.exercises.length ?? 0;
  const doneCount = fitness?.exercises.length ?? 0;
  const durationMin = todayCoachWorkout?.durationMin;
  const coachNote = todayCoachWorkout?.coachNote;

  return (
    <button
      className="w-full text-left rounded-2xl overflow-hidden relative press-effect"
      onClick={onOpenSession}
      style={{ height: CARD_HEIGHT, border: `1px solid color-mix(in srgb, ${accent} 50%, transparent)` }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={IMAGES[isUpper ? "upper" : "lower"]} alt="" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0" style={{ background: GRADIENT }} />

      <div className="absolute bottom-0 left-0 right-0" style={CONTENT_COL_STYLE}>
        <div style={TITLE_ROW_STYLE}>
          <span style={{ ...TITLE_STYLE, color: isDone ? "var(--color-neon)" : "#fff" }}>{titleBase}</span>
          {isDone && <CheckIcon />}
        </div>

        <div style={STATS_ROW_STYLE}>
          {isDone ? (
            <>
              <StatGroup value={`${doneCount}/${plannedCount}`} unit="exos" />
              {durationMin && (
                <>
                  <Separator />
                  <StatGroup value={durationMin} unit="min" />
                </>
              )}
            </>
          ) : (
            <>
              {plannedCount > 0 && <StatGroup value={plannedCount} unit="exos" />}
              {durationMin && (
                <>
                  <Separator />
                  <StatGroup value={durationMin} unit="min" />
                </>
              )}
              {coachNote && (
                <>
                  <Separator />
                  <span style={{ ...STAT_UNIT_STYLE, color: "var(--color-neon)", fontSize: 10, letterSpacing: "0.12em" }}>
                    {coachNote}
                  </span>
                </>
              )}
            </>
          )}
        </div>

        <div style={DIVIDER_STYLE} />
        <p className="text-center text-sm font-semibold" style={{ color: "#aaa" }}>Voir le détail ›</p>
      </div>
    </button>
  );
}

export function SessionCard({ todayCoachWorkout, todayCoachRun, todaySession, onOpenSession, onOpenRun }: SessionCardProps) {
  if (todayCoachRun || todaySession?.type === "run") {
    return <RunCard todayCoachRun={todayCoachRun} todaySession={todaySession} onOpenRun={onOpenRun} />;
  }
  if (todayCoachWorkout || todaySession?.type === "fitness") {
    return <FitnessCard todayCoachWorkout={todayCoachWorkout} todaySession={todaySession} onOpenSession={onOpenSession} />;
  }
  return <RestCard />;
}
