// Client-side trigger for the AI coach analysis.
// Called after every session save — fully async, never blocks the UI.

import { supabase } from "./supabase";
import { getSessions } from "./storage";
import { getCoachWorkouts, getCoachRuns, addCoachWorkout, addCoachRun, parseCoachWorkoutJSON } from "./coachPlan";
import { autoSyncPush } from "./sync";
import { getActiveProfile } from "./profiles";
import type { WorkoutSession } from "./types";
import type { CoachPlan } from "./coachPlan";

export interface CoachAnalysisResult {
  analysis: string;
  programChanged: boolean;
}

/** Returns upcoming coach plans (workouts + runs) sorted by date. */
function getCoachPlansFromNow(days: number): CoachPlan[] {
  const today = new Date().toISOString().slice(0, 10);
  const end = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const workouts = getCoachWorkouts().filter((w) => w.date >= today && w.date <= end);
  const runs = getCoachRuns().filter((r) => r.date >= today && r.date <= end);
  return [...workouts, ...runs].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Sends the just-saved session to the Edge Function for AI analysis.
 * Applies any program changes returned by Claude.
 * Returns the result for display in the UI, or null if anything fails.
 */
export async function analyzeSession(session: WorkoutSession): Promise<CoachAnalysisResult | null> {
  try {
    const profile = getActiveProfile();
    const profileName = profile?.name ?? "Maxime";
    const recentSessions = getSessions().slice(0, 5); // last 5 (excluding current — already saved)
    const coachPlans = getCoachPlansFromNow(14);

    const { data, error } = await supabase.functions.invoke("analyze-session", {
      body: { session, coachPlans, recentSessions, profileName },
    });

    if (error || !data) return null;

    // Apply modified plans via the same parser used for manual JSON imports
    const rawPlans: unknown[] = Array.isArray(data.modified_plans) ? data.modified_plans : [];
    let programChanged = false;

    if (rawPlans.length > 0) {
      try {
        const parsed = parseCoachWorkoutJSON(JSON.stringify(rawPlans));
        for (const plan of parsed) {
          if (plan.type === "fitness") addCoachWorkout(plan);
          else addCoachRun(plan);
        }
        programChanged = true;
        await autoSyncPush();
      } catch {
        // Malformed response — skip silently
      }
    }

    return {
      analysis: typeof data.analysis === "string" ? data.analysis : "",
      programChanged,
    };
  } catch {
    return null;
  }
}
