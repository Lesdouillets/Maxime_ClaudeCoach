import type { CoachWorkout, CoachRun } from "./coachPlan";
import type { FitnessSession, RunSession } from "./types";

function mondayOfWeek(weeksAgo: number): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysToMonday = today.getDay() === 0 ? 6 : today.getDay() - 1;
  const monday = new Date(today);
  monday.setDate(today.getDate() - daysToMonday - weeksAgo * 7);
  return monday;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const UPPER_EXERCISES = [
  { name: "Développé couché",    sets: 4, reps: 8,  weight: 80  },
  { name: "Rowing barre",        sets: 4, reps: 10, weight: 60  },
  { name: "Tractions",           sets: 3, reps: 8,  weight: 0   },
  { name: "Développé épaules",   sets: 3, reps: 10, weight: 20  },
  { name: "Curl biceps",         sets: 3, reps: 12, weight: 14  },
  { name: "Triceps poulie",      sets: 3, reps: 12, weight: 25  },
];

const LOWER_EXERCISES = [
  { name: "Squat",               sets: 4, reps: 8,  weight: 100 },
  { name: "Romanian deadlift",   sets: 4, reps: 10, weight: 80  },
  { name: "Leg press",           sets: 3, reps: 12, weight: 140 },
  { name: "Fentes",              sets: 3, reps: 10, weight: 20  },
  { name: "Mollets",             sets: 4, reps: 15, weight: 60  },
  { name: "Leg curl",            sets: 3, reps: 12, weight: 40  },
];

function makeUpperPlan(date: string, weekIndex: number): CoachWorkout {
  return {
    id: `seed-upper-${weekIndex}`,
    type: "fitness",
    date,
    category: "upper",
    label: "Haut du corps",
    coachNote: "MONTEE EN CHARGE",
    exercises: UPPER_EXERCISES.map((ex) => ({
      ...ex,
      setPlans: Array.from({ length: ex.sets }, () => ({ weight: ex.weight, reps: ex.reps })),
    })),
  };
}

function makeLowerPlan(date: string, weekIndex: number): CoachWorkout {
  return {
    id: `seed-lower-${weekIndex}`,
    type: "fitness",
    date,
    category: "lower",
    label: "Bas du corps",
    coachNote: "DECHARGE",
    exercises: LOWER_EXERCISES.map((ex) => ({
      ...ex,
      setPlans: Array.from({ length: ex.sets }, () => ({ weight: ex.weight, reps: ex.reps })),
    })),
  };
}

function makeRunPlan(date: string, weekIndex: number): CoachRun {
  return {
    id: `seed-run-${weekIndex}`,
    type: "run",
    date,
    label: "Long Run",
    distanceKm: 16,
    pace: "5:37",
    targetZone: "LONG RUN",
    coachNote: "Sortie longue en zone 2, rythme confortable",
  };
}

function makeUpperSession(date: string, weekIndex: number): FitnessSession {
  return {
    id: `sess-upper-${weekIndex}`,
    type: "fitness",
    date: date + "T09:00:00",
    category: "upper",
    comment: "",
    coachWorkoutId: `seed-upper-${weekIndex}`,
    exercises: UPPER_EXERCISES.map((ex) => ({
      id: `ex-upper-${ex.name}-${weekIndex}`,
      name: ex.name,
      sets: ex.sets,
      reps: ex.reps,
      weight: ex.weight,
      comment: "",
      setLogs: Array.from({ length: ex.sets }, () => ({ weight: ex.weight, reps: ex.reps, done: true })),
    })),
  };
}

function makeLowerSession(date: string, weekIndex: number): FitnessSession {
  return {
    id: `sess-lower-${weekIndex}`,
    type: "fitness",
    date: date + "T09:00:00",
    category: "lower",
    comment: "",
    coachWorkoutId: `seed-lower-${weekIndex}`,
    exercises: LOWER_EXERCISES.map((ex) => ({
      id: `ex-lower-${ex.name}-${weekIndex}`,
      name: ex.name,
      sets: ex.sets,
      reps: ex.reps,
      weight: ex.weight,
      comment: "",
      setLogs: Array.from({ length: ex.sets }, () => ({ weight: ex.weight, reps: ex.reps, done: true })),
    })),
  };
}

function makeRunSession(date: string, weekIndex: number): RunSession {
  return {
    id: `sess-run-${weekIndex}`,
    type: "run",
    date: date + "T07:30:00",
    distanceKm: 16.2,
    durationSeconds: 5467,
    avgPaceSecPerKm: 337,
    avgHeartRate: 148,
    comment: "",
  };
}

export function seedLocalStorage(): void {
  const plans: CoachWorkout[] = [];
  const runPlans: CoachRun[] = [];
  const sessions: (FitnessSession | RunSession)[] = [];

  const todayStr = toStr(new Date());

  // Plage : w=7 (7 semaines passées) → w=-3 (3 semaines futures)
  // Semaines w=1 à w=5  : toutes les séances faites → streak intact
  // Semaines w=6 et w=7 : plans seulement, aucune session → streak cassé
  // Semaine courante w=0 : lundi fait (si passé), reste à venir
  // Semaines w=-1 à w=-3 : plans seulement → état "à venir"
  for (let w = 7; w >= -3; w--) {
    const monday = mondayOfWeek(w);
    const upperDate = toStr(monday);
    const lowerDate = toStr(addDays(monday, 2)); // mercredi
    const runDate   = toStr(addDays(monday, 3)); // jeudi

    plans.push(makeUpperPlan(upperDate, w));
    plans.push(makeLowerPlan(lowerDate, w));
    runPlans.push(makeRunPlan(runDate, w));

    const allDone = w >= 1 && w <= 5;
    const isCurrentWeek = w === 0;

    if (allDone) {
      sessions.push(makeUpperSession(upperDate, w));
      sessions.push(makeLowerSession(lowerDate, w));
      sessions.push(makeRunSession(runDate, w));
    } else if (isCurrentWeek) {
      // Toutes les séances passées de la semaine courante sont faites
      if (upperDate < todayStr) sessions.push(makeUpperSession(upperDate, w));
      if (lowerDate < todayStr) sessions.push(makeLowerSession(lowerDate, w));
      if (runDate < todayStr)   sessions.push(makeRunSession(runDate, w));
      // Aujourd'hui et jours futurs → plan seul (état "aujourd'hui" ou "à venir")
    }
    // w=6, w=7 : aucune session → streak cassé
    // w<0 : aucune session → séances à venir
  }

  localStorage.setItem("cc_coach_workouts", JSON.stringify(plans));
  localStorage.setItem("cc_coach_runs", JSON.stringify(runPlans));
  localStorage.setItem("cc_sessions", JSON.stringify(sessions));
  localStorage.removeItem("cc_cancelled_days");
  localStorage.removeItem("cc_rescheduled_days");
}

export function clearSeedData(): void {
  ["cc_coach_workouts", "cc_coach_runs", "cc_sessions",
   "cc_chat_history", "cc_cancelled_days", "cc_rescheduled_days",
  ].forEach((k) => localStorage.removeItem(k));
  // Les clés d'analyse sont de la forme cc_coach_analysis_{date} — on ne peut pas les supprimer unitairement
  Object.keys(localStorage)
    .filter((k) => k.startsWith("cc_coach_analysis_"))
    .forEach((k) => localStorage.removeItem(k));
}
