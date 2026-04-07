// Supabase-based sync — replaces GitHub Gist
import { supabase } from "./supabase";
import type { User } from "@supabase/supabase-js";

const LAST_SYNC_KEY = "cc_last_sync";

// ─── Types ──────────────────────────────────────────────────────────────────
type SyncPayload = {
  sessions: unknown[];
  coach_workouts: unknown[];
  coach_runs: unknown[];
  cancelled_days: unknown[];
  rescheduled_days: unknown[];
  body_weight: unknown[];
  ex_notes: Record<string, unknown>;
};

// ─── Cached auth state (allows isSyncConfigured to stay synchronous) ────────
let _user: User | null = null;

if (typeof window !== "undefined") {
  supabase.auth.getSession().then(({ data }) => {
    _user = data.session?.user ?? null;
  });
  supabase.auth.onAuthStateChange((_e, session) => {
    _user = session?.user ?? null;
  });
}

export function getLastSync(): string { return localStorage.getItem(LAST_SYNC_KEY) ?? ""; }
export function isSyncConfigured(): boolean { return !!_user; }
export function getCurrentUser(): User | null { return _user; }

// ─── Auth ────────────────────────────────────────────────────────────────────
export async function signInWithEmail(email: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
  _user = null;
}

// ─── Local data helpers ──────────────────────────────────────────────────────
function readLocal(): SyncPayload {
  const get = (key: string): unknown[] => {
    try { return JSON.parse(localStorage.getItem(key) ?? "[]") as unknown[]; }
    catch { return []; }
  };
  const notes: Record<string, unknown> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith("cc_ex_notes_")) {
      try { notes[k] = JSON.parse(localStorage.getItem(k) ?? "{}"); } catch {}
    }
  }
  return {
    sessions:         get("cc_sessions"),
    coach_workouts:   get("cc_coach_workouts"),
    coach_runs:       get("cc_coach_runs"),
    cancelled_days:   get("cc_cancelled_days"),
    rescheduled_days: get("cc_rescheduled_days"),
    body_weight:      get("cc_body_weight"),
    ex_notes:         notes,
  };
}

function writeLocal(data: SyncPayload) {
  const map: Record<string, unknown> = {
    cc_sessions:         data.sessions,
    cc_coach_workouts:   data.coach_workouts,
    cc_coach_runs:       data.coach_runs,
    cc_cancelled_days:   data.cancelled_days,
    cc_rescheduled_days: data.rescheduled_days,
    cc_body_weight:      data.body_weight,
  };
  Object.entries(map).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v ?? [])));
  if (data.ex_notes) {
    Object.entries(data.ex_notes).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v)));
  }
}

// ─── Merge helpers ───────────────────────────────────────────────────────────
function mergeByKey<T>(remote: T[], local: T[], key: keyof T): T[] {
  const seen = new Set(remote.map((x) => String(x[key])));
  const localOnly = local.filter((x) => !seen.has(String(x[key])));
  return localOnly.length > 0 ? [...remote, ...localOnly] : remote;
}

function mergeWithLocal(remote: SyncPayload): SyncPayload {
  const get = (key: string): unknown[] => {
    try { return JSON.parse(localStorage.getItem(key) ?? "[]") as unknown[]; }
    catch { return []; }
  };
  return {
    ...remote,
    sessions:         mergeByKey(remote.sessions         as { id: string }[],   get("cc_sessions")         as { id: string }[],   "id"),
    coach_workouts:   mergeByKey(remote.coach_workouts   as { id: string }[],   get("cc_coach_workouts")   as { id: string }[],   "id"),
    coach_runs:       mergeByKey(remote.coach_runs       as { id: string }[],   get("cc_coach_runs")       as { id: string }[],   "id"),
    cancelled_days:   mergeByKey(remote.cancelled_days   as { date: string }[], get("cc_cancelled_days")   as { date: string }[], "date"),
    rescheduled_days: mergeByKey(remote.rescheduled_days as { from: string }[], get("cc_rescheduled_days") as { from: string }[], "from"),
    body_weight:      mergeByKey(remote.body_weight      as { date: string }[], get("cc_body_weight")      as { date: string }[], "date"),
  };
}

// ─── Supabase helpers ────────────────────────────────────────────────────────
async function fetchRemote(userId: string): Promise<SyncPayload | null> {
  const { data, error } = await supabase
    .from("user_data")
    .select("sessions, coach_workouts, coach_runs, cancelled_days, rescheduled_days, body_weight, ex_notes")
    .eq("user_id", userId)
    .single();
  if (error || !data) return null;
  return data as SyncPayload;
}

async function upsertRemote(userId: string, payload: SyncPayload): Promise<void> {
  const { error } = await supabase
    .from("user_data")
    .upsert({ user_id: userId, ...payload, updated_at: new Date().toISOString() });
  if (error) throw new Error(`Erreur Supabase : ${error.message}`);
}

// ─── Public sync API ─────────────────────────────────────────────────────────
export type SyncResult = { ok: boolean; error?: string };

let isSyncing = false;

/**
 * Full bidirectional sync: pull → merge → push.
 * Pulls remote data, merges with local (union, never erases local),
 * then pushes the merged result back to Supabase.
 */
export async function syncFull(): Promise<SyncResult> {
  if (isSyncing) return { ok: false };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  isSyncing = true;
  try {
    const remote = await fetchRemote(user.id);
    const merged = remote ? mergeWithLocal(remote) : readLocal();
    writeLocal(merged);
    const payload = readLocal();
    await upsertRemote(user.id, payload);
    localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur inconnue" };
  } finally {
    isSyncing = false;
  }
}

/**
 * Silent push after any local mutation (log session, cancel, reschedule…).
 * Does not pull — just pushes current local state.
 */
export async function autoSyncPush(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  try {
    await upsertRemote(user.id, readLocal());
    localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
  } catch { /* silent */ }
}
