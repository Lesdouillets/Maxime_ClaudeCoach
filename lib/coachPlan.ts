import type { FitnessCategory } from "./types";

// ─── Fitness types ────────────────────────────────────────────────────────────

export interface CoachExercise {
  name: string;
  sets: number;
  reps: number;
  weight: number;
  restSeconds?: number;
  coachNote?: string;
}

export interface CoachWorkout {
  id: string;
  type: "fitness";
  date: string;
  category: FitnessCategory;
  label: string;
  coachNote?: string;
  exercises: CoachExercise[];
}

// ─── Run types ────────────────────────────────────────────────────────────────

export interface CoachRunInterval {
  label?: string;       // "Échauffement", "Retour au calme"
  reps?: number;        // for repeated intervals
  distanceKm: number;
  pace: string;         // "6:00" (min:sec per km)
  targetHR?: string;    // "130-150" or "165-175"
  restSeconds?: number;
  note?: string;
}

export interface CoachRun {
  id: string;
  type: "run";
  date: string;
  label: string;
  coachNote?: string;
  distanceKm: number;
  pace: string;         // target pace "6:00"
  targetHR?: string;    // "130-150"
  targetZone?: string;  // "Z2", "Z3", "Z4"
  intervals?: CoachRunInterval[];
}

export type CoachPlan = CoachWorkout | CoachRun;

// ─── Storage ──────────────────────────────────────────────────────────────────

const KEY_WORKOUTS = "cc_coach_workouts";
const KEY_RUNS = "cc_coach_runs";

export function getCoachWorkouts(): CoachWorkout[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY_WORKOUTS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    // backward compat: old entries may not have type field
    return parsed.map((w: CoachWorkout) => ({ ...w, type: "fitness" as const }));
  } catch { return []; }
}

export function saveCoachWorkouts(workouts: CoachWorkout[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY_WORKOUTS, JSON.stringify(workouts));
}

export function addCoachWorkout(workout: CoachWorkout): void {
  const existing = getCoachWorkouts();
  const idx = existing.findIndex((w) => w.date === workout.date && w.category === workout.category);
  if (idx !== -1) existing[idx] = workout;
  else existing.unshift(workout);
  saveCoachWorkouts(existing);
}

export function deleteCoachWorkout(id: string): void {
  saveCoachWorkouts(getCoachWorkouts().filter((w) => w.id !== id));
}

export function getCoachRuns(): CoachRun[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY_RUNS);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveCoachRuns(runs: CoachRun[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY_RUNS, JSON.stringify(runs));
}

export function addCoachRun(run: CoachRun): void {
  const existing = getCoachRuns().filter((r) => r.date !== run.date);
  existing.unshift(run);
  saveCoachRuns(existing);
}

export function deleteCoachRun(id: string): void {
  saveCoachRuns(getCoachRuns().filter((r) => r.id !== id));
}

/** Clear all future coach plans (date >= today). Past sessions in cc_sessions are untouched. */
export function clearFutureCoachPlans(): void {
  const today = new Date().toISOString().slice(0, 10);
  saveCoachWorkouts(getCoachWorkouts().filter((w) => w.date < today));
  saveCoachRuns(getCoachRuns().filter((r) => r.date < today));
}

/** Get all coach plans (fitness + run) for a given date */
export function getCoachPlansForDate(date: string): CoachPlan[] {
  return [
    ...getCoachWorkouts().filter((w) => w.date === date),
    ...getCoachRuns().filter((r) => r.date === date),
  ];
}

/** Get the coach plan for today (or the closest upcoming one) */
export function getTodayCoachWorkout(): CoachWorkout | null {
  const workouts = getCoachWorkouts();
  const today = new Date().toISOString().slice(0, 10);
  return workouts.find((w) => w.date === today) ?? workouts[0] ?? null;
}

// ─── JSON Parser ──────────────────────────────────────────────────────────────

function parseFitness(data: Record<string, unknown>, index = 0): CoachWorkout {
  if (!data.exercises || !Array.isArray(data.exercises)) {
    throw new Error("Séance fitness : 'exercises' manquant.");
  }
  return {
    id: `coach-${Date.now()}-${index}`,
    type: "fitness",
    date: String(data.date ?? new Date().toISOString().slice(0, 10)),
    category: data.category === "lower" ? "lower" : "upper",
    label: String(data.label ?? (data.category === "lower" ? "BAS DU CORPS" : "HAUT DU CORPS")),
    coachNote: data.coachNote != null ? String(data.coachNote) : (data.note != null ? String(data.note) : undefined),
    exercises: (data.exercises as Record<string, unknown>[]).map((ex) => ({
      name: String(ex.name ?? ""),
      sets: Number(ex.sets ?? 3),
      reps: Number(ex.reps ?? 10),
      weight: Number(ex.weight ?? 0),
      restSeconds: ex.rest ? Number(ex.rest) : undefined,
      coachNote: ex.note ? String(ex.note) : undefined,
    })),
  };
}

function parseRun(data: Record<string, unknown>, index = 0): CoachRun {
  return {
    id: `coach-run-${Date.now()}-${index}`,
    type: "run",
    date: String(data.date ?? new Date().toISOString().slice(0, 10)),
    label: String(data.label ?? "RUN"),
    coachNote: data.coachNote != null ? String(data.coachNote) : undefined,
    distanceKm: Number(data.distance ?? data.distanceKm ?? 0),
    pace: String(data.pace ?? "6:00"),
    targetHR: data.targetHR != null ? String(data.targetHR) : undefined,
    targetZone: data.targetZone != null ? String(data.targetZone) : undefined,
    intervals: Array.isArray(data.intervals)
      ? (data.intervals as Record<string, unknown>[]).map((seg) => ({
          label: seg.label != null ? String(seg.label) : undefined,
          reps: seg.reps != null ? Number(seg.reps) : undefined,
          distanceKm: Number(seg.distance ?? seg.distanceKm ?? 0),
          pace: String(seg.pace ?? "6:00"),
          targetHR: seg.targetHR != null ? String(seg.targetHR) : undefined,
          restSeconds: seg.rest != null ? Number(seg.rest) : undefined,
          note: seg.note != null ? String(seg.note) : undefined,
        }))
      : undefined,
  };
}

function parseOne(data: Record<string, unknown>, index = 0): CoachPlan {
  if (data.type === "run") return parseRun(data, index);
  return parseFitness(data, index);
}

/** Parse one or multiple coach plans from a JSON string pasted by the user */
export function parseCoachWorkoutJSON(raw: string): CoachPlan[] {
  const data = JSON.parse(raw.trim());
  if (Array.isArray(data)) {
    return data.map((item, i) => parseOne(item as Record<string, unknown>, i));
  }
  return [parseOne(data as Record<string, unknown>)];
}

// ─── Example JSON ─────────────────────────────────────────────────────────────

export const EXAMPLE_COACH_JSON = `{
  "date": "${new Date().toISOString().slice(0, 10)}",
  "category": "upper",
  "label": "HAUT DU CORPS",
  "coachNote": "Focus technique sur le rowing. Repos 90s entre séries.",
  "exercises": [
    { "name": "Développé couché", "sets": 4, "reps": 8, "weight": 80, "note": "Descendre lentement" },
    { "name": "Rowing barre", "sets": 4, "reps": 10, "weight": 60 },
    { "name": "Tractions", "sets": 3, "reps": 8, "weight": 0 },
    { "name": "Curl biceps", "sets": 3, "reps": 12, "weight": 14 }
  ]
}`;
