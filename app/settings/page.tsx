"use client";

import { useState, useEffect } from "react";
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

// ── Avatars ───────────────────────────────────────────────────────────────────
function AvatarMale() {
  return (
    <svg width="52" height="52" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="7.5" r="4" stroke="#666" strokeWidth="1.5" />
      <path d="M4 20c0-4.418 3.582-8 8-8s8 3.582 8 8" stroke="#666" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function AvatarFemale() {
  return (
    <svg width="52" height="52" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="7.5" r="4" stroke="#888" strokeWidth="1.5" />
      {/* hair */}
      <path d="M8 6.5C8 4 9.5 2.5 12 2.5s4 1.5 4 4c0 .5 0 1-.2 1.5" stroke="#888" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M4 20c0-4.418 3.582-8 8-8s8 3.582 8 8" stroke="#888" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ── Row action ────────────────────────────────────────────────────────────────
function ActionRow({
  icon, label, sublabel, onClick, disabled, accent,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  onClick?: () => void;
  disabled?: boolean;
  accent?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center gap-4 px-5 py-4 press-effect disabled:opacity-40"
      style={{ background: "transparent" }}
    >
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: "#131313", border: "1px solid #1e1e1e" }}>
        {icon}
      </div>
      <div className="flex-1 text-left">
        <p className="text-sm font-medium" style={{ color: accent ?? "#ccc" }}>{label}</p>
        {sublabel && <p className="text-[11px] mt-0.5" style={{ color: "#444" }}>{sublabel}</p>}
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M9 6l6 6-6 6" stroke="#333" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

function Divider() {
  return <div className="ml-[72px] mr-5 h-px" style={{ background: "#141414" }} />;
}

// ── Page ──────────────────────────────────────────────────────────────────────
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

  // Profile
  const [profiles,       setProfiles]       = useState<[ProfileMeta | null, ProfileMeta | null]>([null, null]);
  const [activeProfile,  setActiveProfile]  = useState<ProfileMeta | null>(null);
  const [isSwitching,    setIsSwitching]    = useState(false);
  const [showSwitch,     setShowSwitch]     = useState(false);

  useEffect(() => {
    setMounted(true);
    setLastSync(getLastSync());
    setIsStravaConnected(!!getStravaTokens());
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    const ps = getProfiles();
    setProfiles(ps);
    setActiveProfile(getActiveProfile());
    return () => subscription.unsubscribe();
  }, []);

  // ── Strava ──
  const handleStravaAction = async () => {
    if (!isStravaConnected) { window.location.href = getStravaAuthUrl(); return; }
    if (stravaResyncing) return;
    setStravaResyncing(true); setStravaMsg("");
    try {
      const activities = await forceResyncRecentActivities(14);
      let count = 0;
      activities.forEach((a) => { const s = autoImportActivity(a); if (s) { addSession(s); count++; } });
      setStravaMsg(count > 0 ? `${count} activité${count > 1 ? "s" : ""} importée${count > 1 ? "s" : ""}` : "Déjà à jour");
      setTimeout(() => setStravaMsg(""), 3000);
    } catch { setStravaMsg("Erreur"); }
    finally { setStravaResyncing(false); }
  };

  // ── Import ──
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportMsg(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const today = new Date().toISOString().slice(0, 10);
        const plans = parseCoachWorkoutJSON(text).filter((p) => p.date >= today);
        if (plans.length === 0) { setImportMsg({ ok: false, text: "Aucune séance future trouvée" }); return; }
        clearFutureCoachPlans();
        plans.forEach((p) => { if (p.type === "run") addCoachRun(p); else addCoachWorkout(p); });
        autoSyncPush();
        setImportMsg({ ok: true, text: `${plans.length} séance${plans.length > 1 ? "s" : ""} importée${plans.length > 1 ? "s" : ""}` });
        setTimeout(() => setImportMsg(null), 4000);
      } catch { setImportMsg({ ok: false, text: "JSON invalide" }); }
    };
    reader.readAsText(file);
    e.target.value = "";
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
    a.click();
    setShowExport(false);
  };

  // ── Profile switch ──
  const otherProfile = profiles.find((p) => p && p.slot !== activeProfile?.slot) ?? null;

  const handleSwitchConfirm = async () => {
    if (!otherProfile) return;
    setShowSwitch(false);
    setIsSwitching(true);

    // If other profile doesn't exist yet, create it
    const existing = profiles[otherProfile.slot - 1];
    if (!existing && user) {
      const defaultName = otherProfile.slot === 2 ? "Christine" : "Profil 1";
      await createProfile(otherProfile.slot, defaultName, user.id);
      setProfiles(getProfiles());
    }
    try { await switchProfile(otherProfile.slot); }
    catch { setIsSwitching(false); }
  };

  // Determine which profile to switch to
  const targetSlot: 1 | 2 = activeProfile?.slot === 1 ? 2 : 1;
  const targetMeta = profiles[targetSlot - 1];

  const handleNameTap = () => {
    if (isSwitching) return;
    setShowSwitch(true);
  };

  if (!mounted) return null;

  const ghName = (user?.user_metadata?.user_name as string) ?? user?.email ?? "—";
  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
  const profileName = activeProfile?.name ?? (activeProfile?.slot === 2 ? "Christine" : "Maxime");
  const isFemale = activeProfile?.slot === 2;

  const syncLabel = lastSync
    ? new Date(lastSync).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col pb-24 animate-fade-in">

      {/* ── Avatar + nom ── */}
      <div className="flex flex-col items-center pt-14 pb-8 px-5">
        {/* Photo de profil */}
        <div className="w-24 h-24 rounded-full overflow-hidden flex items-center justify-center mb-5"
          style={{ background: "#111", border: "2px solid #1e1e1e" }}>
          {avatarUrl ? (
            <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
          ) : isFemale ? <AvatarFemale /> : <AvatarMale />}
        </div>

        {/* Nom cliquable */}
        <button
          onClick={handleNameTap}
          disabled={isSwitching}
          className="flex items-center gap-2 press-effect disabled:opacity-50"
        >
          <span className="text-xl font-semibold" style={{ color: "#eee" }}>{profileName}</span>
          {!isSwitching && (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M6 9l6 6 6-6" stroke="#444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          {isSwitching && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="spinner">
              <circle cx="12" cy="12" r="9" stroke="#222" strokeWidth="2" />
              <path d="M12 3a9 9 0 0 1 9 9" stroke="#39ff14" strokeWidth="2" strokeLinecap="round" />
            </svg>
          )}
        </button>
        {isSwitching && (
          <p className="text-xs mt-2" style={{ color: "#444" }}>Changement de profil…</p>
        )}
      </div>

      {/* ── Actions ── */}
      <div className="flex-1 mx-4 rounded-2xl overflow-hidden" style={{ background: "#0d0d0d", border: "1px solid #161616" }}>

        {/* Strava */}
        <ActionRow
          icon={
            <img src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/strava.svg`}
              width={20} height={20} alt="Strava"
              style={{ opacity: isStravaConnected ? 1 : 0.35 }} />
          }
          label={stravaResyncing ? "Synchronisation…" : isStravaConnected ? "Strava" : "Connecter Strava"}
          sublabel={stravaMsg || (isStravaConnected ? "Connecté" : "Non connecté")}
          onClick={handleStravaAction}
          disabled={stravaResyncing}
          accent={isStravaConnected ? "#ccc" : "#555"}
        />

        <Divider />

        {/* Import */}
        <label className="w-full flex items-center gap-4 px-5 py-4 cursor-pointer press-effect">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "#131313", border: "1px solid #1e1e1e" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 15V3M7 8l5-5 5 5" stroke="#555" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M20 21H4" stroke="#555" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-medium" style={{ color: "#ccc" }}>Import programme</p>
            {importMsg && (
              <p className="text-[11px] mt-0.5" style={{ color: importMsg.ok ? "#39ff14" : "#ff4444" }}>
                {importMsg.text}
              </p>
            )}
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M9 6l6 6-6 6" stroke="#333" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <input type="file" accept=".json,application/json" className="hidden" onChange={handleImportFile} />
        </label>

        <Divider />

        {/* Export */}
        <div>
          <ActionRow
            icon={
              copied
                ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M5 13L9 17L19 7" stroke="#39ff14" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                : <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M12 9v12M7 16l5 5 5-5" stroke="#555" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M20 3H4" stroke="#555" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
            }
            label={copied ? "Copié !" : "Export programme"}
            accent={copied ? "#39ff14" : "#ccc"}
            onClick={() => setShowExport((v) => !v)}
          />
          {showExport && (
            <div className="flex gap-3 px-5 pb-4">
              <button onClick={handleCopy}
                className="flex-1 py-3 rounded-xl text-xs font-bold press-effect"
                style={{ background: "rgba(57,255,20,0.07)", border: "1px solid rgba(57,255,20,0.15)", color: "#39ff14" }}>
                Copier JSON
              </button>
              <button onClick={handleDownload}
                className="flex-1 py-3 rounded-xl text-xs font-bold press-effect"
                style={{ background: "#111", border: "1px solid #1e1e1e", color: "#555" }}>
                Télécharger
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── GitHub sync bar ── */}
      <div className="mx-4 mt-4 px-5 py-4 rounded-2xl flex items-center justify-between"
        style={{ background: "#0d0d0d", border: "1px solid #161616" }}>
        {/* Left: nom + sync */}
        <div>
          <p className="text-sm font-medium" style={{ color: user ? "#888" : "#333" }}>
            {user ? ghName : "Non connecté"}
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: "#333" }}>
            {syncLabel ? `Sync ${syncLabel}` : "Jamais synchronisé"}
          </p>
        </div>

        {/* Right: icône GitHub + statut */}
        <button onClick={user ? signOut : signInWithGitHub} className="flex items-center gap-2.5 press-effect">
          <svg width="22" height="22" viewBox="0 0 24 24" fill={user ? "#888" : "#2a2a2a"}>
            <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
          </svg>
          <span className="w-2 h-2 rounded-full"
            style={{
              background: user ? "#39ff14" : "#2a2a2a",
              boxShadow: user ? "0 0 6px #39ff14" : "none",
            }} />
        </button>
      </div>

      {/* ── Modal switch profil ── */}
      {showSwitch && (
        <div className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={() => setShowSwitch(false)}>
          <div className="w-full max-w-md mb-6 mx-4 rounded-2xl overflow-hidden"
            style={{ background: "#111", border: "1px solid #222" }}
            onClick={(e) => e.stopPropagation()}>
            <div className="px-5 pt-5 pb-2">
              <p className="text-sm font-semibold text-center" style={{ color: "#eee" }}>
                Changer de profil
              </p>
              <p className="text-xs text-center mt-1" style={{ color: "#444" }}>
                Passer vers{" "}
                <span style={{ color: "#aaa" }}>
                  {targetMeta?.name ?? (targetSlot === 2 ? "Christine" : "Maxime")}
                </span>
                {" "}?
              </p>
            </div>
            <div className="flex gap-3 p-4">
              <button onClick={() => setShowSwitch(false)}
                className="flex-1 py-3 rounded-xl text-sm font-medium press-effect"
                style={{ background: "#1a1a1a", color: "#555" }}>
                Annuler
              </button>
              <button onClick={handleSwitchConfirm}
                className="flex-1 py-3 rounded-xl text-sm font-bold press-effect"
                style={{ background: "rgba(57,255,20,0.1)", border: "1px solid rgba(57,255,20,0.2)", color: "#39ff14" }}>
                Changer
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`.spinner { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
