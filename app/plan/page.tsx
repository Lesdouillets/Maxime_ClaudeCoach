"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toLocalDateStr } from "@/lib/plan";
import { WingLeft, WingRight, RACE_COLOR } from "@/components/RaceBadge";
import { getSessions, getCancelledDays, getRescheduledDays } from "@/lib/storage";
import { getCoachWorkouts, getCoachRuns } from "@/lib/coachPlan";
import { syncFull } from "@/lib/sync";
import { useSession } from "@/contexts/SessionContext";
import { useRunSheet } from "@/contexts/RunSheetContext";
import type { WorkoutSession, CancelledDay } from "@/lib/types";
import type { CoachWorkout, CoachRun } from "@/lib/coachPlan";

// ── Types ─────────────────────────────────────────────────────────────────────

type PlanType   = "run" | "fitness" | null;
type StatusKind = "done" | "missed" | "upcoming" | "today-planned" | "today-rest" | "rest";

interface DayStatus {
  session:      WorkoutSession | undefined;
  isCancelled:  boolean;
  hasPlan:      boolean;
  planType:     PlanType;
  effectiveRun: CoachRun | null;
  isToday:      boolean;
  status:       StatusKind;
  isRace:       boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MONTH_OFFSETS = [-3, -2, -1, 0, 1, 2, 3] as const;
const DAY_HEADERS   = ["LUN.", "MAR.", "MER.", "JEU.", "VEN.", "SAM.", "DIM."];
const SCROLL_OFFSET = 64; // hauteur du gradient fixe + safe-area-inset-top

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusColor(status: StatusKind, planType: PlanType): string {
  if (status === "done")                                  return "var(--color-neon)";
  if (status === "missed")                                return "var(--color-error)";
  if (status === "today-rest" || status === "rest")       return "var(--color-muted)";
  return planType === "run" ? "var(--color-blue)" : "var(--color-orange)";
}

function getMonthLabel(offset: number): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return `${d.toLocaleDateString("fr-FR", { month: "long" })} ${d.getFullYear()}`;
}

function getMonthDays(offset: number): (Date | null)[] {
  const now   = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const last  = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  const pad   = (first.getDay() + 6) % 7; // décalage lundi = 0
  const days: (Date | null)[] = Array(pad).fill(null);
  for (let d = 1; d <= last.getDate(); d++) {
    days.push(new Date(now.getFullYear(), now.getMonth() + offset, d));
  }
  return days;
}

// ── Month component ───────────────────────────────────────────────────────────

interface MonthProps {
  offset:       number;
  todayRef?:    React.RefObject<HTMLDivElement>;
  getDayStatus: (dateStr: string) => DayStatus;
  onDayClick:   (dateStr: string, planType: PlanType) => void;
}

