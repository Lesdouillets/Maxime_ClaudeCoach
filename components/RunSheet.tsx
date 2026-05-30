"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useRunSheet } from "@/contexts/RunSheetContext";
import { ContextMenu } from "@/components/ui/ContextMenu";
import RunSessionResults from "@/components/RunSessionResults";
import CoachFeedbackCard from "@/components/CoachFeedbackCard";
import { RunCard } from "@/components/SessionCard";
import RunPlanSection from "@/components/RunPlanSection";
import SessionBriefCard from "@/components/SessionBriefCard";
import { toLocalDateStr } from "@/lib/plan";
import { getCoachRuns, deleteCoachRun, addCoachRun } from "@/lib/coachPlan";
import { getSessions, getStravaTokens, addSession, updateSession, cancelDay } from "@/lib/storage";
import { autoSyncPush } from "@/lib/sync";
import { originNeedsRedirect } from "@/lib/navigation";
import { CalendarIcon, ImageIcon, NoteIcon, OptionsIcon, StravaIcon, TrashIcon } from "@/components/icons";
import NoteModal from "@/components/NoteModal";
import { JETBRAINS_MONO_LABEL } from "@/lib/typography";
import { fetchActivityLaps, fetchRecentActivities, autoImportActivity } from "@/lib/strava";
import {
  analyzeSession,
  getStoredCoachAnalysis,
  type CoachAnalysisResult,
} from "@/lib/coachAnalyzer";
import type { CoachRun } from "@/lib/coachPlan";
import type { RunSession, StravaLap } from "@/lib/types";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const IS_DEV_SYNC = process.env.NEXT_PUBLIC_DISABLE_SYNC === "true";

// Webpack élimine ce tableau en prod car la condition est résolue à la compilation
const DEV_MOCK_LAPS: StravaLap[] = process.env.NEXT_PUBLIC_DISABLE_SYNC === "true" ? [
  { lap_index: 1,  name: "Lap 1",  elapsed_time: 330, moving_time: 328, distance: 1000, average_speed: 3.05, average_heartrate: 128, total_elevation_gain: 8  },
  { lap_index: 2,  name: "Lap 2",  elapsed_time: 326, moving_time: 324, distance: 1000, average_speed: 3.09, average_heartrate: 133, total_elevation_gain: 5  },
  { lap_index: 3,  name: "Lap 3",  elapsed_time: 321, moving_time: 319, distance: 1000, average_speed: 3.13, average_heartrate: 136, total_elevation_gain: 22 },
  { lap_index: 4,  name: "Lap 4",  elapsed_time: 318, moving_time: 316, distance: 1000, average_speed: 3.16, average_heartrate: 139, total_elevation_gain: 14 },
  { lap_index: 5,  name: "Lap 5",  elapsed_time: 323, moving_time: 321, distance: 1000, average_speed: 3.12, average_heartrate: 141, total_elevation_gain: 31 },
  { lap_index: 6,  name: "Lap 6",  elapsed_time: 316, moving_time: 314, distance: 1000, average_speed: 3.18, average_heartrate: 144, total_elevation_gain: 6  },
  { lap_index: 7,  name: "Lap 7",  elapsed_time: 320, moving_time: 318, distance: 1000, average_speed: 3.14, average_heartrate: 146, total_elevation_gain: 19 },
  { lap_index: 8,  name: "Lap 8",  elapsed_time: 315, moving_time: 313, distance: 1000, average_speed: 3.19, average_heartrate: 148, total_elevation_gain: 11 },
  { lap_index: 9,  name: "Lap 9",  elapsed_time: 322, moving_time: 320, distance: 1000, average_speed: 3.13, average_heartrate: 149, total_elevation_gain: 28 },
  { lap_index: 10, name: "Lap 10", elapsed_time: 318, moving_time: 316, distance: 1000, average_speed: 3.16, average_heartrate: 150, total_elevation_gain: 7  },
  { lap_index: 11, name: "Lap 11", elapsed_time: 324, moving_time: 322, distance: 1000, average_speed: 3.10, average_heartrate: 143, total_elevation_gain: 16 },
  { lap_index: 12, name: "Lap 12", elapsed_time: 328, moving_time: 326, distance: 1000, average_speed: 3.06, average_heartrate: 140, total_elevation_gain: 9  },
  { lap_index: 13, name: "Lap 13", elapsed_time: 312, moving_time: 310, distance: 1000, average_speed: 3.22, average_heartrate: 142, total_elevation_gain: 4  },
  { lap_index: 14, name: "Lap 14", elapsed_time: 319, moving_time: 317, distance: 1000, average_speed: 3.15, average_heartrate: 141, total_elevation_gain: 12 },
  { lap_index: 15, name: "Lap 15", elapsed_time: 325, moving_time: 323, distance: 1000, average_speed: 3.10, average_heartrate: 138, total_elevation_gain: 3  },
  { lap_index: 16, name: "Lap 16", elapsed_time: 323, moving_time: 321, distance: 1200, average_speed: 3.12, average_heartrate: 135, total_elevation_gain: 2  },
] : [];
const DRAG_CLOSE_THRESHOLD_PX = 80;
const TAP_MAX_MOVEMENT_PX = 6;
const TAP_MAX_DURATION_MS = 250;

