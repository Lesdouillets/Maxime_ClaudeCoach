"use client";

import Badge from "@/components/Badge";
import type { CoachRun, CoachRunInterval } from "@/lib/coachPlan";

interface Props {
  coachRun: CoachRun;
}

function parsePaceSec(pace: string): number {
  const [m, s] = pace.split(":").map(Number);
  return m * 60 + (s || 0);
}

function segDuration(seg: CoachRunInterval): string {
  const totalSec = seg.distanceKm * parsePaceSec(seg.pace) * (seg.reps ?? 1);
  const min = Math.floor(totalSec / 60);
  const sec = Math.round(totalSec % 60);
  return sec === 0 ? `~${min} min` : `~${min}min${sec.toString().padStart(2, "0")}`;
}

function segDistLabel(seg: CoachRunInterval): string {
  const d = seg.distanceKm < 1
    ? `${seg.distanceKm * 1000}m`
    : `${seg.distanceKm}km`;
  return seg.reps ? `${seg.reps}×${d}` : d;
}

export default function CoachRunPlan({ coachRun }: Props) {
  return (
    <div className="rounded-2xl p-4" style={{ background: "rgba(57,255,20,0.04)", border: "1px solid rgba(57,255,20,0.15)" }}>
      <p className="text-[10px] font-bold tracking-widest mb-3" style={{ color: "#39ff14" }}>PLAN COACH</p>
      {coachRun.intervals && coachRun.intervals.length > 0 ? (
        <div className="space-y-3">
          {coachRun.intervals.map((seg, i) => (
            <div key={i} className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium">{seg.label ?? segDistLabel(seg)}</p>
                {seg.label && (
                  <p className="text-xs mt-0.5" style={{ color: "#555" }}>{segDistLabel(seg)}</p>
                )}
              </div>
              <div className="text-right ml-4">
                <p className="text-sm font-semibold" style={{ color: "#ccc" }}>{segDuration(seg)}</p>
                <p className="text-xs mt-0.5" style={{ color: "#555" }}>
                  {seg.pace}/km
                  {seg.targetHR && ` · ♥ ${seg.targetHR}`}
                </p>
                {seg.restSeconds && (
                  <p className="text-xs" style={{ color: "#555" }}>récup {seg.restSeconds}s</p>
                )}
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
