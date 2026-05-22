"use client";

import { usePathname } from "next/navigation";
import { TimerProvider, useTimer } from "@/contexts/TimerContext";
import { SessionProvider, useSession } from "@/contexts/SessionContext";
import { RunSheetProvider, useRunSheet } from "@/contexts/RunSheetContext";
import SessionSheet from "@/components/SessionSheet";
import RunSheet from "@/components/RunSheet";
import BottomNav from "@/components/BottomNav";

function TimerHalo() {
  const { timerKey, timerSec } = useTimer();
  const visible = !!timerKey && timerSec > 0 && timerSec <= 10;

  return (
    <div
      aria-hidden
      style={{
        position:      "fixed",
        inset:         0,
        zIndex:        65,
        pointerEvents: "none",
        borderRadius:  "inherit",
        opacity:       visible ? 1 : 0,
        transition:    "opacity 1.8s ease-out",
        animation:     visible ? "timer-halo-pulse 2.4s ease-in-out infinite" : "none",
      }}
    />
  );
}

function BottomNavGate() {
  const session = useSession();
  const runSheet = useRunSheet();
  const pathname = usePathname();
  if (pathname.startsWith("/dev/")) return null;
  if (session.view === "expanded" || runSheet.view === "expanded") return null;
  return <BottomNav state="nav" />;
}

export default function GlobalUI({ children }: { children: React.ReactNode }) {
  return (
    <TimerProvider>
      <SessionProvider>
        <RunSheetProvider>
          <TimerHalo />
          {children}
          <BottomNavGate />
          <SessionSheet />
          <RunSheet />
        </RunSheetProvider>
      </SessionProvider>
    </TimerProvider>
  );
}
