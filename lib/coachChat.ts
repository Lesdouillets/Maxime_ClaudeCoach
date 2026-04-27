// Client-side lib for the Coach chat feature.
// Handles message history (localStorage + Supabase) and sending messages to the chat-coach Edge Function.

import { supabase } from "./supabase";
import { getSessions } from "./storage";
import { getCoachWorkouts, getCoachRuns, addCoachWorkout, addCoachRun, deleteCoachWorkout, deleteCoachRun, parseCoachWorkoutJSON } from "./coachPlan";
import { getActiveProfile, getActiveProfileId } from "./profiles";
import { getRecentCoachAnalyses, compactSession } from "./coachAnalyzer";
import { autoSyncPush } from "./sync";
import type { CoachPlan } from "./coachPlan";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string; // ISO
  modifiedCount?: number;      // set once plans are applied
  deletedCount?: number;       // set once deletions are applied
  pendingPlans?: unknown[];    // plans proposed by coach, awaiting user confirmation
  pendingDeleteIds?: string[]; // plan IDs proposed for deletion, awaiting confirmation
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
    .maybeSingle();

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

/** Get all future coach plans (from today onwards). The Edge Function handles
 * the near/far split (J0-3 full JSON vs J4+ compact) to keep token usage in check. */
function getCoachPlansForChat(): CoachPlan[] {
  const today = new Date().toISOString().slice(0, 10);
  const workouts = getCoachWorkouts().filter((w) => w.date >= today);
  const runs = getCoachRuns().filter((r) => r.date >= today);
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
  const coachPlans = getCoachPlansForChat();
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

  // Format for API: role + content. For assistant messages with pending plans/deletes,
  // embed the JSON inline so the model retains the proposal data across turns and can
  // accurately move it to modified_plans / delete_plan_ids on user confirmation.
  const apiMessages = history.map((m) => {
    if (m.role === "assistant" && (m.pendingPlans?.length || m.pendingDeleteIds?.length)) {
      const parts: string[] = [m.content];
      if (m.pendingPlans?.length) {
        parts.push(`[pending_plans=${JSON.stringify(m.pendingPlans)}]`);
      }
      if (m.pendingDeleteIds?.length) {
        parts.push(`[pending_delete_ids=${JSON.stringify(m.pendingDeleteIds)}]`);
      }
      return { role: m.role, content: parts.join("\n\n") };
    }
    return { role: m.role, content: m.content };
  });

  try {
    const { data, error } = await supabase.functions.invoke("chat-coach", {
      body: { messages: apiMessages, coachPlans, recentSessions, profileName, previousAnalyses },
    });

    if (error || !data) {
      // Rollback optimistic save on error
      _saveChatLocal(history.slice(0, -1));
      return null;
    }

    // Apply confirmed plans + deletions immediately (user already confirmed)
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

    const confirmedDeletes: string[] = Array.isArray(data.delete_plan_ids) ? data.delete_plan_ids : [];
    let deletedCount = 0;
    for (const id of confirmedDeletes) {
      deleteCoachWorkout(id);
      deleteCoachRun(id);
      deletedCount++;
    }

    // Pending changes require user confirmation before being applied
    const pendingPlans: unknown[] = Array.isArray(data.pending_plans) && data.pending_plans.length > 0
      ? data.pending_plans : [];
    const pendingDeleteIds: string[] = Array.isArray(data.pending_delete_ids) && data.pending_delete_ids.length > 0
      ? data.pending_delete_ids : [];

    const assistantMsg: ChatMessage = {
      id: `chat-${Date.now()}-assistant`,
      role: "assistant",
      content: typeof data.response === "string" ? data.response : "",
      timestamp: new Date().toISOString(),
      modifiedCount: modifiedCount > 0 ? modifiedCount : undefined,
      deletedCount: deletedCount > 0 ? deletedCount : undefined,
      pendingPlans: pendingPlans.length > 0 ? pendingPlans : undefined,
      pendingDeleteIds: pendingDeleteIds.length > 0 ? pendingDeleteIds : undefined,
    };

    const finalHistory = [...history, assistantMsg];
    await saveChatHistory(finalHistory); // persist + push Supabase

    // Sync plan changes to Supabase if any mutations happened
    if (modifiedCount > 0 || deletedCount > 0) {
      try { await autoSyncPush(); } catch { /* silent */ }
    }

    return assistantMsg;
  } catch {
    // Rollback on network error
    _saveChatLocal(history.slice(0, -1));
    return null;
  }
}

/**
 * Apply pending plans + deletions from a coach message and update the message in history.
 * Returns total number of changes applied (creates + deletes), or 0 on failure.
 */
export async function applyPendingPlans(msgId: string): Promise<number> {
  const history = getChatHistory();
  const msgIndex = history.findIndex((m) => m.id === msgId);
  if (msgIndex === -1) return 0;

  const msg = history[msgIndex];
  const hasPending = msg.pendingPlans && msg.pendingPlans.length > 0;
  const hasDeleteIds = msg.pendingDeleteIds && msg.pendingDeleteIds.length > 0;
  if (!hasPending && !hasDeleteIds) return 0;

  let modifiedCount = 0;
  if (hasPending) {
    try {
      const parsed = parseCoachWorkoutJSON(JSON.stringify(msg.pendingPlans));
      for (const plan of parsed) {
        if (plan.type === "fitness") addCoachWorkout(plan);
        else addCoachRun(plan);
      }
      modifiedCount = parsed.length;
    } catch { /* skip */ }
  }

  let deletedCount = 0;
  if (hasDeleteIds) {
    for (const id of msg.pendingDeleteIds!) {
      deleteCoachWorkout(id);
      deleteCoachRun(id);
      deletedCount++;
    }
  }

  const updated: ChatMessage = {
    ...msg,
    pendingPlans: undefined,
    pendingDeleteIds: undefined,
    modifiedCount: modifiedCount > 0 ? modifiedCount : msg.modifiedCount,
    deletedCount: deletedCount > 0 ? deletedCount : msg.deletedCount,
  };
  const newHistory = [...history];
  newHistory[msgIndex] = updated;
  await saveChatHistory(newHistory);

  // Push plan mutations to Supabase so they survive page reloads / pulls
  try { await autoSyncPush(); } catch { /* silent */ }

  return modifiedCount + deletedCount;
}
