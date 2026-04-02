"use client";

import { TimerProvider, useTimer } from "@/contexts/TimerContext";

function FloatingTimer() {
  const { timerKey, timerSec, stopTimer } = useTimer();
  if (!timerKey || timerSec <= 0) return null;
  const color = timerSec > 10 ? "#39ff14" : timerSec > 3 ? "#ff6b00" : "#ff4444";
  return (
    <button
      onClick={stopTimer}
      className="fixed top-4 right-4 z-50 w-12 h-12 rounded-full flex items-center justify-center press-effect"
      style={{
        background: "#111",
        border: `2px solid ${color}`,
        boxShadow: `0 0 16px ${color}33`,
      }}
    >
      <span className="font-display text-sm leading-none" style={{ color }}>{timerSec}</span>
    </button>
  );
}

export default function GlobalUI({ children }: { children: React.ReactNode }) {
  return (
    <TimerProvider>
      <FloatingTimer />
      {children}
    </TimerProvider>
  );
}
