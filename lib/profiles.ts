// Multi-profile engine — exactly 2 profiles per GitHub account
// Core mechanic: on switch, stash active profile data under prefixed keys,
// restore target profile data to canonical keys, then reload.
// All pages keep reading the same localStorage keys — they never know a switch happened.

import { supabase } from "./supabase";

// ─── Constants ────────────────────────────────────────────────────────────────
const ACTIVE_PROFILE_KEY = "cc_active_profile"; // stores active profile UUID
const PROFILE_1_KEY = "cc_profile_1_meta";       // { id, slot, name }
const PROFILE_2_KEY = "cc_profile_2_meta";

// All canonical localStorage keys that are per-profile (must be stashed/restored on switch).
// cc_ex_notes_* dynamic keys are handled separately by enumeration.
export const PROFILED_KEYS = [
  "cc_sessions",
  "cc_coach_workouts",
  "cc_coach_runs",
  "cc_cancelled_days",
  "cc_rescheduled_days",
  "cc_body_weight",
  "cc_strava_tokens",
  "cc_last_strava_fetch",
  "cc_pending_strava",
  "cc_last_sync",
  "cc_chat_history",
  "cc_chat_updated_at",
] as const;

// ─── Types ────────────────────────────────────────────────────────────────────
export interface ProfileMeta {
  id: string;
  slot: 1 | 2;
  name: string;
}

// ─── Synchronous reads (safe to call anywhere) ────────────────────────────────
export function getActiveProfileId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_PROFILE_KEY);
}

export function getActiveProfile(): ProfileMeta | null {
  if (typeof window === "undefined") return null;
  const activeId = getActiveProfileId();
  if (!activeId) return null;
  const p1 = _readMeta(1);
  if (p1?.id === activeId) return p1;
  const p2 = _readMeta(2);
  if (p2?.id === activeId) return p2;
  return null;
}

export function getProfiles(): [ProfileMeta | null, ProfileMeta | null] {
  return [_readMeta(1), _readMeta(2)];
}

// ─── Private helpers ──────────────────────────────────────────────────────────
function _metaKey(slot: 1 | 2): string {
  return slot === 1 ? PROFILE_1_KEY : PROFILE_2_KEY;
}

function _readMeta(slot: 1 | 2): ProfileMeta | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(_metaKey(slot));
    return raw ? JSON.parse(raw) as ProfileMeta : null;
  } catch {
    return null;
  }
}

function _writeMeta(meta: ProfileMeta): void {
  localStorage.setItem(_metaKey(meta.slot), JSON.stringify(meta));
}

function _stashPrefix(slot: 1 | 2): string {
  return `cc_p${slot}_`;
}

// Collect all dynamic cc_ex_notes_* keys currently in localStorage
function _exNoteKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith("cc_ex_notes_")) keys.push(k);
  }
  return keys;
}

// Stash current slot's data under prefixed keys, then clear canonical keys
function _stashSlot(slot: 1 | 2): void {
  const prefix = _stashPrefix(slot);
  // Static keys
  for (const key of PROFILED_KEYS) {
    const val = localStorage.getItem(key);
    if (val !== null) {
      localStorage.setItem(prefix + key, val);
    } else {
      localStorage.removeItem(prefix + key);
    }
  }
  // Dynamic ex_notes keys
  const exKeys = _exNoteKeys();
  for (const key of exKeys) {
    const val = localStorage.getItem(key);
    if (val !== null) {
      localStorage.setItem(prefix + key, val);
    }
    localStorage.removeItem(key);
  }
  // Also clear any stale ex_notes stash entries for this slot that are no longer present
  // (handled naturally — we only restore what we stashed)

  // Clear canonical static keys
  for (const key of PROFILED_KEYS) {
    localStorage.removeItem(key);
  }
}

// Restore target slot's stashed data to canonical keys
function _restoreSlot(slot: 1 | 2): void {
  const prefix = _stashPrefix(slot);
  // Static keys
  for (const key of PROFILED_KEYS) {
    const stashed = localStorage.getItem(prefix + key);
    if (stashed !== null) {
      localStorage.setItem(key, stashed);
    }
    // If no stash, leave absent — will be populated by Supabase pull
  }
  // Dynamic ex_notes stashed keys
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(prefix + "cc_ex_notes_")) {
      const canonical = k.slice(prefix.length);
      const val = localStorage.getItem(k);
      if (val !== null) localStorage.setItem(canonical, val);
    }
  }
}

