"use client";

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
  setRows?: SetRow[]; // per-set breakdown (from plan setPlans or session setLogs)
  restSeconds?: number;
  coachNote?: string;
  note: string;
}

interface Props {
  ex: ExerciseData;
  isDone: boolean;
  timerExIndex: string | null;
  timerSec: number;
  onStartTimer: (key: string, seconds: number) => void;
  onStopTimer: () => void;
  onNoteChange: (index: number, value: string) => void;
}

export default function ExerciseCardReadonly({ ex, isDone, timerExIndex, timerSec, onStartTimer, onStopTimer, onNoteChange }: Props) {
  const hasPerSet = Array.isArray(ex.setRows) && ex.setRows.length > 0;

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "#111", border: "1px solid #1a1a1a" }}>
      {/* Header: name + rest timer */}
      <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-3">
        <p className="font-bold text-xs tracking-widest flex-1">{ex.name.toUpperCase()}</p>
        {ex.restSeconds && !isDone && (
          timerExIndex === String(ex.index) ? (
            <button onClick={onStopTimer} className="flex items-center gap-2 press-effect flex-shrink-0">
              <span className="font-display text-xl leading-none"
                style={{ color: timerSec > 10 ? "#39ff14" : timerSec > 3 ? "#ff6b00" : "#ff4444" }}>
                {timerSec}s
              </span>
              <span className="text-sm" style={{ color: "#555" }}>■</span>
            </button>
          ) : (
            <button onClick={() => onStartTimer(String(ex.index), ex.restSeconds!)} className="flex items-center gap-2 press-effect flex-shrink-0">
              <span className="text-[10px] font-bold tracking-wide" style={{ color: "#333" }}>RÉCUP {ex.restSeconds}s</span>
              <span className="text-xs" style={{ color: "#555" }}>▶</span>
            </button>
          )
        )}
      </div>

      {/* Metrics — per-set table OR flat summary */}
      {hasPerSet ? (
        <div style={{ borderTop: "1px solid #1a1a1a" }}>
          {/* Column headers */}
          <div
            className="grid px-4 py-1.5"
            style={{
              gridTemplateColumns: "32px 1fr 1fr",
              background: "#0a0a0a",
              borderBottom: "1px solid #1a1a1a",
            }}
          >
            {["SÉR.", "KG", "REPS"].map((h, i) => (
              <span
                key={i}
                className="text-[9px] font-bold tracking-widest text-center"
                style={{ color: "#3a3a3a" }}
              >
                {h}
              </span>
            ))}
          </div>
          {/* Set rows */}
          {ex.setRows!.map((row, i) => (
            <div
              key={i}
              className="grid px-4 py-2 items-center"
              style={{
                gridTemplateColumns: "32px 1fr 1fr",
                background: row.done ? "rgba(57,255,20,0.04)" : "#0f0f0f",
                borderBottom: i < ex.setRows!.length - 1 ? "1px solid #151515" : "none",
              }}
            >
              <span
                className="font-display text-lg leading-none text-center"
                style={{ color: row.done ? "#39ff14" : "#444" }}
              >
                {i + 1}
              </span>
              <div className="flex items-end justify-center gap-0.5">
                <span
                  className="font-display text-xl leading-none"
                  style={{ color: row.done ? "#39ff14" : "#39ff14" }}
                >
                  {row.weight}
                </span>
                <span className="text-[9px] pb-0.5" style={{ color: "#3a3a3a" }}>kg</span>
              </div>
              <div className="flex items-end justify-center gap-0.5">
                <span
                  className="font-display text-xl leading-none"
                  style={{ color: row.done ? "#39ff14" : "#39ff14" }}
                >
                  {row.reps}
                </span>
                <span className="text-[9px] pb-0.5" style={{ color: "#3a3a3a" }}>×</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-4 pb-3">
          <div className="flex items-end gap-5">
            {ex.weight > 0 && (
              <div className="flex items-end gap-0.5">
                <span className="font-display text-2xl leading-none" style={{ color: "#39ff14" }}>{ex.weight}</span>
                <span className="text-xs text-muted mb-0.5 ml-0.5">kg</span>
              </div>
            )}
            <div className="flex items-end gap-0.5">
              <span className="font-display text-2xl leading-none" style={{ color: "#39ff14" }}>{ex.sets}</span>
              <span className="text-xs text-muted mb-0.5 ml-0.5">séries</span>
            </div>
            <div className="flex items-end gap-0.5">
              <span className="font-display text-2xl leading-none" style={{ color: "#39ff14" }}>{ex.reps}</span>
              <span className="text-xs text-muted mb-0.5 ml-0.5">rep</span>
            </div>
          </div>
        </div>
      )}

      {/* Coach note */}
      {ex.coachNote && (
        <div className="px-4 py-2.5" style={{ borderTop: "1px solid #1a1a1a", background: "rgba(57,255,20,0.02)" }}>
          <p className="text-[10px] font-bold tracking-widest mb-1" style={{ color: "#2a4a1a" }}>COACH</p>
          <p className="text-xs italic" style={{ color: "#666" }}>{ex.coachNote}</p>
        </div>
      )}

      {(ex.note || !isDone) && (
        <div className="px-4 py-3" style={{ borderTop: "1px solid #1a1a1a" }}>
          <p className="text-[10px] font-bold tracking-widest mb-1.5" style={{ color: "#333" }}>RESSENTI</p>
          {isDone ? (
            <p className="text-xs" style={{ color: "#666" }}>{ex.note}</p>
          ) : (
            <textarea
              value={ex.note}
              onChange={(e) => onNoteChange(ex.index, e.target.value)}
              placeholder="Charge, fatigue, forme…"
              rows={2}
              className="w-full rounded-lg px-2.5 py-2 text-xs resize-none focus:outline-none"
              style={{ background: "#0d0d0d", border: "1px solid #1a1a1a", color: "#aaa" }}
            />
          )}
        </div>
      )}
    </div>
  );
}
