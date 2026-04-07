// Supabase-based sync — tables normalisées (Option B)
import { supabase } from "./supabase";
import type { User } from "@supabase/supabase-js";
import type { WorkoutSession, CancelledDay } from "./types";
import type { CoachPlan } from "./coachPlan";
import type { WeightEntry, RescheduledDay } from "./storage";

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
// Sessions : upsert + suppression des entrées disparues localement
async function pushSessions(userId: string, sessions: WorkoutSession[]) {
  if (sessions.length > 0) {
    const rows = sessions.map((s) => ({
      id: s.id, user_id: userId, type: s.type, date: s.date.slice(0, 10), data: s,
    }));
    const { error } = await supabase.from("sessions").upsert(rows, { onConflict: "id" });
    if (error) throw new Error(error.message);
  }
  // Supprimer les sessions qui n'existent plus en local
  const localIds = sessions.map((s) => s.id);
  const { data: remoteRows } = await supabase.from("sessions").select("id").eq("user_id", userId);
  const toDelete = (remoteRows ?? []).map((r) => r.id as string).filter((id) => !localIds.includes(id));
  if (toDelete.length > 0) {
    await supabase.from("sessions").delete().eq("user_id", userId).in("id", toDelete);
  }
}

// Coach plans : upsert + suppression des entrées disparues
async function pushCoachPlans(userId: string, plans: CoachPlan[]) {
  if (plans.length > 0) {
    const rows = plans.map((p) => ({
      id: p.id, user_id: userId, type: p.type, date: p.date.slice(0, 10), data: p,
    }));
    const { error } = await supabase.from("coach_plans").upsert(rows, { onConflict: "id" });
    if (error) throw new Error(error.message);
  }
  const localIds = plans.map((p) => p.id);
  const { data: remoteRows } = await supabase.from("coach_plans").select("id").eq("user_id", userId);
  const toDelete = (remoteRows ?? []).map((r) => r.id as string).filter((id) => !localIds.includes(id));
  if (toDelete.length > 0) {
    await supabase.from("coach_plans").delete().eq("user_id", userId).in("id", toDelete);
  }
}

// Tables à clé composite : delete + reinsert (table petite, atomique suffisant)
async function pushDayEvents(userId: string, events: DayEvent[]) {
  await supabase.from("day_events").delete().eq("user_id", userId);
  if (events.length === 0) return;
  const { error } = await supabase.from("day_events").insert(
    events.map((e) => ({ user_id: userId, ...e }))
  );
  if (error) throw new Error(error.message);
}

async function pushWeightEntries(userId: string, entries: WeightEntry[]) {
  await supabase.from("weight_entries").delete().eq("user_id", userId);
  if (entries.length === 0) return;
  const { error } = await supabase.from("weight_entries").insert(
    entries.map((e) => ({ user_id: userId, date: e.date, kg: e.kg }))
  );
  if (error) throw new Error(error.message);
}

async function pushExNotes(userId: string, notes: { date: string; notes: object }[]) {
  await supabase.from("ex_notes").delete().eq("user_id", userId);
  if (notes.length === 0) return;
  const { error } = await supabase.from("ex_notes").insert(
    notes.map((n) => ({ user_id: userId, ...n }))
  );
  if (error) throw new Error(error.message);
}

// ─── Pull depuis Supabase ─────────────────────────────────────────────────────
async function pullSessions(userId: string): Promise<WorkoutSession[]> {
  const { data } = await supabase.from("sessions").select("data").eq("user_id", userId);
  return (data ?? []).map((r) => r.data as WorkoutSession);
}

async function pullCoachPlans(userId: string): Promise<CoachPlan[]> {
  const { data } = await supabase.from("coach_plans").select("data").eq("user_id", userId);
  return (data ?? []).map((r) => r.data as CoachPlan);
}

async function pullDayEvents(userId: string): Promise<DayEvent[]> {
  const { data } = await supabase.from("day_events").select("event_type, date, data").eq("user_id", userId);
  return (data ?? []) as DayEvent[];
}

async function pullWeightEntries(userId: string): Promise<WeightEntry[]> {
  const { data } = await supabase.from("weight_entries").select("date, kg").eq("user_id", userId);
  return (data ?? []).map((r) => ({ date: r.date as string, kg: Number(r.kg) }));
}

async function pullExNotes(userId: string): Promise<{ date: string; notes: object }[]> {
  const { data } = await supabase.from("ex_notes").select("date, notes").eq("user_id", userId);
  return (data ?? []) as { date: string; notes: object }[];
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
  isSyncing = true;
  try {
    // Pull en parallèle
    const [remoteSessions, remoteCoachPlans, remoteDayEvents, remoteWeightEntries, remoteExNotes] =
      await Promise.all([
        pullSessions(user.id),
        pullCoachPlans(user.id),
        pullDayEvents(user.id),
        pullWeightEntries(user.id),
        pullExNotes(user.id),
      ]);

    // Merge
    const mergedSessions     = mergeById(remoteSessions, readSessions());
    const mergedCoachPlans   = mergeById(remoteCoachPlans, readCoachPlans());
    const mergedDayEvents    = mergeDayEvents(remoteDayEvents, readDayEvents());
    const mergedWeightEntries = mergeByKey(remoteWeightEntries, readWeightEntries(), "date");
    const mergedExNotes      = mergeByKey(remoteExNotes, readExNotes(), "date");

    // Écriture locale
    writeSessions(mergedSessions);
    writeCoachPlans(mergedCoachPlans);
    writeDayEvents(mergedDayEvents);
    writeWeightEntries(mergedWeightEntries);
    writeExNotes(mergedExNotes);

    // Push en parallèle
    await Promise.all([
      pushSessions(user.id, mergedSessions),
      pushCoachPlans(user.id, mergedCoachPlans),
      pushDayEvents(user.id, mergedDayEvents),
      pushWeightEntries(user.id, mergedWeightEntries),
      pushExNotes(user.id, mergedExNotes),
    ]);

    localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur inconnue" };
  } finally {
    isSyncing = false;
  }
}

/**
 * Push silencieux après toute mutation locale.
 * Propage aussi les suppressions (le remote reflète exactement le local).
 */
export async function autoSyncPush(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  try {
    await Promise.all([
      pushSessions(user.id, readSessions()),
      pushCoachPlans(user.id, readCoachPlans()),
      pushDayEvents(user.id, readDayEvents()),
      pushWeightEntries(user.id, readWeightEntries()),
      pushExNotes(user.id, readExNotes()),
    ]);
    localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
  } catch { /* silent */ }
}
