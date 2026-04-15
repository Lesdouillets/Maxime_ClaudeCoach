// Client-side lib for the Coach chat feature.
// Handles message history (localStorage + Supabase) and sending messages to the chat-coach Edge Function.

import { supabase } from "./supabase";
import { getSessions } from "./storage";
import { getCoachWorkouts, getCoachRuns, addCoachWorkout, addCoachRun, parseCoachWorkoutJSON } from "./coachPlan";
import { getActiveProfile, getActiveProfileId } from "./profiles";
import { getRecentCoachAnalyses, compactSession } from "./coachAnalyzer";
import type { CoachPlan } from "./coachPlan";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string; // ISO
  modifiedCount?: number;   // set once plans are applied
  pendingPlans?: unknown[]; // plans proposed by coach, awaiting user confirmation
}

// ─── localStorage keys ────────────────────────────────────────────────────────

const KEY_HISTORY = "cc_chat_history";
const KEY_UPDATED_AT = "cc_chat_updated_at";

// ─── Local storage helpers ────────────────────────────────────────────────────

export function getChatHistory(): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY_HISTORY);
    return raw ? (JSON.parse(raw) as ChatMessage[]) : [];
  } catch { return []; }
}

function _saveChatLocal(messages: ChatMessage[]): void {
  const now = new Date().toISOString();
  localStorage.setItem(KEY_HISTORY, JSON.stringify(messages));
  localStorage.setItem(KEY_UPDATED_AT, now);
}

// ─── Supabase push / pull ─────────────────────────────────────────────────────

export async function pushChatToSupabase(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const profileId = getActiveProfileId();
  if (!profileId) return;
  const messages = getChatHistory();
  const updatedAt = localStorage.getItem(KEY_UPDATED_AT) ?? new Date().toISOString();
  const { error } = await supabase.from("chat_messages").upsert(
    { user_id: user.id, profile_id: profileId, messages, updated_at: updatedAt },
    { onConflict: "user_id,profile_id" }
  );
  if (error) throw new Error(error.message);
}

export async function pullChatFromSupabase(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const profileId = getActiveProfileId();
  if (!profileId) return;

  const { data } = await supabase.from("chat_messages")
    .select("messages, updated_at")
    .eq("user_id", user.id)
    .eq("profile_id", profileId)
    .single();

  if (!data) return;

  const remoteUpdatedAt = data.updated_at as string;
  const localUpdatedAt = localStorage.getItem(KEY_UPDATED_AT) ?? "";

  // Last-write-wins: only overwrite local if remote is newer
  if (remoteUpdatedAt > localUpdatedAt) {
    localStorage.setItem(KEY_HISTORY, JSON.stringify(data.messages));
    localStorage.setItem(KEY_UPDATED_AT, remoteUpdatedAt);
  }
}

/** Load chat history from Supabase on mount (last-write-wins) */
export async function loadChatFromSupabase(): Promise<void> {
  try {
    await pullChatFromSupabase();
  } catch { /* silent — local data stays */ }
}

/** Persist history locally then push to Supabase */
export async function saveChatHistory(messages: ChatMessage[]): Promise<void> {
  _saveChatLocal(messages);
  try { await pushChatToSupabase(); } catch { /* silent */ }
}

/** Clear all chat history (locally + Supabase) */
export async function clearChatHistory(): Promise<void> {
  await saveChatHistory([]);
}

// ─── Context builders ─────────────────────────────────────────────────────────

/** Get coach plans from today up to `days` ahead, split into near (full JSON) and far (compact) */
function getCoachPlansForChat(days: number): CoachPlan[] {
  const today = new Date().toISOString().slice(0, 10);
  const end = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const workouts = getCoachWorkouts().filter((w) => w.date >= today && w.date <= end);
  const runs = getCoachRuns().filter((r) => r.date >= today && r.date <= end);
  return [...workouts, ...runs].sort((a, b) => a.date.localeCompare(b.date));
}

