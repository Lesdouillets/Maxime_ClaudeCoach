// Supabase-based sync — tables normalisées (Option B) + multi-profile
import { supabase } from "./supabase";
import type { User } from "@supabase/supabase-js";
import type { WorkoutSession, CancelledDay, StravaTokens } from "./types";
import type { CoachPlan } from "./coachPlan";
import type { WeightEntry, RescheduledDay } from "./storage";
import { getActiveProfileId } from "./profiles";

const LAST_SYNC_KEY = "cc_last_sync";

// ─── Types internes ───────────────────────────────────────────────────────────
type DayEvent = {
  event_type: "cancelled" | "rescheduled";
  date: string;
  data: Record<string, unknown>;
};

// ─── Cached auth state (isSyncConfigured reste synchrone) ────────────────────
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

// ─── Auth ─────────────────────────────────────────────────────────────────────
export async function signInWithGitHub(): Promise<void> {
  await supabase.auth.signInWithOAuth({
    provider: "github",
    options: {
      redirectTo: typeof window !== "undefined"
        ? window.location.href
        : undefined,
    },
  });
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
  _user = null;
}

// ─── Lecture localStorage ─────────────────────────────────────────────────────
function ls<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) ?? "") as T; }
  catch { return fallback; }
}

function readSessions(): WorkoutSession[] {
  return ls<WorkoutSession[]>("cc_sessions", []);
}

function readCoachPlans(): CoachPlan[] {
  return [
    ...ls<CoachPlan[]>("cc_coach_workouts", []),
    ...ls<CoachPlan[]>("cc_coach_runs", []),
  ];
}

function readDayEvents(): DayEvent[] {
  const cancelled = ls<CancelledDay[]>("cc_cancelled_days", []).map((d) => ({
    event_type: "cancelled" as const,
    date: d.date,
    data: { reason: d.reason },
  }));
  const rescheduled = ls<RescheduledDay[]>("cc_rescheduled_days", []).map((d) => ({
    event_type: "rescheduled" as const,
    date: d.from,
    data: { to: d.to },
  }));
  return [...cancelled, ...rescheduled];
}

function readWeightEntries(): WeightEntry[] {
  return ls<WeightEntry[]>("cc_body_weight", []);
}

function readExNotes(): { date: string; notes: object }[] {
  const result: { date: string; notes: object }[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith("cc_ex_notes_")) {
      const date = k.slice("cc_ex_notes_".length);
      try { result.push({ date, notes: JSON.parse(localStorage.getItem(k) ?? "{}") }); }
      catch {}
    }
  }
  return result;
}

// ─── Écriture localStorage ────────────────────────────────────────────────────
function writeSessions(sessions: WorkoutSession[]) {
  localStorage.setItem("cc_sessions", JSON.stringify(sessions));
}

function writeCoachPlans(plans: CoachPlan[]) {
  localStorage.setItem("cc_coach_workouts", JSON.stringify(plans.filter((p) => p.type === "fitness")));
  localStorage.setItem("cc_coach_runs", JSON.stringify(plans.filter((p) => p.type === "run")));
}

function writeDayEvents(events: DayEvent[]) {
  localStorage.setItem("cc_cancelled_days", JSON.stringify(
    events.filter((e) => e.event_type === "cancelled")
      .map((e) => ({ date: e.date, reason: (e.data.reason as string) ?? "" }))
  ));
  localStorage.setItem("cc_rescheduled_days", JSON.stringify(
    events.filter((e) => e.event_type === "rescheduled")
      .map((e) => ({ from: e.date, to: (e.data.to as string) ?? "" }))
  ));
}

function writeWeightEntries(entries: WeightEntry[]) {
  localStorage.setItem("cc_body_weight", JSON.stringify(entries));
}

function writeExNotes(notes: { date: string; notes: object }[]) {
  notes.forEach(({ date, notes }) => {
    localStorage.setItem(`cc_ex_notes_${date}`, JSON.stringify(notes));
  });
}

// ─── Merge (union, remote gagne sur les doublons) ─────────────────────────────
function mergeById<T extends { id: string }>(remote: T[], local: T[]): T[] {
  const seen = new Set(remote.map((x) => x.id));
  return [...remote, ...local.filter((x) => !seen.has(x.id))];
}

function mergeByKey<T>(remote: T[], local: T[], key: keyof T): T[] {
  const seen = new Set(remote.map((x) => String(x[key])));
  return [...remote, ...local.filter((x) => !seen.has(String(x[key])))];
}

