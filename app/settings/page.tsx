"use client";

import { useState, useEffect } from "react";
import PageHeader from "@/components/PageHeader";
import {
  getGitHubToken, setGitHubToken,
  getLastSync,
  verifyToken, manualSync, autoSyncPush,
} from "@/lib/sync";
import { parseCoachWorkoutJSON, addCoachWorkout, addCoachRun, clearFutureCoachPlans } from "@/lib/coachPlan";
import { buildExportData, downloadExport } from "@/lib/export";
import { getCancelledDays, getStravaTokens, addSession } from "@/lib/storage";
import { getStravaAuthUrl, forceResyncRecentActivities, autoImportActivity } from "@/lib/strava";

// ─── Section wrapper ────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold tracking-[0.2em] mb-3 px-1" style={{ color: "#333" }}>
        {title}
      </p>
      <div className="rounded-2xl overflow-hidden" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
        {children}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [mounted, setMounted] = useState(false);

  // ── Sync state ──
  const [token, setToken] = useState("");
  const [tokenStatus, setTokenStatus] = useState<"idle" | "checking" | "ok" | "error">("idle");
  const [tokenLogin, setTokenLogin] = useState("");
  const [tokenError, setTokenError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [syncError, setSyncError] = useState("");
  const [lastSync, setLastSync] = useState("");

  // ── Strava state ──
  const [isStravaConnected, setIsStravaConnected] = useState(false);
  const [stravaResyncing, setStravaResyncing] = useState(false);
  const [stravaMsg, setStravaMsg] = useState("");

  // ── Import state ──
  const [importError, setImportError] = useState("");
  const [importSuccess, setImportSuccess] = useState("");

  // ── Export state ──
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setMounted(true);
    setToken(getGitHubToken());
    setLastSync(getLastSync());
    if (getGitHubToken()) setTokenStatus("ok");
    setIsStravaConnected(!!getStravaTokens());
  }, []);

  // ── Sync handlers ──
  const handleVerifyToken = async () => {
    if (!token.trim()) return;
    setTokenStatus("checking"); setTokenError("");
    const result = await verifyToken(token.trim());
    if (result.ok) {
      setGitHubToken(token.trim());
      setTokenStatus("ok");
      setTokenLogin(result.login ?? "");
    } else {
      setTokenStatus("error");
      setTokenError(result.error ?? "Erreur");
    }
  };

  const handleSync = async () => {
    const t = getGitHubToken();
    if (!t) { setSyncError("Configure d'abord ton token GitHub."); return; }
    setSyncing(true); setSyncMsg(""); setSyncError("");
    const result = await manualSync(t);
    setSyncing(false);
    if (result.ok) {
      setLastSync(new Date().toISOString());
      setSyncMsg("Synchronisé ✓");
    } else {
      setSyncError(result.error ?? "Erreur de synchronisation");
    }
  };

  const handleDisconnect = () => {
    setGitHubToken(""); setToken("");
    setTokenStatus("idle"); setTokenLogin(""); setSyncMsg("Déconnecté.");
  };

  // ── Strava handler ──
  const handleStravaResync = async () => {
    if (stravaResyncing) return;
    setStravaResyncing(true); setStravaMsg("");
    try {
      const activities = await forceResyncRecentActivities(14);
      let count = 0;
      activities.forEach((a) => { const s = autoImportActivity(a); if (s) { addSession(s); count++; } });
      setStravaMsg(count > 0 ? `${count} activité${count > 1 ? "s" : ""} importée${count > 1 ? "s" : ""} ✓` : "Aucune nouvelle activité");
      setTimeout(() => setStravaMsg(""), 4000);
    } catch { setStravaMsg("Erreur de synchronisation"); }
    finally { setStravaResyncing(false); }
  };

  // ── Import handler ──
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(""); setImportSuccess("");
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const plans = parseCoachWorkoutJSON(text);
        if (plans.length === 0) { setImportError("Aucune séance trouvée dans le JSON."); return; }
        clearFutureCoachPlans();
        plans.forEach((p) => { if (p.type === "run") addCoachRun(p); else addCoachWorkout(p); });
        autoSyncPush();
        setImportSuccess(`${plans.length} séance${plans.length > 1 ? "s" : ""} importée${plans.length > 1 ? "s" : ""} ✓`);
        setTimeout(() => setImportSuccess(""), 4000);
      } catch {
        setImportError("JSON invalide. Vérifiez le format.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // ── Export handlers ──
  const handleCopy = async () => {
    const data = buildExportData();
    const cancelledDays = getCancelledDays();
    const json = JSON.stringify({ ...data, cancelledDays }, null, 2);
    await navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const data = buildExportData();
    const cancelledDays = getCancelledDays();
    const json = JSON.stringify({ ...data, cancelledDays }, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `coach-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!mounted) return null;

  const isConnected = tokenStatus === "ok" && !!getGitHubToken();

  return (
    <div className="max-w-md mx-auto animate-fade-in pb-24">
      <PageHeader title="PARAMÈTRES" subtitle="Données & synchronisation" accent="neon" />

      <div className="px-5 space-y-6">

        {/* ── 1. SYNCHRO DONNÉES ── */}
        <Section title="SYNCHRO DONNÉES">
          <div className="px-4 py-3 space-y-3">

            {/* Status */}
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{
                background: isConnected ? "#39ff14" : "#333",
                boxShadow: isConnected ? "0 0 6px #39ff14" : "none",
              }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: isConnected ? "#39ff14" : "#555" }}>
                  {isConnected ? `Connecté${tokenLogin ? ` · @${tokenLogin}` : ""}` : "Non configuré"}
                </p>
                {lastSync && (
                  <p className="text-xs text-muted">
                    Dernière sync : {new Date(lastSync).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                )}
              </div>
            </div>

            {/* Token */}
            <div>
              <p className="text-xs font-semibold mb-1.5" style={{ color: "#444" }}>
                Personal Access Token — scope : <span style={{ color: "#aaa" }}>repo</span>
              </p>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={token}
                  onChange={(e) => { setToken(e.target.value); setTokenStatus("idle"); }}
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  className="flex-1 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none"
                  style={{ background: "#151515", border: `1px solid ${tokenStatus === "ok" ? "rgba(57,255,20,0.3)" : tokenStatus === "error" ? "rgba(255,68,68,0.4)" : "#222"}`, color: "#aaa" }}
                />
                <button
                  onClick={handleVerifyToken}
                  disabled={!token.trim() || tokenStatus === "checking"}
                  className="px-3 py-2 rounded-xl text-xs font-bold press-effect disabled:opacity-40"
                  style={{ background: "#1a1a1a", border: "1px solid #333", color: "#aaa" }}
                >
                  {tokenStatus === "checking" ? "…" : "Vérifier"}
                </button>
              </div>
              {tokenStatus === "error" && <p className="text-xs mt-1" style={{ color: "#ff4444" }}>{tokenError}</p>}
            </div>

            {/* Sync button */}
            <button
              onClick={handleSync}
              disabled={syncing || !isConnected}
              className="w-full py-2.5 rounded-xl text-sm font-bold press-effect disabled:opacity-40"
              style={{ background: "rgba(57,255,20,0.12)", border: "1px solid rgba(57,255,20,0.3)", color: "#39ff14" }}
            >
              {syncing ? "Synchronisation…" : "Synchroniser"}
            </button>
            {syncMsg && <p className="text-xs text-center" style={{ color: "#39ff14" }}>{syncMsg}</p>}
            {syncError && <p className="text-xs text-center" style={{ color: "#ff4444" }}>{syncError}</p>}

            {isConnected && (
              <button
                onClick={handleDisconnect}
                className="w-full py-2 rounded-xl text-xs press-effect"
                style={{ background: "transparent", border: "1px solid #1a1a1a", color: "#333" }}
              >
                Déconnecter
              </button>
            )}
          </div>
        </Section>

        {/* ── 2. STRAVA ── */}
      <Section title="STRAVA">
        <div className="px-4 py-3 space-y-3">
          <div className="flex items-center gap-3">
            <img src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/strava.svg`} width={16} height={16} alt="Strava"
              style={{ opacity: isStravaConnected ? 1 : 0.3 }} />
            <p className="text-sm font-semibold" style={{ color: isStravaConnected ? "#ff6b00" : "#555" }}>
              {isStravaConnected ? "Connecté" : "Non connecté"}
            </p>
          </div>
          {isStravaConnected ? (
            <button
              onClick={handleStravaResync}
              disabled={stravaResyncing}
              className="w-full py-2.5 rounded-xl text-sm font-bold press-effect disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: "rgba(255,107,0,0.1)", border: "1px solid rgba(255,107,0,0.3)", color: "#ff6b00" }}
            >
              {stravaResyncing ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="animate-spin">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="#ff6b00" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M1 4v6h6M23 20v-6h-6M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
              Resynchroniser (14 derniers jours)
            </button>
          ) : (
            <a
              href={getStravaAuthUrl()}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-bold press-effect"
              style={{ background: "rgba(255,107,0,0.1)", border: "1px solid rgba(255,107,0,0.3)", color: "#ff6b00" }}
            >
              Connecter Strava
            </a>
          )}
          {stravaMsg && <p className="text-xs text-center" style={{ color: "#ff6b00" }}>{stravaMsg}</p>}
        </div>
      </Section>

      {/* ── 4. IMPORT JSON COACH ── */}
        <Section title="IMPORT JSON — PROGRAMME COACH">
          <div className="px-4 py-3 space-y-2">
            <p className="text-xs text-muted">Fichier JSON généré par ton coach (muscu + runs).</p>
            <label className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-bold cursor-pointer press-effect"
              style={{ background: "rgba(57,255,20,0.12)", border: "1px solid rgba(57,255,20,0.3)", color: "#39ff14" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M12 15V3M7 8l5-5 5 5M20 21H4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Importer un fichier JSON
              <input type="file" accept=".json,application/json" className="hidden" onChange={handleImportFile} />
            </label>
            {importError && <p className="text-xs" style={{ color: "#ff4444" }}>{importError}</p>}
            {importSuccess && <p className="text-xs font-bold" style={{ color: "#39ff14" }}>{importSuccess}</p>}
          </div>
        </Section>

        {/* ── 5. EXPORT JSON COACH ── */}
        <Section title="EXPORT JSON — POUR MON COACH">
          <div className="px-4 py-3 space-y-2">
            <p className="text-xs text-muted">
              Export complet : séances, exercices + commentaires, stats, annulations.
              À coller dans une conversation avec ton coach.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleCopy}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold press-effect flex items-center justify-center gap-2"
                style={{ background: "rgba(57,255,20,0.12)", border: "1px solid rgba(57,255,20,0.3)", color: "#39ff14" }}
              >
                {copied ? (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                      <path d="M5 13L9 17L19 7" stroke="#39ff14" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Copié !
                  </>
                ) : (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                      <path d="M8 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1M8 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M8 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m0 0h2a2 2 0 0 1 2 2v3" stroke="#39ff14" strokeWidth="1.8" strokeLinecap="round"/>
                    </svg>
                    Copier
                  </>
                )}
              </button>
              <button
                onClick={handleDownload}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold press-effect flex items-center justify-center gap-2"
                style={{ background: "#111", border: "1px solid #222", color: "#555" }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <path d="M12 15V3M7 10l5 5 5-5M20 21H4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Télécharger
              </button>
            </div>
          </div>
        </Section>

      </div>
    </div>
  );
}
