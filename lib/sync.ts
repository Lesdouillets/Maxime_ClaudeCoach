// GitHub Gist-based sync — single file, auto-discovery by description

const TOKEN_KEY = "cc_gh_token";
const GIST_ID_KEY = "cc_gist_id"; // auto-cached, never shown to user
const LAST_SYNC_KEY = "cc_last_sync"; // ISO timestamp, displayed in Settings
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
 * Find or create the sync Gist. Returns the Gist ID.
 * If multiple Gists with the same description exist, picks the OLDEST one
 * (most likely the original with all data, not an accidentally-created empty one).
 */
async function resolveGistId(token: string): Promise<string> {
  const cached = localStorage.getItem(GIST_ID_KEY);
  if (cached) return cached;

  // Collect ALL matching gists across pages (GitHub returns newest first)
  const matching: { id: string; created_at: string }[] = [];
  for (let page = 1; page <= 3; page++) {
    const res = await fetch(`https://api.github.com/gists?per_page=100&page=${page}`, {
      headers: ghHeaders(token),
    });
    if (!res.ok) break;
    const gists = await res.json() as { id: string; description: string; created_at: string }[];
    if (gists.length === 0) break;
    matching.push(...gists.filter((g) => g.description === GIST_DESCRIPTION));
  }

  if (matching.length > 0) {
    // Pick the oldest — it's the original Gist with all accumulated data
    const oldest = matching.sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
    localStorage.setItem(GIST_ID_KEY, oldest.id);
    return oldest.id;
  }

  // Not found → create new private Gist with current local data
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

/** Fetch Gist content */
async function fetchGist(token: string, gistId: string): Promise<SyncPayload | null> {
  const res = await fetch(`https://api.github.com/gists/${gistId}`, {
    headers: ghHeaders(token),
  });
  if (res.status === 404) {
    localStorage.removeItem(GIST_ID_KEY); // stale cache — will re-discover next call
    return null;
  }
  if (!res.ok) throw new Error(`Erreur lecture Gist: ${res.status}`);
  const gist = await res.json() as { files: Record<string, { content: string }> };
  const file = gist.files?.[GIST_FILENAME];
  if (!file) return null;
  return JSON.parse(file.content) as SyncPayload;
}

/** Update Gist content */
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

// ─── Merge helpers ───────────────────────────────────────────────────────────

/** Union two arrays by a unique string key. Remote wins for duplicates. */
function mergeByKey<T>(remote: T[], local: T[], key: keyof T): T[] {
  const seen = new Set(remote.map((x) => String(x[key])));
  const localOnly = local.filter((x) => !seen.has(String(x[key])));
  return localOnly.length > 0 ? [...remote, ...localOnly] : remote;
}

/** Merge remote payload into current local state. Local-only entries are never erased. */
function mergeWithLocal(remote: SyncPayload): SyncPayload {
  const get = (key: string): unknown[] => {
    try { return JSON.parse(localStorage.getItem(key) ?? "[]") as unknown[]; }
    catch { return []; }
  };
  return {
    ...remote,
    cc_sessions:         mergeByKey(remote.cc_sessions         as { id: string }[],   get("cc_sessions")         as { id: string }[],   "id"),
    cc_coach_workouts:   mergeByKey(remote.cc_coach_workouts   as { id: string }[],   get("cc_coach_workouts")   as { id: string }[],   "id"),
    cc_coach_runs:       mergeByKey(remote.cc_coach_runs       as { id: string }[],   get("cc_coach_runs")       as { id: string }[],   "id"),
    cc_cancelled_days:   mergeByKey(remote.cc_cancelled_days   as { date: string }[], get("cc_cancelled_days")   as { date: string }[], "date"),
    cc_rescheduled_days: mergeByKey(remote.cc_rescheduled_days as { from: string }[], get("cc_rescheduled_days") as { from: string }[], "from"),
    cc_body_weight:      mergeByKey(remote.cc_body_weight      as { date: string }[], get("cc_body_weight")      as { date: string }[], "date"),
  };
}

// ─── Public sync API ─────────────────────────────────────────────────────────

export type SyncResult = { ok: boolean; error?: string };

// Mutex — prevents concurrent sync calls
let isSyncing = false;

/**
 * Full bidirectional sync: pull → merge → push.
 * - Fetches remote Gist, merges into local (union, never erases local data)
 * - Pushes the merged result back so the Gist is always up to date
 * - Protected by a mutex to prevent concurrent calls
 * Call on: app open, visibilitychange, manual button in Settings
 */
export async function syncFull(): Promise<SyncResult> {
  if (isSyncing) return { ok: false };
  const token = getGitHubToken();
  if (!token) return { ok: false };
  isSyncing = true;
  try {
    const gistId = await resolveGistId(token);
    const remote = await fetchGist(token, gistId);
    const merged = remote ? mergeWithLocal(remote) : readLocal();
    writeLocal(merged);
    const payload = readLocal(); // re-read with fresh exportedAt
    await updateGist(token, gistId, payload);
    localStorage.setItem(LAST_SYNC_KEY, payload.exportedAt);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur inconnue" };
  } finally {
    isSyncing = false;
  }
}

/**
 * Silent push after any local mutation (session log, cancel, reschedule…).
 * Does not pull — just pushes current local state immediately.
 */
export async function autoSyncPush(): Promise<void> {
  const token = getGitHubToken();
  if (!token) return;
  try {
    const payload = readLocal();
    const gistId = await resolveGistId(token);
    await updateGist(token, gistId, payload);
    localStorage.setItem(LAST_SYNC_KEY, payload.exportedAt);
  } catch { /* silent */ }
}
