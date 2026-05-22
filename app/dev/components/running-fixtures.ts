// app/dev/components/running-fixtures.ts
import type { CoachRun } from "@/lib/coachPlan";
import type { RunSession } from "@/lib/types";

export const FIXTURE_RUN_CLASSIC: CoachRun = {
  id: "dev-run-classic",
  type: "run",
  date: "2026-05-22",
  label: "Sortie Longue",
  distanceKm: 16,
  durationMin: 90,
  pace: "5:37",
  targetHR: "112-149",
  runType: "z2",
};

export const FIXTURE_RUN_INTERVAL: CoachRun = {
  id: "dev-run-interval",
  type: "run",
  date: "2026-05-22",
  label: "10×400m",
  distanceKm: 8.5,
  durationMin: 48,
  runType: "fractionne",
  intervals: [
    { label: "Échauffement", distanceKm: 2, pace: "6:00" },
    { label: "Répétitions", reps: 10, distanceKm: 0.4, pace: "4:10", restSeconds: 90 },
    { label: "Retour au calme", distanceKm: 1.5, pace: "6:30" },
  ],
};

export const FIXTURE_RUN_PROGRESSIVE: CoachRun = {
  id: "dev-run-progressive",
  type: "run",
  date: "2026-05-22",
  label: "Z2 - Z3 - Z4",
  distanceKm: 8.5,
  durationMin: 48,
  runType: "progressif",
  intervals: [
    { label: "Z2", distanceKm: 3, pace: "5:50", targetHR: "120-145" },
    { label: "Z3", distanceKm: 3, pace: "5:10", targetHR: "145-160" },
    { label: "Z4", distanceKm: 2.5, pace: "4:40", targetHR: "160-175" },
  ],
};

export const FIXTURE_DONE_RUN: RunSession = {
  id: "dev-done-run",
  type: "run",
  date: "2026-05-22T08:30:00",
  distanceKm: 16.2,
  durationSeconds: 5160,
  avgPaceSecPerKm: 319,
  avgHeartRate: 142,
  comment: "",
  importedFromStrava: true,
};
