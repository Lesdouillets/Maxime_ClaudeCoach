"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useRunSheet } from "@/contexts/RunSheetContext";
import CoachRunPlan from "@/components/CoachRunPlan";
import RunSessionResults from "@/components/RunSessionResults";
import CoachFeedbackCard from "@/components/CoachFeedbackCard";
import { formatPace, toLocalDateStr } from "@/lib/plan";
import { getCoachRuns, deleteCoachRun, addCoachRun } from "@/lib/coachPlan";
import { RaceBadge } from "@/components/RaceBadge";
import { getSessions, getStravaTokens, addSession, updateSession, cancelDay } from "@/lib/storage";
import { autoSyncPush } from "@/lib/sync";
import { originNeedsRedirect } from "@/lib/navigation";
import { OptionsIcon } from "@/components/icons";
import { fetchActivityLaps, fetchRecentActivities, autoImportActivity } from "@/lib/strava";
import {
  analyzeSession,
  getStoredCoachAnalysis,
  type CoachAnalysisResult,
} from "@/lib/coachAnalyzer";
import type { CoachRun } from "@/lib/coachPlan";
import type { RunSession } from "@/lib/types";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const StravaIcon = () => (
  // eslint-disable-next-line @next/next/no-img-element
  <img
    src={`${BASE}/strava.svg`}
    width={12}
    height={12}
    alt="Strava"
    style={{ filter: "invert(50%) sepia(100%) saturate(500%) hue-rotate(350deg)" }}
  />
);

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

  const handleClose = useCallback(() => {
    const origin = sheet.state?.originRoute;
    sheet.close();
    setIsDragging(false);
    setDragY(0);
    setOptionsMenuOpen(false);
    setOptionsPanel(null);
    setRescheduleDate("");
    setCancelReason("");
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

  const isExpanded = sheet.view === "expanded" && hasEntered;
  const backdropVisible = sheet.view === "expanded";

  const dateLabel = new Date(dateStr + "T12:00:00").toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long",
  });

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          background: "#0a0a0a",
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
          background: "#0a0a0a",
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
            style={{ background: "#161616", border: "1px solid #222", color: "#ddd" }}
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
              style={{ width: 36, height: 4, background: "#2a2a2a" }}
            />
          </button>

          {coachRun !== null && !doneSession ? (
            <div className="relative">
              <button
                onClick={() => { setOptionsMenuOpen((v) => !v); setOptionsPanel(null); }}
                className="w-10 h-10 rounded-full flex items-center justify-center press-effect"
                style={{ background: "#161616", border: "1px solid #222", color: "#777" }}
                aria-label="Options"
              >
                <OptionsIcon size={20} color="currentColor" />
              </button>
              {optionsMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-[60]"
                    style={{ background: "transparent" }}
                    onClick={() => setOptionsMenuOpen(false)}
                  />
                  <div
                    className="absolute right-0 top-12 z-[61] rounded-2xl overflow-hidden"
                    style={{
                      width: 220,
                      background: "rgba(28,28,30,0.96)",
                      border: "1px solid #2a2a2a",
                      backdropFilter: "blur(40px)",
                      WebkitBackdropFilter: "blur(40px)",
                      boxShadow: "0 18px 48px rgba(0,0,0,0.6)",
                    }}
                  >
                    <button
                      onClick={() => { setOptionsPanel("reschedule"); setOptionsMenuOpen(false); }}
                      className="w-full flex items-center justify-between px-4 py-3 text-sm press-effect"
                      style={{ color: "#eee", borderBottom: "1px solid #1f1f1f" }}
                    >
                      <span>Décaler la séance</span>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M8 7H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M8 7h8" stroke="#888" strokeWidth="1.8" strokeLinecap="round"/>
                      </svg>
                    </button>
                    <button
                      onClick={() => { setOptionsPanel("cancel"); setOptionsMenuOpen(false); }}
                      className="w-full flex items-center justify-between px-4 py-3 text-sm press-effect"
                      style={{ color: "#ff4d4d" }}
                    >
                      <span>Annuler la séance</span>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M18 6L6 18M6 6l12 12" stroke="#ff4d4d" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    </button>
                  </div>
                </>
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
            style={{ background: "rgba(28,28,30,0.96)", border: "1px solid #2a2a2a" }}
          >
            {optionsPanel === "reschedule" && (
              <div className="p-4 space-y-3">
                <p className="text-xs font-bold tracking-widest" style={{ color: "#888" }}>DÉCALER LE RUN</p>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                    min={toLocalDateStr(new Date())}
                    autoFocus
                    className="flex-1 rounded-xl px-3 py-2.5 text-xs focus:outline-none"
                    style={{ background: "#111", border: "1px solid rgba(208,121,0,0.3)", color: "white" }}
                  />
                  <button
                    onClick={handleRescheduleRun}
                    disabled={!rescheduleDate}
                    className="px-3 py-2.5 rounded-xl text-xs font-bold press-effect disabled:opacity-40"
                    style={{ background: "#D07900", color: "white" }}
                  >OK</button>
                  <button
                    onClick={() => { setOptionsPanel(null); setRescheduleDate(""); }}
                    className="px-3 py-2.5 rounded-xl text-xs press-effect"
                    style={{ background: "#1a1a1a", color: "#555" }}
                  >✕</button>
                </div>
              </div>
            )}
            {optionsPanel === "cancel" && (
              <div className="p-4 space-y-3">
                <p className="text-xs font-bold tracking-widest" style={{ color: "#888" }}>ANNULER LE RUN</p>
                <input
                  type="text"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Raison de l'annulation…"
                  className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none"
                  style={{ background: "#111", border: "1px solid #333", color: "white" }}
                  onKeyDown={(e) => { if (e.key === "Enter") handleCancelRun(); }}
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleCancelRun}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold press-effect"
                    style={{ background: "#1a1a1a", color: "#aaa", border: "1px solid #333" }}
                  >Confirmer l&apos;annulation</button>
                  <button
                    onClick={() => { setOptionsPanel(null); setCancelReason(""); }}
                    className="px-4 py-2.5 rounded-xl text-sm press-effect"
                    style={{ background: "transparent", color: "#555" }}
                  >✕</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Header */}
        <div className="px-5 pb-3">
          <p
            className="text-xs font-medium tracking-[0.2em] uppercase mb-1"
            style={{ color: "#CDFF00" }}
          >
            {dateLabel}
          </p>
          <div className="flex items-center gap-3">
            <h1
              className="font-display text-5xl leading-none"
              style={{ textShadow: coachRun?.isRace ? "0 0 30px rgba(254,237,0,0.25)" : "0 0 30px rgba(205,255,0,0.3)" }}
            >
              RUN{doneSession ? " ✓" : ""}
            </h1>
            {coachRun?.isRace && <RaceBadge wingSize={10} fontSize={11} />}
          </div>
        </div>

        {/* Body */}
        <div className={`flex-1 overflow-y-auto px-5 pt-2 space-y-4 ${coachRun && !doneSession ? "pb-32" : "pb-12"}`}>
          {doneSession ? (
            // Archive view: results + coach feedback (same widgets as /day)
            <>
              {doneSession.importedFromStrava && (
                <div
                  className="flex items-center gap-1.5 text-xs"
                  style={{ color: "#D07900" }}
                >
                  <StravaIcon /> Importé depuis Strava
                </div>
              )}

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
                    border: "1px solid rgba(205,255,0,0.2)",
                    color: "#CDFF00",
                  }}
                >
                  RELANCER L&apos;ANALYSE COACH →
                </button>
              )}

              <RunSessionResults session={doneSession} />

              {/* Strava sync button */}
              <button
                onClick={handleStravaSync}
                disabled={stravaSyncing}
                className="w-full py-2.5 rounded-xl text-xs font-bold tracking-widest press-effect"
                style={{
                  background: "rgba(252,76,2,0.08)",
                  border: "1px solid rgba(252,76,2,0.3)",
                  color: stravaSyncing ? "#888" : "#fc4c02",
                  opacity: stravaSyncing ? 0.6 : 1,
                }}
              >
                {stravaSyncing ? "SYNCHRONISATION…" : "SYNCHRONISER AVEC STRAVA →"}
              </button>
              {stravaSyncMsg && (
                <p className="text-center text-xs" style={{ color: "#888" }}>{stravaSyncMsg}</p>
              )}
            </>
          ) : coachRun ? (
            <CoachRunPlan coachRun={coachRun} />
          ) : (
            <div
              className="rounded-2xl p-4"
              style={{ background: "#111", border: "1px solid #1a1a1a" }}
            >
              <p className="text-sm text-muted">Aucun run prévu pour cette date.</p>
            </div>
          )}

        </div>

        {/* Strava CTA — run à venir non encore loggué */}
        {coachRun && !doneSession && (
          <div
            className="absolute left-0 right-0 px-4 pt-3"
            style={{
              bottom: 0,
              paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
              background: "linear-gradient(to top, #0a0a0a 70%, transparent)",
            }}
          >
            {stravaSyncMsg && (
              <p className="text-center text-xs mb-2" style={{ color: "#888" }}>{stravaSyncMsg}</p>
            )}
            <div className="flex gap-3">
              <button
                disabled
                title="Import photo — bientôt disponible"
                aria-label="Import photo (bientôt disponible)"
                className="flex items-center justify-center"
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "14px",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  flexShrink: 0,
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" />

              <button
                onClick={handleStravaImport}
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
                {!stravaSyncing && (
                  <svg width="20" height="20" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                    <path opacity="0.6" fillRule="evenodd" clipRule="evenodd" d="M4.97436 6.83333L7.53846 11L10 6.83333H8.46154L7.53846 8.40741L6.51282 6.83333H4.97436Z" fill="white"/>
                    <path fillRule="evenodd" clipRule="evenodd" d="M5.28205 1L8.46154 6.83333H2L5.28205 1ZM5.28205 4.51852L6.51282 6.83333H3.94872L5.28205 4.51852Z" fill="white"/>
                  </svg>
                )}
                {stravaSyncing ? "Recherche en cours…" : "Sync Strava"}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
