"use client";

import { memo, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, type LiveExercise } from "@/contexts/SessionContext";
import { useTimer } from "@/contexts/TimerContext";
import CoachFeedbackCard from "@/components/CoachFeedbackCard";
import FinishSessionModal from "@/components/FinishSessionModal";

function formatMMSS(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.max(0, sec) % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function ExerciseThumb({ name, size = 56 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <div
      className="rounded-2xl flex items-center justify-center flex-shrink-0"
      style={{
        width: size,
        height: size,
        background: "linear-gradient(135deg, #1c1c1c, #0e0e0e)",
        border: "1px solid #1f1f1f",
      }}
    >
      <span className="font-display text-xl" style={{ color: "#888" }}>
        {initials || "EX"}
      </span>
    </div>
  );
}

function ExerciseMenu({
  onNote,
  onDelete,
  onClose,
}: {
  onNote: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <div
        className="fixed inset-0 z-[60]"
        style={{ background: "transparent" }}
        onClick={onClose}
      />
      <div
        className="absolute right-3 top-12 z-[61] rounded-2xl overflow-hidden"
        style={{
          width: 240,
          background: "rgba(28,28,30,0.96)",
          border: "1px solid #2a2a2a",
          backdropFilter: "blur(40px)",
          WebkitBackdropFilter: "blur(40px)",
          boxShadow: "0 18px 48px rgba(0,0,0,0.6)",
        }}
      >
        <button
          onClick={() => { onNote(); onClose(); }}
          className="w-full flex items-center justify-between px-4 py-3 text-sm press-effect"
          style={{ color: "#eee", borderBottom: "1px solid #1f1f1f" }}
        >
          <span>Ajouter une note</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <rect x="4" y="4" width="16" height="16" rx="2" stroke="#888" strokeWidth="1.6"/>
            <path d="M8 9h8M8 13h8M8 17h5" stroke="#888" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
        </button>
        <button
          onClick={() => { onDelete(); onClose(); }}
          className="w-full flex items-center justify-between px-4 py-3 text-sm press-effect"
          style={{ color: "#ff4d4d" }}
        >
          <span>Supprimer l&apos;exercice</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13" stroke="#ff4d4d" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </>
  );
}

function ProgressDots({ exercise }: { exercise: LiveExercise }) {
  const logs = exercise.setLogs ?? [];
  if (logs.length === 0) {
    return (
      <span
        className="inline-block rounded-full"
        style={{ width: 28, height: 4, background: "#1f1f1f" }}
      />
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      {logs.map((s, i) => (
        <span
          key={i}
          className="inline-block rounded-full"
          style={{
            width: 22,
            height: 4,
            background: s.done ? "#39ff14" : "#1f1f1f",
            boxShadow: s.done ? "0 0 6px rgba(57,255,20,0.4)" : undefined,
            transition: "background 200ms ease",
          }}
        />
      ))}
    </div>
  );
}

interface CollapsedCardProps {
  exercise: LiveExercise;
  onTap: () => void;
  onMenu: () => void;
  menuOpen: boolean;
  onMenuClose: () => void;
  onAction: (kind: "note" | "delete") => void;
}

function CollapsedCardImpl({
  exercise,
  onTap,
  onMenu,
  menuOpen,
  onMenuClose,
  onAction,
}: CollapsedCardProps) {
  return (
    <div
      className="relative rounded-2xl p-3 flex items-center gap-3 press-effect"
      style={{
        background: "#141414",
        border: "1px solid #1d1d1d",
      }}
      onClick={onTap}
    >
      <ExerciseThumb name={exercise.name} />
      <div className="flex-1 min-w-0">
        <p className="font-bold text-base truncate">{exercise.name}</p>
        <div className="mt-1.5"><ProgressDots exercise={exercise} /></div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onMenu(); }}
        className="w-9 h-9 rounded-full flex items-center justify-center press-effect flex-shrink-0"
        style={{ color: "#777" }}
        aria-label="Options"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <circle cx="6" cy="12" r="1.5" fill="currentColor"/>
          <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
          <circle cx="18" cy="12" r="1.5" fill="currentColor"/>
        </svg>
      </button>
      {menuOpen && (
        <ExerciseMenu
          onNote={() => onAction("note")}
          onDelete={() => onAction("delete")}
          onClose={onMenuClose}
        />
      )}
    </div>
  );
}

const CollapsedCard = memo(CollapsedCardImpl);

interface ActiveCardProps {
  exercise: LiveExercise;
  noteOpen: boolean;
}

