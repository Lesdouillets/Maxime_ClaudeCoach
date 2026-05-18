"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toLocalDateStr } from "@/lib/plan";
import { WingLeft, WingRight, RACE_COLOR } from "@/components/RaceBadge";
import { getSessions, getCancelledDays, getRescheduledDays } from "@/lib/storage";
import { getCoachWorkouts, getCoachRuns } from "@/lib/coachPlan";
import { syncFull } from "@/lib/sync";
import { useSession } from "@/contexts/SessionContext";
import { useRunSheet } from "@/contexts/RunSheetContext";
import type { WorkoutSession, CancelledDay as CancelledDayType } from "@/lib/types";
import type { CoachWorkout, CoachRun } from "@/lib/coachPlan";

// ── Constants ──────────────────────────────────────────────────────────────
const GRID_HEADERS = ["LUN.", "MAR.", "MER.", "JEU.", "VEN.", "SAM.", "DIM."];
const TODAY_RING_COLOR  = "rgba(255,255,255,0.85)";
const TODAY_GLOW        = "0 0 8px rgba(255,255,255,0.15)";
const MONTH_LABEL_COLOR = "rgba(255,255,255,0.65)";
const TOP_GRADIENT_STYLE = {
  position:      "fixed" as const,
  top: 0, left: 0, right: 0,
  height:        "calc(env(safe-area-inset-top, 44px) + 56px)",
  background:    "linear-gradient(to top, rgba(0,0,0,0) 0%, var(--color-background) 55%)",
  pointerEvents: "none" as const,
  zIndex:        10,
};

// ── Type ───────────────────────────────────────────────────────────────────
interface DayStatus {
  session: WorkoutSession | undefined;
  isCancelled: boolean;
  hasPlan: boolean;
  planType: "run" | "fitness" | null;
  effectiveWorkout: CoachWorkout | null;
  effectiveRun: CoachRun | null;
  isToday: boolean;
  isPast: boolean;
  status: "done" | "missed" | "upcoming" | "today-planned" | "today-rest" | "rest";
  planLabel: string;
  planDistanceKm: number | null;
  planPaceStr: string | null;
  planZone: string | null;
  planHR: string | null;
}

// ── Pure helpers (module-level, no state dependency) ──────────────────────
const planColor = (type: string | null) =>
  type === "run" ? "var(--color-blue)" : "var(--color-orange)";

function statusColor(s: DayStatus): string {
  if (s.status === "done")                                return "var(--color-neon)";
  if (s.status === "missed")                              return "var(--color-error)";
  if (s.status === "today-rest" || s.status === "rest")  return "var(--color-muted)";
  return planColor(s.planType);
}

// ── Calendar utilities ─────────────────────────────────────────────────────
function getVisibleMonths(): number[] {
  return [-3, -2, -1, 0, 1, 2, 3];
}

function getMonthLabel(monthOffset: number): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + monthOffset);
  return `${d.toLocaleDateString("fr-FR", { month: "long" })} ${d.getFullYear()}`;
}

function getMonthCells(monthOffset: number): (Date | null)[] {
  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth() + monthOffset;
  const first = new Date(year, month, 1);
  const last  = new Date(year, month + 1, 0);
  const startPad = (first.getDay() + 6) % 7;
  const cells: (Date | null)[] = Array(startPad).fill(null);
  for (let d = 1; d <= last.getDate(); d++) {
    cells.push(new Date(year, month, d));
  }
  return cells;
}

// ── MonthSection ───────────────────────────────────────────────────────────
interface MonthSectionProps {
  monthOffset: number;
  isFirst: boolean;
  getDayStatus: (dateStr: string) => DayStatus;
  handleDayClick: (
    e: React.MouseEvent,
    href: string,
    target: "fitness" | "run" | null,
    dateStr: string
  ) => void;
  scrollRef?: React.RefObject<HTMLDivElement>;
}

