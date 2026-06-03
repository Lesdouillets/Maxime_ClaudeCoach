// Client-side lib for the Coach chat feature.
// Handles message history (localStorage + Supabase) and sending messages to the chat-coach Edge Function.

import { supabase } from "./supabase";
import { getSessions } from "./storage";
import { getCoachWorkouts, getCoachRuns, addCoachWorkout, addCoachRun, deleteCoachWorkout, deleteCoachRun, parseCoachWorkoutJSON } from "./coachPlan";
import { getActiveProfile, getActiveProfileId } from "./profiles";
import { getRecentCoachAnalyses, compactSession } from "./coachAnalyzer";
import { autoSyncPush, SYNC_DISABLED } from "./sync";
import { getCoachMemory, mergeCoachMemory } from "./coachMemory";
import type { CoachPlan } from "./coachPlan";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageBase64?: string;
  timestamp: string; // ISO
  error?: boolean;               // ephemeral error state, never persisted
  modifiedCount?: number;      // set once plans are applied
  deletedCount?: number;       // set once deletions are applied
  card?: {
    plans: CoachPlan[];
    deleteIds: string[];
    status: "pending" | "validated";
  };
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
  if (SYNC_DISABLED) return;
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
  if (SYNC_DISABLED) return;
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

/** Archive current conversation then clear it. Throws on Supabase error (no silent loss). */
export async function archiveChatHistory(): Promise<void> {
  const messages = getChatHistory();
  if (messages.length === 0) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("non authentifié");
  const profileId = getActiveProfileId();
  if (!profileId) throw new Error("profil manquant");

  const { error } = await supabase.from("chat_archives").insert({
    user_id: user.id,
    profile_id: profileId,
    messages,
  });
  if (error) throw new Error(error.message);

  // Vider localement — l'archive est en Supabase, c'est la source de vérité
  // pushChatToSupabase peut échouer sans danger : loadChatFromSupabase récupérera au prochain montage
  _saveChatLocal([]);
  try { await pushChatToSupabase(); } catch {
    // Non critique : l'archive est créée, le localStorage est vidé
    console.warn("[archiveChatHistory] sync Supabase échouée, sera récupérée au prochain chargement");
  }
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

export interface ChatAttachments {
  imageBase64: string;
  imageMimeType: string;
}

/**
 * Send a user message to the coach and apply any plan modifications returned.
 * Returns the assistant's ChatMessage, or null on failure.
 */
export async function sendMessage(userText: string, attachments?: ChatAttachments): Promise<ChatMessage | null> {
  const profile = getActiveProfile();
  const profileName = profile?.name ?? "Maxime";

  let userId: string | null = null;
  let profileId: string | null = null;
  try {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    userId = authUser?.id ?? null;
    profileId = getActiveProfileId() ?? null;
  } catch { /* auth indisponible — on envoie sans userId, le coach fonctionnera sans archives */ }

  // Build context
  const recentSessions = getSessions().slice(0, 5).map(compactSession);
  const coachPlans = getCoachPlansForChat();
  const previousAnalyses = getRecentCoachAnalyses(3);

  // Append the new user message to history
  const userMsg: ChatMessage = {
    id: `chat-${Date.now()}-user`,
    role: "user",
    content: userText,
    ...(attachments?.imageBase64 && { imageBase64: attachments.imageBase64 }),
    timestamp: new Date().toISOString(),
  };
  const history = [...getChatHistory(), userMsg];
  _saveChatLocal(history); // optimistic local save before API call

  const apiMessages = history.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // Compute today in the user's local timezone to avoid UTC date drift
  const _d = new Date();
  const today = `${_d.getFullYear()}-${String(_d.getMonth() + 1).padStart(2, "0")}-${String(_d.getDate()).padStart(2, "0")}`;

  const coachMemory = getCoachMemory();

  try {
    const { data, error } = await supabase.functions.invoke("chat-coach", {
      body: {
        messages: apiMessages,
        coachPlans,
        recentSessions,
        profileName,
        previousAnalyses,
        today,
        coachMemory,
        userId,
        profileId,
        ...(attachments?.imageBase64 && {
          imageBase64: attachments.imageBase64,
          imageMimeType: attachments.imageMimeType,
        }),
      },
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
      // The coach may regenerate exercises slightly differently from the proposal.
      // Always apply the original pending_plans (what the user actually approved)
      // rather than the potentially-mutated modified_plans from the API.
      const lastPendingMsg = [...history].reverse().find(
        (m) => m.role === "assistant" && m.card?.status === "pending" && m.card.plans.length > 0
      );
      const plansToApply = lastPendingMsg?.card?.plans ?? (confirmedPlans as CoachPlan[]);
      try {
        const parsed = parseCoachWorkoutJSON(JSON.stringify(plansToApply));
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
    const pendingPlans: CoachPlan[] = Array.isArray(data.pending_plans) && data.pending_plans.length > 0
      ? (data.pending_plans as CoachPlan[]) : [];
    const pendingDeleteIds: string[] = Array.isArray(data.pending_delete_ids) && data.pending_delete_ids.length > 0
      ? (data.pending_delete_ids as string[]) : [];

    // Persister la mise à jour mémoire retournée par le coach si présente
    if (data.memory_update && typeof data.memory_update === "object") {
      mergeCoachMemory(data.memory_update as Parameters<typeof mergeCoachMemory>[0]);
    }

    const assistantMsg: ChatMessage = {
      id: `chat-${Date.now()}-assistant`,
      role: "assistant",
      content: typeof data.response === "string" ? data.response : "",
      timestamp: new Date().toISOString(),
      modifiedCount: modifiedCount > 0 ? modifiedCount : undefined,
      deletedCount: deletedCount > 0 ? deletedCount : undefined,
      card: pendingPlans.length > 0 || pendingDeleteIds.length > 0
        ? { plans: pendingPlans, deleteIds: pendingDeleteIds, status: "pending" as const }
        : undefined,
    };

    const finalHistory = [...history, assistantMsg];
    await saveChatHistory(finalHistory); // persist + push Supabase

    // Sync plan changes to Supabase si mutation de plans ou mise à jour mémoire
    if (modifiedCount > 0 || deletedCount > 0 || (data.memory_update && typeof data.memory_update === "object")) {
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
  if (!msg.card || msg.card.status === "validated") return 0;

  let modifiedCount = 0;
  if (msg.card.plans.length > 0) {
    try {
      const parsed = parseCoachWorkoutJSON(JSON.stringify(msg.card.plans));
      for (const plan of parsed) {
        if (plan.type === "fitness") addCoachWorkout(plan);
        else addCoachRun(plan);
      }
      modifiedCount = parsed.length;
    } catch {
      // JSON des plans malformé — on n'applique rien et on ne valide pas la carte
      return 0;
    }
  }

  let deletedCount = 0;
  for (const id of msg.card.deleteIds) {
    deleteCoachWorkout(id);
    deleteCoachRun(id);
    deletedCount++;
  }

  const updated: ChatMessage = {
    ...msg,
    card: { ...msg.card, status: "validated" },
    modifiedCount: modifiedCount > 0 ? modifiedCount : msg.modifiedCount,
    deletedCount: deletedCount > 0 ? deletedCount : msg.deletedCount,
  };
  const newHistory = [...history];
  newHistory[msgIndex] = updated;
  await saveChatHistory(newHistory);

  try { await autoSyncPush(); } catch { /* silent */ }

  return modifiedCount + deletedCount;
}