export default function RunSheet() {
  const sheet = useRunSheet();
  const router = useRouter();
  const pathname = usePathname();
  const [hasEntered, setHasEntered] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ y: number; t: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dateStr = sheet.state?.date ?? toLocalDateStr(new Date());
  const [coachRun, setCoachRun] = useState<CoachRun | null>(null);
  const [doneSession, setDoneSession] = useState<RunSession | null>(null);
  const [coachState, setCoachState] = useState<"analyzing" | "done">("done");
  const [coachResult, setCoachResult] = useState<CoachAnalysisResult | null>(null);
  const [analysisAttempted, setAnalysisAttempted] = useState(false);
  const [stravaSyncing, setStravaSyncing] = useState(false);
  const [stravaSyncMsg, setStravaSyncMsg] = useState("");
  const [optionsMenuOpen, setOptionsMenuOpen] = useState(false);
  const [optionsPanel, setOptionsPanel] = useState<"reschedule" | "cancel" | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [addContentMenuOpen, setAddContentMenuOpen] = useState(false);
  const [noteModalOpen, setNoteModalOpen] = useState(false);

  // Entrance animation: render at translateY(100%) on first frame, then flip.
  useEffect(() => {
    if (!sheet.state) {
      setHasEntered(false);
      return;
    }
    const id1 = requestAnimationFrame(() => {
      const id2 = requestAnimationFrame(() => setHasEntered(true));
      return () => cancelAnimationFrame(id2);
    });
    return () => cancelAnimationFrame(id1);
  }, [sheet.state]);

  // Pull the recorded session (if any), the coach run, and the generic
  // weekly plan for the requested date.
  useEffect(() => {
    if (!sheet.state) return;
    setOptionsMenuOpen(false);
    setOptionsPanel(null);
    const dateStr = sheet.state.date ?? toLocalDateStr(new Date());

    const recorded = getSessions().find(
      (s): s is RunSession => s.type === "run" && s.date.slice(0, 10) === dateStr
    ) ?? null;
    setDoneSession(recorded);

    setCoachRun(getCoachRuns().find((r) => r.date === dateStr) ?? null);

    // For a Strava-imported run with no stored analysis, fire the coach
    // analysis in the background so the feedback shows up here.
    const stored = getStoredCoachAnalysis(dateStr);
    setCoachResult(stored);
    if (!stored && recorded?.importedFromStrava) {
      setAnalysisAttempted(true);
      setCoachState("analyzing");
      analyzeSession(recorded).then((result) => {
        setCoachResult(result);
        setCoachState("done");
      });
    } else {
      setCoachState("done");
    }
  }, [sheet.state]);

  const handleStravaImport = async () => {
    if (stravaSyncing) return;
    const tokens = getStravaTokens();
    if (!tokens) { setStravaSyncMsg("Non connecté à Strava"); return; }
    setStravaSyncing(true);
    setStravaSyncMsg("");
    try {
      const dayStart = Math.floor(new Date(dateStr + "T00:00:00").getTime() / 1000);
      const activities = await fetchRecentActivities(tokens, dayStart);
      const match = activities.find(
        (a) => a.start_date.slice(0, 10) === dateStr &&
          ["Run", "TrailRun", "VirtualRun"].includes(a.type)
      );
      if (!match) { setStravaSyncMsg("Aucune activité Strava trouvée pour ce jour"); return; }
      const laps = await fetchActivityLaps(tokens, match.id);
      const session = autoImportActivity(match, laps);
      if (!session || session.type !== "run") { setStravaSyncMsg("Erreur lors de l'import"); return; }
      const alreadyLogged = getSessions().some((s) => s.type === "run" && s.date.slice(0, 10) === dateStr);
      if (alreadyLogged) { setStravaSyncMsg("Une séance run existe déjà pour ce jour"); return; }
      addSession(session);
      setDoneSession(session as RunSession);
      autoSyncPush().catch(() => {});
    } catch {
      setStravaSyncMsg("Erreur de synchronisation");
    } finally {
      setStravaSyncing(false);
      setTimeout(() => setStravaSyncMsg(""), 4000);
    }
  };

  const handleStravaSync = async () => {
    if (!doneSession || stravaSyncing) return;
    const tokens = getStravaTokens();
    if (!tokens) { setStravaSyncMsg("Non connecté à Strava"); return; }
    setStravaSyncing(true);
    setStravaSyncMsg("");
    try {
      let activityId = doneSession.stravaActivityId;

      if (!activityId) {
        // Cherche une activité run Strava le même jour
        const dayStart = Math.floor(new Date(dateStr + "T00:00:00").getTime() / 1000);
        const activities = await fetchRecentActivities(tokens, dayStart);
        const match = activities.find(
          (a) => a.start_date.slice(0, 10) === dateStr &&
            ["Run", "TrailRun", "VirtualRun"].includes(a.type)
        );
        if (match) activityId = match.id;
      }

      if (!activityId) {
        setStravaSyncMsg("Aucune activité Strava trouvée pour ce jour");
        return;
      }

      const laps = await fetchActivityLaps(tokens, activityId);
      if (laps.length > 1) {
        const updated: RunSession = { ...doneSession, laps, stravaActivityId: activityId, importedFromStrava: true };
        updateSession(updated);
        setDoneSession(updated);
        autoSyncPush().catch(() => {});
        setStravaSyncMsg(`${laps.length} fractions synchronisées ✓`);
      } else {
        setStravaSyncMsg("Aucune fraction trouvée dans Strava");
      }
    } catch {
      setStravaSyncMsg("Erreur de synchronisation");
    } finally {
      setStravaSyncing(false);
      setTimeout(() => setStravaSyncMsg(""), 4000);
    }
  };

  const handleMockStravaSync = () => {
    if (!doneSession || stravaSyncing) return;
    const updated: RunSession = { ...doneSession, laps: DEV_MOCK_LAPS, importedFromStrava: true };
    updateSession(updated);
    setDoneSession(updated);
    setStravaSyncMsg(`${DEV_MOCK_LAPS.length} fractions simulées ✓`);
    setTimeout(() => setStravaSyncMsg(""), 3000);
  };

  const handleClose = useCallback(() => {
    const origin = sheet.state?.originRoute;
    sheet.close();
    setIsDragging(false);
    setDragY(0);
    setOptionsMenuOpen(false);
    setOptionsPanel(null);
    setRescheduleDate("");
    setCancelReason("");
    setAddContentMenuOpen(false);
    setNoteModalOpen(false);
    if (origin && originNeedsRedirect(origin, pathname)) router.push(origin);
  }, [sheet, router, pathname]);

  const handleRescheduleRun = () => {
    if (!rescheduleDate || !coachRun) return;
    deleteCoachRun(coachRun.id);
    addCoachRun({ ...coachRun, date: rescheduleDate });
    autoSyncPush().catch(() => {});
    setOptionsPanel(null);
    setRescheduleDate("");
  };

  const handleCancelRun = () => {
    if (!coachRun) return;
    cancelDay(dateStr, cancelReason.trim());
    deleteCoachRun(coachRun.id);
    autoSyncPush().catch(() => {});
    setCancelReason("");
    handleClose();
  };

  const onHandlePointerDown = (e: React.PointerEvent<HTMLElement>) => {
    dragStartRef.current = { y: e.clientY, t: Date.now() };
    setIsDragging(true);
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch {}
  };

  const onHandlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (!dragStartRef.current) return;
    const dy = e.clientY - dragStartRef.current.y;
    setDragY(Math.max(0, dy));
  };

  const onHandlePointerEnd = (e: React.PointerEvent<HTMLElement>) => {
    const start = dragStartRef.current;
    dragStartRef.current = null;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
    if (!start) {
      setIsDragging(false);
      setDragY(0);
      return;
    }
    const dy = Math.max(0, e.clientY - start.y);
    const elapsed = Date.now() - start.t;
    const isTap = dy < TAP_MAX_MOVEMENT_PX && elapsed < TAP_MAX_DURATION_MS;
    if (dy >= DRAG_CLOSE_THRESHOLD_PX || isTap) {
      handleClose();
    } else {
      setIsDragging(false);
      setDragY(0);
    }
  };

  if (!sheet.state) return null;

  // En dev, toujours vrai dès qu'une session existe — permet de rejouer la mock à tout moment
  const needsStravaSync = IS_DEV_SYNC
    ? !!doneSession
    : !!doneSession && !doneSession.importedFromStrava && !doneSession.stravaActivityId;
  const isExpanded = sheet.view === "expanded" && hasEntered;
  const backdropVisible = sheet.view === "expanded";

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          background: "var(--color-background)",
          opacity: isDragging
            ? Math.max(0, 1 - dragY / 300)
            : (backdropVisible && hasEntered ? 1 : 0),
          pointerEvents: backdropVisible ? "auto" : "none",
          transition: isDragging ? "none" : "opacity 220ms ease",
          zIndex: 55,
        }}
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal={isExpanded}
        aria-hidden={!isExpanded}
        style={{
          position: "fixed",
          inset: 0,
          background: "var(--color-background)",
          color: "#fff",
          zIndex: 60,
          transform: isDragging
            ? `translateY(${dragY}px)`
            : (isExpanded ? "translateY(0)" : "translateY(100%)"),
          transition: isDragging
            ? "none"
            : "transform 280ms cubic-bezier(0.32, 0.72, 0, 1)",
          display: "flex",
          flexDirection: "column",
          paddingTop: "env(safe-area-inset-top, 0px)",
        }}
      >
        {/* Top bar */}
        <div className="relative flex items-center justify-between px-4 pt-3 pb-2">
          <button
            onClick={handleClose}
            className="w-10 h-10 rounded-full flex items-center justify-center press-effect"
            style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-surface-3)", color: "#ddd" }}
            aria-label="Réduire"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          <button
            onPointerDown={onHandlePointerDown}
            onPointerMove={onHandlePointerMove}
            onPointerUp={onHandlePointerEnd}
            onPointerCancel={onHandlePointerEnd}
            aria-label="Glisser vers le bas pour fermer"
            className="flex items-center justify-center"
            style={{
              padding: "16px 32px",
              touchAction: "none",
              background: "transparent",
              border: "none",
              cursor: "grab",
            }}
          >
            <span
              className="rounded-full block"
              style={{ width: 36, height: 4, background: "var(--color-surface-3)" }}
            />
          </button>

          {coachRun !== null && !doneSession ? (
            <div className="relative">
              <button
                onClick={() => { setOptionsMenuOpen((v) => !v); setOptionsPanel(null); }}
                className="w-10 h-10 rounded-full flex items-center justify-center press-effect"
                style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-surface-3)", color: "#777" }}
                aria-label="Options"
              >
                <OptionsIcon size={20} color="currentColor" />
              </button>
              {optionsMenuOpen && (
                <ContextMenu
                  onClose={() => setOptionsMenuOpen(false)}
                  items={[
                    {
                      label: "Décaler la séance",
                      icon: <CalendarIcon size={16} color="currentColor" />,
                      onClick: () => { setOptionsPanel("reschedule"); setOptionsMenuOpen(false); },
                    },
                    {
                      label: "Annuler la séance",
                      icon: <TrashIcon size={16} color="currentColor" />,
                      onClick: () => { setOptionsPanel("cancel"); setOptionsMenuOpen(false); },
                      variant: "destructive",
                    },
                  ]}
                />
              )}
            </div>
          ) : (
            <span className="w-10 h-10" aria-hidden />
          )}
        </div>

        {/* Options panel */}
        {optionsPanel !== null && (
          <div
            className="mx-4 mb-2 rounded-2xl overflow-hidden"
            style={{ background: "rgba(28,28,30,0.96)", border: "1px solid var(--color-surface-3)" }}
          >
            {optionsPanel === "reschedule" && (
              <div className="p-4 space-y-3">
                <p style={{ ...JETBRAINS_MONO_LABEL, color: "var(--color-secondary)" }}>DÉCALER LE RUN</p>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                    min={toLocalDateStr(new Date())}
                    autoFocus
                    className="flex-1 rounded-xl px-3 py-2.5 text-xs focus:outline-none"
                    style={{ background: "var(--color-surface)", border: "1px solid var(--color-orange-shadow)", color: "white" }}
                  />
                  <button
                    onClick={handleRescheduleRun}
                    disabled={!rescheduleDate}
                    className="px-3 py-2.5 rounded-xl text-xs font-bold press-effect disabled:opacity-40"
                    style={{ background: "var(--color-orange)", color: "white" }}
                  >OK</button>
                  <button
                    onClick={() => { setOptionsPanel(null); setRescheduleDate(""); }}
                    className="px-3 py-2.5 rounded-xl text-xs press-effect"
                    style={{ background: "var(--color-surface-2)", color: "var(--color-muted)" }}
                  >✕</button>
                </div>
              </div>
            )}
            {optionsPanel === "cancel" && (
              <div className="p-4 space-y-3">
                <p style={{ ...JETBRAINS_MONO_LABEL, color: "var(--color-secondary)" }}>ANNULER LE RUN</p>
                <input
                  type="text"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Raison de l'annulation…"
                  className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none"
                  style={{ background: "var(--color-surface)", border: "1px solid var(--color-subtle)", color: "white" }}
                  onKeyDown={(e) => { if (e.key === "Enter") handleCancelRun(); }}
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleCancelRun}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold press-effect"
                    style={{ background: "var(--color-surface-2)", color: "#aaa", border: "1px solid var(--color-subtle)" }}
                  >Confirmer l&apos;annulation</button>
                  <button
                    onClick={() => { setOptionsPanel(null); setCancelReason(""); }}
                    className="px-4 py-2.5 rounded-xl text-sm press-effect"
                    style={{ background: "transparent", color: "var(--color-muted)" }}
                  >✕</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Body */}
        <div className={`flex-1 overflow-y-auto px-5 pt-2 space-y-4 ${coachRun && !doneSession ? "pb-32" : needsStravaSync ? "pb-32" : "pb-12"}`}>
          {/* Carte hero — visible si coachRun existe */}
          {coachRun && (
            <RunCard
              todayCoachRun={coachRun}
              todaySession={doneSession}
              onOpenRun={() => {}}
              variant="embedded"
            />
          )}

          {doneSession ? (
            <>
              {(analysisAttempted || coachState === "analyzing" || !!coachResult) && (
                <CoachFeedbackCard state={coachState} result={coachResult} />
              )}

              {coachState === "done" && !analysisAttempted && doneSession && (
                <button
                  onClick={() => {
                    const s = doneSession;
                    setAnalysisAttempted(true);
                    setCoachResult(null);
                    setCoachState("analyzing");
                    analyzeSession(s).then((result) => {
                      setCoachResult(result);
                      setCoachState("done");
                    });
                  }}
                  className="w-full py-2.5 rounded-xl text-xs font-bold tracking-widest press-effect"
                  style={{
                    background: "rgba(205,255,0,0.06)",
                    border: "1px solid var(--color-neon-20)",
                    color: "var(--color-neon)",
                  }}
                >
                  RELANCER L&apos;ANALYSE COACH →
                </button>
              )}

              <RunSessionResults session={doneSession} />
            </>
          ) : coachRun ? (
            <>
              <SessionBriefCard brief={coachRun.coachNote} />
              <RunPlanSection coachRun={coachRun} />
            </>
          ) : (
            <div
              className="rounded-2xl p-4"
              style={{ background: "var(--color-surface)", border: "1px solid var(--color-surface-2)" }}
            >
              <p className="text-sm text-muted">Aucun run prévu pour cette date.</p>
            </div>
          )}

        </div>

        <NoteModal
          open={noteModalOpen}
          initialValue={coachRun?.userNote ?? doneSession?.comment ?? ""}
          onClose={() => setNoteModalOpen(false)}
          onSave={(note) => {
            if (coachRun) {
              const updated = { ...coachRun, userNote: note };
              addCoachRun(updated);
              setCoachRun(updated);
              autoSyncPush().catch(() => {});
            } else if (doneSession) {
              const updated = { ...doneSession, comment: note };
              updateSession(updated);
              setDoneSession(updated);
              autoSyncPush().catch(() => {});
            }
          }}
        />

        {/* Strava CTA — run à venir non loggué, ou session existante pas encore syncée */}
        {((coachRun && !doneSession) || needsStravaSync) && (
          <div
            className="absolute left-0 right-0 px-4 pt-3"
            style={{
              bottom: 0,
              paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
              background: "linear-gradient(to top, var(--color-background) 70%, transparent)",
            }}
          >
            {stravaSyncMsg && (
              <p className="text-center text-xs mb-2" style={{ color: "var(--color-secondary)" }}>{stravaSyncMsg}</p>
            )}
            <div className="flex gap-3">
              <div className="relative" style={{ flexShrink: 0 }}>
                <button
                  onClick={() => setAddContentMenuOpen((v) => !v)}
                  aria-label="Ajouter une image ou une note"
                  className="flex items-center justify-center press-effect"
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: "14px",
                    background: "var(--color-white-06)",
                    border: "1px solid var(--color-white-10)",
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
                {addContentMenuOpen && (
                  <ContextMenu
                    onClose={() => setAddContentMenuOpen(false)}
                    menuClassName="absolute left-0 bottom-16"
                    width={240}
                    items={[
                      {
                        label: "Ajouter une image",
                        icon: <ImageIcon size={16} color="currentColor" />,
                        onClick: () => { setAddContentMenuOpen(false); fileInputRef.current?.click(); },
                      },
                      {
                        label: "Ajouter une note",
                        icon: <NoteIcon size={16} color="currentColor" />,
                        onClick: () => { setAddContentMenuOpen(false); setNoteModalOpen(true); },
                      },
                    ]}
                  />
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" />

              <button
                onClick={needsStravaSync
                  ? (IS_DEV_SYNC ? handleMockStravaSync : handleStravaSync)
                  : handleStravaImport}
                disabled={stravaSyncing}
                className="flex-1 flex items-center justify-center gap-2.5 press-effect"
                style={{
                  background: stravaSyncing ? "#7a2500" : "#FC4C02",
                  borderRadius: "12px",
                  padding: "15px 20px",
                  fontWeight: 600,
                  fontSize: "15px",
                  color: "white",
                  opacity: stravaSyncing ? 0.7 : 1,
                }}
              >
                {!stravaSyncing && <StravaIcon size={20} />}
                {stravaSyncing ? "Recherche en cours…" : IS_DEV_SYNC && needsStravaSync ? "Simuler synchro (dev)" : "Sync Strava"}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