function Month({ offset, todayRef, getDayStatus, onDayClick }: MonthProps) {
  const days = getMonthDays(offset);

  return (
    <div ref={todayRef} className={offset > -3 ? "mt-8" : ""}>

      {/* En-tête du mois */}
      <div
        className="font-display font-bold mb-3"
        style={{
          fontSize: 20, lineHeight: "22px",
          letterSpacing: "-0.43px", fontVariationSettings: "'wdth' 100",
          color: "rgba(255,255,255,0.65)",
        }}
      >
        {getMonthLabel(offset)}
      </div>

      {/* En-têtes colonnes */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_HEADERS.map((h) => (
          <div
            key={h}
            className="text-center font-mono font-bold py-1"
            style={{ fontSize: 12, letterSpacing: "0.10em", color: "var(--color-muted)" }}
          >
            {h}
          </div>
        ))}
      </div>

      {/* Grille des jours */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((date, i) => {
          if (!date) return <div key={`pad-${i}`} />;

          const dateStr = toLocalDateStr(date);
          const s       = getDayStatus(dateStr);
          const color   = statusColor(s.status, s.planType);

          const dayCircle = (
            <div
              className="aspect-square flex items-center justify-center"
              style={{ opacity: s.isCancelled ? 0.4 : 1 }}
            >
              {s.isRace ? (
                <div className="w-7 h-7 flex items-center justify-center" style={{ gap: 3, color: RACE_COLOR }}>
                  <WingLeft size={6} />
                  <span className="text-xs font-medium leading-none" style={{ color: RACE_COLOR }}>
                    {date.getDate()}
                  </span>
                  <WingRight size={6} />
                </div>
              ) : (
                <div
                  className="w-7 h-7 flex items-center justify-center rounded-full border border-transparent"
                  style={s.isToday
                    ? { border: "1px solid rgba(255,255,255,0.85)", boxShadow: "0 0 8px rgba(255,255,255,0.15)" }
                    : undefined}
                >
                  <span className="text-xs font-medium leading-none" style={{ color }}>
                    {date.getDate()}
                  </span>
                </div>
              )}
            </div>
          );

          return (s.hasPlan || s.session) ? (
            <button
              key={dateStr}
              className="press-effect"
              onClick={() => onDayClick(dateStr, s.planType)}
            >
              {dayCircle}
            </button>
          ) : (
            <div key={dateStr}>{dayCircle}</div>
          );
        })}
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function PlanPage() {
  const router     = useRouter();
  const sessionCtx = useSession();
  const runSheet   = useRunSheet();

  const [mounted,       setMounted]       = useState(false);
  const [sessions,      setSessions]      = useState<WorkoutSession[]>([]);
  const [cancelled,     setCancelled]     = useState<CancelledDay[]>([]);
  const [rescheduled,   setRescheduled]   = useState<{ from: string; to: string }[]>([]);
  const [coachWorkouts, setCoachWorkouts] = useState<CoachWorkout[]>([]);
  const [coachRuns,     setCoachRuns]     = useState<CoachRun[]>([]);

  const todayRef = useRef<HTMLDivElement>(null);
  const todayStr = toLocalDateStr(new Date());

  useEffect(() => {
    const load = () => {
      setSessions(getSessions());
      setCancelled(getCancelledDays());
      setRescheduled(getRescheduledDays());
      setCoachWorkouts(getCoachWorkouts());
      setCoachRuns(getCoachRuns());
    };
    load();
    setMounted(true);
    syncFull().then(load).catch(console.error);
  }, []);

  // Scroll vers le mois courant après le premier rendu
  useEffect(() => {
    if (!mounted || !todayRef.current) return;
    todayRef.current.scrollIntoView({ behavior: "instant", block: "start" });
  }, [mounted]);

  function getDayStatus(dateStr: string): DayStatus {
    const session     = sessions.find((s) => s.date.slice(0, 10) === dateStr);
    const isCancelled = cancelled.some((d) => d.date === dateStr);
    const movedAway   = rescheduled.some((r) => r.from === dateStr);
    const movedHere   = rescheduled.find((r) => r.to === dateStr);

    const effectiveWorkout = isCancelled || movedAway
      ? null
      : (coachWorkouts.find((w) => w.date === dateStr)
          ?? (movedHere ? coachWorkouts.find((w) => w.date === movedHere.from) ?? null : null));

    const effectiveRun = isCancelled || movedAway
      ? null
      : (coachRuns.find((r) => r.date === dateStr)
          ?? (movedHere ? coachRuns.find((r) => r.date === movedHere.from) ?? null : null));

    const hasPlan  = !!(effectiveWorkout || effectiveRun);
    const planType = effectiveRun ? "run" : effectiveWorkout ? "fitness" : null;
    const isToday  = dateStr === todayStr;
    const isPast   = dateStr < todayStr;

    let status: StatusKind;
    if      (session)  status = "done";
    else if (isToday)  status = hasPlan ? "today-planned" : "today-rest";
    else if (!hasPlan) status = "rest";
    else if (isPast)   status = "missed";
    else               status = "upcoming";

    return {
      session, isCancelled, hasPlan, planType,
      effectiveRun, isToday, status,
      isRace: effectiveRun?.isRace ?? false,
    };
  }

  function handleDayClick(dateStr: string, planType: PlanType) {
    if (planType === "run") {
      runSheet.open(dateStr, { originRoute: "/plan" });
    } else {
      const result = sessionCtx.open(dateStr, { originRoute: "/plan" });
      if (result === "no-plan") router.push(`/log/fitness?date=${dateStr}`);
    }
  }

  if (!mounted) return null;

  return (
    <>
      {/* Gradient fixe masquant le défilement sous la safe area */}
      <div
        aria-hidden
        style={{
          position: "fixed", top: 0, left: 0, right: 0,
          height: "calc(env(safe-area-inset-top, 44px) + 56px)",
          background: "linear-gradient(to top, rgba(0,0,0,0) 0%, var(--color-background) 55%)",
          pointerEvents: "none",
          zIndex: 10,
        }}
      />

      <div
        className="max-w-md mx-auto px-4 pb-nav"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 44px) + 20px)" }}
      >
        {MONTH_OFFSETS.map((offset) => (
          <Month
            key={offset}
            offset={offset}
            todayRef={offset === 0 ? todayRef : undefined}
            getDayStatus={getDayStatus}
            onDayClick={handleDayClick}
          />
        ))}
      </div>
    </>
  );
}