function mergeDayEvents(remote: DayEvent[], local: DayEvent[]): DayEvent[] {
  const seen = new Set(remote.map((e) => `${e.event_type}_${e.date}`));
  return [...remote, ...local.filter((e) => !seen.has(`${e.event_type}_${e.date}`))];
}

// ─── Push vers Supabase ───────────────────────────────────────────────────────
async function pushSessions(userId: string, profileId: string, sessions: WorkoutSession[]) {
  if (sessions.length > 0) {
    const rows = sessions.map((s) => ({
      id: s.id, user_id: userId, profile_id: profileId,
      type: s.type, date: s.date.slice(0, 10), data: s,
    }));
    const { error } = await supabase.from("sessions").upsert(rows, { onConflict: "id" });
    if (error) throw new Error(error.message);
  }
  const localIds = sessions.map((s) => s.id);
  const { data: remoteRows } = await supabase.from("sessions").select("id")
    .eq("user_id", userId).eq("profile_id", profileId);
  const toDelete = (remoteRows ?? []).map((r) => r.id as string).filter((id) => !localIds.includes(id));
  if (toDelete.length > 0) {
    await supabase.from("sessions").delete()
      .eq("user_id", userId).eq("profile_id", profileId).in("id", toDelete);
  }
}

async function pushCoachPlans(userId: string, profileId: string, plans: CoachPlan[]) {
  if (plans.length > 0) {
    const rows = plans.map((p) => ({
      id: p.id, user_id: userId, profile_id: profileId,
      type: p.type, date: p.date.slice(0, 10), data: p,
    }));
    const { error } = await supabase.from("coach_plans").upsert(rows, { onConflict: "id" });
    if (error) throw new Error(error.message);
  }
  const localIds = plans.map((p) => p.id);
  const { data: remoteRows } = await supabase.from("coach_plans").select("id")
    .eq("user_id", userId).eq("profile_id", profileId);
  const toDelete = (remoteRows ?? []).map((r) => r.id as string).filter((id) => !localIds.includes(id));
  if (toDelete.length > 0) {
    await supabase.from("coach_plans").delete()
      .eq("user_id", userId).eq("profile_id", profileId).in("id", toDelete);
  }
}

async function pushDayEvents(userId: string, profileId: string, events: DayEvent[]) {
  await supabase.from("day_events").delete().eq("user_id", userId).eq("profile_id", profileId);
  if (events.length === 0) return;
  const { error } = await supabase.from("day_events").insert(
    events.map((e) => ({ user_id: userId, profile_id: profileId, ...e }))
  );
  if (error) throw new Error(error.message);
}

async function pushWeightEntries(userId: string, profileId: string, entries: WeightEntry[]) {
  await supabase.from("weight_entries").delete().eq("user_id", userId).eq("profile_id", profileId);
  if (entries.length === 0) return;
  const { error } = await supabase.from("weight_entries").insert(
    entries.map((e) => ({ user_id: userId, profile_id: profileId, date: e.date, kg: e.kg }))
  );
  if (error) throw new Error(error.message);
}

async function pushExNotes(userId: string, profileId: string, notes: { date: string; notes: object }[]) {
  await supabase.from("ex_notes").delete().eq("user_id", userId).eq("profile_id", profileId);
  if (notes.length === 0) return;
  const { error } = await supabase.from("ex_notes").insert(
    notes.map((n) => ({ user_id: userId, profile_id: profileId, ...n }))
  );
  if (error) throw new Error(error.message);
}

async function pushStravaTokens(userId: string, profileId: string) {
  try {
    const raw = localStorage.getItem("cc_strava_tokens");
    if (!raw) return;
    const tokens = JSON.parse(raw) as StravaTokens;
    await supabase.from("strava_tokens").upsert(
      { user_id: userId, profile_id: profileId, tokens, updated_at: new Date().toISOString() },
      { onConflict: "user_id,profile_id" }
    );
  } catch { /* silent */ }
}

// ─── Pull depuis Supabase ─────────────────────────────────────────────────────
async function pullSessions(userId: string, profileId: string): Promise<WorkoutSession[]> {
  const { data } = await supabase.from("sessions").select("data")
    .eq("user_id", userId).eq("profile_id", profileId);
  return (data ?? []).map((r) => r.data as WorkoutSession);
}

async function pullCoachPlans(userId: string, profileId: string): Promise<CoachPlan[]> {
  const { data } = await supabase.from("coach_plans").select("data")
    .eq("user_id", userId).eq("profile_id", profileId);
  return (data ?? []).map((r) => r.data as CoachPlan);
}