// ─── Send message ─────────────────────────────────────────────────────────────

/**
 * Send a user message to the coach and apply any plan modifications returned.
 * Returns the assistant's ChatMessage, or null on failure.
 */
export async function sendMessage(userText: string): Promise<ChatMessage | null> {
  const profile = getActiveProfile();
  const profileName = profile?.name ?? "Maxime";

  // Build context
  const recentSessions = getSessions().slice(0, 5).map(compactSession);
  const coachPlans = getCoachPlansForChat(21);
  const previousAnalyses = getRecentCoachAnalyses(3);

  // Append the new user message to history
  const userMsg: ChatMessage = {
    id: `chat-${Date.now()}-user`,
    role: "user",
    content: userText,
    timestamp: new Date().toISOString(),
  };
  const history = [...getChatHistory(), userMsg];
  _saveChatLocal(history); // optimistic local save before API call

  // Format for API: only role + content
  const apiMessages = history.map((m) => ({ role: m.role, content: m.content }));

  try {
    const { data, error } = await supabase.functions.invoke("chat-coach", {
      body: { messages: apiMessages, coachPlans, recentSessions, profileName, previousAnalyses },
    });

    if (error || !data) {
      // Rollback optimistic save on error
      _saveChatLocal(history.slice(0, -1));
      return null;
    }

    // Apply confirmed plans immediately (coach said "yes" / user confirmed)
    const confirmedPlans: unknown[] = Array.isArray(data.modified_plans) ? data.modified_plans : [];
    let modifiedCount = 0;
    if (confirmedPlans.length > 0) {
      try {
        const parsed = parseCoachWorkoutJSON(JSON.stringify(confirmedPlans));
        for (const plan of parsed) {
          if (plan.type === "fitness") addCoachWorkout(plan);
          else addCoachRun(plan);
        }
        modifiedCount = parsed.length;
      } catch { /* Malformed response — skip silently */ }
    }

    // Pending plans require user confirmation before being applied
    const pendingPlans: unknown[] = Array.isArray(data.pending_plans) && data.pending_plans.length > 0
      ? data.pending_plans
      : [];

    const assistantMsg: ChatMessage = {
      id: `chat-${Date.now()}-assistant`,
      role: "assistant",
      content: typeof data.response === "string" ? data.response : "",
      timestamp: new Date().toISOString(),
      modifiedCount: modifiedCount > 0 ? modifiedCount : undefined,
      pendingPlans: pendingPlans.length > 0 ? pendingPlans : undefined,
    };

    const finalHistory = [...history, assistantMsg];
    await saveChatHistory(finalHistory); // persist + push Supabase

    return assistantMsg;
  } catch {
    // Rollback on network error
    _saveChatLocal(history.slice(0, -1));
    return null;
  }
}

/**
 * Apply pending plans from a coach message and update the message in history.
 * Returns the number of plans applied, or 0 on failure.
 */
export async function applyPendingPlans(msgId: string): Promise<number> {
  const history = getChatHistory();
  const msgIndex = history.findIndex((m) => m.id === msgId);
  if (msgIndex === -1) return 0;

  const msg = history[msgIndex];
  if (!msg.pendingPlans || msg.pendingPlans.length === 0) return 0;

  let modifiedCount = 0;
  try {
    const parsed = parseCoachWorkoutJSON(JSON.stringify(msg.pendingPlans));
    for (const plan of parsed) {
      if (plan.type === "fitness") addCoachWorkout(plan);
      else addCoachRun(plan);
    }
    modifiedCount = parsed.length;
  } catch { return 0; }

  // Update message: remove pendingPlans, set modifiedCount
  const updated: ChatMessage = { ...msg, pendingPlans: undefined, modifiedCount };
  const newHistory = [...history];
  newHistory[msgIndex] = updated;
  await saveChatHistory(newHistory);

  return modifiedCount;
}
