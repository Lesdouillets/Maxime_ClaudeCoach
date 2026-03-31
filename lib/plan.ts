import type { PlannedDay } from "./types";

// Fixed weekly plan: Mon=fitness(upper), Wed=run, Thu=fitness(lower), Sun=run
export const WEEKLY_PLAN: PlannedDay[] = [
  {
    dayOfWeek: 1, // Monday
    type: "fitness",
    category: "upper",
    label: "HAUT DU CORPS",
    targetDescription: "Développé couché, tractions, rowing. Focus force.",
  },
  {
    dayOfWeek: 3, // Wednesday
    type: "run",
    label: "RUN Z2",
    targetDescription: "Zone 2 facile. Conversation possible.",
    targetDistanceKm: 8,
    targetPaceSecPerKm: 360, // 6:00/km
    targetZone: "Z2",
  },
  {
    dayOfWeek: 4, // Thursday
    type: "fitness",
    category: "lower",
    label: "BAS DU CORPS",
    targetDescription: "Squat, soulevé de terre, fentes. Focus puissance.",
  },
  {
    dayOfWeek: 0, // Sunday
    type: "run",
    label: "LONG RUN",
    targetDescription: "Sortie longue en Z2. Construire l'endurance.",
    targetDistanceKm: 14,
    targetPaceSecPerKm: 375, // 6:15/km
    targetZone: "Z2",
  },
];

const DAY_NAMES_FR = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const DAY_NAMES_FULL = [
  "Dimanche",
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
];

export function getTodayPlan(): PlannedDay | null {
  const today = new Date().getDay() as PlannedDay["dayOfWeek"];
  return WEEKLY_PLAN.find((p) => p.dayOfWeek === today) ?? null;
}

export function getDayName(dow: number, full = false): string {
  return full ? DAY_NAMES_FULL[dow] : DAY_NAMES_FR[dow];
}

export function formatPace(secPerKm: number): string {
  const min = Math.floor(secPerKm / 60);
  const sec = secPerKm % 60;
  return `${min}:${sec.toString().padStart(2, "0")}/km`;
}

/** Format a Date to "YYYY-MM-DD" using local time (avoids UTC offset issues) */
export function toLocalDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export type WeekDay = {
  date: Date;
  dow: number;
  plan: PlannedDay | null;
  label: string;
  isToday: boolean;
  isPast: boolean;
};

export function getWeekDays(weekOffset = 0): WeekDay[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Start from Monday of current week
  const startOfWeek = new Date(today);
  const dow = today.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  startOfWeek.setDate(today.getDate() + diff + weekOffset * 7);

  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + i);
    const d = date.getDay();
    return {
      date,
      dow: d,
      plan: WEEKLY_PLAN.find((p) => p.dayOfWeek === d) ?? null,
      label: DAY_NAMES_FR[d],
      isToday: date.getTime() === today.getTime(),
      isPast: date < today,
    };
  });
}

export function getThisWeekDays(): WeekDay[] {
  return getWeekDays(0);
}
