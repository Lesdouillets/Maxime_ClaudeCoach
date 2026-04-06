// GitHub Gist-based sync — no commits, auto-discovery by description

const TOKEN_KEY = "cc_gh_token";
const GIST_ID_KEY = "cc_gist_id"; // auto-cached, never shown to user
const LAST_SYNC_KEY = "cc_last_sync";
const LAST_GIST_AT_KEY = "cc_last_gist_at"; // exportedAt of the last Gist we wrote locally
const GIST_DESCRIPTION = "claude-coach-data";
const GIST_FILENAME = "claude-coach-data.json";

// ─── Token / Gist ID storage ───────────────────────────────────────────────
export function getGitHubToken(): string { return localStorage.getItem(TOKEN_KEY) ?? ""; }
export function setGitHubToken(t: string) {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}
export function getLastSync(): string { return localStorage.getItem(LAST_SYNC_KEY) ?? ""; }
export function isSyncConfigured(): boolean { return !!getGitHubToken(); }
export function getStoredGistId(): string { return localStorage.getItem(GIST_ID_KEY) ?? ""; }
export function setStoredGistId(id: string) {
  if (id) localStorage.setItem(GIST_ID_KEY, id);
  else localStorage.removeItem(GIST_ID_KEY);
}

// ─── Local data helpers ─────────────────────────────────────────────────────
type SyncPayload = {
  exportedAt: string;
  cc_sessions: unknown[];
  cc_coach_workouts: unknown[];
  cc_coach_runs: unknown[];
  cc_cancelled_days: unknown[];
  cc_rescheduled_days: unknown[];
  cc_body_weight: unknown[];
  cc_ex_notes: Record<string, unknown>;
};

const DATA_KEYS = [
  "cc_sessions",
  "cc_coach_workouts",
  "cc_coach_runs",
  "cc_cancelled_days",
  "cc_rescheduled_days",
  "cc_body_weight",
] as const;

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
    exportedAt: new Date().toISOString(),
    cc_sessions: get("cc_sessions"),
    cc_coach_workouts: get("cc_coach_workouts"),
    cc_coach_runs: get("cc_coach_runs"),
    cc_cancelled_days: get("cc_cancelled_days"),
    cc_rescheduled_days: get("cc_rescheduled_days"),
    cc_body_weight: get("cc_body_weight"),
    cc_ex_notes: notes,
  };
}