function ActiveCardImpl({ exercise, noteOpen }: ActiveCardProps) {
  const session = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  const onAction = (kind: "note" | "delete") => {
    if (kind === "delete") {
      session.removeExercise(exercise.id);
      return;
    }
    if (kind === "note") {
      // Toggle the inline note field by giving the comment a single space if empty
      session.setNote(exercise.id, exercise.comment || " ");
      return;
    }
  };

  return (
    <div
      className="relative rounded-2xl overflow-visible"
      style={{
        background: "#141414",
        border: "1px solid #232323",
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 p-3">
        <ExerciseThumb name={exercise.name} />
        <p className="flex-1 font-bold text-base leading-tight">{exercise.name}</p>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="w-9 h-9 rounded-full flex items-center justify-center press-effect flex-shrink-0"
          style={{ color: "#aaa" }}
          aria-label="Options"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <circle cx="6" cy="12" r="1.5" fill="currentColor"/>
            <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
            <circle cx="18" cy="12" r="1.5" fill="currentColor"/>
          </svg>
        </button>
        {menuOpen && (
          <ExerciseMenu
            onNote={() => onAction("note")}
            onDelete={() => onAction("delete")}
            onClose={() => setMenuOpen(false)}
          />
        )}
      </div>

      {/* Coach note (read-only, from coach plan) */}
      {exercise.coachNote && (
        <p className="px-4 pb-2 text-xs italic" style={{ color: "#666" }}>
          ↳ {exercise.coachNote}
        </p>
      )}

      {/* Inline editable note */}
      {(noteOpen || (exercise.comment && exercise.comment.trim() !== "")) && (
        <div className="px-3 pb-2">
          <textarea
            value={exercise.comment}
            onChange={(e) => session.setNote(exercise.id, e.target.value)}
            placeholder="Ressenti sur cet exercice…"
            rows={2}
            className="w-full bg-transparent border rounded-xl px-3 py-2 text-xs resize-none focus:outline-none"
            style={{ color: "#bbb", borderColor: "#262626", background: "#0f0f0f" }}
          />
        </div>
      )}

      {/* Set table */}
      <div className="px-3 pb-3">
        {/* Headers */}
        <div
          className="grid items-center px-2 py-2 text-[11px] tracking-wide"
          style={{
            gridTemplateColumns: "44px 1fr 1fr 44px",
            color: "#888",
          }}
        >
          <span className="text-center">Série</span>
          <span className="text-center">Reps</span>
          <span className="text-center">kg <span style={{ color: "#666" }}>x2</span></span>
          <span className="text-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ display: "inline-block" }}>
              <path d="M5 12l5 5L20 7" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
        </div>

        {/* Rows */}
        {(exercise.setLogs ?? []).map((set, idx) => {
          return (
            <div
              key={idx}
              className="grid items-center px-2 py-2 my-1.5 rounded-xl"
              style={{
                gridTemplateColumns: "44px 1fr 1fr 44px",
                background: set.done ? "rgba(57,255,20,0.06)" : "transparent",
                border: set.done ? "1px solid rgba(57,255,20,0.18)" : "1px solid #1c1c1c",
                opacity: set.done ? 0.95 : 1,
              }}
            >
              <span
                className="text-center font-display text-2xl leading-none"
                style={{ color: set.done ? "#39ff14" : "#9aa0a6" }}
              >
                {idx + 1}
              </span>

              <input
                type="number"
                value={set.reps === 0 ? "" : set.reps}
                onChange={(e) =>
                  session.updateSet(exercise.id, idx, { reps: parseInt(e.target.value) || 0 })
                }
                disabled={set.done}
                inputMode="numeric"
                className="text-center bg-transparent border-none p-0 font-display text-2xl leading-none focus:outline-none disabled:cursor-default"
                style={{ color: set.done ? "#39ff14" : "#cfd2d6" }}
                min={0}
                step={1}
              />

              <input
                type="number"
                value={set.weight === 0 ? "" : set.weight}
                onChange={(e) =>
                  session.updateSet(exercise.id, idx, { weight: parseFloat(e.target.value) || 0 })
                }
                disabled={set.done}
                inputMode="decimal"
                className="text-center bg-transparent border-none p-0 font-display text-2xl leading-none focus:outline-none disabled:cursor-default"
                style={{ color: set.done ? "#39ff14" : "#cfd2d6" }}
                min={0}
                step={0.5}
              />

              <div className="flex justify-center">
                {set.done ? (
                  <button
                    onClick={() => session.unvalidateSet(exercise.id, idx)}
                    className="w-9 h-9 rounded-xl flex items-center justify-center press-effect"
                    style={{ background: "rgba(57,255,20,0.18)", border: "1px solid rgba(57,255,20,0.5)" }}
                    aria-label="Annuler la validation"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M5 12l5 5L20 7" stroke="#39ff14" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                ) : (
                  <button
                    onClick={() => session.validateSet(exercise.id, idx)}
                    className="w-9 h-9 rounded-xl flex items-center justify-center press-effect"
                    style={{ border: "1px solid #2a2a2a", background: "transparent" }}
                    aria-label="Valider la série"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M5 12l5 5L20 7" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Add set */}
        <button
          onClick={() => session.addSet(exercise.id)}
          className="mt-1 w-full flex items-center justify-center gap-2 rounded-2xl py-3 press-effect"
          style={{ background: "#1a1a1a", border: "1px solid #232323", color: "#cfd2d6" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <span className="text-sm font-medium">Ajouter une série</span>
        </button>
      </div>
    </div>
  );
}

const ActiveCard = memo(ActiveCardImpl);

export default function SessionSheet() {
  const session = useSession();
  const { timerKey, timerSec, timerTotalSec } = useTimer();
  const router = useRouter();
  const [openMenuExId, setOpenMenuExId] = useState<string | null>(null);
  const [noteOpenExIds, setNoteOpenExIds] = useState<Set<string>>(new Set());
  // Drives the slide-in animation: starts at translateY(100%) on first render,
  // flips to translateY(0) on the next frame so CSS can interpolate.
  const [hasEntered, setHasEntered] = useState(false);

  // Reset menu state on close
  useEffect(() => {
    if (session.view !== "expanded") setOpenMenuExId(null);
  }, [session.view]);

  // Entrance animation: when state appears, start hidden, then expand on next frame.
  useEffect(() => {
    if (!session.state) {
      setHasEntered(false);
      return;
    }
    const id1 = requestAnimationFrame(() => {
      const id2 = requestAnimationFrame(() => setHasEntered(true));
      return () => cancelAnimationFrame(id2);
    });
    return () => cancelAnimationFrame(id1);
  }, [session.state]);

  if (!session.state) return null;

  const isExpanded = session.view === "expanded" && hasEntered;
  const backdropVisible = session.view === "expanded";
  const isFinishingRunning =
    session.finishing.status === "saving" ||
    session.finishing.status === "analyzing" ||
    session.finishing.status === "done" ||
    session.finishing.status === "error";

  const restProgress =
    timerKey && timerTotalSec > 0
      ? Math.min(1, Math.max(0, (timerTotalSec - timerSec) / timerTotalSec))
      : 0;

  return (
    <>
      {/* Backdrop blocks underlying interaction when expanded */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          background: "#0a0a0a",
          opacity: backdropVisible && hasEntered ? 1 : 0,
          pointerEvents: backdropVisible ? "auto" : "none",
          transition: "opacity 220ms ease",
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
          transform: isExpanded ? "translateY(0)" : "translateY(100%)",
          transition: "transform 280ms cubic-bezier(0.32, 0.72, 0, 1)",
          display: "flex",
          flexDirection: "column",
          paddingTop: "env(safe-area-inset-top, 0px)",
        }}
      >
        {/* Top bar */}
        <div className="relative flex items-center justify-between px-4 pt-3 pb-2">
          <button
            onClick={session.minimize}
            className="w-10 h-10 rounded-full flex items-center justify-center press-effect"
            style={{ background: "#161616", border: "1px solid #222", color: "#ddd" }}
            aria-label="Réduire"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          <div className="rounded-full" style={{ width: 36, height: 4, background: "#2a2a2a" }} />

          <button
            onClick={session.requestFinish}
            disabled={isFinishingRunning}
            className="w-10 h-10 rounded-full flex items-center justify-center press-effect disabled:opacity-50"
            style={{ background: "#161616", border: "1px solid #222", color: "#ddd" }}
            aria-label="Finir la séance"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M5 4v16M5 5h12l-2 4 2 4H5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-3 pt-2 pb-40 space-y-3">
          {session.state.exercises.map((ex, i) => {
            const isActive = i === session.state!.activeExIdx;
            if (isActive) {
              return (
                <ActiveCard
                  key={ex.id}
                  exercise={ex}
                  noteOpen={noteOpenExIds.has(ex.id)}
                />
              );
            }
            return (
              <CollapsedCard
                key={ex.id}
                exercise={ex}
                menuOpen={openMenuExId === ex.id}
                onMenuClose={() => setOpenMenuExId(null)}
                onTap={() => session.setActiveIdx(i)}
                onMenu={() => setOpenMenuExId(ex.id)}
                onAction={(kind) => {
                  if (kind === "delete") session.removeExercise(ex.id);
                  else if (kind === "note") {
                    setNoteOpenExIds((prev) => {
                      const next = new Set(prev);
                      next.add(ex.id);
                      return next;
                    });
                    session.setActiveIdx(i);
                  }
                }}
              />
            );
          })}

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
                  style={{ background: "rgba(57,255,20,0.12)", border: "1px solid rgba(57,255,20,0.4)", color: "#39ff14" }}
                >
                  Continuer →
                </button>
              )}
            </div>
          )}
        </div>

        {/* Bottom rest progress */}
        {timerKey && timerSec > 0 && (
          <div
            className="absolute left-0 right-0 px-4 pt-3"
            style={{
              bottom: 0,
              paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
              background: "linear-gradient(to top, #0a0a0a 70%, transparent)",
            }}
          >
            <div className="flex items-baseline justify-between text-xs mb-1">
              <span className="font-display text-xl tabular-nums" style={{ color: "#ff6b00" }}>
                {formatMMSS(timerSec)}
              </span>
              <span style={{ color: "#666" }}>/ {formatMMSS(timerTotalSec)}</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#1d1d1d" }}>
              <div
                className="h-full"
                style={{
                  width: `${restProgress * 100}%`,
                  background: "linear-gradient(90deg, #ff6b00, #ff9a3c)",
                  transition: "width 600ms linear",
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Confirm finish modal */}
      <FinishSessionModal />
    </>
  );
}
