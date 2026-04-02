// GitHub Gist-based sync for cross-device data sharing

const TOKEN_KEY = "cc_gh_token";
const GIST_ID_KEY = "cc_gist_id";
const LAST_SYNC_KEY = "cc_last_sync";
const GIST_FILENAME = "claude-coach-data.json";

// ─── Token / Gist ID storage ───────────────────────────────────────────────
export function getGitHubToken(): string { return localStorage.getItem(TOKEN_KEY) ?? ""; }
export function setGitHubToken(t: string) {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}
export function getGistId(): string { return localStorage.getItem(GIST_ID_KEY) ?? ""; }
export function setGistId(id: string) {
  if (id) localStorage.setItem(GIST_ID_KEY, id);
  else localStorage.removeItem(GIST_ID_KEY);
}
export function getLastSync(): string { return localStorage.getItem(LAST_SYNC_KEY) ?? ""; }

// ─── Export / Import helpers ────────────────────────────────────────────────
const DATA_KEYS = [
  "cc_sessions",
  "cc_coach_workouts",
  "cc_coach_runs",
  "cc_cancelled",
  "cc_rescheduled",
] as const;

type SyncPayload = {
  exportedAt: string;
  cc_sessions: unknown[];
  cc_coach_workouts: unknown[];
  cc_coach_runs: unknown[];
  cc_cancelled: unknown[];
  cc_rescheduled: unknown[];
  cc_ex_notes: Record<string, unknown>; // "cc_ex_notes_YYYY-MM-DD" → notes object
};

function readLocal(): SyncPayload {
  const get = (key: string): unknown[] => {
    try { return JSON.parse(localStorage.getItem(key) ?? "[]") as unknown[]; }
    catch { return []; }
  };
  // Collect all cc_ex_notes_* keys
  const notes: Record<string, unknown> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith("cc_ex_notes_")) {
      try { notes[k] = JSON.parse(localStorage.getItem(k) ?? "{}"); } catch {}
    }
  }
  return {
    exportedAt: new Date().toISOString(),
    cc_sessions: get("cc_sessions"),
    cc_coach_workouts: get("cc_coach_workouts"),
    cc_coach_runs: get("cc_coach_runs"),
    cc_cancelled: get("cc_cancelled"),
    cc_rescheduled: get("cc_rescheduled"),
    cc_ex_notes: notes,
  };
}

function writeLocal(data: SyncPayload) {
  DATA_KEYS.forEach((k) => {
    localStorage.setItem(k, JSON.stringify(data[k] ?? []));
  });
  // Restore exercise notes
  if (data.cc_ex_notes) {
    Object.entries(data.cc_ex_notes).forEach(([k, v]) => {
      localStorage.setItem(k, JSON.stringify(v));
    });
  }
  localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
}

/** Merge two arrays of objects, deduplicating by a key field. Local overrides remote on conflict. */
function mergeById<T extends Record<string, unknown>>(
  remote: T[], local: T[], key: string
): T[] {
  const map = new Map<unknown, T>();
  remote.forEach((item) => map.set(item[key], item));
  local.forEach((item) => map.set(item[key], item)); // local wins
  return Array.from(map.values());
}

function mergeSyncPayloads(remote: SyncPayload, local: SyncPayload): SyncPayload {
  return {
    exportedAt: new Date().toISOString(),
    cc_sessions: mergeById(remote.cc_sessions as Record<string, unknown>[], local.cc_sessions as Record<string, unknown>[], "id"),
    cc_coach_workouts: mergeById(remote.cc_coach_workouts as Record<string, unknown>[], local.cc_coach_workouts as Record<string, unknown>[], "id"),
    cc_coach_runs: mergeById(remote.cc_coach_runs as Record<string, unknown>[], local.cc_coach_runs as Record<string, unknown>[], "id"),
    cc_cancelled: mergeById(remote.cc_cancelled as Record<string, unknown>[], local.cc_cancelled as Record<string, unknown>[], "date"),
    cc_rescheduled: mergeById(remote.cc_rescheduled as Record<string, unknown>[], local.cc_rescheduled as Record<string, unknown>[], "from"),
    cc_ex_notes: { ...(remote.cc_ex_notes ?? {}), ...(local.cc_ex_notes ?? {}) }, // local wins
  };
}

