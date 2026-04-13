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
import { analyzeSession, getStoredCoachAnalysis } from "@/lib/coachAnalyzer";
import {
  getProfiles, getActiveProfile, switchProfile,
  createProfile, renameProfile, type ProfileMeta,
} from "@/lib/profiles";

function AvatarMale() {
  return (
    <svg width="42" height="42" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="9" r="4" stroke="#555" strokeWidth="1.5"/>
      <path d="M5 20c0-3.866 3.134-7 7-7s7 3.134 7 7" stroke="#555" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function AvatarFemale() {
  return (
    <svg width="42" height="42" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="9" r="4" stroke="#777" strokeWidth="1.5"/>
      <path d="M8.5 7C8.5 4.5 10 3 12 3s3.5 1.5 3.5 4" stroke="#777" strokeWidth="1.3" strokeLinecap="round"/>
      <path d="M5 20c0-3.866 3.134-7 7-7s7 3.134 7 7" stroke="#777" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function Divider() {
  return <div className="ml-[68px] mr-4 h-px" style={{ background: "#161616" }}/>;
}

export default function SettingsPage() {
  const [mounted,           setMounted]           = useState(false);
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
  const [editingOther,      setEditingOther]      = useState(false);
  const [editName,          setEditName]          = useState("");
  const editRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => { if (editingOther) editRef.current?.focus(); }, [editingOther]);

  // ── Strava ──
  const handleStravaAction = async () => {
    if (!isStravaConnected) { window.location.href = getStravaAuthUrl(); return; }
    if (stravaResyncing) return;
    setStravaResyncing(true); setStravaMsg("");
    try {
      const acts = await forceResyncRecentActivities(14);
      let n = 0;
      acts.forEach((a) => {
        const s = autoImportActivity(a);
        if (s) {
          addSession(s);
          n++;
          if (s.type === "run" && !getStoredCoachAnalysis(s.date.slice(0, 10))) {
            analyzeSession(s).catch(() => {});
          }
        }
      });
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

  // ── Switch ──
  const targetSlot: 1 | 2 = activeProfile?.slot === 1 ? 2 : 1;
  const targetMeta = profiles[targetSlot - 1];
  const isGenericName = (n?: string) => !n || n === "Profil 2" || n === "Profil 1";
  const targetName = isGenericName(targetMeta?.name)
    ? (targetSlot === 2 ? "Christine" : "Maxime")
    : targetMeta!.name;

  const handleSwitchTo = async () => {
    setShowSwitch(false); setIsSwitching(true);
    if (!targetMeta && user) { await createProfile(targetSlot, targetName, user.id); setProfiles(getProfiles()); }
    if (targetMeta && isGenericName(targetMeta.name)) { await renameProfile(targetSlot, targetName); setProfiles(getProfiles()); }
    try { await switchProfile(targetSlot); } catch { setIsSwitching(false); }
  };

  const handleRenameOther = async () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== targetMeta?.name) {
      if (targetMeta) await renameProfile(targetSlot, trimmed);
      else if (user) await createProfile(targetSlot, trimmed, user.id);
      setProfiles(getProfiles());
    }
    setEditingOther(false);
  };

  if (!mounted) return null;

  const ghName = (user?.user_metadata?.user_name as string) ?? user?.email ?? "—";
  const profileName = activeProfile?.name && !isGenericName(activeProfile.name)
    ? activeProfile.name
    : (activeProfile?.slot === 2 ? "Christine" : "Maxime");
  const isFemale = activeProfile?.slot === 2;
  const syncLabel = lastSync
    ? new Date(lastSync).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : "—";

  return (
    // Pleine hauteur, flex centré, safe-area haut+bas
    <div className="max-w-md mx-auto flex flex-col px-4 animate-fade-in"
      style={{
        minHeight: "calc(100svh - 100px - env(safe-area-inset-bottom))",
        paddingTop: "env(safe-area-inset-top)",
      }}>

      {/* Espace flexible haut */}
      <div className="flex-1"/>

      {/* ── Avatar + nom ── */}
      <div className="flex flex-col items-center pb-8">
        {/* Cercle — pas d'overflow-hidden pour éviter le crop */}
        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4"
          style={{ background: "#111", border: "2px solid #1e1e1e" }}>
          {isFemale ? <AvatarFemale /> : <AvatarMale />}
        </div>

        {/* Nom + popover — le nom n'apparaît qu'une fois */}
        <div className="relative flex flex-col items-center" style={{ minHeight: 32 }}>
          {/* Bouton fantôme pour maintenir la hauteur quand la carte est ouverte */}
          <button
            onClick={() => !isSwitching && setShowSwitch((v) => !v)}
            disabled={isSwitching}
            className={`flex items-center gap-1.5 press-effect disabled:opacity-50${showSwitch ? " invisible" : ""}`}
          >
            {isSwitching && (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="spinner">
                <circle cx="12" cy="12" r="9" stroke="#222" strokeWidth="2"/>
                <path d="M12 3a9 9 0 0 1 9 9" stroke="#39ff14" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            )}
            <span className="text-xl font-semibold" style={{ color: "#39ff14" }}>{profileName}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M6 9l6 6 6-6" stroke="#2a2a2a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          {/* Carte — top:0 pour que le nom soit au même endroit que le bouton */}
          {showSwitch && (
            <div className="absolute top-0 z-50 rounded-2xl overflow-hidden shadow-2xl"
              style={{ background: "#131313", border: "1px solid #222", minWidth: 160 }}>
              {/* En-tête = le nom actif (remplace le bouton) */}
              <button
                onClick={() => setShowSwitch(false)}
                className="w-full flex items-center justify-center gap-1.5 px-6 pt-4 pb-2 press-effect"
              >
                <span className="text-xl font-semibold" style={{ color: "#39ff14" }}>{profileName}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ transform: "rotate(180deg)" }}>
                  <path d="M6 9l6 6 6-6" stroke="#39ff14" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <div className="mx-4 h-px" style={{ background: "#1e1e1e" }}/>
              {/* Autre profil */}
              <div className="px-6 pt-2 pb-4 flex items-center justify-center gap-2">
                {editingOther ? (
                  <input
                    ref={editRef}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={handleRenameOther}
                    onKeyDown={(e) => { if (e.key === "Enter") handleRenameOther(); if (e.key === "Escape") setEditingOther(false); }}
                    className="text-center bg-transparent outline-none text-base font-semibold w-28"
                    style={{ color: "#eee", borderBottom: "1px solid #333" }}
                    maxLength={20}
                  />
                ) : (
                  <>
                    <button onClick={handleSwitchTo}
                      className="text-base font-semibold press-effect" style={{ color: "#eee" }}>
                      {targetName}
                    </button>
                    <button
                      onClick={() => { setEditName(targetName); setEditingOther(true); }}
                      className="press-effect" style={{ opacity: 0.3 }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="#aaa" strokeWidth="2" strokeLinecap="round"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="#aaa" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "#0d0d0d", border: "1px solid #161616" }}>

        {/* Strava */}
        <button onClick={handleStravaAction} disabled={stravaResyncing}
          className="w-full flex items-center gap-4 px-4 py-4 press-effect disabled:opacity-40">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "#131313", border: "1px solid #1e1e1e" }}>
            <img src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/strava.svg`} width={20} height={20} alt="Strava"
              style={{ opacity: isStravaConnected ? 1 : 0.3 }}/>
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-medium" style={{ color: isStravaConnected ? "#ccc" : "#555" }}>
              {stravaResyncing ? "Synchronisation…" : "Strava"}
            </p>
            <p className="text-[11px]" style={{ color: stravaMsg ? "#ff6b00" : "#333" }}>
              {stravaMsg || (isStravaConnected ? "Connecté" : "Non connecté")}
            </p>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M9 6l6 6-6 6" stroke="#252525" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <Divider/>

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
            <path d="M9 6l6 6-6 6" stroke="#252525" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <input type="file" accept=".json,application/json" className="hidden" onChange={handleImportFile}/>
        </label>

        <Divider/>

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
                  </svg>}
            </div>
            <p className="flex-1 text-left text-sm font-medium" style={{ color: copied ? "#39ff14" : "#ccc" }}>
              {copied ? "Copié !" : "Export programme"}
            </p>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              style={{ transform: showExport ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}>
              <path d="M9 6l6 6-6 6" stroke="#252525" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
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

      {/* ── GitHub footer ── */}
      <div className="mt-3 px-4 py-3.5 rounded-2xl flex items-center justify-between"
        style={{ background: "#0d0d0d", border: "1px solid #161616" }}>
        <div>
          <p className="text-sm font-medium" style={{ color: user ? "#555" : "#252525" }}>{ghName}</p>
          <p className="text-[11px]" style={{ color: "#252525" }}>Sync {syncLabel}</p>
        </div>
        <button onClick={user ? signOut : signInWithGitHub} className="flex items-center gap-2 press-effect">
          <svg width="20" height="20" viewBox="0 0 24 24" fill={user ? "#555" : "#222"}>
            <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
          </svg>
          <span className="w-2 h-2 rounded-full"
            style={{ background: user ? "#39ff14" : "#1e1e1e", boxShadow: user ? "0 0 5px #39ff14" : "none" }}/>
        </button>
      </div>

      {/* Espace flexible bas */}
      <div className="flex-1"/>

      {/* Fermer popover au clic extérieur */}
      {showSwitch && (
        <div className="fixed inset-0 z-40" onClick={() => { setShowSwitch(false); setEditingOther(false); }}/>
      )}

      <style>{`.spinner{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
