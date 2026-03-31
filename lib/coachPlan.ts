import type { FitnessCategory } from "./types";

// ─── Types ────────────────────────────────────────────────────────────────────

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
  date: string;           // "YYYY-MM-DD" ou "next-monday" etc.
  category: FitnessCategory;
  label: string;
  coachNote?: string;
  exercises: CoachExercise[];
}

// ─── Storage ──────────────────────────────────────────────────────────────────

const KEY = "cc_coach_workouts";

export function getCoachWorkouts(): CoachWorkout[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCoachWorkouts(workouts: CoachWorkout[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(workouts));
}

export function addCoachWorkout(workout: CoachWorkout): void {
  const existing = getCoachWorkouts();
  // Replace if same date+category
  const idx = existing.findIndex(
    (w) => w.date === workout.date && w.category === workout.category
  );
  if (idx !== -1) existing[idx] = workout;
  else existing.unshift(workout);
  saveCoachWorkouts(existing);
}

export function deleteCoachWorkout(id: string): void {
  saveCoachWorkouts(getCoachWorkouts().filter((w) => w.id !== id));
}

/** Get the coach plan for today (or the closest upcoming one) */
export function getTodayCoachWorkout(): CoachWorkout | null {
  const workouts = getCoachWorkouts();
  const today = new Date().toISOString().slice(0, 10);
  return workouts.find((w) => w.date === today) ?? workouts[0] ?? null;
}

// ─── JSON Parser ──────────────────────────────────────────────────────────────

function parseOne(data: Record<string, unknown>, index = 0): CoachWorkout {
  if (!data.exercises || !Array.isArray(data.exercises)) {
    throw new Error("Chaque séance doit contenir un tableau 'exercises'.");
  }
  return {
    id: `coach-${Date.now()}-${index}`,
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

/** Parse one or multiple coach workouts from a JSON string pasted by the user */
export function parseCoachWorkoutJSON(raw: string): CoachWorkout[] {
  const data = JSON.parse(raw.trim());
  if (Array.isArray(data)) {
    return data.map((item, i) => parseOne(item as Record<string, unknown>, i));
  }
  return [parseOne(data as Record<string, unknown>)];
}

// ─── Example JSON for coach ───────────────────────────────────────────────────

export const EXAMPLE_COACH_JSON = `{
  "date": "${new Date().toISOString().slice(0, 10)}",
  "category": "upper",
  "label": "HAUT DU CORPS",
  "coachNote": "Focus technique sur le rowing. Repos 90s entre séries.",
  "exercises": [
    { "name": "Développé couché", "sets": 4, "reps": 8, "weight": 80, "note": "Descendre lentement" },
    { "name": "Rowing barre", "sets": 4, "reps": 10, "weight": 60 },
    { "name": "Développé militaire", "sets": 3, "reps": 10, "weight": 50 },
    { "name": "Tractions", "sets": 3, "reps": 8, "weight": 0 },
    { "name": "Curl biceps", "sets": 3, "reps": 12, "weight": 14 },
    { "name": "Extension triceps", "sets": 3, "reps": 12, "weight": 20 }
  ]
}`;