async function pullDayEvents(userId: string, profileId: string): Promise<DayEvent[]> {
  const { data } = await supabase.from("day_events").select("event_type, date, data")
    .eq("user_id", userId).eq("profile_id", profileId);
  return (data ?? []) as DayEvent[];
}

async function pullWeightEntries(userId: string, profileId: string): Promise<WeightEntry[]> {
  const { data } = await supabase.from("weight_entries").select("date, kg")
    .eq("user_id", userId).eq("profile_id", profileId);
  return (data ?? []).map((r) => ({ date: r.date as string, kg: Number(r.kg) }));
}

async function pullExNotes(userId: string, profileId: string): Promise<{ date: string; notes: object }[]> {
  const { data } = await supabase.from("ex_notes").select("date, notes")
    .eq("user_id", userId).eq("profile_id", profileId);
  return (data ?? []) as { date: string; notes: object }[];
}

async function pullStravaTokens(userId: string, profileId: string) {
  try {
    if (localStorage.getItem("cc_strava_tokens")) return;
    const { data } = await supabase.from("strava_tokens")
      .select("tokens").eq("user_id", userId).eq("profile_id", profileId).single();
    if (data?.tokens) {
      localStorage.setItem("cc_strava_tokens", JSON.stringify(data.tokens));
    }
  } catch { /* silent */ }
}

// ─── Core sync logic (shared) ─────────────────────────────────────────────────
async function _runSync(userId: string, profileId: string): Promise<void> {
  const [remoteSessions, remoteCoachPlans, remoteDayEvents, remoteWeightEntries, remoteExNotes] =
    await Promise.all([
      pullSessions(userId, profileId),
      pullCoachPlans(userId, profileId),
      pullDayEvents(userId, profileId),
      pullWeightEntries(userId, profileId),
      pullExNotes(userId, profileId),
    ]);

  const mergedSessions      = mergeById(remoteSessions, readSessions());
  const mergedCoachPlans    = mergeById(remoteCoachPlans, readCoachPlans());
  const mergedDayEvents     = mergeDayEvents(remoteDayEvents, readDayEvents());
  const mergedWeightEntries = mergeByKey(remoteWeightEntries, readWeightEntries(), "date");
  const mergedExNotes       = mergeByKey(remoteExNotes, readExNotes(), "date");

  writeSessions(mergedSessions);
  writeCoachPlans(mergedCoachPlans);
  writeDayEvents(mergedDayEvents);
  writeWeightEntries(mergedWeightEntries);
  writeExNotes(mergedExNotes);

  await Promise.all([
    pushSessions(userId, profileId, mergedSessions),
    pushCoachPlans(userId, profileId, mergedCoachPlans),
    pushDayEvents(userId, profileId, mergedDayEvents),
    pushWeightEntries(userId, profileId, mergedWeightEntries),
    pushExNotes(userId, profileId, mergedExNotes),
    pushStravaTokens(userId, profileId),
    pullStravaTokens(userId, profileId),
  ]);
}

// ─── API publique ─────────────────────────────────────────────────────────────
export type SyncResult = { ok: boolean; error?: string };

let isSyncing = false;

/**
 * Sync bidirectionnel : pull toutes les tables → merge → write local → push.
 * Les entrées local-only ne sont jamais supprimées.
 */
export async function syncFull(): Promise<SyncResult> {
  if (isSyncing) return { ok: false };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  const profileId = getActiveProfileId();
  if (!profileId) return { ok: false };
  isSyncing = true;
  try {
    await _runSync(user.id, profileId);
    localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur inconnue" };
  } finally {
    isSyncing = false;
  }
}

/**
 * Sync avec un profileId explicite — utilisé lors d'un switch de profil pour
 * pull les données du profil cible avant qu'il devienne actif.
 */
export async function syncFullForProfile(profileId: string): Promise<SyncResult> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  try {
    await _runSync(user.id, profileId);
    localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur inconnue" };
  }
}

/**
 * Push silencieux après toute mutation locale.
 * Propage aussi les suppressions (le remote reflète exactement le local).
 */
export async function autoSyncPush(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const profileId = getActiveProfileId();
  if (!profileId) return;
  try {
    await Promise.all([
      pushSessions(user.id, profileId, readSessions()),
      pushCoachPlans(user.id, profileId, readCoachPlans()),
      pushDayEvents(user.id, profileId, readDayEvents()),
      pushWeightEntries(user.id, profileId, readWeightEntries()),
      pushExNotes(user.id, profileId, readExNotes()),
      pushStravaTokens(user.id, profileId),
    ]);
    localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
  } catch { /* silent */ }
}
