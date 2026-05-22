"use client";

import Badge from "@/components/Badge";
import { getRunBadge } from "@/lib/coachPlan";
import type { CoachRun } from "@/lib/coachPlan";
import { segDuration, segDistLabel } from "@/lib/runPlanUtils";
import { JETBRAINS_MONO_LABEL, JETBRAINS_MONO_DATA } from "@/lib/typography";

interface Props {
  coachRun: CoachRun;
}

export default function CoachRunPlan({ coachRun }: Props) {
  const badge = getRunBadge(coachRun);

  return (
    <div className="rounded-2xl p-4" style={{ background: "rgba(205,255,0,0.04)", border: "1px solid rgba(205,255,0,0.15)" }}>
      <p className="mb-3" style={{ ...JETBRAINS_MONO_LABEL, color: "#CDFF00" }}>PLAN COACH</p>

      <div className="flex items-center gap-2 mb-3">
        {badge && <Badge label={badge} variant="neon" />}
        <span className="text-sm font-bold">{coachRun.label}</span>
        {coachRun.durationMin != null && (
          <span className="text-xs ml-auto" style={{ color: "#888" }}>~{coachRun.durationMin} min</span>
        )}
      </div>

      {coachRun.intervals && coachRun.intervals.length > 0 ? (
        <div className="space-y-3">
          {coachRun.intervals.map((seg, i) => (
            <div key={i} className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium">{seg.label ?? segDistLabel(seg)}</p>
                {seg.label && (
                  <p className="mt-0.5" style={JETBRAINS_MONO_DATA}>{segDistLabel(seg)}</p>
                )}
              </div>
              <div className="text-right ml-4">
                <p className="text-sm font-semibold" style={{ color: "#ccc" }}>{segDuration(seg)}</p>
                <p className="mt-0.5" style={JETBRAINS_MONO_DATA}>
                  {seg.pace}/km
                  {seg.targetHR && ` · ♥ ${seg.targetHR}`}
                </p>
                {seg.restSeconds && (
                  <p style={JETBRAINS_MONO_DATA}>récup {seg.restSeconds}s</p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex gap-4 items-end">
          <div>
            <span className="font-display text-3xl" style={{ color: "#CDFF00" }}>{coachRun.distanceKm}</span>
            <span className="text-xs text-muted ml-1">km</span>
          </div>
          <span className="font-display text-2xl" style={{ color: "#CDFF00" }}>{coachRun.pace}/km</span>
          {coachRun.targetHR && <span className="text-sm text-muted self-end mb-1">♥ {coachRun.targetHR}</span>}
        </div>
      )}
    </div>
  );
}
