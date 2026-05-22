"use client";

import type { CoachRun } from "@/lib/coachPlan";
import { JETBRAINS_MONO_LABEL } from "@/lib/typography";

interface Props {
  coachRun: CoachRun;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-2xl px-4 py-3 flex items-center justify-between"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-subtle)" }}
    >
      <span style={{ ...JETBRAINS_MONO_LABEL, color: "var(--color-secondary)", fontSize: 11 }}>
        {label}
      </span>
      <span className="font-display text-xl" style={{ color: "#fff" }}>{value}</span>
    </div>
  );
}

export default function RunPlanClassic({ coachRun }: Props) {
  return (
    <div className="space-y-2">
      {coachRun.pace && (
        <StatCard label="Allure cible" value={`${coachRun.pace}/km`} />
      )}
      {coachRun.targetHR && (
        <StatCard label="FC Cible" value={coachRun.targetHR} />
      )}
      <StatCard label="Distance" value={`${coachRun.distanceKm} km`} />
    </div>
  );
}
