import type { CoachRunInterval } from "@/lib/coachPlan";

export function parsePaceSec(pace: string): number {
  const parts = pace.split(":");
  if (parts.length !== 2) return 0;
  const [m, s] = parts.map(Number);
  if (isNaN(m) || isNaN(s)) return 0;
  return m * 60 + s;
}

export function segDuration(seg: CoachRunInterval): string {
  const totalSec = seg.distanceKm * parsePaceSec(seg.pace) * (seg.reps ?? 1);
  const min = Math.round(totalSec / 60);
  return `~${min} min`;
}

export function segDistOnly(seg: CoachRunInterval): string {
  return seg.distanceKm < 1
    ? `${Math.round(seg.distanceKm * 1000)} m`
    : `${seg.distanceKm} km`;
}

export function segDistLabel(seg: CoachRunInterval): string {
  const d = seg.distanceKm < 1
    ? `${Math.round(seg.distanceKm * 1000)}m`
    : `${seg.distanceKm}km`;
  return seg.reps ? `${seg.reps}×${d}` : d;
}
