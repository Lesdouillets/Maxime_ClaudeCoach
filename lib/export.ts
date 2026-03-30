import { getSessions, getWeightHistory } from "./storage";
import type { WorkoutSession } from "./types";

export interface ExportData {
  exportedAt: string;
  athlete: string;
  sessions: WorkoutSession[];
  stats: {
    totalSessions: number;
    totalRuns: number;
    totalFitness: number;
    totalRunKm: number;
    last30DaySessions: number;
  };
  weightHistory: Array<{ date: string; kg: number }>;
}

export function buildExportData(): ExportData {
  const sessions = getSessions();
  const weightHistory = getWeightHistory();
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const runs = sessions.filter((s) => s.type === "run");
  const fitness = sessions.filter((s) => s.type === "fitness");
  const totalRunKm = runs.reduce((acc, s) => {
    if (s.type === "run") return acc + (s.distanceKm ?? 0);
    return acc;
  }, 0);

  const last30 = sessions.filter(
    (s) => new Date(s.date) >= thirtyDaysAgo
  ).length;

  return {
    exportedAt: now.toISOString(),
    athlete: "Maxime",
    sessions,
    stats: {
      totalSessions: sessions.length,
      totalRuns: runs.length,
      totalFitness: fitness.length,
      totalRunKm: Math.round(totalRunKm * 10) / 10,
      last30DaySessions: last30,
    },
    weightHistory,
  };
}

export function downloadExport(): void {
  const data = buildExportData();
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `sessions.json`;
  a.click();

  URL.revokeObjectURL(url);
}

export async function copyExportToClipboard(): Promise<void> {
  const data = buildExportData();
  const json = JSON.stringify(data, null, 2);
  await navigator.clipboard.writeText(json);
}
