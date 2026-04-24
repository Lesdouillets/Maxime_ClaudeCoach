"use client";

import { useState } from "react";
import Link from "next/link";
import { toLocalDateStr } from "@/lib/plan";
import type { CoachWorkout, CoachRun } from "@/lib/coachPlan";

interface Props {
  date: string;
  canAct: boolean;
  hasDouble: boolean;
  isDone: boolean;
  isPast: boolean;
  isToday: boolean;
  activeTab: "run" | "workout";
  isRunDay: boolean;
  coachRun: CoachRun | null;
  coachWorkout: CoachWorkout | null;
  onReschedule: (newDate: string, target: "run" | "workout" | null) => void;
  onCancel: (reason: string) => void;
  onDeletePlan: (type: "run" | "workout") => void;
  onValidateFitness: () => void;
  onDeleteSession: () => void;
}

export default function DayActions({
  date, canAct, hasDouble, isDone, isPast, isToday, activeTab, isRunDay,
  coachRun, coachWorkout,
  onReschedule, onCancel, onDeletePlan, onValidateFitness, onDeleteSession,
}: Props) {
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTarget, setRescheduleTarget] = useState<"run" | "workout" | null>(null);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const canValidate = !isDone && (isPast || isToday);

  const handleRescheduleConfirm = () => {
    if (!rescheduleDate) return;
    onReschedule(rescheduleDate, rescheduleTarget);
    setShowReschedule(false);
    setRescheduleDate("");
    setRescheduleTarget(null);
  };

  const handleCancelConfirm = () => {
    onCancel(cancelReason.trim());
    setShowCancel(false);
    setCancelReason("");
  };

  const renderRescheduleInline = (target: "run" | "workout", label: string) =>
    showReschedule && rescheduleTarget === target ? (
      <div className="flex gap-2">
        <input type="date" value={rescheduleDate} onChange={(e) => setRescheduleDate(e.target.value)}
          min={toLocalDateStr(new Date())} autoFocus
          className="flex-1 rounded-xl px-3 py-2.5 text-xs focus:outline-none"
          style={{ background: "#2C2C2E", border: "1px solid rgba(255,159,10,0.3)", color: "white" }} />
        <button onClick={handleRescheduleConfirm} disabled={!rescheduleDate}
          className="px-3 py-2.5 rounded-xl text-xs font-semibold press-effect disabled:opacity-40"
          style={{ background: "#FF9F0A", color: "#000" }}>OK</button>
        <button onClick={() => { setShowReschedule(false); setRescheduleDate(""); setRescheduleTarget(null); }}
          className="px-3 py-2.5 rounded-xl text-xs press-effect"
          style={{ background: "#2C2C2E", color: "rgba(235,235,245,0.4)" }}>✕</button>
      </div>
    ) : (
      <button onClick={() => { setRescheduleTarget(target); setShowReschedule(true); setShowCancel(false); }}
        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm press-effect"
        style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(235,235,245,0.4)" }}>
        {label}
      </button>
    );

  return (
    <>
      {/* Double journée — onglet Run */}
      {hasDouble && activeTab === "run" && canAct && canValidate && (
        <div className="space-y-2">
          <Link href={`/log/run?date=${date}`}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl text-sm font-semibold press-effect"
            style={{ background: "rgba(48,209,88,0.12)", border: "1px solid rgba(48,209,88,0.3)", color: "#30D158" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            Valider le Run
          </Link>
          {renderRescheduleInline("run", "Décaler le Run")}
          <button onClick={() => onDeletePlan("run")}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm press-effect"
            style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(235,235,245,0.2)" }}>
            Annuler le Run
          </button>
        </div>
      )}

      {/* Double journée — onglet Muscu */}
      {hasDouble && activeTab === "workout" && canAct && canValidate && (
        <div className="space-y-2">
          <button onClick={onValidateFitness}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl text-sm font-semibold press-effect"
            style={{ background: "rgba(48,209,88,0.12)", border: "1px solid rgba(48,209,88,0.3)", color: "#30D158" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            Valider la Muscu
          </button>
          {renderRescheduleInline("workout", "Décaler la Muscu")}
          <button onClick={() => onDeletePlan("workout")}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm press-effect"
            style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(235,235,245,0.2)" }}>
            Annuler la Muscu
          </button>
        </div>
      )}

      {/* Journée simple — Valider */}
      {!hasDouble && canAct && canValidate && (
        isRunDay ? (
          <Link href={`/log/run?date=${date}`}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl text-sm font-semibold press-effect"
            style={{ background: "rgba(48,209,88,0.12)", border: "1px solid rgba(48,209,88,0.3)", color: "#30D158" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Valider le Run
          </Link>
        ) : (
          <button onClick={onValidateFitness}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl text-sm font-semibold press-effect"
            style={{ background: "rgba(48,209,88,0.12)", border: "1px solid rgba(48,209,88,0.3)", color: "#30D158" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Valider la séance
          </button>
        )
      )}

      {/* Modifier — session done */}
      {isDone && coachWorkout && (
        <button onClick={onDeleteSession}
          className="w-full py-2.5 rounded-xl text-sm press-effect"
          style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(235,235,245,0.3)" }}>
          Modifier
        </button>
      )}

      {/* Journée simple — Décaler / Annuler */}
      {canAct && !hasDouble && (
        <div className="space-y-2">
          {showReschedule ? (
            <div className="flex gap-2">
              <input type="date" value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
                min={toLocalDateStr(new Date())}
                className="flex-1 rounded-xl px-3 py-2.5 text-xs focus:outline-none"
                style={{ background: "#2C2C2E", border: "1px solid rgba(255,159,10,0.3)", color: "white" }}
                autoFocus
              />
              <button onClick={handleRescheduleConfirm} disabled={!rescheduleDate}
                className="px-3 py-2.5 rounded-xl text-xs font-semibold press-effect disabled:opacity-40"
                style={{ background: "#FF9F0A", color: "#000" }}>OK</button>
              <button onClick={() => { setShowReschedule(false); setRescheduleDate(""); setRescheduleTarget(null); }}
                className="px-3 py-2.5 rounded-xl text-xs press-effect"
                style={{ background: "#2C2C2E", color: "rgba(235,235,245,0.4)" }}>✕</button>
            </div>
          ) : (
            <button onClick={() => { setShowReschedule(true); setShowCancel(false); }}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm press-effect"
              style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(235,235,245,0.4)" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path d="M8 7H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M8 7h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              Décaler
            </button>
          )}

          {showCancel ? (
            <div className="space-y-2">
              <input type="text" value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Raison de l'annulation…"
                className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none"
                style={{ background: "#2C2C2E", border: "1px solid rgba(255,255,255,0.12)", color: "white" }}
                onKeyDown={(e) => { if (e.key === "Enter") handleCancelConfirm(); }}
                autoFocus
              />
              <div className="flex gap-2">
                <button onClick={handleCancelConfirm}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold press-effect"
                  style={{ background: "#2C2C2E", color: "rgba(235,235,245,0.6)", border: "1px solid rgba(255,255,255,0.1)" }}>
                  Confirmer l'annulation
                </button>
                <button onClick={() => setShowCancel(false)}
                  className="px-4 py-2.5 rounded-xl text-sm press-effect"
                  style={{ background: "transparent", color: "rgba(235,235,245,0.3)" }}>✕</button>
              </div>
            </div>
          ) : (
            <button onClick={() => { setShowCancel(true); setShowReschedule(false); }}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm press-effect"
              style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(235,235,245,0.2)" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Annuler la séance
            </button>
          )}
        </div>
      )}
    </>
  );
}
