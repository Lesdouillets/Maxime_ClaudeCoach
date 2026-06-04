"use client";

import type { CoachRun, CoachRunInterval } from "@/lib/coachPlan";
import { JETBRAINS_MONO_TINY } from "@/lib/typography";
import { segDuration, segDistOnly } from "@/lib/runPlanUtils";
import RunSegmentCard from "@/components/RunSegmentCard";

interface Props {
  coachRun: CoachRun;
}

function formatRest(seconds: number): string {
  if (seconds >= 60) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s > 0 ? `${m}:${String(s).padStart(2, "0")} trot.` : `${m} min`;
  }
  return `${seconds}s`;
}

function RepBlock({ seg }: { seg: CoachRunInterval }) {
  const dashCount = Math.min(seg.reps ?? 8, 12);

  return (
    <div
      className="rounded-2xl px-4 py-4"
      style={{
        background: "var(--color-neon-04)",
        border: "1px solid var(--color-neon-15)",
      }}
    >
      <div className="flex items-baseline justify-between mb-3">
        <div className="flex items-baseline gap-1">
          <span className="font-display leading-none" style={{ fontSize: 20, color: "var(--color-neon-text)" }}>
            {seg.reps}
          </span>
          <span className="font-display leading-none" style={{ fontSize: 16, color: "var(--color-neon-text)" }}>
            × {segDistOnly(seg)}
          </span>
        </div>
        <span className="font-display leading-none" style={{ fontSize: 16, color: "var(--color-neon-text)" }}>
          {segDuration(seg)}
        </span>
      </div>

      <div className="flex gap-1 mb-4">
        {Array.from({ length: dashCount }).map((_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 2,
              background: "var(--color-neon)",
              opacity: dashCount === 1 ? 1 : 0.2 + (i / (dashCount - 1)) * 0.8,
            }}
          />
        ))}
      </div>

      <div style={{ borderTop: "1px solid var(--color-neon-15)", marginBottom: 16 }} />
      <div className="flex">
        <div className="flex-1">
          <p style={{ ...JETBRAINS_MONO_TINY, color: "var(--color-neon-text)" }}>ALLURE / KM</p>
          <p className="font-display leading-none mt-2" style={{ fontSize: 16, color: "var(--color-text)" }}>{seg.pace ?? "—"}</p>
        </div>
        {seg.restSeconds != null && (
          <div className="flex-1" style={{ borderLeft: "1px solid var(--color-subtle)", paddingLeft: 16 }}>
            <p style={{ ...JETBRAINS_MONO_TINY, color: "var(--color-secondary)" }}>RECUP</p>
            <p className="font-display leading-none mt-2" style={{ fontSize: 16, color: "var(--color-secondary)" }}>
              {formatRest(seg.restSeconds)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function RunPlanInterval({ coachRun }: Props) {
  if (!coachRun.intervals?.length) return null;

  const warmup = coachRun.intervals.find((s) => s.label === "Échauffement");
  const cooldown = coachRun.intervals.find((s) => s.label === "Retour au calme");
  const repBlock = coachRun.intervals.find((s) => (s.reps ?? 0) > 0 || s.label === "Répétitions");

  return (
    <div className="space-y-2">
      {warmup && <RunSegmentCard seg={warmup} />}
      {repBlock && <RepBlock seg={repBlock} />}
      {cooldown && <RunSegmentCard seg={cooldown} />}
    </div>
  );
}
