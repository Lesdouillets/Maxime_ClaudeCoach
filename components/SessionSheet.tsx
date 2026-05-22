"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/contexts/SessionContext";
import { ContextMenu } from "@/components/ui/ContextMenu";
import { useTimer } from "@/contexts/TimerContext";
import CoachFeedbackCard from "@/components/CoachFeedbackCard";
import FinishSessionModal from "@/components/FinishSessionModal";
import FitnessSessionResults from "@/components/FitnessSessionResults";
import NoteModal from "@/components/NoteModal";
import { FitnessCard } from "@/components/SessionCard";
import SessionBriefCard from "@/components/SessionBriefCard";
import ExerciseRowCard from "@/components/ExerciseRowCard";
import ActiveExerciseCard from "@/components/ActiveExerciseCard";
import { CalendarIcon, FlagIcon, OptionsIcon, TrashIcon } from "@/components/icons";
import { JETBRAINS_MONO_LABEL } from "@/lib/typography";
import {
  analyzeSession,
  getStoredCoachAnalysis,
  type CoachAnalysisResult,
} from "@/lib/coachAnalyzer";
import { getSessions, cancelDay } from "@/lib/storage";
import { getCoachWorkouts, deleteCoachWorkout, addCoachWorkout, type CoachWorkout } from "@/lib/coachPlan";
import { toLocalDateStr } from "@/lib/plan";
import { autoSyncPush } from "@/lib/sync";
import { originNeedsRedirect } from "@/lib/navigation";
import type { FitnessSession } from "@/lib/types";

const DRAG_CLOSE_THRESHOLD_PX = 80;
const TAP_MAX_MOVEMENT_PX = 6;
const TAP_MAX_DURATION_MS = 250;

function formatMMSS(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.max(0, sec) % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}


