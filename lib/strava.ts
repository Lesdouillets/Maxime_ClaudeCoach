import type { StravaActivity, StravaLap, StravaTokens } from "./types";
import { getStravaTokens, saveStravaTokens } from "./storage";
import { supabase } from "./supabase";
import { getActiveProfileId } from "./profiles";

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

// ─── Échange et rafraîchissement des jetons ───────────────────────────────────
// Strava ne supporte pas PKCE : ces deux opérations réclament le client_secret.
// Embarqué dans un site statique, il est lisible par quiconque ouvre le bundle
// JS — ce qui a été le cas ici de fin mai à août 2026. Il vit désormais dans les
// secrets du projet Supabase, et c'est la fonction edge `strava-auth` qui parle
// à Strava. L'app Flutter passe par le même relais.

/// Appelle le relais. La fonction exige une session Supabase : elle vérifie
/// l'appelant avant tout, sans quoi elle serait un oracle ouvert sur le secret.
async function callStravaAuth(
  body: { action: "exchange"; code: string } | { action: "refresh"; profile_id: string }
): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.functions.invoke("strava-auth", { body });

  if (error || !data) {
    throw new Error(`Strava auth failed: ${error?.message ?? "réponse vide"}`);
  }
  return data as Record<string, unknown>;
}

export async function exchangeCodeForTokens(code: string): Promise<StravaTokens> {
  const data = await callStravaAuth({ action: "exchange", code });
  const athlete = data.athlete as { id: number; firstname: string; lastname: string };

  return {
    access_token: data.access_token as string,
    refresh_token: data.refresh_token as string,
    expires_at: data.expires_at as number,
    athlete_id: athlete.id,
    athlete_name: `${athlete.firstname} ${athlete.lastname}`,
  };
}

// ─── Token Refresh ────────────────────────────────────────────────────────────

export async function refreshTokenIfNeeded(tokens: StravaTokens): Promise<StravaTokens> {
  const now = Math.floor(Date.now() / 1000);
  if (tokens.expires_at > now + 300) return tokens; // valid for 5+ min

  // Le relais ne rafraîchit pas le jeton qu'on lui présente, mais celui qu'il
  // va chercher lui-même en base pour ce profil : détenir le jeton d'autrui ne
  // suffit donc pas à s'en servir.
  const profileId = getActiveProfileId();
  if (!profileId) throw new Error("Token refresh failed: aucun profil actif");

  const data = await callStravaAuth({ action: "refresh", profile_id: profileId });

  const refreshed: StravaTokens = {
    ...tokens,
    access_token: data.access_token as string,
    refresh_token: data.refresh_token as string,
    expires_at: data.expires_at as number,
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

// ─── Fetch Activity Laps ──────────────────────────────────────────────────────

/** Fetch per-lap data for a single activity. Returns [] on failure. */
export async function fetchActivityLaps(
  tokens: StravaTokens,
  activityId: number
): Promise<StravaLap[]> {
  const fresh = await refreshTokenIfNeeded(tokens);
  const res = await fetch(
    `https://www.strava.com/api/v3/activities/${activityId}/laps`,
    { headers: { Authorization: `Bearer ${fresh.access_token}` } }
  );
  if (!res.ok) return [];
  return res.json();
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
function formatDuration(seconds: number): string {
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
  activity: StravaActivity,
  laps?: StravaLap[]
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
      ...(laps && laps.length > 0 ? { laps } : {}),
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
