// components/RunPlanInterval.tsx
"use client";

import type { CoachRun, CoachRunInterval } from "@/lib/coachPlan";
import { JETBRAINS_MONO_DATA, JETBRAINS_MONO_LABEL } from "@/lib/typography";
import { segDuration, segDistLabel } from "@/lib/runPlanUtils";

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

function SimpleCard({ seg }: { seg: CoachRunInterval }) {
  return (
    <div
      className="rounded-2xl px-4 py-3 flex items-center justify-between"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-subtle)" }}
    >
      <div>
        <p className="font-display text-lg" style={{ color: "#fff" }}>
          {seg.label ?? segDistLabel(seg)}
        </p>
        <p className="mt-0.5" style={{ ...JETBRAINS_MONO_DATA, color: "var(--color-secondary)", fontSize: 11 }}>
          {segDistLabel(seg)} · {seg.pace}/km
        </p>
      </div>
      <span style={{ ...JETBRAINS_MONO_LABEL, color: "var(--color-secondary)", fontSize: 11 }}>
        {segDuration(seg)}
      </span>
    </div>
  );
}

function RepBlock({ seg }: { seg: CoachRunInterval }) {
  const repLabel = seg.reps
    ? `${seg.reps} × ${seg.distanceKm < 1 ? `${seg.distanceKm * 1000}m` : `${seg.distanceKm}km`}`
    : segDistLabel(seg);
  const dashCount = Math.min(seg.reps ?? 8, 12);

  return (
    <div
      className="rounded-2xl px-4 py-4"
      style={{
        background: "rgba(205,255,0,0.04)",
        border: "1px solid rgba(205,255,0,0.15)",
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="font-display text-2xl" style={{ color: "#CDFF00" }}>{repLabel}</p>
        <span style={{ ...JETBRAINS_MONO_LABEL, color: "var(--color-secondary)", fontSize: 11 }}>
          {segDuration(seg)}
        </span>
      </div>

      {/* Barre de tirets décorative */}
      <div className="flex gap-1 mb-4">
        {Array.from({ length: dashCount }).map((_, i) => (
          <div
            key={i}
            style={{ flex: 1, height: 3, borderRadius: 2, background: "var(--color-neon)", opacity: 0.7 }}
          />
        ))}
      </div>

      <div className="flex gap-4">
        <div>
          <p style={{ ...JETBRAINS_MONO_LABEL, color: "var(--color-secondary)", fontSize: 9 }}>ALLURE / KM</p>
          <p className="font-display text-xl mt-1">{seg.pace}</p>
        </div>
        {seg.restSeconds != null && (
          <div style={{ borderLeft: "1px solid var(--color-subtle)", paddingLeft: 16 }}>
            <p style={{ ...JETBRAINS_MONO_LABEL, color: "var(--color-secondary)", fontSize: 9 }}>RECUP</p>
            <p className="font-display text-xl mt-1" style={{ color: "var(--color-secondary)" }}>
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
      {warmup && <SimpleCard seg={warmup} />}
      {repBlock && <RepBlock seg={repBlock} />}
      {cooldown && <SimpleCard seg={cooldown} />}
    </div>
  );
}