export default function SessionSheet() {
  const session = useSession();
  const { timerKey, timerSec, timerTotalSec } = useTimer();
  const router = useRouter();
  const pathname = usePathname();
  const [noteModalExId, setNoteModalExId] = useState<string | null>(null);
  // Drives the slide-in animation: starts at translateY(100%) on first render,
  // flips to translateY(0) on the next frame so CSS can interpolate.
  const [hasEntered, setHasEntered] = useState(false);
  // Drag-to-close gesture state. dragY is in pixels (down is positive).
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ y: number; t: number } | null>(null);
  // Archive-mode state (loaded only when session.archive is set)
  const [archiveSession, setArchiveSession] = useState<FitnessSession | null>(null);
  const [archiveCoachState, setArchiveCoachState] = useState<"analyzing" | "done">("done");
  const [archiveCoachResult, setArchiveCoachResult] = useState<CoachAnalysisResult | null>(null);
  const [sheetOptionsOpen, setSheetOptionsOpen] = useState(false);
  const [sheetPanel, setSheetPanel] = useState<"reschedule" | "cancel" | null>(null);
  const [sheetRescheduleDate, setSheetRescheduleDate] = useState("");
  const [sheetCancelReason, setSheetCancelReason] = useState("");

  // Reset panel state on close
  useEffect(() => {
    if (session.view !== "expanded") {
      setSheetOptionsOpen(false);
      setSheetPanel(null);
    }
  }, [session.view]);

  // Load the archived session whenever archive mode is engaged.
  useEffect(() => {
    if (!session.archive) {
      setArchiveSession(null);
      setArchiveCoachResult(null);
      setArchiveCoachState("done");
      return;
    }
    const found = getSessions().find(
      (s): s is FitnessSession =>
        s.type === "fitness" && s.date.slice(0, 10) === session.archive!.date
    ) ?? null;
    setArchiveSession(found);
    setArchiveCoachResult(getStoredCoachAnalysis(session.archive.date));
    setArchiveCoachState("done");
  }, [session.archive]);

  const handleArchiveRetry = useCallback(() => {
    if (!archiveSession) return;
    setArchiveCoachState("analyzing");
    analyzeSession(archiveSession).then((result) => {
      setArchiveCoachResult(result);
      setArchiveCoachState("done");
    });
  }, [archiveSession]);

  // Drag-down / Réduire: minimize live sessions (so they can be resumed),
  // but fully close archive views (nothing to resume).
  const handleClose = useCallback(() => {
    const origin = session.state?.originRoute ?? session.archive?.originRoute;
    if (session.archive && !session.state) {
      session.close();
    } else {
      session.minimize();
    }
    setIsDragging(false);
    setDragY(0);
    setSheetOptionsOpen(false);
    setSheetPanel(null);
    setSheetRescheduleDate("");
    setSheetCancelReason("");
    if (origin && originNeedsRedirect(origin, pathname)) router.push(origin);
  }, [session, router, pathname]);

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

  // Entrance animation: when state or archive appears, start hidden, then expand on next frame.
  useEffect(() => {
    if (!session.state && !session.archive) {
      setHasEntered(false);
      return;
    }
    const id1 = requestAnimationFrame(() => {
      const id2 = requestAnimationFrame(() => setHasEntered(true));
      return () => cancelAnimationFrame(id2);
    });
    return () => cancelAnimationFrame(id1);
  }, [session.state, session.archive]);

  if (!session.state && !session.archive) return null;

  const isArchive = !session.state && !!session.archive;
  const isExpanded = session.view === "expanded" && hasEntered;
  const backdropVisible = session.view === "expanded";
  const isFinishingRunning =
    !isArchive && (
      session.finishing.status === "saving" ||
      session.finishing.status === "analyzing" ||
      session.finishing.status === "done" ||
      session.finishing.status === "error"
    );
  const isStarted = !isArchive && (session.state?.started ?? false);
  const showRestBar = isStarted && !!timerKey && timerSec > 0;
  const activeExIdx = session.state?.activeExIdx ?? 0;
  const liveExercises = session.state?.exercises ?? [];

  const archiveDateStr = session.archive?.date ?? null;
  const archiveDateLabel = archiveDateStr
    ? new Date(archiveDateStr + "T12:00:00").toLocaleDateString("fr-FR", {
        weekday: "long", day: "numeric", month: "long",
      })
    : "";
  const archiveTitle = archiveSession
    ? archiveSession.category === "upper" ? "HAUT DU CORPS" : "BAS DU CORPS"
    : "SÉANCE";

  const restProgress =
    timerKey && timerTotalSec > 0
      ? Math.min(1, Math.max(0, (timerTotalSec - timerSec) / timerTotalSec))
      : 0;

  const sessionCoachWorkoutId = !isArchive ? (session.state?.coachWorkoutId ?? null) : null;
  const sessionCoachWorkout: CoachWorkout | null = sessionCoachWorkoutId
    ? (getCoachWorkouts().find((w) => w.id === sessionCoachWorkoutId) ?? null)
    : null;
  const sessionDate = !isArchive ? (session.state?.date ?? "") : "";

  const handleRescheduleWorkout = () => {
    if (!sheetRescheduleDate || !sessionCoachWorkout) return;
    deleteCoachWorkout(sessionCoachWorkout.id);
    addCoachWorkout({ ...sessionCoachWorkout, date: sheetRescheduleDate });
    autoSyncPush().catch(() => {});
    setSheetPanel(null);
    setSheetRescheduleDate("");
  };

  const handleCancelWorkout = () => {
    if (!sessionCoachWorkout) return;
    cancelDay(sessionDate, sheetCancelReason.trim());
    deleteCoachWorkout(sessionCoachWorkout.id);
    autoSyncPush().catch(() => {});
    setSheetCancelReason("");
    handleClose();
  };

  return (
    <>
      {/* Backdrop blocks underlying interaction when expanded; fades during a
          drag-to-close gesture so the user sees what's behind. */}
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

          {isStarted ? (
            <div className="flex flex-col items-center gap-0">
              <p style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontVariationSettings: '"wdth" 110', fontSize: 15, lineHeight: "18px", color: "#fff" }}>
                {sessionCoachWorkout?.label ?? "SÉANCE FITNESS"}
              </p>
              <p style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 11, lineHeight: "14px", letterSpacing: "0.06em", color: "#555" }}>
                {liveExercises.length} exercice{liveExercises.length > 1 ? "s" : ""}
              </p>
            </div>
          ) : (
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
              <span className="rounded-full block" style={{ width: 36, height: 4, background: "#2a2a2a" }} />
            </button>
          )}

          {isStarted ? (
            <button
              onClick={session.requestFinish}
              disabled={isFinishingRunning}
              className="w-10 h-10 rounded-full flex items-center justify-center press-effect disabled:opacity-50"
              style={{ background: "#CDFF00" }}
              aria-label="Finir la séance"
            >
              <FlagIcon size={18} color="#000" />
            </button>
          ) : sessionCoachWorkoutId !== null ? (
            <div className="relative">
              <button
                onClick={() => { setSheetOptionsOpen((v) => !v); setSheetPanel(null); }}
                className="w-10 h-10 rounded-full flex items-center justify-center press-effect"
                style={{ background: "#161616", border: "1px solid #222", color: "#777" }}
                aria-label="Options"
              >
                <OptionsIcon size={20} color="currentColor" />
              </button>
              {sheetOptionsOpen && (
                <ContextMenu
                  onClose={() => setSheetOptionsOpen(false)}
                  items={[
                    {
                      label: "Décaler la séance",
                      icon: <CalendarIcon size={16} color="currentColor" />,
                      onClick: () => { setSheetPanel("reschedule"); setSheetOptionsOpen(false); },
                    },
                    {
                      label: "Annuler la séance",
                      icon: <TrashIcon size={16} color="currentColor" />,
                      onClick: () => { setSheetPanel("cancel"); setSheetOptionsOpen(false); },
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

        {/* Progress bar (séance en cours) */}
        {isStarted && !isFinishingRunning && (
          <div className="px-4 pb-3">
            <div className="flex items-center gap-3">
              <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 11, letterSpacing: "0.10em", textTransform: "uppercase", color: "#7A7C7E" }}>
                EXO {activeExIdx + 1} / {liveExercises.length}
              </span>
              <div className="flex gap-1 flex-1">
                {liveExercises.map((_, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-full"
                    style={{
                      height: i === activeExIdx ? 3 : 2,
                      background: i < activeExIdx
                        ? "rgba(205,255,0,0.3)"
                        : i === activeExIdx
                        ? "#CDFF00"
                        : "#7A7C7E",
                      transition: "background 300ms ease",
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Options panel */}
        {sheetPanel !== null && !isArchive && (
          <div
            className="mx-4 mb-2 rounded-2xl overflow-hidden"
            style={{ background: "rgba(28,28,30,0.96)", border: "1px solid #2a2a2a" }}
          >
            {sheetPanel === "reschedule" && (
              <div className="p-4 space-y-3">
                <p style={{ ...JETBRAINS_MONO_LABEL, color: "#888" }}>DÉCALER LA SÉANCE</p>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={sheetRescheduleDate}
                    onChange={(e) => setSheetRescheduleDate(e.target.value)}
                    min={toLocalDateStr(new Date())}
                    autoFocus
                    className="flex-1 rounded-xl px-3 py-2.5 text-xs focus:outline-none"
                    style={{ background: "#111", border: "1px solid var(--color-orange-shadow)", color: "white" }}
                  />
                  <button
                    onClick={handleRescheduleWorkout}
                    disabled={!sheetRescheduleDate}
                    className="px-3 py-2.5 rounded-xl text-xs font-bold press-effect disabled:opacity-40"
                    style={{ background: "var(--color-orange)", color: "white" }}
                  >OK</button>
                  <button
                    onClick={() => { setSheetPanel(null); setSheetRescheduleDate(""); }}
                    className="px-3 py-2.5 rounded-xl text-xs press-effect"
                    style={{ background: "#1a1a1a", color: "#555" }}
                  >✕</button>
                </div>
              </div>
            )}
            {sheetPanel === "cancel" && (
              <div className="p-4 space-y-3">
                <p style={{ ...JETBRAINS_MONO_LABEL, color: "#888" }}>ANNULER LA SÉANCE</p>
                <input
                  type="text"
                  value={sheetCancelReason}
                  onChange={(e) => setSheetCancelReason(e.target.value)}
                  placeholder="Raison de l'annulation…"
                  className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none"
                  style={{ background: "#111", border: "1px solid #333", color: "white" }}
                  onKeyDown={(e) => { if (e.key === "Enter") handleCancelWorkout(); }}
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleCancelWorkout}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold press-effect"
                    style={{ background: "#1a1a1a", color: "#aaa", border: "1px solid #333" }}
                  >Confirmer l&apos;annulation</button>
                  <button
                    onClick={() => { setSheetPanel(null); setSheetCancelReason(""); }}
                    className="px-4 py-2.5 rounded-xl text-sm press-effect"
                    style={{ background: "transparent", color: "#555" }}
                  >✕</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-3 pt-2 pb-40 space-y-3">
          {isArchive && (
            <div className="px-2 pb-2">
              <p
                className="text-xs font-medium tracking-[0.2em] uppercase mb-1"
                style={{ color: "#CDFF00" }}
              >
                {archiveDateLabel}
              </p>
              <h1
                className="font-display text-5xl leading-none"
                style={{ textShadow: "0 0 30px rgba(205,255,0,0.3)" }}
              >
                {archiveTitle} ✓
              </h1>
            </div>
          )}
          {isArchive && archiveSession && (
            <div className="px-2 space-y-3">
              <CoachFeedbackCard
                state={archiveCoachState}
                result={archiveCoachResult}
                onRetry={handleArchiveRetry}
              />
              <FitnessSessionResults session={archiveSession} />
              <button
                onClick={session.deleteArchivedSession}
                className="w-full py-2 rounded-xl text-xs press-effect"
                style={{ background: "transparent", border: "1px solid #111", color: "#2a2a2a" }}
              >
                Supprimer la séance
              </button>
            </div>
          )}
          {isArchive && !archiveSession && (
            <div
              className="rounded-2xl p-4 mx-2"
              style={{ background: "#111", border: "1px solid #1a1a1a" }}
            >
              <p className="text-sm text-muted">Séance introuvable.</p>
            </div>
          )}
          {!isArchive && !isStarted && (
            <div className="space-y-3">
              <FitnessCard
                todayCoachWorkout={sessionCoachWorkout}
                todaySession={null}
                onOpenSession={() => {}}
                variant="embedded"
              />
              <SessionBriefCard brief={sessionCoachWorkout?.sessionBrief} />
              <div className="flex items-center justify-between px-1 pt-1">
                <span style={JETBRAINS_MONO_LABEL}>PROGRAMME</span>
                <span style={JETBRAINS_MONO_LABEL}>
                  {(session.state?.exercises.length ?? 0)} EXERCICE{(session.state?.exercises.length ?? 0) > 1 ? "S" : ""}
                </span>
              </div>
            </div>
          )}
          {/* Avant démarrage : liste planifiée */}
          {!isArchive && !isStarted && liveExercises.map((ex) => (
            <ExerciseRowCard
              key={ex.id}
              name={ex.name}
              sets={ex.setLogs?.length ?? ex.sets ?? 0}
              reps={ex.reps ?? 0}
              weight={ex.weight ?? 0}
              variant="planned"
            />
          ))}

          {!isArchive && isStarted && liveExercises.slice(0, activeExIdx).map((ex, i) => {
            const doneSets = ex.setLogs?.filter(s => s.done).length ?? 0;
            const totalSets = ex.setLogs?.length ?? ex.sets ?? 0;
            const allDone = totalSets > 0 && doneSets === totalSets;
            return (
              <ExerciseRowCard
                key={ex.id}
                name={ex.name}
                sets={totalSets}
                reps={ex.reps ?? 0}
                weight={ex.weight ?? 0}
                variant={allDone ? "completed" : "in_progress"}
                doneSets={doneSets}
                onTap={() => session.setActiveIdx(i)}
              />
            );
          })}

          {/* Exercice actif */}
          {!isArchive && isStarted && liveExercises[activeExIdx] && (
            <ActiveExerciseCard
              exercise={liveExercises[activeExIdx]}
              onOpenNote={() => setNoteModalExId(liveExercises[activeExIdx].id)}
            />
          )}

          {/* À suivre */}
          {!isArchive && isStarted && liveExercises.slice(activeExIdx + 1).length > 0 && (
            <>
              <div className="px-1 pt-2">
                <span style={{ ...JETBRAINS_MONO_LABEL, color: "#555" }}>À suivre</span>
              </div>
              {liveExercises.slice(activeExIdx + 1).map((ex, i) => (
                <ExerciseRowCard
                  key={ex.id}
                  name={ex.name}
                  sets={ex.setLogs?.length ?? ex.sets ?? 0}
                  reps={ex.reps ?? 0}
                  weight={ex.weight ?? 0}
                  variant="upcoming"
                  onTap={() => session.setActiveIdx(activeExIdx + 1 + i)}
                />
              ))}
            </>
          )}

          {isFinishingRunning && (
            <div className="pt-2">
              <CoachFeedbackCard
                state={session.finishing.status === "analyzing" || session.finishing.status === "saving" ? "analyzing" : "done"}
                result={session.finishing.result ?? null}
                onRetry={session.finishing.status === "error" ? session.retryAnalysis : undefined}
              />
              {(session.finishing.status === "done" || session.finishing.status === "error") && (
                <button
                  onClick={() => { session.close(); router.push("/"); }}
                  className="mt-3 w-full py-3 rounded-2xl font-bold press-effect"
                  style={{ background: "rgba(205,255,0,0.12)", border: "1px solid rgba(205,255,0,0.4)", color: "#CDFF00" }}
                >
                  Continuer →
                </button>
              )}
            </div>
          )}
        </div>

        {/* Bottom: "Commencer" CTA while not started, or rest progress while running */}
        {!isArchive && !isStarted && !isFinishingRunning && (
          <div
            className="absolute left-0 right-0 px-4 pt-3"
            style={{
              bottom: 0,
              paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
              background: "linear-gradient(to top, #0a0a0a 70%, transparent)",
            }}
          >
            <button
              onClick={session.startSession}
              className="w-full flex items-center justify-center gap-2 press-effect"
              style={{
                background: "var(--color-neon)",
                color: "#000",
                borderRadius: "12px",
                padding: "15px 24px",
                fontWeight: 600,
                fontSize: "15px",
                letterSpacing: "0.01em",
              }}
            >
              Commencer la séance
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M9 18l6-6-6-6" stroke="#000" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        )}

        {showRestBar && (
          <div
            className="absolute left-0 right-0 px-4 pt-3"
            style={{
              bottom: 0,
              paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
              background: "linear-gradient(to top, #0a0a0a 70%, transparent)",
            }}
          >
            <div className="flex items-baseline justify-between text-xs mb-1">
              <span className="font-display text-xl tabular-nums" style={{ color: "var(--color-orange)" }}>
                {formatMMSS(timerSec)}
              </span>
              <span style={{ color: "#666" }}>/ {formatMMSS(timerTotalSec)}</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#1d1d1d" }}>
              <div
                className="h-full"
                style={{
                  width: `${restProgress * 100}%`,
                  background: "linear-gradient(90deg, var(--color-orange), var(--color-orange-light))",
                  transition: "width 600ms linear",
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Confirm finish modal */}
      <FinishSessionModal />

      {/* Note editor modal */}
      <NoteModal
        open={!!noteModalExId}
        initialValue={
          noteModalExId
            ? session.state?.exercises.find((e) => e.id === noteModalExId)?.comment ?? ""
            : ""
        }
        onClose={() => setNoteModalExId(null)}
        onSave={(note) => {
          if (noteModalExId) session.setNote(noteModalExId, note);
        }}
      />
    </>
  );
}