// ─── GitHub API helpers ─────────────────────────────────────────────────────
function ghHeaders(token: string): HeadersInit {
  return {
    Authorization: `token ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  };
}

/** Verify PAT and return GitHub username */
export async function verifyToken(token: string): Promise<{ ok: boolean; login?: string; error?: string }> {
  try {
    const res = await fetch("https://api.github.com/user", { headers: ghHeaders(token) });
    if (res.status === 401) return { ok: false, error: "Token invalide ou expiré." };
    if (!res.ok) return { ok: false, error: `Erreur GitHub ${res.status}` };
    const user = await res.json() as { login: string };
    return { ok: true, login: user.login };
  } catch {
    return { ok: false, error: "Impossible de contacter GitHub (réseau ?)" };
  }
}

/** Fetch gist content. Returns null if not found. */
async function fetchGist(token: string, gistId: string): Promise<SyncPayload | null> {
  const res = await fetch(`https://api.github.com/gists/${gistId}`, {
    headers: ghHeaders(token),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Gist fetch error: ${res.status}`);
  const gist = await res.json() as { files: Record<string, { content: string }> };
  const file = gist.files?.[GIST_FILENAME];
  if (!file) return null;
  return JSON.parse(file.content) as SyncPayload;
}

/** Create a new private gist and return its ID */
async function createGist(token: string, data: SyncPayload): Promise<string> {
  const res = await fetch("https://api.github.com/gists", {
    method: "POST",
    headers: ghHeaders(token),
    body: JSON.stringify({
      description: "Claude Coach — sync data",
      public: false,
      files: { [GIST_FILENAME]: { content: JSON.stringify(data, null, 2) } },
    }),
  });
  if (!res.ok) throw new Error(`Gist create error: ${res.status}`);
  const gist = await res.json() as { id: string };
  return gist.id;
}

/** Update existing gist */
async function updateGist(token: string, gistId: string, data: SyncPayload): Promise<void> {
  const res = await fetch(`https://api.github.com/gists/${gistId}`, {
    method: "PATCH",
    headers: ghHeaders(token),
    body: JSON.stringify({
      files: { [GIST_FILENAME]: { content: JSON.stringify(data, null, 2) } },
    }),
  });
  if (!res.ok) throw new Error(`Gist update error: ${res.status}`);
}

// ─── Public sync API ─────────────────────────────────────────────────────────

export type SyncResult = {
  ok: boolean;
  gistId?: string;
  error?: string;
  added?: { sessions: number; coachPlans: number };
};

/**
 * Full bidirectional sync:
 * 1. Pull remote gist (if exists)
 * 2. Merge remote + local (union by id, local wins conflicts)
 * 3. Write merged data locally
 * 4. Push merged data to gist (create if no gistId)
 */
export async function syncData(token: string, gistId?: string): Promise<SyncResult> {
  try {
    const local = readLocal();
    let merged = local;

    if (gistId) {
      const remote = await fetchGist(token, gistId);
      if (remote) {
        merged = mergeSyncPayloads(remote, local);
      }
    }

    const countBefore = {
      sessions: local.cc_sessions.length,
      plans: local.cc_coach_workouts.length + local.cc_coach_runs.length,
    };

    writeLocal(merged);

    const newGistId = gistId
      ? (await updateGist(token, gistId, merged), gistId)
      : await createGist(token, merged);

    if (!gistId) setGistId(newGistId);

    return {
      ok: true,
      gistId: newGistId,
      added: {
        sessions: merged.cc_sessions.length - countBefore.sessions,
        coachPlans: (merged.cc_coach_workouts.length + merged.cc_coach_runs.length) - countBefore.plans,
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur inconnue" };
  }
}

/** Push local data to gist, overwriting remote completely */
export async function pushData(token: string, gistId: string): Promise<SyncResult> {
  try {
    const local = readLocal();
    await updateGist(token, gistId, local);
    localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
    return { ok: true, gistId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur inconnue" };
  }
}

/** Pull remote gist data, overwriting local completely */
export async function pullData(token: string, gistId: string): Promise<SyncResult> {
  try {
    const remote = await fetchGist(token, gistId);
    if (!remote) return { ok: false, error: "Gist introuvable." };
    const countBefore = {
      sessions: (JSON.parse(localStorage.getItem("cc_sessions") ?? "[]") as unknown[]).length,
      plans: (JSON.parse(localStorage.getItem("cc_coach_workouts") ?? "[]") as unknown[]).length +
             (JSON.parse(localStorage.getItem("cc_coach_runs") ?? "[]") as unknown[]).length,
    };
    writeLocal(remote);
    return {
      ok: true,
      gistId,
      added: {
        sessions: remote.cc_sessions.length - countBefore.sessions,
        coachPlans: (remote.cc_coach_workouts.length + remote.cc_coach_runs.length) - countBefore.plans,
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur inconnue" };
  }
}

/** Quick check: does the token have gist scope? */
export function isSyncConfigured(): boolean {
  return !!(getGitHubToken() && getGistId());
}

/** Silent auto-pull: on app load, get latest data from cloud. No-op if not configured. */
export async function autoSyncPull(): Promise<void> {
  const token = getGitHubToken();
  const gistId = getGistId();
  if (!token || !gistId) return;
  try {
    const remote = await fetchGist(token, gistId);
    if (!remote) return;
    // Merge remote into local so we don't lose anything entered on this device
    const local = readLocal();
    const merged = mergeSyncPayloads(remote, local);
    writeLocal(merged);
  } catch { /* silent */ }
}

/** Silent auto-push: after any mutation, save local state to cloud. No-op if not configured. */
export async function autoSyncPush(): Promise<void> {
  const token = getGitHubToken();
  const gistId = getGistId();
  if (!token || !gistId) return;
  try {
    const local = readLocal();
    await updateGist(token, gistId, local);
    localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
  } catch { /* silent */ }
}
