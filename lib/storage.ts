import type {
  WorkoutSession,
  StravaTokens,
  StravaActivity,
  AppState,
  CancelledDay,
  Exercise,
} from "./types";

const KEYS = {
  sessions: "cc_sessions",
  stravaTokens: "cc_strava_tokens",
  lastStravaFetch: "cc_last_strava_fetch",
  pendingStrava: "cc_pending_strava",
  bodyWeight: "cc_body_weight",
  cancelledDays: "cc_cancelled_days",
  rescheduledDays: "cc_rescheduled_days",
} as const;

// ─── Sessions ─────────────────────────────────────────────────────────────────

export function getSessions(): WorkoutSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEYS.sessions);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveSessions(sessions: WorkoutSession[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEYS.sessions, JSON.stringify(sessions));
}

export function addSession(session: WorkoutSession): void {
  const sessions = getSessions();
  sessions.unshift(session); // newest first
  saveSessions(sessions);
}

export function updateSession(session: WorkoutSession): void {
  const sessions = getSessions();
  const idx = sessions.findIndex((s) => s.id === session.id);
  if (idx !== -1) {
    sessions[idx] = session;
    saveSessions(sessions);
  }
}

export function deleteSession(id: string): void {
  const sessions = getSessions().filter((s) => s.id !== id);
  saveSessions(sessions);
}

// ─── Strava Tokens ────────────────────────────────────────────────────────────

export function getStravaTokens(): StravaTokens | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEYS.stravaTokens);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveStravaTokens(tokens: StravaTokens): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEYS.stravaTokens, JSON.stringify(tokens));
}

export function clearStravaTokens(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEYS.stravaTokens);
}

// ─── Last Strava Fetch ────────────────────────────────────────────────────────

export function getLastStravaFetch(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEYS.lastStravaFetch);
}

export function setLastStravaFetch(iso: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEYS.lastStravaFetch, iso);
}

// ─── Pending Strava Activities ────────────────────────────────────────────────

export function getPendingStravaActivities(): StravaActivity[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEYS.pendingStrava);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function setPendingStravaActivities(activities: StravaActivity[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEYS.pendingStrava, JSON.stringify(activities));
}

export function clearPendingStravaActivities(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEYS.pendingStrava);
}

// ─── Body Weight ──────────────────────────────────────────────────────────────

export interface WeightEntry {
  date: string; // ISO
  kg: number;
}

export function getWeightHistory(): WeightEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEYS.bodyWeight);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addWeightEntry(entry: WeightEntry): void {
  const entries = getWeightHistory();
  entries.unshift(entry);
  localStorage.setItem(KEYS.bodyWeight, JSON.stringify(entries));
}

// ─── Cancelled & Rescheduled Days ─────────────────────────────────────────────

export function getCancelledDays(): CancelledDay[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEYS.cancelledDays);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    // Backward-compat: migrate old string[] format
    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "string") {
      const migrated: CancelledDay[] = (parsed as string[]).map((d) => ({ date: d, reason: "" }));
      localStorage.setItem(KEYS.cancelledDays, JSON.stringify(migrated));
      return migrated;
    }
    return parsed as CancelledDay[];
  } catch { return []; }
}

export function getCancelledDay(date: string): CancelledDay | undefined {
  return getCancelledDays().find((d) => d.date === date);
}

export function cancelDay(date: string, reason = ""): void {
  if (typeof window === "undefined") return;
  const days = getCancelledDays().filter((d) => d.date !== date);
  days.push({ date, reason });
  localStorage.setItem(KEYS.cancelledDays, JSON.stringify(days));
}

export function uncancelDay(date: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEYS.cancelledDays, JSON.stringify(
    getCancelledDays().filter((d) => d.date !== date)
  ));
}

export interface RescheduledDay { from: string; to: string }

export function getRescheduledDays(): RescheduledDay[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEYS.rescheduledDays);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function rescheduleDay(from: string, to: string): void {
  if (typeof window === "undefined") return;
  const days = getRescheduledDays().filter((d) => d.from !== from);
  days.push({ from, to });
  localStorage.setItem(KEYS.rescheduledDays, JSON.stringify(days));
}

export function unrescheduleDay(from: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEYS.rescheduledDays, JSON.stringify(
    getRescheduledDays().filter((d) => d.from !== from)
  ));
}

// ─── In-Progress Fitness Sessions ─────────────────────────────────────────────
// Live workout state survives navigation (cleared on save or cancel).

export interface InProgressFitnessState {
  exercises: Exercise[];
  activeExIdx: number;
}

const inProgressKey = (date: string) => `cc_in_progress_fitness_${date}`;

export function getInProgressFitness(date: string): InProgressFitnessState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(inProgressKey(date));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setInProgressFitness(date: string, state: InProgressFitnessState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(inProgressKey(date), JSON.stringify(state));
  } catch {}
}

export function clearInProgressFitness(date: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(inProgressKey(date));
  } catch {}
}

// ─── Full State Export ────────────────────────────────────────────────────────

export function getFullState(): AppState {
  return {
    sessions: getSessions(),
    lastStravaFetch: getLastStravaFetch() ?? undefined,
    stravaTokens: getStravaTokens() ?? undefined,
    pendingStravaActivities: getPendingStravaActivities(),
  };
}

// ─── ID Generator ─────────────────────────────────────────────────────────────

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
