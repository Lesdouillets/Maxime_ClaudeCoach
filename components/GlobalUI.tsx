"use client";

import { usePathname } from "next/navigation";
import { TimerProvider, useTimer } from "@/contexts/TimerContext";

function TimerHalo() {
  const { timerKey, timerSec } = useTimer();

  // Halo visible uniquement en fin de timer (≤ 10s)
  const THRESHOLD = 10;
  const visible = !!timerKey && timerSec > 0 && timerSec <= THRESHOLD;
  // Intensité : 0 à 10s → 1 à 0s
  const intensity = visible ? Math.min(1, (THRESHOLD - timerSec) / (THRESHOLD - 1)) : 0;
  // Pulse rapide quand ≤ 3s
  const pulse = timerSec <= 3 && timerSec > 0;

  return (
    <div
      aria-hidden
      className={pulse ? "animate-pulse" : ""}
      style={{
        position:       "fixed",
        inset:          0,
        zIndex:         40,
        pointerEvents:  "none",
        opacity:        intensity,
        transition:     "opacity 0.8s ease",
        background: `
          radial-gradient(ellipse 80% 50% at 0% 0%,   rgba(255,107,0,0.35) 0%, transparent 65%),
          radial-gradient(ellipse 80% 50% at 100% 0%,  rgba(220,40,40,0.30) 0%, transparent 65%),
          radial-gradient(ellipse 80% 50% at 0% 100%,  rgba(220,40,40,0.30) 0%, transparent 65%),
          radial-gradient(ellipse 80% 50% at 100% 100%,rgba(255,107,0,0.35) 0%, transparent 65%)
        `,
      }}
    />
  );
}

function FloatingTimer() {
  const { timerKey, timerSec, stopTimer } = useTimer();
  const pathname = usePathname();
  const isTimerPage = pathname === "/day" || pathname === "/log/fitness";
  if (!timerKey || timerSec <= 0 || isTimerPage) return null;
  const color = timerSec > 10 ? "#39ff14" : timerSec > 3 ? "#ff6b00" : "#ff4444";
  return (
    <button
      onClick={stopTimer}
      className="fixed top-12 right-5 z-50 w-12 h-12 rounded-full flex items-center justify-center press-effect"
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
      <TimerHalo />
      <FloatingTimer />
      {children}
    </TimerProvider>
  );
}

