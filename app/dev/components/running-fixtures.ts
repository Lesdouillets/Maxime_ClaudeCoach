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

export const FIXTURE_RUN_TEMPO: CoachRun = {
  id: "dev-run-tempo",
  type: "run",
  date: "2026-05-22",
  label: "Tempo",
  distanceKm: 8,
  durationMin: 42,
  runType: "tempo",
  intervals: [
    { label: "Échauffement", distanceKm: 2, pace: "6:00" },
    { label: "Tempo", distanceKm: 5, pace: "4:50", targetHR: "148-168" },
    { label: "Récup", distanceKm: 1, pace: "6:00" },
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
  elevationGainM: 187,
  comment: "",
  importedFromStrava: true,
  laps: [
    { lap_index: 1, name: "Lap 1", elapsed_time: 330, moving_time: 328, distance: 1000, average_speed: 3.05, average_heartrate: 128, total_elevation_gain: 8 },
    { lap_index: 2, name: "Lap 2", elapsed_time: 326, moving_time: 324, distance: 1000, average_speed: 3.09, average_heartrate: 133, total_elevation_gain: 5 },
    { lap_index: 3, name: "Lap 3", elapsed_time: 321, moving_time: 319, distance: 1000, average_speed: 3.13, average_heartrate: 136, total_elevation_gain: 22 },
    { lap_index: 4, name: "Lap 4", elapsed_time: 318, moving_time: 316, distance: 1000, average_speed: 3.16, average_heartrate: 139, total_elevation_gain: 14 },
    { lap_index: 5, name: "Lap 5", elapsed_time: 323, moving_time: 321, distance: 1000, average_speed: 3.12, average_heartrate: 141, total_elevation_gain: 31 },
    { lap_index: 6, name: "Lap 6", elapsed_time: 316, moving_time: 314, distance: 1000, average_speed: 3.18, average_heartrate: 144, total_elevation_gain: 6 },
    { lap_index: 7, name: "Lap 7", elapsed_time: 320, moving_time: 318, distance: 1000, average_speed: 3.14, average_heartrate: 146, total_elevation_gain: 19 },
    { lap_index: 8, name: "Lap 8", elapsed_time: 315, moving_time: 313, distance: 1000, average_speed: 3.19, average_heartrate: 148, total_elevation_gain: 11 },
    { lap_index: 9, name: "Lap 9", elapsed_time: 322, moving_time: 320, distance: 1000, average_speed: 3.13, average_heartrate: 149, total_elevation_gain: 28 },
    { lap_index: 10, name: "Lap 10", elapsed_time: 318, moving_time: 316, distance: 1000, average_speed: 3.16, average_heartrate: 150, total_elevation_gain: 7 },
    { lap_index: 11, name: "Lap 11", elapsed_time: 324, moving_time: 322, distance: 1000, average_speed: 3.10, average_heartrate: 143, total_elevation_gain: 16 },
    { lap_index: 12, name: "Lap 12", elapsed_time: 328, moving_time: 326, distance: 1000, average_speed: 3.06, average_heartrate: 140, total_elevation_gain: 9 },
    { lap_index: 13, name: "Lap 13", elapsed_time: 312, moving_time: 310, distance: 1000, average_speed: 3.22, average_heartrate: 142, total_elevation_gain: 4 },
    { lap_index: 14, name: "Lap 14", elapsed_time: 319, moving_time: 317, distance: 1000, average_speed: 3.15, average_heartrate: 141, total_elevation_gain: 12 },
    { lap_index: 15, name: "Lap 15", elapsed_time: 325, moving_time: 323, distance: 1000, average_speed: 3.10, average_heartrate: 138, total_elevation_gain: 3 },
    { lap_index: 16, name: "Lap 16", elapsed_time: 323, moving_time: 321, distance: 1200, average_speed: 3.12, average_heartrate: 135, total_elevation_gain: 2 },
  ],
};
