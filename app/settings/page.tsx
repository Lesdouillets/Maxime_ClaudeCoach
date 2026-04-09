"use client";

import { useState, useEffect, useRef } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { getLastSync, autoSyncPush, signInWithGitHub, signOut } from "@/lib/sync";
import { parseCoachWorkoutJSON, addCoachWorkout, addCoachRun, clearFutureCoachPlans } from "@/lib/coachPlan";
import { buildExportData } from "@/lib/export";
import { getCancelledDays, getStravaTokens } from "@/lib/storage";
import { getStravaAuthUrl, forceResyncRecentActivities, autoImportActivity } from "@/lib/strava";
import { addSession } from "@/lib/storage";
import {
  getProfiles, getActiveProfile, switchProfile,
  createProfile, type ProfileMeta,
} from "@/lib/profiles";

function AvatarMale() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="7.5" r="4" stroke="#555" strokeWidth="1.5" />
      <path d="M4 20c0-4.418 3.582-8 8-8s8 3.582 8 8" stroke="#555" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function AvatarFemale() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="7.5" r="4" stroke="#777" strokeWidth="1.5" />
      <path d="M8.5 6C8.5 3.8 10 2.5 12 2.5s3.5 1.3 3.5 3.5" stroke="#777" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M4 20c0-4.418 3.582-8 8-8s8 3.582 8 8" stroke="#777" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function Divider() {
  return <div className="ml-[68px] mr-4 h-px" style={{ background: "#161616" }} />;
}

