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
 * Returns coach plans from sessionDate (inclusive) up to `days` days from now.
 * Including the session's own date ensures past sessions still have their plan in context.
 */
function getCoachPlans(sessionDate: string, days: number): CoachPlan[] {
  const today = new Date().toISOString().slice(0, 10);
  const start = sessionDate < today ? sessionDate : today;
  const end = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const workouts = getCoachWorkouts().filter((w) => w.date >= start && w.date <= end);
  const runs = getCoachRuns().filter((r) => r.date >= start && r.date <= end);
  return [...workouts, ...runs].sort((a, b) => a.date.localeCompare(b.date));
}

/** Returns the last `limit` stored coach analyses, newest first. */
function getRecentCoachAnalyses(limit: number): Array<{ date: string; analysis: string }> {
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
 * Only fitness sessions are considered. Most recent session wins.
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
 * Keeps all other plan data intact so the coach can modify them.
 */
function annotatePlansWithDelta(plans: CoachPlan[], perfIndex: Map<string, number>): CoachPlan[] {
  return plans.map((plan) => {
    const p = plan as unknown as Record<string, unknown>;
    if (!Array.isArray(p.exercises)) return plan; // run plans: keep as-is
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

// Prevents firing two concurrent API calls for the same session (e.g. home page + day view both trigger).
const analyzingInFlight = new Set<string>();

/**
 * Sends the just-saved session to the Edge Function for AI analysis.
 * Applies any program changes returned by Claude.
 * Returns the result for display in the UI, or null if anything fails.
 */
export async function analyzeSession(session: WorkoutSession): Promise<CoachAnalysisResult | null> {
  if (analyzingInFlight.has(session.id)) return null;
  analyzingInFlight.add(session.id);
  try {
    const profile = getActiveProfile();
    const profileName = profile?.name ?? "Maxime";
    const allRecent = getSessions().slice(0, 11); // current + last 10 for perf index
    const recentSessions = allRecent.slice(1, 6); // last 5, excluding current session
    const sessionDateStr = session.date.slice(0, 10);
    const coachPlans = getCoachPlans(sessionDateStr, 7);
    const previousAnalyses = getRecentCoachAnalyses(3); // last 3 coach analyses for context

    // Enrich upcoming plans: replace verbose coachNotes with compact deltas (+X kg / maintenu / 1er essai)
    const perfIndex = buildPerfIndex(allRecent);
    const annotatedPlans = annotatePlansWithDelta(coachPlans, perfIndex);

    const { data, error } = await supabase.functions.invoke("analyze-session", {
      body: { session, coachPlans: annotatedPlans, recentSessions, profileName, previousAnalyses },
    });

    if (error) {
      console.error("[analyzeSession] edge function error:", error);
      return null;
    }
    if (!data) {
      console.error("[analyzeSession] no data returned");
      return null;
    }

    // Apply modified plans via the same parser used for manual JSON imports
    const rawPlans: unknown[] = Array.isArray(data.modified_plans) ? data.modified_plans : [];
    let programChanged = false;
    let modifiedCount = 0;

    if (rawPlans.length > 0) {
      try {
        const parsed = parseCoachWorkoutJSON(JSON.stringify(rawPlans));
        for (const plan of parsed) {
          if (plan.type === "fitness") addCoachWorkout(plan);
          else addCoachRun(plan);
        }
        programChanged = true;
        modifiedCount = parsed.length;
      } catch {
        // Malformed response — skip silently
      }
    }

    const result: CoachAnalysisResult = {
      analysis: typeof data.analysis === "string" ? data.analysis : "",
      programChanged,
      modifiedCount,
    };

    // Persist to localStorage then sync to Supabase
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
