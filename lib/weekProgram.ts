import type { SessionType, SessionStatus } from "@/components/SessionTag";
import type { WorkoutSession } from "./types";
import type { CoachWorkout, CoachRun } from "./coachPlan";

export interface DaySlot {
  date: string;
  letter: string;
  type: SessionType; // "rest" est inclus dans SessionType
  status: SessionStatus;
  isToday: boolean;
}

// Index 0 = lundi, en cohérence avec getMondayOfCurrentWeek (getDay() décalé)
const DAY_LETTERS = ["L", "M", "M", "J", "V", "S", "D"];

function getMondayOfCurrentWeek(todayStr: string): Date {
  const today = new Date(todayStr + "T00:00:00");
  const dayOfWeek = today.getDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(today);
  monday.setDate(today.getDate() - daysToMonday);
  return monday;
}

function toDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatWeekLabel(monday: Date, sunday: Date): string {
  const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) =>
    d.toLocaleDateString("fr-FR", opts);

  const sameMonth = monday.getMonth() === sunday.getMonth();

  const startStr = sameMonth
    ? fmt(monday, { day: "numeric" })
    : fmt(monday, { day: "numeric", month: "long" });

  const endStr = fmt(sunday, { day: "numeric", month: "long" });

  return `SEMAINE DU ${startStr} AU ${endStr}`.toUpperCase();
}

export function buildWeekDays(
  todayStr: string,
  coachWorkouts: CoachWorkout[],
  coachRuns: CoachRun[],
  sessions: WorkoutSession[],
): { days: DaySlot[]; weekLabel: string } {
  const monday = getMondayOfCurrentWeek(todayStr);

  const days: DaySlot[] = [];

  for (let i = 0; i < 7; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    const dateStr = toDateStr(date);
    const isToday = dateStr === todayStr;
    const isPast = dateStr < todayStr;

    const coachWorkout = coachWorkouts.find((cw) => cw.date === dateStr);
    const coachRun = coachRuns.find((cr) => cr.date === dateStr);

    let planType: SessionType | "rest" = "rest";
    if (coachWorkout) planType = "fitness";
    else if (coachRun) planType = coachRun.isRace ? "course" : "run";

    const doneSession = sessions.find((s) => s.date.slice(0, 10) === dateStr);

    let status: SessionStatus;
    if (isToday) {
      status = "today";
    } else if (!isPast) {
      status = "planned";
    } else {
      // jour passé — les jours repos restent "planned", pas de statut validé
      if (planType === "rest") {
        status = "planned";
      } else if (doneSession && doneSession.type === planType) {
        status = "done";
      } else {
        status = "missed";
      }
    }

    days.push({ date: dateStr, letter: DAY_LETTERS[i], type: planType, status, isToday });
  }

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return { days, weekLabel: formatWeekLabel(monday, sunday) };
}
