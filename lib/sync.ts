// GitHub repo-based sync — source of truth is sync.json on the `data` branch

const TOKEN_KEY = "cc_gh_token";
const LAST_SYNC_KEY = "cc_last_sync";
const CACHED_SHA_KEY = "cc_sync_sha";

const REPO_OWNER = "lesdouillets";
const REPO_NAME = "maxime_claudecoach";
const DATA_BRANCH = "data";
const DATA_FILE = "sync.json";

// ─── Token storage ─────────────────────────────────────────────────────────
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
  cc_cancelled: unknown[];
  cc_rescheduled: unknown[];
  cc_ex_notes: Record<string, unknown>;
};

const DATA_KEYS = [
  "cc_sessions",
  "cc_coach_workouts",
  "cc_coach_runs",
  "cc_cancelled",
  "cc_rescheduled",
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
    cc_cancelled: get("cc_cancelled"),
    cc_rescheduled: get("cc_rescheduled"),
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

/** Ensure the `data` branch exists, creating it from main HEAD if needed */
async function ensureDataBranch(token: string): Promise<void> {
  const branchRes = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/git/ref/heads/${DATA_BRANCH}`,
    { headers: ghHeaders(token) }
  );
  if (branchRes.ok) return; // Branch already exists

  // Get main HEAD SHA
  const mainRes = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/git/ref/heads/main`,
    { headers: ghHeaders(token) }
  );
  if (!mainRes.ok) throw new Error("Impossible de récupérer la branche main.");
  const main = await mainRes.json() as { object: { sha: string } };

  // Create data branch
  const createRes = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/git/refs`,
    {
      method: "POST",
      headers: ghHeaders(token),
      body: JSON.stringify({ ref: `refs/heads/${DATA_BRANCH}`, sha: main.object.sha }),
    }
  );
  if (!createRes.ok) throw new Error("Impossible de créer la branche data.");
}

/** Fetch sync.json from the data branch. Returns null if not found yet. */
async function fetchRepoFile(token: string): Promise<{ data: SyncPayload | null; sha: string | null }> {
  const res = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${DATA_FILE}?ref=${DATA_BRANCH}`,
    { headers: ghHeaders(token) }
  );
  if (res.status === 404) return { data: null, sha: null };
  if (!res.ok) throw new Error(`Erreur lecture fichier: ${res.status}`);
  const file = await res.json() as { content: string; sha: string };
  const content = decodeURIComponent(escape(atob(file.content.replace(/\n/g, ""))));
  return { data: JSON.parse(content) as SyncPayload, sha: file.sha };
}

/** Write data to sync.json on the data branch. Pass sha to update, null to create. Returns new SHA. */
async function pushRepoFile(token: string, data: SyncPayload, sha: string | null): Promise<string> {
  const body: Record<string, unknown> = {
    message: `sync ${data.exportedAt}`,
    content: btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2)))),
    branch: DATA_BRANCH,
  };
  if (sha) body.sha = sha;

  const res = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${DATA_FILE}`,
    { method: "PUT", headers: ghHeaders(token), body: JSON.stringify(body) }
  );
  if (!res.ok) throw new Error(`Erreur écriture fichier: ${res.status}`);
  const result = await res.json() as { content: { sha: string } };
  return result.content.sha;
}

// ─── Public sync API ─────────────────────────────────────────────────────────

export type SyncResult = {
  ok: boolean;
  error?: string;
};

/**
 * Silent auto-pull on app load.
 * Remote is source of truth → overwrites local completely.
 */
export async function autoSyncPull(): Promise<void> {
  const token = getGitHubToken();
  if (!token) return;
  try {
    const { data, sha } = await fetchRepoFile(token);
    if (!data) return; // No remote file yet, nothing to pull
    writeLocal(data);
    if (sha) localStorage.setItem(CACHED_SHA_KEY, sha);
  } catch { /* silent */ }
}

/**
 * Silent auto-push after any mutation.
 * Fetches current SHA to avoid conflicts, then writes local state to repo.
 */
export async function autoSyncPush(): Promise<void> {
  const token = getGitHubToken();
  if (!token) return;
  try {
    await ensureDataBranch(token);
    // Always fetch latest SHA before pushing to avoid conflicts
    const { sha } = await fetchRepoFile(token);
    const local = readLocal();
    const newSha = await pushRepoFile(token, local, sha);
    localStorage.setItem(CACHED_SHA_KEY, newSha);
    localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
  } catch { /* silent */ }
}

/**
 * Manual sync triggered from Settings.
 * Push + update last sync timestamp. Returns result for UI feedback.
 */
export async function manualSync(token: string): Promise<SyncResult> {
  try {
    await ensureDataBranch(token);
    const { sha } = await fetchRepoFile(token);
    const local = readLocal();
    const newSha = await pushRepoFile(token, local, sha);
    localStorage.setItem(CACHED_SHA_KEY, newSha);
    localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur inconnue" };
  }
}
