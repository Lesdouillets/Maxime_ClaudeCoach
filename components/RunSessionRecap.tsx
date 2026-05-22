"use client";

import type { CoachRun } from "@/lib/coachPlan";
import { JETBRAINS_MONO_LABEL } from "@/lib/typography";

interface Props {
  coachRun: CoachRun;
}

function RecapCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-2xl px-4 py-3 flex items-center justify-between"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-subtle)",
        opacity: 0.6,
      }}
    >
      <span style={{ ...JETBRAINS_MONO_LABEL, color: "var(--color-secondary)", fontSize: 11 }}>
        {label}
      </span>
      <span className="text-sm" style={{ color: "var(--color-secondary)" }}>{value}</span>
    </div>
  );
}

export default function RunSessionRecap({ coachRun }: Props) {
  return (
    <div className="space-y-3">
      <p style={{ ...JETBRAINS_MONO_LABEL, color: "var(--color-muted)", fontSize: 11 }}>
        RAPPEL DE LA SÉANCE
      </p>
      <div className="space-y-2">
        {coachRun.pace && <RecapCard label="Allure cible" value={`${coachRun.pace}/km`} />}
        {coachRun.targetHR && <RecapCard label="FC Cible" value={coachRun.targetHR} />}
        <RecapCard label="Distance prévue" value={`${coachRun.distanceKm} km`} />
      </div>
    </div>
  );
}