function writeLocal(data: SyncPayload) {
  DATA_KEYS.forEach((k) => {
    localStorage.setItem(k, JSON.stringify(data[k] ?? []));
  });
  if (data.cc_ex_notes) {
    Object.entries(data.cc_ex_notes).forEach(([k, v]) => {
      localStorage.setItem(k, JSON.stringify(v));
    });
  }
  localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
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

/**
 * Find or create the sync gist. Returns the gist ID.
 * Searches existing gists for one with description = GIST_DESCRIPTION.
 * Creates a new private gist if none found.
 */
async function resolveGistId(token: string): Promise<string> {
  // Check local cache first
  const cached = localStorage.getItem(GIST_ID_KEY);
  if (cached) return cached;

  // Search user's gists for existing sync gist (paginated, check first 2 pages)
  for (let page = 1; page <= 2; page++) {
    const res = await fetch(`https://api.github.com/gists?per_page=100&page=${page}`, {
      headers: ghHeaders(token),
    });
    if (!res.ok) break;
    const gists = await res.json() as { id: string; description: string }[];
    if (gists.length === 0) break;
    const found = gists.find((g) => g.description === GIST_DESCRIPTION);
    if (found) {
      localStorage.setItem(GIST_ID_KEY, found.id);
      return found.id;
    }
  }

  // Not found → create new private gist
  const createRes = await fetch("https://api.github.com/gists", {
    method: "POST",
    headers: ghHeaders(token),
    body: JSON.stringify({
      description: GIST_DESCRIPTION,
      public: false,
      files: { [GIST_FILENAME]: { content: JSON.stringify(readLocal(), null, 2) } },
    }),
  });
  if (!createRes.ok) throw new Error(`Impossible de créer le Gist: ${createRes.status}`);
  const gist = await createRes.json() as { id: string };
  localStorage.setItem(GIST_ID_KEY, gist.id);
  return gist.id;
}

/** Fetch gist content */
async function fetchGist(token: string, gistId: string): Promise<SyncPayload | null> {
  const res = await fetch(`https://api.github.com/gists/${gistId}`, {
    headers: ghHeaders(token),
  });
  if (res.status === 404) {
    // Gist deleted externally — clear cache so next call recreates it
    localStorage.removeItem(GIST_ID_KEY);
    return null;
  }
  if (!res.ok) throw new Error(`Erreur lecture Gist: ${res.status}`);
  const gist = await res.json() as { files: Record<string, { content: string }> };
  const file = gist.files?.[GIST_FILENAME];
  if (!file) return null;
  return JSON.parse(file.content) as SyncPayload;
}

/** Update gist content */
async function updateGist(token: string, gistId: string, data: SyncPayload): Promise<void> {
  const res = await fetch(`https://api.github.com/gists/${gistId}`, {
    method: "PATCH",
    headers: ghHeaders(token),
    body: JSON.stringify({
      files: { [GIST_FILENAME]: { content: JSON.stringify(data, null, 2) } },
    }),
  });
  if (!res.ok) throw new Error(`Erreur écriture Gist: ${res.status}`);
}

// ─── Public sync API ─────────────────────────────────────────────────────────

export type SyncResult = {
  ok: boolean;
  error?: string;
  sessionCount?: number;
  exportedAt?: string;
};

/** Merge two arrays deduplicating by a string key. Remote wins for duplicates. */
function mergeByKey<T>(remote: T[], local: T[], key: keyof T): T[] {
  const seen = new Set(remote.map((x) => String(x[key])));
  const localOnly = local.filter((x) => !seen.has(String(x[key])));
  return localOnly.length > 0 ? [...remote, ...localOnly] : remote;
}

/** Merge remote payload with current local storage — never erase local-only entries. */
function mergeWithLocal(remote: SyncPayload): SyncPayload {
  const get = (key: string): unknown[] => {
    try { return JSON.parse(localStorage.getItem(key) ?? "[]") as unknown[]; }
    catch { return []; }
  };
  return {
    ...remote,
    cc_sessions:        mergeByKey(remote.cc_sessions        as { id: string }[],   get("cc_sessions")        as { id: string }[],   "id"),
    cc_coach_workouts:  mergeByKey(remote.cc_coach_workouts  as { id: string }[],   get("cc_coach_workouts")  as { id: string }[],   "id"),
    cc_coach_runs:      mergeByKey(remote.cc_coach_runs      as { id: string }[],   get("cc_coach_runs")      as { id: string }[],   "id"),
    cc_cancelled_days:  mergeByKey(remote.cc_cancelled_days  as { date: string }[], get("cc_cancelled_days")  as { date: string }[], "date"),
    cc_rescheduled_days:mergeByKey(remote.cc_rescheduled_days as { from: string }[], get("cc_rescheduled_days") as { from: string }[], "from"),
    cc_body_weight:     mergeByKey(remote.cc_body_weight     as { date: string }[], get("cc_body_weight")     as { date: string }[], "date"),
  };
}

/**
 * Silent auto-pull on app load.
 * Guards against overwriting fresh local data with a stale Gist:
 *   1. Skip if Gist hasn't changed since our last pull.
 *   2. Skip if we pushed more recently than the remote (local is authoritative).
 *   3. Merge ALL arrays by unique key — local-only entries are never erased.
 */
export async function autoSyncPull(): Promise<void> {
  const token = getGitHubToken();
  if (!token) return;
  try {
    const gistId = await resolveGistId(token);
    const remote = await fetchGist(token, gistId);
    if (!remote) return;

    // 1. Skip if remote hasn't changed since our last pull
    const lastGistAt = localStorage.getItem(LAST_GIST_AT_KEY) ?? "";
    if (lastGistAt && remote.exportedAt <= lastGistAt) return;

    // 2. Skip if local was pushed more recently than remote (our data is newer)
    const lastSync = localStorage.getItem(LAST_SYNC_KEY) ?? "";
    if (lastSync && lastSync >= remote.exportedAt) return;

    // 3. Merge: keep local-only entries across all data types
    writeLocal(mergeWithLocal(remote));
    localStorage.setItem(LAST_GIST_AT_KEY, remote.exportedAt);
  } catch { /* silent */ }
}

/**
 * Silent auto-push after any mutation.
 * Writes local state to gist immediately.
 */
export async function autoSyncPush(): Promise<void> {
  const token = getGitHubToken();
  if (!token) return;
  try {
    const payload = readLocal(); // exportedAt = now
    const gistId = await resolveGistId(token);
    await updateGist(token, gistId, payload);
    const now = payload.exportedAt;
    localStorage.setItem(LAST_SYNC_KEY, now);
    localStorage.setItem(LAST_GIST_AT_KEY, now); // Gist is now at this timestamp
  } catch { /* silent */ }
}

/**
 * Manual sync triggered from Settings. Returns result for UI feedback.
 */
export async function manualSync(token: string): Promise<SyncResult> {
  try {
    const gistId = await resolveGistId(token);
    await updateGist(token, gistId, readLocal());
    localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur inconnue" };
  }
}

/**
 * Force pull from Gist — bypasses all timestamp guards.
 * Use for recovery (e.g. app pointed to wrong Gist after data loss).
 */
export async function forcePull(token: string): Promise<SyncResult> {
  try {
    const gistId = await resolveGistId(token);
    const remote = await fetchGist(token, gistId);
    if (!remote) return { ok: false, error: `Gist introuvable (ID: ${gistId.slice(0, 8)}…)` };
    const sessionCount = Array.isArray(remote.cc_sessions) ? (remote.cc_sessions as unknown[]).length : 0;
    if (sessionCount === 0) {
      return { ok: false, error: `Gist trouvé mais 0 séances dedans (ID: ${gistId.slice(0, 8)}…). Vérifie que tu as copié le bon ID.`, sessionCount: 0 };
    }
    writeLocal(mergeWithLocal(remote));
    localStorage.setItem(LAST_GIST_AT_KEY, remote.exportedAt);
    localStorage.setItem(LAST_SYNC_KEY, remote.exportedAt);
    return { ok: true, sessionCount, exportedAt: remote.exportedAt };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur inconnue" };
  }
}