function MonthSection({
  monthOffset,
  isFirst,
  getDayStatus,
  handleDayClick,
  scrollRef,
}: MonthSectionProps) {
  const monthCells = getMonthCells(monthOffset);

  return (
    <div ref={scrollRef} className={isFirst ? "" : "mt-8"}>
      {/* Header mois */}
      <div
        className="font-display font-bold mb-3"
        style={{
          fontSize: "20px",
          lineHeight: "22px",
          letterSpacing: "-0.43px",
          fontVariationSettings: "'wdth' 100",
          color: MONTH_LABEL_COLOR,
        }}
      >
        {getMonthLabel(monthOffset)}
      </div>

      {/* Headers colonnes */}
      <div className="grid grid-cols-7 mb-1">
        {GRID_HEADERS.map((h, i) => (
          <div
            key={h}
            className="text-center font-mono font-bold text-subtle py-1"
            style={{ fontSize: "12px", letterSpacing: "0.10em" }}
          >
            {h}
          </div>
        ))}
      </div>

      {/* Grille jours */}
      <div className="grid grid-cols-7 gap-1">
        {monthCells.map((date, i) => {
          if (!date) return <div key={`pad-${i}`} />;

          const dateStr     = toLocalDateStr(date);
          const s           = getDayStatus(dateStr);
          const isClickable = s.hasPlan || !!s.session;
          const isFitnessDay =
            s.planType === "fitness" || s.session?.type === "fitness";
          const href = isFitnessDay
            ? `/log/fitness?date=${dateStr}`
            : "/plan";
          const sheetTarget: "fitness" | "run" | null =
            s.session?.type === "run"     ? "run"
            : s.session?.type === "fitness" ? "fitness"
            : s.hasPlan
              ? isFitnessDay              ? "fitness"
                : s.planType === "run"    ? "run"
                : null
              : null;

          const isRace = s.effectiveRun?.isRace ?? false;
          const cell = (
            <div
              className="aspect-square flex items-center justify-center"
              style={{ opacity: s.isCancelled ? 0.4 : 1 }}
            >
              {isRace ? (
                <div
                  className="w-7 h-7 flex items-center justify-center"
                  style={{ gap: 3, color: RACE_COLOR }}
                >
                  <WingLeft size={6} />
                  <span className="text-xs font-medium leading-none" style={{ color: RACE_COLOR }}>
                    {date.getDate()}
                  </span>
                  <WingRight size={6} />
                </div>
              ) : (
                <div
                  className="w-7 h-7 flex items-center justify-center rounded-full border border-transparent"
                  style={s.isToday ? { border: `1px solid ${TODAY_RING_COLOR}`, boxShadow: TODAY_GLOW } : undefined}
                >
                  <span className="text-xs font-medium leading-none" style={{ color: statusColor(s) }}>
                    {date.getDate()}
                  </span>
                </div>
              )}
            </div>
          );

          return isClickable ? (
            <Link
              key={dateStr}
              href={href}
              onClick={(e) => handleDayClick(e, href, sheetTarget, dateStr)}
              className="press-effect"
            >
              {cell}
            </Link>
          ) : (
            <div key={dateStr}>{cell}</div>
          );
        })}
      </div>
    </div>
  );
}

