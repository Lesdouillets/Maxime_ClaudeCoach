"use client";

import type { CoachRun } from "@/lib/coachPlan";
import { JETBRAINS_MONO_DATA } from "@/lib/typography";
import { segDuration, segDistLabel } from "@/lib/runPlanUtils";

interface Props {
  coachRun: CoachRun;
}

export default function RunPlanProgressive({ coachRun }: Props) {
  if (!coachRun.intervals?.length) return null;

  return (
    <div className="space-y-2">
      {coachRun.intervals.map((seg, i) => {
        const parts = [
          segDistLabel(seg),
          seg.pace ? `${seg.pace}/km` : null,
          seg.targetHR ? `${seg.targetHR} FC` : null,
        ].filter(Boolean).join(" · ");

        return (
          <div
            key={i}
            className="rounded-2xl px-4 py-4"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-subtle)" }}
          >
            <div className="flex items-baseline justify-between">
              <p className="font-display leading-none" style={{ fontSize: 16, color: "#fff" }}>
                {seg.label ?? `Bloc ${i + 1}`}
              </p>
              <span className="font-display leading-none" style={{ fontSize: 16, color: "#fff" }}>
                {segDuration(seg)}
              </span>
            </div>
            <p className="mt-2" style={{ ...JETBRAINS_MONO_DATA, color: "var(--color-secondary)", fontSize: 11 }}>
              {parts}
            </p>
          </div>
        );
      })}
    </div>
  );
}