export default function SettingsPage() {
  const [mounted, setMounted] = useState(false);
  const [user,              setUser]              = useState<User | null>(null);
  const [lastSync,          setLastSync]          = useState("");
  const [isStravaConnected, setIsStravaConnected] = useState(false);
  const [stravaResyncing,   setStravaResyncing]   = useState(false);
  const [stravaMsg,         setStravaMsg]         = useState("");
  const [importMsg,         setImportMsg]         = useState<{ ok: boolean; text: string } | null>(null);
  const [showExport,        setShowExport]        = useState(false);
  const [copied,            setCopied]            = useState(false);
  const [profiles,          setProfiles]          = useState<[ProfileMeta | null, ProfileMeta | null]>([null, null]);
  const [activeProfile,     setActiveProfile]     = useState<ProfileMeta | null>(null);
  const [isSwitching,       setIsSwitching]       = useState(false);
  const [showSwitch,        setShowSwitch]        = useState(false);
  const nameRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMounted(true);
    setLastSync(getLastSync());
    setIsStravaConnected(!!getStravaTokens());
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    setProfiles(getProfiles());
    setActiveProfile(getActiveProfile());
    return () => subscription.unsubscribe();
  }, []);

  // ── Strava ──
  const handleStravaAction = async () => {
    if (!isStravaConnected) { window.location.href = getStravaAuthUrl(); return; }
    if (stravaResyncing) return;
    setStravaResyncing(true); setStravaMsg("");
    try {
      const acts = await forceResyncRecentActivities(14);
      let n = 0;
      acts.forEach((a) => { const s = autoImportActivity(a); if (s) { addSession(s); n++; } });
      setStravaMsg(n > 0 ? `${n} activité${n > 1 ? "s" : ""} importée${n > 1 ? "s" : ""}` : "Déjà à jour");
      setTimeout(() => setStravaMsg(""), 3000);
    } catch { setStravaMsg("Erreur"); }
    finally { setStravaResyncing(false); }
  };

  // ── Import ──
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setImportMsg(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const today = new Date().toISOString().slice(0, 10);
        const plans = parseCoachWorkoutJSON(text).filter((p) => p.date >= today);
        if (!plans.length) { setImportMsg({ ok: false, text: "Aucune séance future" }); return; }
        clearFutureCoachPlans();
        plans.forEach((p) => { if (p.type === "run") addCoachRun(p); else addCoachWorkout(p); });
        autoSyncPush();
        setImportMsg({ ok: true, text: `${plans.length} séance${plans.length > 1 ? "s" : ""} importée${plans.length > 1 ? "s" : ""}` });
        setTimeout(() => setImportMsg(null), 4000);
      } catch { setImportMsg({ ok: false, text: "JSON invalide" }); }
    };
    reader.readAsText(file); e.target.value = "";
  };

  // ── Export ──
  const handleCopy = async () => {
    const json = JSON.stringify({ ...buildExportData(), cancelledDays: getCancelledDays() }, null, 2);
    await navigator.clipboard.writeText(json);
    setCopied(true); setShowExport(false);
    setTimeout(() => setCopied(false), 2500);
  };
  const handleDownload = () => {
    const json = JSON.stringify({ ...buildExportData(), cancelledDays: getCancelledDays() }, null, 2);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    a.download = `coach-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click(); setShowExport(false);
  };

  // ── Switch profil ──
  const targetSlot: 1 | 2 = activeProfile?.slot === 1 ? 2 : 1;
  const targetMeta = profiles[targetSlot - 1];
  const targetName = targetMeta?.name ?? (targetSlot === 2 ? "Christine" : "Maxime");

  const handleSwitchConfirm = async () => {
    setShowSwitch(false);
    setIsSwitching(true);
    if (!targetMeta && user) {
      await createProfile(targetSlot, targetName, user.id);
      setProfiles(getProfiles());
    }
    try { await switchProfile(targetSlot); }
    catch { setIsSwitching(false); }
  };

  if (!mounted) return null;

  const ghName = (user?.user_metadata?.user_name as string) ?? user?.email ?? "—";
  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
  const profileName = activeProfile?.name ?? (activeProfile?.slot === 2 ? "Christine" : "Maxime");
  const isFemale = activeProfile?.slot === 2;
  const syncLabel = lastSync
    ? new Date(lastSync).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : "—";

  return (
    // Full height minus nav bar (100px + safe-area), no scroll
    <div className="max-w-md mx-auto flex flex-col px-4 animate-fade-in"
      style={{ height: "calc(100svh - 100px - env(safe-area-inset-bottom))" }}>

      {/* ── Avatar + nom ── */}
      <div className="flex flex-col items-center pt-10 pb-6">
        <div className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center mb-4"
          style={{ background: "#111", border: "2px solid #1e1e1e" }}>
          {avatarUrl
            ? <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
            : isFemale ? <AvatarFemale /> : <AvatarMale />}
        </div>

        {/* Nom + popover switch */}
        <div className="relative flex flex-col items-center">
          <button
            ref={nameRef}
            onClick={() => !isSwitching && setShowSwitch((v) => !v)}
            disabled={isSwitching}
            className="flex items-center gap-1.5 press-effect disabled:opacity-50"
          >
            <span className="text-xl font-semibold" style={{ color: "#eee" }}>{profileName}</span>
            {isSwitching
              ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="spinner">
                  <circle cx="12" cy="12" r="9" stroke="#222" strokeWidth="2"/>
                  <path d="M12 3a9 9 0 0 1 9 9" stroke="#39ff14" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              : <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path d="M6 9l6 6 6-6" stroke="#444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
            }
          </button>
          {isSwitching && <p className="text-[11px] mt-1" style={{ color: "#444" }}>Changement…</p>}

          {/* Inline popover juste sous le nom */}
          {showSwitch && (
            <div className="absolute top-full mt-2 z-50 rounded-2xl overflow-hidden shadow-2xl"
              style={{ background: "#141414", border: "1px solid #252525", minWidth: 200 }}>
              <p className="text-xs px-4 pt-3 pb-1 text-center" style={{ color: "#444" }}>
                Passer à
              </p>
              <p className="text-sm font-semibold px-4 pb-3 text-center" style={{ color: "#eee" }}>
                {targetName}
              </p>
              <div className="flex border-t" style={{ borderColor: "#1e1e1e" }}>
                <button onClick={() => setShowSwitch(false)}
                  className="flex-1 py-3 text-sm press-effect border-r" style={{ borderColor: "#1e1e1e", color: "#444" }}>
                  Annuler
                </button>
                <button onClick={handleSwitchConfirm}
                  className="flex-1 py-3 text-sm font-bold press-effect" style={{ color: "#39ff14" }}>
                  Changer
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="flex-1 rounded-2xl overflow-hidden" style={{ background: "#0d0d0d", border: "1px solid #161616" }}>

        {/* Strava */}
        <button onClick={handleStravaAction} disabled={stravaResyncing}
          className="w-full flex items-center gap-4 px-4 py-4 press-effect disabled:opacity-40">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "#131313", border: "1px solid #1e1e1e" }}>
            <img src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/strava.svg`} width={20} height={20} alt="Strava"
              style={{ opacity: isStravaConnected ? 1 : 0.3 }} />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-medium" style={{ color: isStravaConnected ? "#ccc" : "#555" }}>
              {stravaResyncing ? "Synchronisation…" : "Strava"}
            </p>
            <p className="text-[11px]" style={{ color: stravaMsg ? "#ff6b00" : "#383838" }}>
              {stravaMsg || (isStravaConnected ? "Connecté" : "Non connecté")}
            </p>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M9 6l6 6-6 6" stroke="#2a2a2a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <Divider />

        {/* Import */}
        <label className="w-full flex items-center gap-4 px-4 py-4 cursor-pointer press-effect">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "#131313", border: "1px solid #1e1e1e" }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
              <path d="M12 15V3M7 8l5-5 5 5" stroke="#555" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M20 21H4" stroke="#555" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-medium" style={{ color: "#ccc" }}>Import programme</p>
            {importMsg && (
              <p className="text-[11px]" style={{ color: importMsg.ok ? "#39ff14" : "#ff4444" }}>{importMsg.text}</p>
            )}
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M9 6l6 6-6 6" stroke="#2a2a2a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <input type="file" accept=".json,application/json" className="hidden" onChange={handleImportFile} />
        </label>

        <Divider />

        {/* Export */}
        <div>
          <button onClick={() => setShowExport((v) => !v)}
            className="w-full flex items-center gap-4 px-4 py-4 press-effect">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "#131313", border: "1px solid #1e1e1e" }}>
              {copied
                ? <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                    <path d="M5 13L9 17L19 7" stroke="#39ff14" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                : <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                    <path d="M12 9v12M7 16l5 5 5-5" stroke="#555" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M20 3H4" stroke="#555" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
              }
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium" style={{ color: copied ? "#39ff14" : "#ccc" }}>
                {copied ? "Copié !" : "Export programme"}
              </p>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              style={{ transform: showExport ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}>
              <path d="M9 6l6 6-6 6" stroke="#2a2a2a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          {showExport && (
            <div className="flex gap-2 px-4 pb-4">
              <button onClick={handleCopy}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold press-effect"
                style={{ background: "rgba(57,255,20,0.06)", border: "1px solid rgba(57,255,20,0.12)", color: "#39ff14" }}>
                Copier JSON
              </button>
              <button onClick={handleDownload}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold press-effect"
                style={{ background: "#111", border: "1px solid #1e1e1e", color: "#444" }}>
                Télécharger
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── GitHub sync footer ── */}
      <div className="mt-3 px-4 py-3.5 rounded-2xl flex items-center justify-between"
        style={{ background: "#0d0d0d", border: "1px solid #161616" }}>
        <div>
          <p className="text-sm font-medium" style={{ color: user ? "#666" : "#2a2a2a" }}>{ghName}</p>
          <p className="text-[11px]" style={{ color: "#2a2a2a" }}>Sync {syncLabel}</p>
        </div>
        <button onClick={user ? signOut : signInWithGitHub} className="flex items-center gap-2 press-effect">
          <svg width="20" height="20" viewBox="0 0 24 24" fill={user ? "#666" : "#252525"}>
            <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
          </svg>
          <span className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: user ? "#39ff14" : "#1e1e1e", boxShadow: user ? "0 0 5px #39ff14" : "none" }} />
        </button>
      </div>

      {/* Close popover on outside click */}
      {showSwitch && (
        <div className="fixed inset-0 z-40" onClick={() => setShowSwitch(false)} />
      )}

      <style>{`.spinner{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
