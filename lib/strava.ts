import type { StravaActivity, StravaTokens } from "./types";
import { getStravaTokens, saveStravaTokens } from "./storage";

const CLIENT_ID = process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID ?? "";
const REDIRECT_URI = process.env.NEXT_PUBLIC_STRAVA_REDIRECT_URI ?? "";

// ─── OAuth URLs ───────────────────────────────────────────────────────────────

export function getStravaAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    approval_prompt: "auto",
    scope: "read,activity:read_all",
  });
  return `https://www.strava.com/oauth/authorize?${params.toString()}`;
}

// ─── Token Exchange (requires proxy or direct for dev) ────────────────────────
// NOTE: Strava does not support PKCE. The client_secret cannot be embedded
// in a static app. For production, a lightweight proxy is required.
// For local dev, NEXT_PUBLIC_STRAVA_CLIENT_SECRET can be used temporarily.

export async function exchangeCodeForTokens(code: string): Promise<StravaTokens> {
  const clientSecret = process.env.NEXT_PUBLIC_STRAVA_CLIENT_SECRET ?? "";

  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    throw new Error(`Strava token exchange failed: ${res.statusText}`);
  }

  const data = await res.json();

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
    athlete_id: data.athlete.id,
    athlete_name: `${data.athlete.firstname} ${data.athlete.lastname}`,
  };
}

// ─── Token Refresh ────────────────────────────────────────────────────────────

export async function refreshTokenIfNeeded(tokens: StravaTokens): Promise<StravaTokens> {
  const now = Math.floor(Date.now() / 1000);
  if (tokens.expires_at > now + 300) return tokens; // valid for 5+ min

  const clientSecret = process.env.NEXT_PUBLIC_STRAVA_CLIENT_SECRET ?? "";

  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: clientSecret,
      refresh_token: tokens.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) throw new Error("Token refresh failed");

  const data = await res.json();
  const refreshed: StravaTokens = {
    ...tokens,
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
  };

  saveStravaTokens(refreshed);
  return refreshed;
}

// ─── Fetch Recent Activities ──────────────────────────────────────────────────

export async function fetchRecentActivities(
  tokens: StravaTokens,
  afterTimestamp?: number
): Promise<StravaActivity[]> {
  const fresh = await refreshTokenIfNeeded(tokens);

  const params = new URLSearchParams({
    per_page: "30",
  });
  if (afterTimestamp) {
    params.set("after", afterTimestamp.toString());
  }

  const res = await fetch(
    `https://www.strava.com/api/v3/athlete/activities?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${fresh.access_token}` },
    }
  );

  if (!res.ok) throw new Error(`Strava fetch failed: ${res.statusText}`);

  return res.json();
}

// ─── Auto-fetch on App Open ───────────────────────────────────────────────────

export async function fetchNewActivitiesSinceLastVisit(): Promise<StravaActivity[]> {
  const tokens = getStravaTokens();
  if (!tokens) return [];

  const { getLastStravaFetch, setLastStravaFetch, getSessions } = await import("./storage");

  const lastFetch = getLastStravaFetch();
  const afterTimestamp = lastFetch
    ? Math.floor(new Date(lastFetch).getTime() / 1000)
    : undefined;

  const activities = await fetchRecentActivities(tokens, afterTimestamp);

  // Filter to relevant sport types
  const relevant = activities.filter((a) =>
    ["Run", "WeightTraining", "Workout"].includes(a.type)
  );

  // Check against already imported activities
  const existing = getSessions();
  const existingStravaIds = new Set(
    existing
      .filter((s) => s.stravaActivityId)
      .map((s) => s.stravaActivityId)
  );

  const newActivities = relevant.filter((a) => !existingStravaIds.has(a.id));

  setLastStravaFetch(new Date().toISOString());

  return newActivities;
}

// ─── Force Resync (ignores lastStravaFetch) ───────────────────────────────────

