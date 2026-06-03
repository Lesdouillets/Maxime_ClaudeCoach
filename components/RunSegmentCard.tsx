"use client";

import type { CoachRunInterval } from "@/lib/coachPlan";
import { JETBRAINS_MONO_DATA } from "@/lib/typography";
import { segDuration, segDistLabel } from "@/lib/runPlanUtils";

interface Props {
  seg: CoachRunInterval;
}

export default function RunSegmentCard({ seg }: Props) {
  return (
    <div
      className="rounded-2xl px-4 py-4"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-subtle)" }}
    >
      <div className="flex items-baseline justify-between">
        <p className="font-display leading-none" style={{ fontSize: 16, color: "var(--color-text)" }}>
          {seg.label ?? segDistLabel(seg)}
        </p>
        <span className="font-display leading-none" style={{ fontSize: 16, color: "var(--color-text)" }}>
          {segDuration(seg)}
        </span>
      </div>
      <p className="mt-2" style={{ ...JETBRAINS_MONO_DATA, color: "var(--color-secondary)", fontSize: 11 }}>
        {segDistLabel(seg)} · {seg.pace}/km
      </p>
    </div>
  );
}
