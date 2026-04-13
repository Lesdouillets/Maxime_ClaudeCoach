"use client";

interface ExerciseData {
  index: number;
  name: string;
  sets: number;
  reps: number;
  weight: number;
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
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "#111", border: "1px solid #1a1a1a" }}>
      {/* Exercise header: name + metrics + timer */}
      <div className="px-4 pt-4 pb-3">
        <p className="font-bold text-xs tracking-widest mb-3">{ex.name.toUpperCase()}</p>
        <div className="flex items-end justify-between">
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
          {/* Rest timer */}
          {ex.restSeconds && !isDone && (
            timerExIndex === String(ex.index) ? (
              <button onClick={onStopTimer} className="flex items-center gap-2 press-effect">
                <span className="font-display text-2xl leading-none"
                  style={{ color: timerSec > 10 ? "#39ff14" : timerSec > 3 ? "#ff6b00" : "#ff4444" }}>
                  {timerSec}s
                </span>
                <span className="text-sm" style={{ color: "#555" }}>■</span>
              </button>
            ) : (
              <button onClick={() => onStartTimer(String(ex.index), ex.restSeconds!)} className="flex items-center gap-2 press-effect">
                <span className="text-xs font-bold tracking-wide" style={{ color: "#333" }}>RÉCUP {ex.restSeconds}s</span>
                <span className="text-sm" style={{ color: "#555" }}>▶</span>
              </button>
            )
          )}
        </div>
      </div>

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
