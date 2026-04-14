"use client";

import { useState } from "react";

interface SetRow {
  weight: number;
  reps: number;
  done?: boolean;
}

interface ExerciseData {
  index: number;
  name: string;
  sets: number;
  reps: number;
  weight: number;
  setRows?: SetRow[];
  restSeconds?: number;
  coachNote?: string;
  note: string;
}

interface Props {
  ex: ExerciseData;
  isDone: boolean;
  isActive?: boolean;
  isInteractive?: boolean;
  timerExIndex: string | null;
  timerSec: number;
  onStartTimer: (key: string, seconds: number) => void;
  onStopTimer: () => void;
  onNoteChange: (index: number, value: string) => void;
  onAllSetsDone?: () => void;
}

export default function ExerciseCardReadonly({
  ex, isDone, isActive, isInteractive,
  timerExIndex, timerSec,
  onStartTimer, onStopTimer, onNoteChange, onAllSetsDone,
}: Props) {
  const hasPerSet = Array.isArray(ex.setRows) && ex.setRows.length > 0;

  const [doneSets, setDoneSets] = useState<boolean[]>(() =>
    ex.setRows?.map((r) => r.done ?? false) ?? []
  );

  const handleValidate = (setIdx: number) => {
    const updated = doneSets.map((d, i) => i === setIdx ? true : d);
    setDoneSets(updated);
    if (ex.restSeconds) {
      onStartTimer(`${ex.index}-${setIdx}`, ex.restSeconds);
    }
    if (updated.every(Boolean)) {
      setTimeout(() => onAllSetsDone?.(), 300);
    }
  };

  const active = isActive && !isDone;

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: "#0f0f0f",
        border: "1px solid #1c1c1c",
        borderLeft: active ? "2px solid #ff6b00" : "2px solid transparent",
      }}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            {active && (
              <span style={{ color: "#ff6b00", fontSize: 11, lineHeight: 1 }}>⚡</span>
            )}
            <p
              className="font-semibold text-sm leading-snug"
              style={{ color: active ? "#fff" : "#777" }}
            >
              {ex.name}
            </p>
          </div>
          <p className="text-[11px]" style={{ color: "#333" }}>
            {ex.sets} séries · {ex.reps} reps
            {ex.restSeconds ? ` · ${ex.restSeconds}s récup` : ""}
          </p>
        </div>
        {active && (
          <span
            className="text-[9px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5"
            style={{ background: "rgba(255,107,0,0.1)", color: "#ff6b00" }}
          >
            EN COURS
          </span>
        )}
        {/* Non-interactive timer (read-only mode) */}
        {!isInteractive && ex.restSeconds && !isDone && (
          timerExIndex === String(ex.index) ? (
            <button onClick={onStopTimer} className="flex items-center gap-1.5 press-effect flex-shrink-0">
              <span
                className="text-base font-semibold tabular-nums"
                style={{ color: timerSec > 10 ? "#39ff14" : timerSec > 3 ? "#ff6b00" : "#ff4444" }}
              >
                {timerSec}s
              </span>
              <span className="text-xs" style={{ color: "#444" }}>■</span>
            </button>
          ) : (
            <button
              onClick={() => onStartTimer(String(ex.index), ex.restSeconds!)}
              className="flex items-center gap-1 press-effect flex-shrink-0"
            >
              <span className="text-[10px]" style={{ color: "#2a2a2a" }}>RÉCUP {ex.restSeconds}s ▶</span>
            </button>
          )
        )}
      </div>

      {/* Per-set table */}
      {hasPerSet ? (
        <div style={{ borderTop: "1px solid #181818" }}>
          {/* Column headers */}
          <div
            className="grid px-4 pt-2.5 pb-1.5"
            style={{ gridTemplateColumns: isInteractive ? "28px 1fr 1fr 44px" : "28px 1fr 1fr" }}
          >
            {(isInteractive ? ["SÉR.", "KG", "REPS", ""] : ["SÉR.", "KG", "REPS"]).map((h, i) => (
              <span key={i} className="text-[9px] font-medium text-center" style={{ color: "#2e2e2e", letterSpacing: "0.06em" }}>
                {h}
              </span>
            ))}
          </div>

          {/* Set rows */}
          <div className="px-3 pb-3 flex flex-col gap-1.5">
            {ex.setRows!.map((row, i) => {
              const setDone = isInteractive ? doneSets[i] : (row.done ?? false);
              const timerKey = `${ex.index}-${i}`;
              const isTimerHere = timerExIndex === timerKey;

              return (
                <div
                  key={i}
                  className="grid items-center gap-2"
                  style={{
                    gridTemplateColumns: isInteractive ? "28px 1fr 1fr 44px" : "28px 1fr 1fr",
                    opacity: setDone && !isTimerHere ? 0.4 : 1,
                    transition: "opacity 0.2s",
                  }}
                >
                  {/* Series number */}
                  <span
                    className="text-xs font-semibold text-center tabular-nums"
                    style={{ color: setDone ? "#39ff14" : "#3a3a3a" }}
                  >
                    {i + 1}
                  </span>

                  {/* KG pill */}
                  <div
                    className="flex items-baseline justify-center gap-0.5 rounded-xl py-2"
                    style={{ background: "#161616", border: "1px solid #1e1e1e" }}
                  >
                    <span
                      className="text-base font-semibold tabular-nums"
                      style={{ color: setDone ? "#39ff14" : "#bbb" }}
                    >
                      {row.weight}
                    </span>
                    <span className="text-[9px]" style={{ color: "#2e2e2e" }}>kg</span>
                  </div>

                  {/* REPS pill */}
                  <div
                    className="flex items-baseline justify-center gap-0.5 rounded-xl py-2"
                    style={{ background: "#161616", border: "1px solid #1e1e1e" }}
                  >
                    <span
                      className="text-base font-semibold tabular-nums"
                      style={{ color: setDone ? "#39ff14" : "#bbb" }}
                    >
                      {row.reps}
                    </span>
                    <span className="text-[9px]" style={{ color: "#2e2e2e" }}>×</span>
                  </div>

                  {/* Validate / Timer */}
                  {isInteractive && (
                    <div className="flex justify-center">
                      {isTimerHere ? (
                        <button
                          onClick={onStopTimer}
                          className="w-9 h-9 rounded-full flex items-center justify-center press-effect"
                          style={{ background: "rgba(57,255,20,0.07)", border: "1px solid rgba(57,255,20,0.2)" }}
                        >
                          <span
                            className="text-xs font-semibold tabular-nums"
                            style={{ color: timerSec > 10 ? "#39ff14" : timerSec > 3 ? "#ff6b00" : "#ff4444" }}
                          >
                            {timerSec}s
                          </span>
                        </button>
                      ) : setDone ? (
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center"
                          style={{ background: "rgba(57,255,20,0.1)", border: "1px solid rgba(57,255,20,0.25)" }}
                        >
                          <span className="text-sm" style={{ color: "#39ff14" }}>✓</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleValidate(i)}
                          className="w-9 h-9 rounded-full flex items-center justify-center press-effect"
                          style={{ background: "#171717", border: "1px solid #272727" }}
                        >
                          <span className="text-sm" style={{ color: "#383838" }}>✓</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Flat display — no setRows */
        <div className="px-3 pb-3 flex gap-2" style={{ borderTop: "1px solid #181818" }}>
          <div className="pt-2 flex gap-2 flex-1">
            {ex.weight > 0 && (
              <div
                className="flex-1 rounded-xl py-2.5 flex flex-col items-center gap-0.5"
                style={{ background: "#161616", border: "1px solid #1e1e1e" }}
              >
                <span className="text-base font-semibold tabular-nums" style={{ color: "#39ff14" }}>{ex.weight}</span>
                <span className="text-[9px]" style={{ color: "#2e2e2e" }}>kg</span>
              </div>
            )}
            <div
              className="flex-1 rounded-xl py-2.5 flex flex-col items-center gap-0.5"
              style={{ background: "#161616", border: "1px solid #1e1e1e" }}
            >
              <span className="text-base font-semibold tabular-nums" style={{ color: "#39ff14" }}>{ex.sets}</span>
              <span className="text-[9px]" style={{ color: "#2e2e2e" }}>séries</span>
            </div>
            <div
              className="flex-1 rounded-xl py-2.5 flex flex-col items-center gap-0.5"
              style={{ background: "#161616", border: "1px solid #1e1e1e" }}
            >
              <span className="text-base font-semibold tabular-nums" style={{ color: "#39ff14" }}>{ex.reps}</span>
              <span className="text-[9px]" style={{ color: "#2e2e2e" }}>reps</span>
            </div>
          </div>
        </div>
      )}

      {/* Coach note */}
      {ex.coachNote && (
        <div
          className="px-4 py-2.5 flex items-start gap-2"
          style={{ borderTop: "1px solid #181818" }}
        >
          <span className="text-[11px] flex-shrink-0 mt-px" style={{ color: "#2a2a2a" }}>💬</span>
          <p className="text-[11px] italic leading-relaxed" style={{ color: "#4a4a4a" }}>{ex.coachNote}</p>
        </div>
      )}

      {/* Ressenti */}
      {(isDone ? ex.note : active) && (
        <div className="px-4 py-3" style={{ borderTop: "1px solid #181818" }}>
          {isDone ? (
            <div className="flex items-start gap-2">
              <span className="text-[11px] flex-shrink-0 mt-px" style={{ color: "#2a2a2a" }}>✏</span>
              <p className="text-[11px] leading-relaxed" style={{ color: "#555" }}>{ex.note}</p>
            </div>
          ) : (
            <textarea
              value={ex.note}
              onChange={(e) => onNoteChange(ex.index, e.target.value)}
              placeholder="Ressenti, fatigue, technique…"
              rows={2}
              className="w-full rounded-xl px-3 py-2.5 text-[11px] resize-none focus:outline-none"
              style={{ background: "#161616", border: "1px solid #1e1e1e", color: "#888" }}
            />
          )}
        </div>
      )}
    </div>
  );
}
