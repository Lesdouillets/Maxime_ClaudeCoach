// ─── Session Types ─────────────────────────────────────────────────────────────

export type SessionType = "fitness" | "run";
export type FitnessCategory = "upper" | "lower";

export interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: number;
  weight: number; // kg
  comment: string;
}

export interface FitnessSession {
  id: string;
  type: "fitness";
  date: string; // ISO
  category: FitnessCategory;
  exercises: Exercise[];
  comment: string;
  stravaActivityId?: number;
  importedFromStrava?: boolean;
}

export interface RunSession {
  id: string;
  type: "run";
  date: string; // ISO
  distanceKm: number;
  durationSeconds: number;
  avgPaceSecPerKm: number;
  avgHeartRate?: number;
  elevationGainM?: number;
  comment: string;
  targetDistanceKm?: number;
  targetPaceSecPerKm?: number;
  targetZone?: string;
  stravaActivityId?: number;
  importedFromStrava?: boolean;
}

export type WorkoutSession = FitnessSession | RunSession;

// ─── Weekly Plan ──────────────────────────────────────────────────────────────

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=Sun

export interface PlannedDay {
  dayOfWeek: DayOfWeek;
  type: SessionType;
  category?: FitnessCategory;
  label: string;
  targetDescription: string;
  targetDistanceKm?: number;
  targetPaceSecPerKm?: number;
  targetZone?: string;
}

// ─── Strava ───────────────────────────────────────────────────────────────────

export interface StravaTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number; // unix timestamp
  athlete_id: number;
  athlete_name: string;
}

export interface StravaActivity {
  id: number;
  name: string;
  type: string; // "Run", "WeightTraining", etc.
  sport_type: string;
  start_date: string; // ISO
  distance: number; // meters
  moving_time: number; // seconds
  elapsed_time: number;
  total_elevation_gain: number;
  average_speed: number; // m/s
  average_heartrate?: number;
  max_heartrate?: number;
}

// ─── App State ────────────────────────────────────────────────────────────────

export interface AppState {
  sessions: WorkoutSession[];
  lastStravaFetch?: string; // ISO timestamp
  stravaTokens?: StravaTokens;
  pendingStravaActivities?: StravaActivity[];
  bodyWeightKg?: number[];
}
