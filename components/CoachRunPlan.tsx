"use client";

import Badge from "@/components/Badge";
import type { CoachRun } from "@/lib/coachPlan";

interface Props {
  coachRun: CoachRun;
}

export default function CoachRunPlan({ coachRun }: Props) {
  return (
    <div className="rounded-2xl p-4" style={{ background: "rgba(57,255,20,0.04)", border: "1px solid rgba(57,255,20,0.15)" }}>
      <p className="text-[10px] font-bold tracking-widest mb-3" style={{ color: "#39ff14" }}>PLAN COACH</p>
      {coachRun.intervals && coachRun.intervals.length > 0 ? (
        <div className="space-y-2.5">
          {coachRun.intervals.map((seg, i) => (
            <div key={i} className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {seg.label ?? (seg.reps
                  ? `${seg.reps}×${seg.distanceKm < 1 ? `${seg.distanceKm * 1000}m` : `${seg.distanceKm}km`}`
                  : `${seg.distanceKm}km`)}
              </span>
              <div className="text-right text-xs" style={{ color: "#666" }}>
                <span>{seg.pace}/km</span>
                {seg.targetHR && <span className="ml-2">♥ {seg.targetHR}</span>}
                {seg.restSeconds && <span className="ml-2">récup {seg.restSeconds}s</span>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex gap-4 items-end">
          <div>
            <span className="font-display text-3xl" style={{ color: "#39ff14" }}>{coachRun.distanceKm}</span>
            <span className="text-xs text-muted ml-1">km</span>
          </div>
          <span className="font-display text-2xl" style={{ color: "#39ff14" }}>{coachRun.pace}/km</span>
          {coachRun.targetHR && <span className="text-sm text-muted self-end mb-1">♥ {coachRun.targetHR}</span>}
          {coachRun.targetZone && <Badge label={coachRun.targetZone} variant="neon" />}
        </div>
      )}
    </div>
  );
}
