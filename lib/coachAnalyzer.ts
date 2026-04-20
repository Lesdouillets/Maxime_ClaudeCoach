// Client-side trigger for the AI coach analysis.
// Called after every session save — fully async, never blocks the UI.

import { supabase } from "./supabase";
import { getSessions } from "./storage";
import { getCoachWorkouts, getCoachRuns, addCoachWorkout, addCoachRun, parseCoachWorkoutJSON } from "./coachPlan";
import { autoSyncPush } from "./sync";
import { getActiveProfile } from "./profiles";
import type { WorkoutSession, FitnessSession } from "./types";
import type { CoachPlan } from "./coachPlan";

export interface CoachAnalysisResult {
  analysis: string;
  programChanged: boolean;
  modifiedCount: number;
}

export function storeCoachAnalysis(date: string, result: CoachAnalysisResult): void {
  try { localStorage.setItem(`cc_coach_analysis_${date}`, JSON.stringify(result)); } catch {}
}

export function getStoredCoachAnalysis(date: string): CoachAnalysisResult | null {
  try {
    const raw = localStorage.getItem(`cc_coach_analysis_${date}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.analysis === "string") return parsed as CoachAnalysisResult;
    return null;
  } catch { return null; }
}

/**
 * Returns all future coach plans from sessionDate onwards (up to 28 days).
 */
function getCoachPlans(sessionDate: string): CoachPlan[] {
  const today = new Date().toISOString().slice(0, 10);
  const start = sessionDate < today ? sessionDate : today;
  const end = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const workouts = getCoachWorkouts().filter((w) => w.date >= start && w.date <= end);
  const runs = getCoachRuns().filter((r) => r.date >= start && r.date <= end);
  return [...workouts, ...runs].sort((a, b) => a.date.localeCompare(b.date));
}

/** Returns the last `limit` stored coach analyses, newest first. */
export function getRecentCoachAnalyses(limit: number): Array<{ date: string; analysis: string }> {
  const analyses: Array<{ date: string; analysis: string }> = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith("cc_coach_analysis_")) continue;
      const date = key.replace("cc_coach_analysis_", "");
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (typeof parsed?.analysis === "string" && parsed.analysis) {
        analyses.push({ date, analysis: parsed.analysis });
      }
    }
  } catch {}
  return analyses
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
}

/**
 * Builds an index of last recorded weight per exercise name from recent sessions.
 */
function buildPerfIndex(sessions: WorkoutSession[]): Map<string, number> {
  const index = new Map<string, number>();
  for (const session of sessions) {
    if (session.type !== "fitness") continue;
    for (const ex of (session as FitnessSession).exercises) {
      if (!index.has(ex.name) && typeof ex.weight === "number") {
        index.set(ex.name, ex.weight);
      }
    }
  }
  return index;
}

/**
 * Strips plan-level coachNote and replaces exercise-level coachNote with a
 * short delta label vs last recorded performance: "+2 kg", "maintenu", "1er essai".
 */
function annotatePlansWithDelta(plans: CoachPlan[], perfIndex: Map<string, number>): CoachPlan[] {
  return plans.map((plan) => {
    const p = plan as unknown as Record<string, unknown>;
    if (!Array.isArray(p.exercises)) return plan;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { coachNote: _note, ...planCore } = p;
    return {
      ...planCore,
      exercises: (p.exercises as Array<Record<string, unknown>>).map((ex) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { coachNote: _cn, ...exCore } = ex;
        const lastWeight = perfIndex.get(ex.name as string);
        if (lastWeight === undefined || typeof ex.weight !== "number") return exCore;
        const delta = (ex.weight as number) - lastWeight;
        const label = delta > 0 ? `+${delta} kg` : delta < 0 ? `${delta} kg` : "maintenu";
        return { ...exCore, delta: label };
      }),
    } as unknown as CoachPlan;
  });
}

/** Format pace from seconds/km to "M:SS" string */
function formatPace(secPerKm: number): string {
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Compact text representation of a session — used by coachChat.ts for token efficiency */
export function compactSession(s: WorkoutSession): string {
  if (s.type === "run") {
    const parts: string[] = [`${s.date.slice(0, 10)}: Run`];
    if (s.distanceKm) parts.push(`${s.distanceKm}km`);
    if (s.avgPaceSecPerKm) parts.push(`${formatPace(s.avgPaceSecPerKm)}/km`);
    if (s.avgHeartRate) parts.push(`HR${s.avgHeartRate}`);
    if (s.elevationGainM) parts.push(`D+${s.elevationGainM}m`);
    if (s.targetZone) parts.push(s.targetZone);
    if (s.comment) parts.push(`"${s.comment}"`);
    return parts.join(" ");
  }
  const exSummary = s.exercises
    .slice(0, 4)
    .map((ex) => `${ex.name} ${ex.sets}x${ex.reps}@${ex.weight}kg`)
    .join(", ");
  const parts: string[] = [`${s.date.slice(0, 10)}: ${s.category === "lower" ? "Lower" : "Upper"}`];
  if (exSummary) parts.push(`(${exSummary})`);
  if (s.comment) parts.push(`"${s.comment}"`);
  return parts.join(" ");
}

// Prevents firing two concurrent API calls for the same session.
const analyzingInFlight = new Set<string>();

export async function analyzeSession(session: WorkoutSession, chatContext?: string): Promise<CoachAnalysisResult | null> {
  if (analyzingInFlight.has(session.id)) return null;
  analyzingInFlight.add(session.id);
  try {
    const profile = getActiveProfile();
    const profileName = profile?.name ?? "Maxime";
    const allRecent = getSessions().slice(0, 11);
    const recentSessions = allRecent.slice(1, 6);
    const sessionDateStr = session.date.slice(0, 10);
    const coachPlans = getCoachPlans(sessionDateStr);
    const previousAnalyses = getRecentCoachAnalyses(3);

    const sentPlanIds = new Set(coachPlans.map((p) => p.id));
    const perfIndex = buildPerfIndex(allRecent);
    const annotatedPlans = annotatePlansWithDelta(coachPlans, perfIndex);

    const { data, error } = await supabase.functions.invoke("analyze-session", {
      body: { session, coachPlans: annotatedPlans, recentSessions, profileName, previousAnalyses, chatContext },
    });

    if (error) {
      console.error("[analyzeSession] edge function error:", error);
      return null;
    }
    if (!data) {
      console.error("[analyzeSession] no data returned");
      return null;
    }

    const rawPlans: unknown[] = Array.isArray(data.modified_plans) ? data.modified_plans : [];
    let programChanged = false;
    let modifiedCount = 0;

    if (rawPlans.length > 0) {
      try {
        const parsed = parseCoachWorkoutJSON(JSON.stringify(rawPlans));

        // Collapse any duplicates the coach may have returned for the same slot
        // (date + category, or date for runs). Last wins — coach typically puts
        // the canonical replacement last after listing anything to clean up.
        const bySlot = new Map<string, typeof parsed[number]>();
        for (const plan of parsed) {
          const slot = plan.type === "fitness"
            ? `${plan.date}-${(plan as { category: string }).category}`
            : `${plan.date}-run`;
          bySlot.set(slot, plan);
        }
        const deduped = Array.from(bySlot.values());
        if (deduped.length !== parsed.length) {
          console.warn(`[analyzeSession] collapsed ${parsed.length - deduped.length} same-slot duplicate plans from coach response`);
        }

        // Phantom guard: if the coach returns a brand new id at a slot that already
        // has a plan we did NOT send (eg. race with older local state), drop it.
        const existingByKey = new Set([
          ...getCoachWorkouts().map((w) => `${w.date}-${w.category}`),
          ...getCoachRuns().map((r) => `${r.date}-run`),
        ]);
        const safe = deduped.filter((plan) => {
          if (sentPlanIds.has(plan.id)) return true;
          const key = plan.type === "fitness"
            ? `${plan.date}-${(plan as { category: string }).category}`
            : `${plan.date}-run`;
          if (existingByKey.has(key)) {
            console.warn("[analyzeSession] ignoring phantom plan at occupied slot:", plan.id, key);
            return false;
          }
          return true;
        });
        for (const plan of safe) {
          if (plan.type === "fitness") addCoachWorkout(plan);
          else addCoachRun(plan);
        }
        programChanged = safe.length > 0;
        modifiedCount = safe.length;
      } catch (e) {
        console.error("[analyzeSession] failed to apply modified_plans:", e, JSON.stringify(rawPlans));
      }
    } else {
      console.log("[analyzeSession] coach returned no modified_plans — program unchanged");
    }

    const result: CoachAnalysisResult = {
      analysis: typeof data.analysis === "string" ? data.analysis : "",
      programChanged,
      modifiedCount,
    };

    storeCoachAnalysis(session.date.slice(0, 10), result);
    await autoSyncPush();

    return result;
  } catch (e) {
    console.error("[analyzeSession] unexpected error:", e);
    return null;
  } finally {
    analyzingInFlight.delete(session.id);
  }
}
