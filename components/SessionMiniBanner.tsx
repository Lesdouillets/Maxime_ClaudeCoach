"use client";

import { useSession } from "@/contexts/SessionContext";
import { useTimer } from "@/contexts/TimerContext";

function formatMMSS(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.max(0, sec) % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function ExerciseThumb({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <div
      className="rounded-xl flex items-center justify-center flex-shrink-0"
      style={{
        width: 36,
        height: 36,
        background: "linear-gradient(135deg, #1c1c1c, #0e0e0e)",
        border: "1px solid #1f1f1f",
      }}
    >
      <span className="font-display text-sm" style={{ color: "#888" }}>{initials || "EX"}</span>
    </div>
  );
}

export default function SessionMiniBanner() {
  const session = useSession();
  const { timerKey, timerSec, timerTotalSec } = useTimer();

  // The banner only surfaces the live workout (current exercise + rest timer).
  // Once the user has hit "Finir", the analysis flow is owned by the sheet.
  if (session.view !== "minimized" || !session.state) return null;
  if (session.finishing.status !== "idle") return null;

  const ex = session.state.exercises[session.state.activeExIdx];
  if (!ex) return null;

  const isResting = !!timerKey && timerSec > 0;
  const restProgress = timerTotalSec > 0
    ? Math.min(1, Math.max(0, (timerTotalSec - timerSec) / timerTotalSec))
    : 0;
  const timerColor = timerSec > 10 ? "#39ff14" : timerSec > 3 ? "#ff6b00" : "#ff4444";

  return (
    <div
      className="fixed left-0 right-0 z-40 px-4 pointer-events-none"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 88px)" }}
    >
      <button
        onClick={session.expand}
        className="w-full pointer-events-auto rounded-2xl flex items-center gap-3 p-2.5 press-effect"
        style={{
          background: "rgba(20,20,20,0.92)",
          border: "1px solid #232323",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          boxShadow: "0 6px 20px rgba(0,0,0,0.4)",
        }}
      >
        <ExerciseThumb name={ex.name} />
        <p className="flex-1 text-left font-bold text-sm truncate">{ex.name}</p>
        {isResting && (
          <div className="flex flex-col items-end flex-shrink-0">
            <span className="font-display text-xl leading-none tabular-nums" style={{ color: timerColor }}>
              {formatMMSS(timerSec)}
            </span>
            <div className="mt-1 h-1 rounded-full overflow-hidden" style={{ width: 60, background: "#1d1d1d" }}>
              <div
                className="h-full"
                style={{
                  width: `${restProgress * 100}%`,
                  background: timerColor,
                  transition: "width 600ms linear",
                }}
              />
            </div>
          </div>
        )}
      </button>
    </div>
  );
}
