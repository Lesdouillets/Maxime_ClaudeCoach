import type { WorkoutSession } from "./types";
import type { CoachWorkout, CoachRun } from "./coachPlan";

export type WeekStatus = "validated" | "partial" | "empty" | "future";

export interface WeekResult {
  weekStart: string;
  weekEnd: string;
  status: WeekStatus;
  plannedCount: number;
  doneCount: number;
  isCurrent: boolean;
}

export interface StreakResult {
  streakCount: number;
  weeks: WeekResult[];
}

function toDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function getMondayOfWeek(weeksAgo: number): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysToMonday = today.getDay() === 0 ? 6 : today.getDay() - 1;
  const monday = new Date(today);
  monday.setDate(today.getDate() - daysToMonday - weeksAgo * 7);
  return monday;
}

function buildWeekResult(
  w: number,
  todayStr: string,
  sessions: WorkoutSession[],
  coachWorkouts: CoachWorkout[],
  coachRuns: CoachRun[],
): WeekResult {
  const monday = getMondayOfWeek(w);
  const sunday = addDays(monday, 6);
  const weekStart = toDateStr(monday);
  const weekEnd = toDateStr(sunday);
  const isCurrentWeek = w === 0;

  if (weekStart > todayStr) {
    return { weekStart, weekEnd, status: "future", plannedCount: 0, doneCount: 0, isCurrent: false };
  }

  const planned: { date: string; type: "fitness" | "run" }[] = [
    ...coachWorkouts
      .filter((cw) => cw.date >= weekStart && cw.date <= weekEnd)
      .map((cw) => ({ date: cw.date, type: "fitness" as const })),
    ...coachRuns
      .filter((cr) => cr.date >= weekStart && cr.date <= weekEnd)
      .map((cr) => ({ date: cr.date, type: "run" as const })),
  ];

  // Pour la semaine en cours, on ne compte que les séances prévues jusqu'à aujourd'hui
  const relevantPlanned = isCurrentWeek
    ? planned.filter((p) => p.date <= todayStr)
    : planned;

  const doneCount = relevantPlanned.filter((p) =>
    sessions.some((s) => s.date.slice(0, 10) === p.date && s.type === p.type)
  ).length;

  let status: WeekStatus;
  if (relevantPlanned.length === 0) {
    // Semaine sans séance planifiée : on ne pénalise pas (ex. vacances), la série continue
    status = isCurrentWeek ? "partial" : "validated";
  } else if (doneCount >= relevantPlanned.length) {
    status = "validated";
  } else if (isCurrentWeek) {
    status = "partial";
  } else {
    status = "empty";
  }

  return { weekStart, weekEnd, status, plannedCount: planned.length, doneCount, isCurrent: isCurrentWeek };
}

export function computeStreak(
  sessions: WorkoutSession[],
  coachWorkouts: CoachWorkout[],
  coachRuns: CoachRun[],
  displayWeeks = 8,
  maxLookback = 104,
): StreakResult {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = toDateStr(today);

  // Les 8 semaines affichées dans la barre visuelle
  const weeks: WeekResult[] = [];
  for (let w = displayWeeks - 1; w >= 0; w--) {
    weeks.push(buildWeekResult(w, todayStr, sessions, coachWorkouts, coachRuns));
  }

  // Compteur réel : remonte jusqu'à maxLookback semaines pour trouver la vraie série
  let streakCount = 0;
  for (let w = 1; w <= maxLookback; w++) {
    const { status } = buildWeekResult(w, todayStr, sessions, coachWorkouts, coachRuns);
    if (status === "validated") { streakCount++; continue; }
    break; // "empty" ou "partial" casse la série
  }

  return { streakCount, weeks };
}
