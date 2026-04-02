"use client";

import { useState, useEffect } from "react";
import PageHeader from "@/components/PageHeader";
import {
  getGitHubToken, setGitHubToken,
  getGistId, setGistId,
  getLastSync,
  verifyToken, syncData, pushData, pullData,
} from "@/lib/sync";
import { parseCoachWorkoutJSON, addCoachWorkout, addCoachRun } from "@/lib/coachPlan";
import { buildExportData, downloadExport } from "@/lib/export";
import { getCancelledDays } from "@/lib/storage";

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
  const [gistId, setGistIdState] = useState("");
  const [tokenStatus, setTokenStatus] = useState<"idle" | "checking" | "ok" | "error">("idle");
  const [tokenLogin, setTokenLogin] = useState("");
  const [tokenError, setTokenError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [syncError, setSyncError] = useState("");
  const [lastSync, setLastSync] = useState("");

  // ── Import state ──
  const [importError, setImportError] = useState("");
  const [importSuccess, setImportSuccess] = useState("");

  // ── Export state ──
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setMounted(true);
    setToken(getGitHubToken());
    setGistIdState(getGistId());
    setLastSync(getLastSync());
    if (getGitHubToken()) setTokenStatus("ok");
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
    const result = await syncData(t, gistId.trim() || undefined);
    setSyncing(false);
    if (result.ok) {
      const newId = result.gistId ?? gistId;
      setGistIdState(newId); setGistId(newId);
      setLastSync(new Date().toISOString());
      const a = result.added;
      setSyncMsg(a && (a.sessions > 0 || a.coachPlans > 0)
        ? `Synchronisé ✓${a.sessions > 0 ? ` +${a.sessions} séance(s)` : ""}${a.coachPlans > 0 ? ` +${a.coachPlans} plan(s)` : ""}`
        : "Synchronisé ✓ — déjà à jour");
    } else {
      setSyncError(result.error ?? "Erreur de synchronisation");
    }
  };

  const handlePush = async () => {
    const t = getGitHubToken(); const id = gistId.trim();
    if (!t || !id) { setSyncError("Token et Gist ID requis."); return; }
    setSyncing(true); setSyncMsg(""); setSyncError("");
    const result = await pushData(t, id);
    setSyncing(false);
    if (result.ok) { setLastSync(new Date().toISOString()); setSyncMsg("Poussé vers le cloud ✓"); }
    else setSyncError(result.error ?? "Erreur");
  };

  const handlePull = async () => {
    const t = getGitHubToken(); const id = gistId.trim();
    if (!t || !id) { setSyncError("Token et Gist ID requis."); return; }
    setSyncing(true); setSyncMsg(""); setSyncError("");
    const result = await pullData(t, id);
    setSyncing(false);
    if (result.ok) {
      setLastSync(new Date().toISOString());
      const a = result.added;
      setSyncMsg(a && (a.sessions > 0 || a.coachPlans > 0)
        ? `Tiré depuis le cloud ✓${a.sessions > 0 ? ` +${a.sessions} séance(s)` : ""}${a.coachPlans > 0 ? ` +${a.coachPlans} plan(s)` : ""}`
        : "Tiré depuis le cloud ✓ — déjà à jour");
    } else setSyncError(result.error ?? "Erreur");
  };

  const handleDisconnect = () => {
    setGitHubToken(""); setGistId(""); setToken(""); setGistIdState("");
    setTokenStatus("idle"); setTokenLogin(""); setSyncMsg("Déconnecté.");
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
        plans.forEach((p) => { if (p.type === "run") addCoachRun(p); else addCoachWorkout(p); });
        setImportSuccess(`${plans.length} séance${plans.length > 1 ? "s" : ""} importée${plans.length > 1 ? "s" : ""} ✓`);
        setTimeout(() => setImportSuccess(""), 4000);
      } catch {
        setImportError("JSON invalide. Vérifiez le format.");
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be re-imported
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
                background: isConnected && gistId ? "#39ff14" : isConnected ? "#ff6b00" : "#333",
                boxShadow: isConnected && gistId ? "0 0 6px #39ff14" : "none",
              }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: isConnected && gistId ? "#39ff14" : "#555" }}>
                  {isConnected && gistId ? "Synchronisation active" : isConnected ? "Token OK — Gist manquant" : "Non configuré"}
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
                Personal Access Token (classic) — scope : <span style={{ color: "#aaa" }}>gist</span>
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
              {tokenStatus === "ok" && <p className="text-xs mt-1" style={{ color: "#39ff14" }}>✓ {tokenLogin ? `@${tokenLogin}` : "Connecté"}</p>}
              {tokenStatus === "error" && <p className="text-xs mt-1" style={{ color: "#ff4444" }}>{tokenError}</p>}
            </div>

            {/* Gist ID */}
            <div>
              <p className="text-xs font-semibold mb-1.5" style={{ color: "#444" }}>Gist ID</p>
              <input
                type="text"
                value={gistId}
                onChange={(e) => setGistIdState(e.target.value)}
                placeholder="Laisse vide → créé automatiquement"
                className="w-full rounded-xl px-3 py-2 text-xs font-mono focus:outline-none"
                style={{ background: "#151515", border: "1px solid #222", color: "#aaa" }}
              />
              {gistId && (
                <div className="mt-1.5 flex items-center gap-2">
                  <p className="text-xs font-mono truncate" style={{ color: "#444" }}>{gistId}</p>
                  <button
                    onClick={() => navigator.clipboard.writeText(gistId)}
                    className="text-xs px-2 py-0.5 rounded-lg press-effect flex-shrink-0"
                    style={{ background: "#1a1a1a", color: "#555", border: "1px solid #222" }}
                  >Copier</button>
                </div>
              )}
            </div>

            {/* Sync buttons */}
            <div className="space-y-2">
              <button
                onClick={handleSync}
                disabled={syncing || !isConnected}
                className="w-full py-2.5 rounded-xl text-sm font-bold press-effect disabled:opacity-40"
                style={{ background: "rgba(57,255,20,0.12)", border: "1px solid rgba(57,255,20,0.3)", color: "#39ff14" }}
              >
                {syncing ? "…" : "⇄ Fusionner (bidirectionnel)"}
              </button>
              <div className="flex gap-2">
                <button
                  onClick={handlePush}
                  disabled={syncing || !isConnected || !gistId}
                  className="flex-1 py-2 rounded-xl text-xs font-bold press-effect disabled:opacity-40"
                  style={{ background: "#111", border: "1px solid #222", color: "#555" }}
                >
                  {syncing ? "…" : "↑ Pousser vers cloud"}
                </button>
                <button
                  onClick={handlePull}
                  disabled={syncing || !isConnected || !gistId}
                  className="flex-1 py-2 rounded-xl text-xs font-bold press-effect disabled:opacity-40"
                  style={{ background: "#111", border: "1px solid #222", color: "#555" }}
                >
                  {syncing ? "…" : "↓ Tirer depuis cloud"}
                </button>
              </div>
            </div>
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

        {/* ── 2. IMPORT JSON COACH ── */}
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

        {/* ── 3. EXPORT JSON COACH ── */}
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
