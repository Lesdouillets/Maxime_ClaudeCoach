"use client";

import { usePathname } from "next/navigation";
import { TimerProvider, useTimer } from "@/contexts/TimerContext";

function TimerHalo() {
  const { timerKey, timerSec } = useTimer();
  const visible = !!timerKey && timerSec > 0 && timerSec <= 10;

  return (
    <div
      aria-hidden
      style={{
        position:      "fixed",
        inset:         0,
        zIndex:        40,
        pointerEvents: "none",
        borderRadius:  "inherit",
        opacity:       visible ? 1 : 0,
        transition:    "opacity 1.8s ease-out",
        animation:     visible ? "timer-halo-pulse 2.4s ease-in-out infinite" : "none",
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