// ── PlanPage ───────────────────────────────────────────────────────────────
export default function PlanPage() {
  const router     = useRouter();
  const sessionCtx = useSession();
  const runSheet   = useRunSheet();
  const [mounted, setMounted] = useState(false);

  const todayMonthRef = useRef<HTMLDivElement>(null);

  const handleDayClick = (
    e: React.MouseEvent,
    href: string,
    target: "fitness" | "run" | null,
    dateStr: string
  ) => {
    e.preventDefault();
    if (!target) return;
    if (target === "fitness") {
      const result = sessionCtx.open(dateStr, { originRoute: "/plan" });
      if (result === "no-plan") router.push(href);
      return;
    }
    runSheet.open(dateStr, { originRoute: "/plan" });
  };

  const [sessions,        setSessions]        = useState<WorkoutSession[]>([]);
  const [cancelledDays,   setCancelledDays]   = useState<CancelledDayType[]>([]);
  const [rescheduledDays, setRescheduledDays] = useState<{ from: string; to: string }[]>([]);
  const [coachWorkouts,   setCoachWorkouts]   = useState<CoachWorkout[]>([]);
  const [coachRuns,       setCoachRuns]       = useState<CoachRun[]>([]);

  const todayStr = toLocalDateStr(new Date());

  const refresh = () => {
    setSessions(getSessions());
    setCancelledDays(getCancelledDays());
    setRescheduledDays(getRescheduledDays());
    setCoachWorkouts(getCoachWorkouts());
    setCoachRuns(getCoachRuns());
  };

  useEffect(() => {
    setMounted(true);
    refresh();
    syncFull().then(() => refresh()).catch((err) => console.error("[plan] sync failed", err));
  }, []);

  useEffect(() => {
    if (!mounted) return;
    // RAF : laisse le navigateur iOS finaliser le layout avant de scroller
    requestAnimationFrame(() => {
      todayMonthRef.current?.scrollIntoView({ behavior: "instant", block: "start" });
    });
  }, [mounted]);

  function getDayStatus(dateStr: string): DayStatus {
    const session      = sessions.find((s) => s.date.slice(0, 10) === dateStr);
    const isCancelled  = cancelledDays.some((d) => d.date === dateStr);
    const reschedule   = rescheduledDays.find((r) => r.from === dateStr);
    const reschHere    = rescheduledDays.find((r) => r.to === dateStr);
    const coachWorkout = coachWorkouts.find((w) => w.date === dateStr) ?? null;
    const coachRun     = coachRuns.find((r) => r.date === dateStr) ?? null;
    const reschFromW   = reschHere
      ? coachWorkouts.find((w) => w.date === reschHere.from) ?? null
      : null;
    const reschFromR   = reschHere
      ? coachRuns.find((r) => r.date === reschHere.from) ?? null
      : null;

    const effectiveWorkout = isCancelled ? null : reschedule ? reschFromW : (coachWorkout ?? reschFromW);
    const effectiveRun     = isCancelled ? null : reschedule ? reschFromR : (coachRun     ?? reschFromR);
    const hasPlan          = !!(effectiveWorkout || effectiveRun);
    const planType         = effectiveRun ? "run" : effectiveWorkout ? "fitness" : null;

    const d       = new Date(dateStr + "T00:00:00");
    const isToday = dateStr === todayStr;
    const isPast  = d < new Date(todayStr + "T00:00:00");

    let status: DayStatus["status"];
    if (session)       status = "done";
    else if (isToday)  status = hasPlan ? "today-planned" : "today-rest";
    else if (!hasPlan) status = "rest";
    else if (isPast)   status = "missed";
    else               status = "upcoming";

    return {
      session, isCancelled, hasPlan, planType,
      effectiveWorkout: effectiveWorkout ?? null,
      effectiveRun:     effectiveRun     ?? null,
      isToday, isPast, status,
      planLabel:      effectiveRun?.label ?? effectiveWorkout?.label ?? "",
      planDistanceKm: effectiveRun?.distanceKm ?? null,
      planPaceStr:    effectiveRun?.pace       ?? null,
      planZone:       effectiveRun?.targetZone ?? null,
      planHR:         effectiveRun?.targetHR   ?? null,
    };
  }

  if (!mounted) return null;

  const months = getVisibleMonths();

  return (
    <>
      {/* Gradient fixe en haut — même logique que la nav bar en bas */}
      <div aria-hidden style={TOP_GRADIENT_STYLE} />

      <div
        className="max-w-md mx-auto animate-fade-in px-4 pb-nav"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 44px) + 20px)" }}
      >
        {months.map((offset, idx) => (
          <MonthSection
            key={offset}
            monthOffset={offset}
            isFirst={idx === 0}
            getDayStatus={getDayStatus}
            handleDayClick={handleDayClick}
            scrollRef={offset === 0 ? todayMonthRef : undefined}
          />
        ))}
      </div>
    </>
  );
}
