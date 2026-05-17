// ─── Session Types ─────────────────────────────────────────────────────────────

export type SessionType = "fitness" | "run";
export type FitnessCategory = "upper" | "lower";

export interface SetLog {
  weight: number; // kg
  reps: number;
  done: boolean;
}

export interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: number;
  weight: number; // kg
  comment: string;
  setLogs?: SetLog[];
}

export interface FitnessSession {
  id: string;
  type: "fitness";
  date: string; // ISO
  category: FitnessCategory;
  exercises: Exercise[];
  comment: string;
  coachWorkoutId?: string;
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
  laps?: StravaLap[];
}

export type WorkoutSession = FitnessSession | RunSession;

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

export interface StravaLap {
  lap_index: number;
  name: string;
  elapsed_time: number;
  moving_time: number;
  distance: number;           // mètres
  average_speed: number;      // m/s
  average_heartrate?: number;
  max_heartrate?: number;
  total_elevation_gain?: number;
}

// ─── Cancelled Days ───────────────────────────────────────────────────────────

export interface CancelledDay {
  date: string; // ISO "YYYY-MM-DD"
  reason: string;
}

// ─── App State ────────────────────────────────────────────────────────────────

export interface AppState {
  sessions: WorkoutSession[];
  stravaTokens?: StravaTokens;
  pendingStravaActivities?: StravaActivity[];
  bodyWeightKg?: number[];
}