/** Fetch activities from the last N days regardless of lastStravaFetch timestamp */
export async function forceResyncRecentActivities(daysBack = 14): Promise<StravaActivity[]> {
  const tokens = getStravaTokens();
  if (!tokens) return [];

  const { getSessions, setLastStravaFetch } = await import("./storage");

  const since = new Date();
  since.setDate(since.getDate() - daysBack);
  const afterTimestamp = Math.floor(since.getTime() / 1000);

  const activities = await fetchRecentActivities(tokens, afterTimestamp);
  const relevant = activities.filter((a) =>
    ["Run", "TrailRun", "VirtualRun", "WeightTraining", "Workout", "CrossFit"].includes(a.type)
  );

  const existing = getSessions();
  const existingStravaIds = new Set(
    existing.filter((s) => s.stravaActivityId).map((s) => s.stravaActivityId)
  );

  setLastStravaFetch(new Date().toISOString());

  return relevant.filter((a) => !existingStravaIds.has(a.id));
}



/** Convert m/s to pace string (min:ss /km) */
export function speedToPace(metersPerSecond: number): string {
  if (!metersPerSecond) return "--:--";
  const secPerKm = 1000 / metersPerSecond;
  const min = Math.floor(secPerKm / 60);
  const sec = Math.round(secPerKm % 60);
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

/** Format distance */
export function formatDistance(meters: number): string {
  return (meters / 1000).toFixed(2);
}

/** Format duration */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h${m.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Map Strava sport type to app session type */
export function mapStravaTypeToSession(stravaType: string): "run" | "fitness" | null {
  if (["Run", "TrailRun", "VirtualRun"].includes(stravaType)) return "run";
  if (["WeightTraining", "Workout", "CrossFit"].includes(stravaType)) return "fitness";
  return null;
}

/** Convert a StravaActivity to a WorkoutSession and save it */
export function autoImportActivity(
  activity: StravaActivity
): import("./types").WorkoutSession | null {
  const sessionType = mapStravaTypeToSession(activity.type);
  if (!sessionType) return null;

  const { generateId } = require("./storage");

  if (sessionType === "run") {
    return {
      id: generateId(),
      type: "run",
      date: activity.start_date,
      distanceKm: activity.distance / 1000,
      durationSeconds: activity.moving_time,
      avgPaceSecPerKm:
        activity.distance > 0
          ? activity.moving_time / (activity.distance / 1000)
          : 0,
      avgHeartRate: activity.average_heartrate,
      elevationGainM: activity.total_elevation_gain,
      comment: "",
      stravaActivityId: activity.id,
      importedFromStrava: true,
    };
  }

  // Strava confirme qu'une séance a eu lieu, mais ne porte aucune information :
  // la catégorie et le contenu d'une séance de salle viennent du coach uniquement.
  // Sans plan coach pour ce jour, pas de FitnessSession importée.
  // Si une séance fitness existe déjà pour ce jour (loguée à la main), on ne
  // recrée pas — dédup strict sur la date pour éviter les doublons.
  const dateStr = activity.start_date.slice(0, 10);
  const { getCoachWorkouts } = require("./coachPlan");
  const { getSessions } = require("./storage");
  type CWExercise = { name: string; sets: number; reps: number; weight: number };
  type CW = { id: string; date: string; category: import("./types").FitnessCategory; exercises: CWExercise[] };
  const coachWorkout = (getCoachWorkouts() as CW[]).find((w) => w.date === dateStr);
  if (!coachWorkout) return null;

  const sessionsList = getSessions() as import("./types").WorkoutSession[];
  const existingFitness = sessionsList.find(
    (s) => s.type === "fitness" && s.date.slice(0, 10) === dateStr
  );
  if (existingFitness) return null;

  const exercises = coachWorkout.exercises.map((ex) => ({
    id: generateId(),
    name: ex.name,
    sets: ex.sets,
    reps: ex.reps,
    weight: ex.weight,
    comment: "",
  }));

  return {
    id: generateId(),
    type: "fitness",
    date: activity.start_date,
    category: coachWorkout.category,
    exercises,
    comment: "",
    coachWorkoutId: coachWorkout.id,
    stravaActivityId: activity.id,
    importedFromStrava: true,
  };
}
