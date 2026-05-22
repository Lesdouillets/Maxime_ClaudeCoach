"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useSession } from "@/contexts/SessionContext";
import { useTimer } from "@/contexts/TimerContext";

const ACTIVE = "#FFFFFF";
const MUTED  = "var(--color-muted)";

const STRIP_STYLE: CSSProperties = {
  height: 40,
  display: "flex",
  alignItems: "center",
  padding: "0 16px",
  gap: 8,
  borderBottom: "1px solid var(--color-white-08)",
  cursor: "pointer",
  position: "relative",
};

export type BottomNavState = "nav" | "hidden";

interface BottomNavProps {
  state?: BottomNavState;
}

const NAV_ITEMS = [
  {
    href: "/",
    label: "Home",
    icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path
          d="M3 9.5L12 3L21 9.5V20C21 20.55 20.55 21 20 21H15V15H9V21H4C3.45 21 3 20.55 3 20V9.5Z"
          stroke={active ? ACTIVE : MUTED}
          strokeWidth="1.8"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    ),
  },
  {
    href: "/plan",
    label: "Plan",
    icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="4" width="18" height="18" rx="2"
          stroke={active ? ACTIVE : MUTED} strokeWidth="1.8" />
        <path d="M3 9H21M8 2V6M16 2V6"
          stroke={active ? ACTIVE : MUTED} strokeWidth="1.8" strokeLinecap="round" />
        <path d="M8 13H8.01M12 13H12.01M16 13H16.01M8 17H8.01M12 17H12.01"
          stroke={active ? ACTIVE : MUTED} strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/stats",
    label: "Stats",
    icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M3 20V14M8 20V8M13 20V11M18 20V4"
          stroke={active ? ACTIVE : MUTED} strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/coach",
    label: "Coach",
    icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
          stroke={active ? ACTIVE : MUTED} strokeWidth="1.8"
          strokeLinecap="round" strokeLinejoin="round"
          fill="none" />
      </svg>
    ),
  },
];

function formatMMSS(rawSec: number) {
  const sec = Math.max(0, rawSec);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function SessionStrip() {
  const session = useSession();
  const { timerKey, timerSec, timerTotalSec } = useTimer();

  if (
    session.view !== "minimized" ||
    !session.state?.started ||
    session.finishing.status !== "idle"
  ) return null;

  const ex = session.state.exercises[session.state.activeExIdx];
  if (!ex) return null;

  const isResting = !!timerKey && timerSec > 0;
  const timerColor = isResting
    ? timerSec > 10 ? "var(--color-neon)"
      : timerSec > 3 ? "var(--color-orange)"
      : "var(--color-error)"
    : undefined;
  const restProgress = isResting && timerTotalSec > 0
    ? Math.min(1, Math.max(0, (timerTotalSec - timerSec) / timerTotalSec))
    : 0;

  return (
    <button
      onClick={session.expand}
      className="w-full press-effect"
      style={STRIP_STYLE}
    >
      {/* Point indicateur */}
      <div
        className="flex-shrink-0 rounded-full"
        style={{ width: 6, height: 6, background: "var(--color-neon)" }}
      />

      {/* Nom de l'exercice */}
      <span className="flex-1 text-left text-sm font-semibold truncate block">
        {ex.name}
      </span>

      {/* Timer ou badge EN COURS */}
      {isResting ? (
        <span
          className="font-display text-base leading-none tabular-nums flex-shrink-0"
          style={{ color: timerColor }}
        >
          {formatMMSS(timerSec)}
        </span>
      ) : (
        <span
          className="text-xs font-medium flex-shrink-0"
          style={{ color: "var(--color-neon)", opacity: 0.5 }}
        >
          EN COURS
        </span>
      )}

      {/* Progress bar en bas de la strip (visible seulement si timer actif) */}
      {isResting && (
        <div
          className="absolute bottom-0 left-0 right-0"
          style={{ height: 2, background: "var(--color-surface-3)" }}
        >
          <div
            style={{
              height: 2,
              width: `${restProgress * 100}%`,
              background: timerColor,
              transition: "width 600ms linear",
            }}
          />
        </div>
      )}
    </button>
  );
}

export default function BottomNav({ state = "nav" }: BottomNavProps) {
  const pathname = usePathname();
  const [activating, setActivating] = useState<string | null>(null);

  useEffect(() => {
    setActivating(pathname);
    const t = setTimeout(() => setActivating(null), 400);
    return () => clearTimeout(t);
  }, [pathname]);

  if (state === "hidden") return null;

  return (
    <div
      className="fixed left-0 right-0 bottom-0 z-nav"
      style={{
        background: "linear-gradient(to bottom, rgba(0,0,0,0) 0%, #000000 35%)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <SessionStrip />
      <nav className="flex items-center justify-around px-2 pt-3 pb-2">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          const isActivating = activating === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              className="flex flex-col items-center gap-0.5 press-effect"
              style={{
                animation: isActivating ? "nav-activate 0.35s ease-out" : undefined,
              }}
            >
              {item.icon(isActive)}
              <span
                className="text-[10px] font-medium uppercase tracking-[0.08em]"
                style={{ color: isActive ? ACTIVE : MUTED }}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
