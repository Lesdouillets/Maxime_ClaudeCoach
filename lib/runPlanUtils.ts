import type { CoachRunInterval } from "@/lib/coachPlan";

export function parsePaceSec(pace: string): number {
  const [m, s] = pace.split(":").map(Number);
  return m * 60 + (s || 0);
}

export function segDuration(seg: CoachRunInterval): string {
  const totalSec = seg.distanceKm * parsePaceSec(seg.pace) * (seg.reps ?? 1);
  const min = Math.floor(totalSec / 60);
  const sec = Math.round(totalSec % 60);
  return sec === 0 ? `~${min} min` : `~${min}min${sec.toString().padStart(2, "0")}`;
}

export function segDistLabel(seg: CoachRunInterval): string {
  const d = seg.distanceKm < 1
    ? `${seg.distanceKm * 1000}m`
    : `${seg.distanceKm}km`;
  return seg.reps ? `${seg.reps}×${d}` : d;
}
