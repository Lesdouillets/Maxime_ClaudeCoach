"use client";

import { useState, useEffect } from "react";
import PageHeader from "@/components/PageHeader";
import {
  getGitHubToken, setGitHubToken,
  getGistId, setGistId,
  getLastSync,
  verifyToken, syncData, isSyncConfigured,
} from "@/lib/sync";

export default function SettingsPage() {
  const [mounted, setMounted] = useState(false);
  const [token, setToken] = useState("");
  const [gistId, setGistIdState] = useState("");
  const [tokenStatus, setTokenStatus] = useState<"idle" | "checking" | "ok" | "error">("idle");
  const [tokenLogin, setTokenLogin] = useState("");
  const [tokenError, setTokenError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [syncError, setSyncError] = useState("");
  const [lastSync, setLastSync] = useState("");

  useEffect(() => {
    setMounted(true);
    setToken(getGitHubToken());
    setGistIdState(getGistId());
    setLastSync(getLastSync());
    if (getGitHubToken()) setTokenStatus("ok");
  }, []);

  const handleVerifyToken = async () => {
    if (!token.trim()) return;
    setTokenStatus("checking");
    setTokenError("");
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
    setSyncing(true);
    setSyncMsg(""); setSyncError("");
    const result = await syncData(t, gistId.trim() || undefined);
    setSyncing(false);
    if (result.ok) {
      const newId = result.gistId ?? gistId;
      setGistIdState(newId);
      setGistId(newId);
      setLastSync(new Date().toISOString());
      const added = result.added;
      if (added && (added.sessions > 0 || added.coachPlans > 0)) {
        setSyncMsg(`Synchronisé ✓ — ${added.sessions > 0 ? `+${added.sessions} séance(s)` : ""}${added.coachPlans > 0 ? ` +${added.coachPlans} plan(s) coach` : ""}`);
      } else {
        setSyncMsg("Synchronisé ✓ — déjà à jour");
      }
    } else {
      setSyncError(result.error ?? "Erreur de synchronisation");
    }
  };

  const handleDisconnect = () => {
    setGitHubToken("");
    setGistId("");
    setToken("");
    setGistIdState("");
    setTokenStatus("idle");
    setTokenLogin("");
    setSyncMsg("Déconnecté.");
  };

  if (!mounted) return null;

  const isConnected = tokenStatus === "ok" && !!getGitHubToken();

  return (
    <div className="max-w-md mx-auto animate-fade-in pb-24">
      <PageHeader title="RÉGLAGES" subtitle="Synchronisation" accent="neon" />

      <div className="px-5 space-y-5">

        {/* Sync status banner */}
        <div className="rounded-2xl p-4" style={{
          background: isConnected && gistId ? "rgba(57,255,20,0.04)" : "#0d0d0d",
          border: `1px solid ${isConnected && gistId ? "rgba(57,255,20,0.2)" : "#1a1a1a"}`,
        }}>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{
              background: isConnected && gistId ? "#39ff14" : isConnected ? "#ff6b00" : "#333",
              boxShadow: isConnected && gistId ? "0 0 6px #39ff14" : "none",
            }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: isConnected && gistId ? "#39ff14" : "#555" }}>
                {isConnected && gistId ? "Synchronisation active" : isConnected ? "Token OK — Gist manquant" : "Non synchronisé"}
              </p>
              {lastSync && (
                <p className="text-xs text-muted mt-0.5">
                  Dernière sync : {new Date(lastSync).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* GitHub Token */}
        <div>
          <label className="block text-xs font-semibold tracking-widest mb-2" style={{ color: "#555" }}>
            PERSONAL ACCESS TOKEN (CLASSIC)
          </label>
          <p className="text-xs text-muted mb-3">
            github.com → Settings → Developer settings → Personal access tokens → Tokens (classic).
            Scope requis : <strong style={{ color: "#aaa" }}>gist</strong>.
          </p>
          <div className="flex gap-2">
            <input
              type="password"
              value={token}
              onChange={(e) => { setToken(e.target.value); setTokenStatus("idle"); }}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              className="flex-1 rounded-xl px-3 py-2.5 text-xs font-mono focus:outline-none"
              style={{ background: "#111", border: `1px solid ${tokenStatus === "ok" ? "rgba(57,255,20,0.3)" : tokenStatus === "error" ? "rgba(255,68,68,0.4)" : "#222"}`, color: "#aaa" }}
            />
            <button
              onClick={handleVerifyToken}
              disabled={!token.trim() || tokenStatus === "checking"}
              className="px-3 py-2.5 rounded-xl text-xs font-bold press-effect disabled:opacity-40"
              style={{ background: "#1a1a1a", border: "1px solid #333", color: "#aaa" }}
            >
              {tokenStatus === "checking" ? "…" : "Vérifier"}
            </button>
          </div>
          {tokenStatus === "ok" && (
            <p className="text-xs mt-1.5" style={{ color: "#39ff14" }}>
              ✓ Connecté{tokenLogin ? ` en tant que @${tokenLogin}` : ""}
            </p>
          )}
          {tokenStatus === "error" && (
            <p className="text-xs mt-1.5" style={{ color: "#ff4444" }}>{tokenError}</p>
          )}
        </div>

        {/* Gist ID */}
        <div>
          <label className="block text-xs font-semibold tracking-widest mb-2" style={{ color: "#555" }}>
            GIST ID
          </label>
          <p className="text-xs text-muted mb-3">
            Laisse vide pour créer un nouveau gist privé lors de la première sync. Sur un autre device, colle l'ID affiché ci-dessous.
          </p>
          <input
            type="text"
            value={gistId}
            onChange={(e) => setGistIdState(e.target.value)}
            placeholder="Laisse vide → créé automatiquement"
            className="w-full rounded-xl px-3 py-2.5 text-xs font-mono focus:outline-none"
            style={{ background: "#111", border: "1px solid #222", color: "#aaa" }}
          />
          {gistId && (
            <div className="mt-2 flex items-center gap-2">
              <p className="text-xs font-mono" style={{ color: "#555" }}>
                ID : <span style={{ color: "#aaa" }}>{gistId}</span>
              </p>
              <button
                onClick={() => navigator.clipboard.writeText(gistId)}
                className="text-xs px-2 py-0.5 rounded-lg press-effect"
                style={{ background: "#1a1a1a", color: "#555", border: "1px solid #222" }}
              >
                Copier
              </button>
            </div>
          )}
        </div>

        {/* Sync button */}
        <button
          onClick={handleSync}
          disabled={syncing || !isConnected}
          className="w-full py-3 rounded-2xl text-sm font-bold press-effect disabled:opacity-40"
          style={{
            background: syncing ? "rgba(57,255,20,0.06)" : "rgba(57,255,20,0.12)",
            border: "1px solid rgba(57,255,20,0.3)",
            color: "#39ff14",
          }}
        >
          {syncing ? "Synchronisation…" : "Synchroniser maintenant"}
        </button>
        {syncMsg && <p className="text-xs text-center" style={{ color: "#39ff14" }}>{syncMsg}</p>}
        {syncError && <p className="text-xs text-center" style={{ color: "#ff4444" }}>{syncError}</p>}

        {/* Disconnect */}
        {isConnected && (
          <button
            onClick={handleDisconnect}
            className="w-full py-2.5 rounded-2xl text-xs press-effect"
            style={{ background: "transparent", border: "1px solid #1a1a1a", color: "#333" }}
          >
            Déconnecter
          </button>
        )}

        {/* How it works */}
        <div className="rounded-xl p-4" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
          <p className="text-xs font-semibold mb-2" style={{ color: "#444" }}>Comment ça marche</p>
          <ul className="text-xs space-y-1.5" style={{ color: "#333" }}>
            <li>• Tes données (séances, plans coach, annulations) sont stockées dans un Gist GitHub privé.</li>
            <li>• Au démarrage de l'app, une sync automatique est lancée si configurée.</li>
            <li>• Sur un nouveau device : entre ton token + l'ID du Gist, puis sync.</li>
            <li>• Ton token reste uniquement sur ce device (localStorage).</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
