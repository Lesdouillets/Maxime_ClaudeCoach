"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useRunSheet } from "@/contexts/RunSheetContext";
import Badge from "@/components/Badge";
import CoachRunPlan from "@/components/CoachRunPlan";
import RunSessionResults from "@/components/RunSessionResults";
import CoachFeedbackCard from "@/components/CoachFeedbackCard";
import { WEEKLY_PLAN, formatPace, toLocalDateStr } from "@/lib/plan";
import { getCoachRuns } from "@/lib/coachPlan";
import { getSessions } from "@/lib/storage";
import {
  analyzeSession,
  getStoredCoachAnalysis,
  type CoachAnalysisResult,
} from "@/lib/coachAnalyzer";
import type { CoachRun } from "@/lib/coachPlan";
import type { PlannedDay, RunSession } from "@/lib/types";

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
  const [hasEntered, setHasEntered] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ y: number; t: number } | null>(null);
  const [coachRun, setCoachRun] = useState<CoachRun | null>(null);
  const [genericPlan, setGenericPlan] = useState<PlannedDay | null>(null);
  const [doneSession, setDoneSession] = useState<RunSession | null>(null);
  const [coachState, setCoachState] = useState<"analyzing" | "done">("done");
  const [coachResult, setCoachResult] = useState<CoachAnalysisResult | null>(null);
  const [analysisAttempted, setAnalysisAttempted] = useState(false);

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
    const dateStr = sheet.state.date ?? toLocalDateStr(new Date());

    const recorded = getSessions().find(
      (s): s is RunSession => s.type === "run" && s.date.slice(0, 10) === dateStr
    ) ?? null;
    setDoneSession(recorded);

    const dow = new Date(dateStr + "T12:00:00").getDay();
    setCoachRun(getCoachRuns().find((r) => r.date === dateStr) ?? null);
    const generic = WEEKLY_PLAN.find((p) => p.dayOfWeek === dow) ?? null;
    setGenericPlan(generic?.type === "run" ? generic : null);

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

  const handleClose = useCallback(() => {
    const origin = sheet.state?.originRoute;
    sheet.close();
    setIsDragging(false);
    setDragY(0);
    if (typeof window !== "undefined" && origin) {
      const here = window.location.pathname + window.location.search;
      if (origin !== here) router.push(origin);
    }
  }, [sheet, router]);

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

  const dateStr = sheet.state.date ?? toLocalDateStr(new Date());
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

          <span className="w-10 h-10" aria-hidden />
        </div>

        {/* Header */}
        <div className="px-5 pb-3">
          <p
            className="text-xs font-medium tracking-[0.2em] uppercase mb-1"
            style={{ color: "#39ff14" }}
          >
            {dateLabel}
          </p>
          <h1
            className="font-display text-5xl leading-none"
            style={{ textShadow: "0 0 30px rgba(57,255,20,0.3)" }}
          >
            RUN{doneSession ? " ✓" : ""}
          </h1>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 pt-2 pb-12 space-y-4">
          {doneSession ? (
            // Archive view: results + coach feedback (same widgets as /day)
            <>
              {doneSession.importedFromStrava && (
                <div
                  className="flex items-center gap-1.5 text-xs"
                  style={{ color: "#ff6b00" }}
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
                    background: "rgba(57,255,20,0.06)",
                    border: "1px solid rgba(57,255,20,0.2)",
                    color: "#39ff14",
                  }}
                >
                  RELANCER L&apos;ANALYSE COACH →
                </button>
              )}

              <RunSessionResults session={doneSession} />
            </>
          ) : coachRun ? (
            <CoachRunPlan coachRun={coachRun} />
          ) : genericPlan ? (
            <div
              className="rounded-2xl p-4"
              style={{
                background: "rgba(57,255,20,0.04)",
                border: "1px solid rgba(57,255,20,0.15)",
              }}
            >
              <p className="text-xs text-muted mb-2">{genericPlan.targetDescription}</p>
              <div className="flex gap-4 mt-2 items-end">
                {genericPlan.targetDistanceKm && (
                  <div>
                    <span className="font-display text-3xl" style={{ color: "#39ff14" }}>
                      {genericPlan.targetDistanceKm}
                    </span>
                    <span className="text-xs text-muted ml-1">km</span>
                  </div>
                )}
                {genericPlan.targetPaceSecPerKm && (
                  <span className="font-display text-2xl" style={{ color: "#39ff14" }}>
                    {formatPace(genericPlan.targetPaceSecPerKm)}
                  </span>
                )}
                {genericPlan.targetZone && <Badge label={genericPlan.targetZone} variant="neon" />}
              </div>
            </div>
          ) : (
            <div
              className="rounded-2xl p-4"
              style={{ background: "#111", border: "1px solid #1a1a1a" }}
            >
              <p className="text-sm text-muted">Aucun run prévu pour cette date.</p>
            </div>
          )}

          {/* Strava sync hint — only when the run hasn't been recorded yet */}
          {!doneSession && (
            <div
              className="rounded-2xl p-4 flex items-start gap-3"
              style={{
                background: "rgba(255,107,0,0.04)",
                border: "1px solid rgba(255,107,0,0.18)",
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                style={{ flexShrink: 0, marginTop: 2 }}
              >
                <path
                  d="M13 4a1 1 0 1 0 2 0 1 1 0 0 0-2 0M5.5 16.5l2.5-3.5 3 2.5 3.5-5L17 14M3 20h18"
                  stroke="#ff6b00"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div>
                <p className="text-sm font-semibold" style={{ color: "#ff6b00" }}>
                  Synchro Strava automatique
                </p>
                <p className="text-xs mt-1" style={{ color: "#888" }}>
                  Ton run sera importé automatiquement depuis Strava et le coach
                  lancera son analyse à ce moment-là. Aucune validation manuelle
                  à faire ici.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