// ─── Supabase CRUD ────────────────────────────────────────────────────────────
export async function createProfile(slot: 1 | 2, name: string, userId: string): Promise<ProfileMeta> {
  const { data, error } = await supabase
    .from("profiles")
    .insert({ user_id: userId, slot, name })
    .select("id, slot, name")
    .single();
  if (error) throw new Error(error.message);
  const meta: ProfileMeta = { id: data.id as string, slot, name: data.name as string };
  _writeMeta(meta);
  return meta;
}

export async function renameProfile(slot: 1 | 2, name: string): Promise<void> {
  const meta = _readMeta(slot);
  if (!meta) return;
  const { error } = await supabase.from("profiles").update({ name }).eq("id", meta.id);
  if (error) throw new Error(error.message);
  _writeMeta({ ...meta, name });
}

// ─── Boot-time initialisation ─────────────────────────────────────────────────
/**
 * Called once on app boot (in SyncProvider).
 * - If profile meta already in localStorage: nothing to do.
 * - If Supabase has rows but localStorage is stale: rehydrate.
 * - If no profiles exist at all: create slot 1 "Maxime" and backfill existing data.
 */
export async function ensureProfilesExist(userId: string): Promise<void> {
  // Already initialised?
  if (_readMeta(1)) return;

  // Check Supabase for existing profiles
  const { data: rows } = await supabase
    .from("profiles")
    .select("id, slot, name")
    .eq("user_id", userId)
    .order("slot");

  if (rows && rows.length > 0) {
    // Rehydrate meta from Supabase
    for (const row of rows) {
      const meta: ProfileMeta = { id: row.id as string, slot: row.slot as 1 | 2, name: row.name as string };
      _writeMeta(meta);
    }
    // Set active to slot 1 if not already set
    if (!getActiveProfileId()) {
      const slot1 = rows.find((r) => r.slot === 1);
      if (slot1) localStorage.setItem(ACTIVE_PROFILE_KEY, slot1.id as string);
    }
    return;
  }

  // First run — create slot 1
  const { data: inserted, error } = await supabase
    .from("profiles")
    .insert({ user_id: userId, slot: 1, name: "Maxime" })
    .select("id, slot, name")
    .single();
  if (error || !inserted) return;

  const meta: ProfileMeta = { id: inserted.id as string, slot: 1, name: inserted.name as string };
  _writeMeta(meta);
  localStorage.setItem(ACTIVE_PROFILE_KEY, meta.id);

  // Backfill existing data to profile 1
  await _backfillProfileId(userId, meta.id);
}

async function _backfillProfileId(userId: string, profileId: string): Promise<void> {
  const tables = ["sessions", "coach_plans", "day_events", "weight_entries", "ex_notes"] as const;
  await Promise.all(
    tables.map((table) =>
      supabase
        .from(table)
        .update({ profile_id: profileId })
        .eq("user_id", userId)
        .is("profile_id", null)
    )
  );
}

// ─── Profile switch (the core ceremony) ──────────────────────────────────────
/**
 * Switches the active profile:
 * 1. Push current state to Supabase
 * 2. Stash current profile's localStorage data under prefixed keys
 * 3. Restore target profile's stashed data to canonical keys
 * 4. Update active profile pointer
 * 5. Pull target profile's data from Supabase
 * 6. Dispatch cc:profileSwitch event
 * 7. Reload page
 */
export async function switchProfile(targetSlot: 1 | 2): Promise<void> {
  const currentMeta = getActiveProfile();
  if (!currentMeta) throw new Error("No active profile");
  if (currentMeta.slot === targetSlot) return;

  const targetMeta = _readMeta(targetSlot);
  if (!targetMeta) throw new Error("Target profile not initialized");

  // Lazy import to avoid circular deps (sync.ts imports profiles.ts)
  const { syncFull, syncFullForProfile } = await import("./sync");

  // Step 1: push current profile's data to Supabase
  await syncFull();

  // Step 2: stash current slot's data + clear canonical keys
  _stashSlot(currentMeta.slot);

  // Step 3: restore target slot's stashed data to canonical keys
  _restoreSlot(targetSlot);

  // Step 4: update active profile pointer
  localStorage.setItem(ACTIVE_PROFILE_KEY, targetMeta.id);

  // Step 5: pull target profile from Supabase and merge with restored local
  await syncFullForProfile(targetMeta.id);

  // Step 6: notify SyncProvider to resubscribe Realtime channel
  window.dispatchEvent(new CustomEvent("cc:profileSwitch", {
    detail: { slot: targetSlot, profileId: targetMeta.id },
  }));

  // Step 7: reload to flush all React state
  window.location.reload();
}
