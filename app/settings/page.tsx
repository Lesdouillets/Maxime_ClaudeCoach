"use client";

import { useState, useEffect, useRef } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import {
  getLastSync, autoSyncPush,
  signInWithGitHub, signOut,
} from "@/lib/sync";
import { parseCoachWorkoutJSON, addCoachWorkout, addCoachRun, clearFutureCoachPlans } from "@/lib/coachPlan";
import { buildExportData } from "@/lib/export";
import { getCancelledDays, getStravaTokens } from "@/lib/storage";
import { getStravaAuthUrl, forceResyncRecentActivities, autoImportActivity } from "@/lib/strava";
import { addSession } from "@/lib/storage";
import {
  getProfiles, getActiveProfile, switchProfile,
  createProfile, renameProfile,
  type ProfileMeta,
} from "@/lib/profiles";

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

  const [user,              setUser]              = useState<User | null>(null);
  const [lastSync,          setLastSync]          = useState("");
  const [isStravaConnected, setIsStravaConnected] = useState(false);
  const [stravaResyncing,   setStravaResyncing]   = useState(false);
  const [stravaMsg,         setStravaMsg]         = useState("");
  const [importError,       setImportError]       = useState("");
  const [importSuccess,     setImportSuccess]     = useState("");
  const [showExport,        setShowExport]        = useState(false);
  const [copied,            setCopied]            = useState(false);

  // Profiles
  const [profiles,    setProfiles]    = useState<[ProfileMeta | null, ProfileMeta | null]>([null, null]);
  const [activeSlot,  setActiveSlot]  = useState<1 | 2 | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);
  const [editingSlot, setEditingSlot] = useState<1 | 2 | null>(null);
  const [editName,    setEditName]    = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
    setLastSync(getLastSync());
    setIsStravaConnected(!!getStravaTokens());
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    // Load profiles
    const ps = getProfiles();
    setProfiles(ps);
    const active = getActiveProfile();
    setActiveSlot(active?.slot ?? null);
    return () => subscription.unsubscribe();
  }, []);

  // Focus edit input when editing starts
  useEffect(() => {
    if (editingSlot !== null) editInputRef.current?.focus();
  }, [editingSlot]);

  // ── Strava ──
  const handleStravaAction = async () => {
    if (!isStravaConnected) { window.location.href = getStravaAuthUrl(); return; }
    if (stravaResyncing) return;
    setStravaResyncing(true); setStravaMsg("");
    try {
      const activities = await forceResyncRecentActivities(14);
      let count = 0;
      activities.forEach((a) => { const s = autoImportActivity(a); if (s) { addSession(s); count++; } });
      setStravaMsg(count > 0 ? `${count} activité${count > 1 ? "s" : ""} ✓` : "Déjà à jour");
      setTimeout(() => setStravaMsg(""), 3000);
    } catch { setStravaMsg("Erreur"); }
    finally { setStravaResyncing(false); }
  };

  // ── Import ──
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(""); setImportSuccess("");
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const today = new Date().toISOString().slice(0, 10);
        const plans = parseCoachWorkoutJSON(text).filter((p) => p.date >= today);
        if (plans.length === 0) { setImportError("Aucune séance future trouvée."); return; }
        clearFutureCoachPlans();
        plans.forEach((p) => { if (p.type === "run") addCoachRun(p); else addCoachWorkout(p); });
        autoSyncPush();
        setImportSuccess(`${plans.length} séance${plans.length > 1 ? "s" : ""} importée${plans.length > 1 ? "s" : ""} ✓`);
        setTimeout(() => setImportSuccess(""), 4000);
      } catch { setImportError("JSON invalide."); }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // ── Export ──
  const handleCopy = async () => {
    const json = JSON.stringify({ ...buildExportData(), cancelledDays: getCancelledDays() }, null, 2);
    await navigator.clipboard.writeText(json);
    setCopied(true); setShowExport(false);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const json = JSON.stringify({ ...buildExportData(), cancelledDays: getCancelledDays() }, null, 2);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    a.download = `coach-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setShowExport(false);
  };

  // ── Profiles ──
  const handleProfileTap = async (slot: 1 | 2) => {
    if (isSwitching || slot === activeSlot) return;

    const target = profiles[slot - 1];
    if (!target) {
      // Profile 2 doesn't exist yet — create it first
      if (!user) return;
      await createProfile(slot, "Profil 2", user.id);
      setProfiles(getProfiles());
    }
    setIsSwitching(true);
    try { await switchProfile(slot); }
    catch { setIsSwitching(false); }
  };

  const handleStartRename = (slot: 1 | 2) => {
    const meta = profiles[slot - 1];
    if (!meta) return;
    setEditName(meta.name);
    setEditingSlot(slot);
  };

  const handleFinishRename = async () => {
    if (editingSlot === null) return;
    const trimmed = editName.trim();
    if (trimmed && trimmed !== profiles[editingSlot - 1]?.name) {
      await renameProfile(editingSlot, trimmed);
      setProfiles(getProfiles());
    }
    setEditingSlot(null);
  };

  if (!mounted) return null;

  const ghName = (user?.user_metadata?.user_name as string) ?? user?.email ?? "GitHub";
  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;

  return (
    <div className="max-w-md mx-auto animate-fade-in pb-28 min-h-screen flex flex-col justify-center">

      {/* ── Profil ── */}
      <div className="flex flex-col items-center pt-4 pb-10 px-5">
        {/* Avatar */}
        <div className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center mb-4"
          style={{ background: "#141414", border: "1.5px solid #222" }}>
          {avatarUrl ? (
            <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
          ) : (
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="8" r="4" stroke="#444" strokeWidth="1.6" />
              <path d="M4 20c0-4.418 3.582-8 8-8s8 3.582 8 8" stroke="#444" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          )}
        </div>

        {/* Nom + sync */}
        <p className="text-base font-semibold" style={{ color: user ? "#eee" : "#444" }}>
          {user ? ghName : "Non connecté"}
        </p>
        {lastSync && (
          <p className="text-[11px] mt-1" style={{ color: "#333" }}>
            Sync {new Date(lastSync).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
          </p>
        )}
      </div>

      <div className="px-5 space-y-5">

        {/* ── Profils ── */}
        {user && (
          <Section title="PROFILS">
            <div className="flex divide-x" style={{ borderColor: "#1a1a1a" }}>
              {([1, 2] as const).map((slot) => {
                const meta = profiles[slot - 1];
                const isActive = slot === activeSlot;
                const isLoading = isSwitching && slot !== activeSlot;
                const name = meta?.name ?? (slot === 1 ? "Profil 1" : "Profil 2");

                return (
                  <button
                    key={slot}
                    onClick={() => isActive ? handleStartRename(slot) : handleProfileTap(slot)}
                    disabled={isSwitching}
                    className="flex-1 flex flex-col items-center gap-2.5 py-5 press-effect disabled:opacity-60"
                    style={{
                      background: isActive ? "rgba(57,255,20,0.04)" : "transparent",
                    }}
                  >
                    {/* Slot number badge */}
                    <div className="w-8 h-8 rounded-full flex items-center justify-center"
                      style={{
                        background: isActive ? "rgba(57,255,20,0.12)" : "#181818",
                        border: isActive ? "1.5px solid rgba(57,255,20,0.3)" : "1.5px solid #2a2a2a",
                      }}>
                      {isLoading ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                          className="spinner">
                          <circle cx="12" cy="12" r="9" stroke="#333" strokeWidth="2" />
                          <path d="M12 3a9 9 0 0 1 9 9" stroke="#39ff14" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      ) : (
                        <span className="text-xs font-bold" style={{ color: isActive ? "#39ff14" : "#555" }}>
                          {slot}
                        </span>
                      )}
                    </div>

                    {/* Profile name */}
                    {editingSlot === slot ? (
                      <input
                        ref={editInputRef}
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onBlur={handleFinishRename}
                        onKeyDown={(e) => { if (e.key === "Enter") handleFinishRename(); }}
                        className="text-center text-[11px] font-medium w-full px-2 bg-transparent outline-none"
                        style={{ color: "#39ff14", borderBottom: "1px solid rgba(57,255,20,0.3)", borderRadius: 0 }}
                        maxLength={20}
                      />
                    ) : (
                      <span className="text-[11px] font-medium" style={{ color: isActive ? "#aaa" : "#444" }}>
                        {name}
                      </span>
                    )}

                    {/* Status dot */}
                    <span className="w-1.5 h-1.5 rounded-full"
                      style={{
                        background: isActive ? "#39ff14" : "#2a2a2a",
                        boxShadow: isActive ? "0 0 5px #39ff14" : "none",
                      }} />
                  </button>
                );
              })}
            </div>
            {isSwitching && (
              <p className="text-xs text-center pb-3" style={{ color: "#555" }}>Changement de profil…</p>
            )}
          </Section>
        )}

        {/* ── Connexions ── */}
        <Section title="CONNEXIONS">
          <div className="flex divide-x" style={{ borderColor: "#1a1a1a" }}>

            {/* GitHub */}
            <button
              onClick={user ? signOut : signInWithGitHub}
              className="flex-1 flex flex-col items-center gap-3 py-5 press-effect"
            >
              <div className="relative">
                <svg width="28" height="28" viewBox="0 0 24 24" fill={user ? "#eee" : "#333"}>
                  <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
                </svg>
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full"
                  style={{ background: user ? "#39ff14" : "#2a2a2a", border: "1.5px solid #0d0d0d",
                    boxShadow: user ? "0 0 5px #39ff14" : "none" }} />
              </div>
              <span className="text-[11px] font-medium" style={{ color: user ? "#aaa" : "#333" }}>GitHub</span>
            </button>

            {/* Strava */}
            <button
              onClick={handleStravaAction}
              disabled={stravaResyncing}
              className="flex-1 flex flex-col items-center gap-3 py-5 press-effect disabled:opacity-60"
            >
              <div className="relative">
                <img
                  src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/strava.svg`}
                  width={28} height={28} alt="Strava"
                  style={{ opacity: isStravaConnected ? 1 : 0.2 }}
                />
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full"
                  style={{ background: isStravaConnected ? "#ff6b00" : "#2a2a2a", border: "1.5px solid #0d0d0d",
                    boxShadow: isStravaConnected ? "0 0 5px #ff6b00" : "none" }} />
              </div>
              <span className="text-[11px] font-medium" style={{ color: isStravaConnected ? "#aaa" : "#333" }}>
                {stravaResyncing ? "Sync…" : "Strava"}
              </span>
            </button>
          </div>
          {stravaMsg && (
            <p className="text-xs text-center pb-3" style={{ color: "#ff6b00" }}>{stravaMsg}</p>
          )}
        </Section>

        {/* ── Programme ── */}
        <Section title="PROGRAMME">
          <div className="flex divide-x" style={{ borderColor: "#1a1a1a" }}>

            {/* Import */}
            <label className="flex-1 flex flex-col items-center gap-3 py-5 cursor-pointer press-effect">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M12 15V3M7 8l5-5 5 5" stroke="#555" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M20 21H4" stroke="#555" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              <span className="text-[11px] font-medium" style={{ color: "#555" }}>Import</span>
              <input type="file" accept=".json,application/json" className="hidden" onChange={handleImportFile} />
            </label>

            {/* Export */}
            <button
              onClick={() => setShowExport((v) => !v)}
              className="flex-1 flex flex-col items-center gap-3 py-5 press-effect"
            >
              {copied ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path d="M5 13L9 17L19 7" stroke="#39ff14" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path d="M12 9v12M7 16l5 5 5-5" stroke="#555" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M20 3H4" stroke="#555" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              )}
              <span className="text-[11px] font-medium" style={{ color: copied ? "#39ff14" : "#555" }}>
                {copied ? "Copié !" : "Export"}
              </span>
            </button>
          </div>

          {/* Options export */}
          {showExport && (
            <div className="flex gap-3 px-4 pb-4">
              <button
                onClick={handleCopy}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold press-effect flex items-center justify-center gap-2"
                style={{ background: "rgba(57,255,20,0.08)", border: "1px solid rgba(57,255,20,0.2)", color: "#39ff14" }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <path d="M8 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1M8 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M8 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m0 0h2a2 2 0 0 1 2 2v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
                Copier
              </button>
              <button
                onClick={handleDownload}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold press-effect flex items-center justify-center gap-2"
                style={{ background: "#111", border: "1px solid #222", color: "#555" }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <path d="M12 15V3M7 10l5 5 5-5M20 21H4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Télécharger
              </button>
            </div>
          )}

          {importError   && <p className="text-xs text-center pb-3" style={{ color: "#ff4444" }}>{importError}</p>}
          {importSuccess && <p className="text-xs text-center pb-3 font-bold" style={{ color: "#39ff14" }}>{importSuccess}</p>}
        </Section>

      </div>

      <style>{`.spinner { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
