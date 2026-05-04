"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import Badge from "@/components/Badge";
import { getWeekDays, toLocalDateStr } from "@/lib/plan";
import { getSessions, getCancelledDays, getRescheduledDays } from "@/lib/storage";
import { getCoachWorkouts, getCoachRuns } from "@/lib/coachPlan";
import { syncFull } from "@/lib/sync";
import { useSession } from "@/contexts/SessionContext";
import { useRunSheet } from "@/contexts/RunSheetContext";
import type { WorkoutSession, CancelledDay as CancelledDayType } from "@/lib/types";
import type { CoachWorkout, CoachRun } from "@/lib/coachPlan";

const DAY_FULL_FR   = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const DAY_SHORT_FR  = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
// Grid columns start on Monday — reorder to Mon…Sun
const GRID_HEADERS  = ["L", "M", "M", "J", "V", "S", "D"];

function formatWeekLabel(days: ReturnType<typeof getWeekDays>): string {
  const first = days[0].date;
  const last  = days[6].date;
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  return `${first.toLocaleDateString("fr-FR", opts)} – ${last.toLocaleDateString("fr-FR", opts)}`;
}

function formatMonthLabel(monthOffset: number): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + monthOffset);
  return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }).toUpperCase();
}

/** Returns an array of Date | null for the month grid (null = padding before 1st) */
function getMonthCells(monthOffset: number): (Date | null)[] {
  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth() + monthOffset;
  const first = new Date(year, month, 1);
  const last  = new Date(year, month + 1, 0);
  // Mon-based dow: Mon=0 … Sun=6
  const startPad = (first.getDay() + 6) % 7;
  const cells: (Date | null)[] = Array(startPad).fill(null);
  for (let d = 1; d <= last.getDate(); d++) {
    cells.push(new Date(year, month, d));
  }
  return cells;
}

export default function PlanPage() {
  const router = useRouter();
  const sessionCtx = useSession();
  const runSheet = useRunSheet();
  const [mounted, setMounted] = useState(false);

  // Click handler for day cards: when the day has a coach plan and no
  // completed session, hand off to the relevant global sheet directly so the
  // user lands in the workout view (no /day page, no back button) and the
  // origin (this plan page) is preserved for minimize/drag-down.
  const handleDayClick = (
    e: React.MouseEvent,
    href: string,
    target: "fitness" | "run" | null,
    dateStr: string
  ) => {
    if (!target) return; // not eligible — let the Link navigate
    e.preventDefault();
    if (target === "fitness") {
      const result = sessionCtx.open(dateStr, { originRoute: "/plan" });
      if (result === "no-plan") router.push(href);
      return;
    }
    // Run day → run sheet (planned or archive view)
    runSheet.open(dateStr, { originRoute: "/plan" });
  };

  // ── View toggle ──
  const [view, setView] = useState<"week" | "month">(() => {
    try { return (sessionStorage.getItem("plan_view") as "week" | "month") ?? "week"; }
    catch { return "week"; }
  });

  // ── Offsets ──
  const [weekOffset, setWeekOffset] = useState(() => {
    try { return parseInt(sessionStorage.getItem("plan_week_offset") ?? "0", 10) || 0; }
    catch { return 0; }
  });
  const [monthOffset, setMonthOffset] = useState(() => {
    try { return parseInt(sessionStorage.getItem("plan_month_offset") ?? "0", 10) || 0; }
    catch { return 0; }
  });

  // ── Data ──
  const [sessions,        setSessions]        = useState<WorkoutSession[]>([]);
  const [cancelledDays,   setCancelledDays]   = useState<CancelledDayType[]>([]);
  const [rescheduledDays, setRescheduledDays] = useState<{ from: string; to: string }[]>([]);
  const [coachWorkouts,   setCoachWorkouts]   = useState<CoachWorkout[]>([]);
  const [coachRuns,       setCoachRuns]       = useState<CoachRun[]>([]);

  const weekDays   = getWeekDays(weekOffset);
  const monthCells = getMonthCells(monthOffset);
  const todayStr   = toLocalDateStr(new Date());

  const refresh = () => {
    setSessions(getSessions());
    setCancelledDays(getCancelledDays());
    setRescheduledDays(getRescheduledDays());
    setCoachWorkouts(getCoachWorkouts());
    setCoachRuns(getCoachRuns());
  };

  useEffect(() => {
    setMounted(true);
    refresh(); // affiche le cache local immédiatement
    syncFull().then(() => refresh()).catch(() => {}); // puis met à jour depuis Supabase
  }, []);

  if (!mounted) return null;

  // ── Helpers to set offset + persist ──
  const setWeek = (n: number) => {
    try { sessionStorage.setItem("plan_week_offset", String(n)); } catch {}
    setWeekOffset(n);
  };
  const setMonth = (n: number) => {
    try { sessionStorage.setItem("plan_month_offset", String(n)); } catch {}
    setMonthOffset(n);
  };
  const setViewMode = (v: "week" | "month") => {
    try { sessionStorage.setItem("plan_view", v); } catch {}
    setView(v);
  };

  // ── Day status helper (shared between views) ──
  function getDayStatus(dateStr: string) {
    const session      = sessions.find((s) => s.date.slice(0, 10) === dateStr);
    const isCancelled  = cancelledDays.some((d) => d.date === dateStr);
    const reschedule   = rescheduledDays.find((r) => r.from === dateStr);
    const reschHere    = rescheduledDays.find((r) => r.to === dateStr);
    const coachWorkout = coachWorkouts.find((w) => w.date === dateStr) ?? null;
    const coachRun     = coachRuns.find((r) => r.date === dateStr) ?? null;
    const reschFromW   = reschHere ? coachWorkouts.find((w) => w.date === reschHere.from) ?? null : null;
    const reschFromR   = reschHere ? coachRuns.find((r)     => r.date === reschHere.from) ?? null : null;

    const effectiveWorkout = isCancelled ? null : reschedule ? reschFromW : (coachWorkout ?? reschFromW);
    const effectiveRun     = isCancelled ? null : reschedule ? reschFromR : (coachRun     ?? reschFromR);
    const hasPlan          = !!(effectiveWorkout || effectiveRun);
    const planType         = effectiveRun ? "run" : effectiveWorkout ? "fitness" : null;

    const d       = new Date(dateStr + "T00:00:00");
    const isToday = dateStr === todayStr;
    const isPast  = d < new Date(todayStr + "T00:00:00");

    let status: "done" | "missed" | "upcoming" | "today-planned" | "today-rest" | "rest";
    if (session)       status = "done";
    else if (isToday)  status = hasPlan ? "today-planned" : "today-rest";
    else if (!hasPlan) status = "rest";
    else if (isPast)   status = "missed";
    else               status = "upcoming";

    return { session, isCancelled, hasPlan, planType, effectiveWorkout, effectiveRun, isToday, isPast, status,
             planLabel: effectiveRun?.label ?? effectiveWorkout?.label ?? "",
             planDistanceKm: effectiveRun?.distanceKm ?? null,
             planPaceStr: effectiveRun?.pace ?? null,
             planZone: effectiveRun?.targetZone ?? null,
             planHR: effectiveRun?.targetHR ?? null };
  }

  const planColor  = (type: string | null) => type === "run" ? "#4f9cf9" : "#ff6b00";
  const planBorder = (type: string | null) => type === "run" ? "rgba(79,156,249,0.35)" : "rgba(255,107,0,0.35)";
  const planBg     = (type: string | null) => type === "run" ? "rgba(79,156,249,0.03)" : "rgba(255,107,0,0.03)";

  const statusColor = (s: ReturnType<typeof getDayStatus>) => {
    if (s.status === "done")                                    return "#39ff14";
    if (s.status === "missed")                                  return "#ff6b00";
    if (s.status === "today-rest" || s.status === "rest")       return "#555";
    return planColor(s.planType);
  };

  // ── Navigation label/buttons ──
  const isWeek  = view === "week";
  const subtitle = isWeek ? formatWeekLabel(weekDays) : formatMonthLabel(monthOffset);

  const handlePrev  = () => isWeek ? setWeek(weekOffset - 1)  : setMonth(monthOffset - 1);
  const handleNext  = () => isWeek ? setWeek(weekOffset + 1)  : setMonth(monthOffset + 1);
  const handleToday = () => isWeek ? setWeek(0) : setMonth(0);
  const isAtToday   = isWeek ? weekOffset === 0 : monthOffset === 0;

  return (
    <div className="max-w-md mx-auto animate-fade-in">
      <PageHeader title="PLAN" subtitle={subtitle} accent="neon" />

      {/* ── View toggle ── */}
      <div className="px-5 mb-4 flex items-center justify-between gap-3">
        <div className="flex rounded-xl overflow-hidden" style={{ border: "1px solid #222" }}>
          {(["week", "month"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setViewMode(v)}
              className="px-4 py-1.5 text-xs font-bold press-effect"
              style={{
                background: view === v ? "#1a1a1a" : "transparent",
                color:      view === v ? "#eee"    : "#444",
                borderRight: v === "week" ? "1px solid #222" : "none",
              }}
            >
              {v === "week" ? "Hebdo" : "Mensuel"}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrev}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs press-effect"
            style={{ background: "#111", border: "1px solid #222", color: "#555" }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
          {!isAtToday && (
            <button
              onClick={handleToday}
              className="text-xs press-effect px-2 py-1 rounded-lg"
              style={{ color: "#39ff14", background: "rgba(57,255,20,0.08)", border: "1px solid rgba(57,255,20,0.2)" }}
            >
              Auj.
            </button>
          )}
          <button
            onClick={handleNext}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs press-effect"
            style={{ background: "#111", border: "1px solid #222", color: "#555" }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          VUE HEBDOMADAIRE (liste verticale)
      ══════════════════════════════════════════ */}
      {view === "week" && (
        <div className="px-5 space-y-3">
          {weekDays.map((day) => {
            const dateStr = toLocalDateStr(day.date);
            const s = getDayStatus(dateStr);

            const sc = {
              done:            { color: "#39ff14", label: "Fait ✓",      border: "rgba(57,255,20,0.3)",  bg: "rgba(57,255,20,0.04)" },
              missed:          { color: "#ff6b00", label: "Manqué",      border: "rgba(255,107,0,0.25)", bg: "rgba(255,107,0,0.03)" },
              upcoming:        { color: planColor(s.planType), label: "À venir",     border: planBorder(s.planType), bg: "#111" },
              "today-planned": { color: planColor(s.planType), label: "Aujourd'hui", border: planBorder(s.planType), bg: planBg(s.planType) },
              "today-rest":    { color: "#555",    label: "Repos",       border: "#333",                 bg: "#111" },
              rest:            { color: "#2a2a2a", label: "Repos",       border: "#1a1a1a",              bg: "#0d0d0d" },
            }[s.status];

            const isClickable = s.hasPlan || !!s.session;
            const isFitnessDay =
              s.planType === "fitness" || s.session?.type === "fitness";
            const href = isFitnessDay
              ? `/log/fitness?date=${dateStr}`
              : `/day?date=${dateStr}`;

            const inner = day.isToday ? (
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-2xl" style={{ color: sc.color }}>
                      {DAY_FULL_FR[day.dow].toUpperCase()}
                    </span>
                    <span className="text-[9px] px-2 py-0.5 rounded-full font-bold tracking-widest"
                      style={s.hasPlan
                        ? { background: `${planColor(s.planType)}20`, color: planColor(s.planType), border: `1px solid ${planColor(s.planType)}50` }
                        : { background: "rgba(85,85,85,0.15)", color: "#555", border: "1px solid rgba(85,85,85,0.3)" }
                      }>
                      TODAY
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium" style={{ color: sc.color }}>{sc.label}</span>
                    {isClickable && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path d="M9 18L15 12L9 6" stroke="#555" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    )}
                  </div>
                </div>

                {s.hasPlan ? (
                  <>
                    <h3 className="font-bold text-xl mb-2">{s.planLabel}</h3>
                    {s.planType === "run" && (
                      <div className="flex gap-4 flex-wrap items-end mt-2">
                        {s.planDistanceKm && (
                          <div className="flex items-end gap-1">
                            <span className="font-display text-3xl" style={{ color: "#39ff14" }}>{s.planDistanceKm}</span>
                            <span className="text-sm text-muted mb-1">km</span>
                          </div>
                        )}
                        {s.planPaceStr && <span className="font-display text-2xl" style={{ color: "#39ff14" }}>{s.planPaceStr}/km</span>}
                        {s.planHR      && <span className="text-sm self-end mb-0.5" style={{ color: "#ff6b00" }}>♥ {s.planHR}</span>}
                        {s.planZone    && <Badge label={s.planZone} variant="neon" />}
                      </div>
                    )}
                    {s.planType === "fitness" && s.effectiveWorkout && (
                      <span className="text-xs text-muted">{s.effectiveWorkout.exercises.length} exercices</span>
                    )}
                    {s.session && (
                      <div className="mt-4 pt-4" style={{ borderTop: "1px solid #1a1a1a" }}>
                        {s.session.type === "run" ? (
                          <div className="flex gap-4 text-sm">
                            <span style={{ color: "#39ff14" }}>
                              <span className="font-display text-xl">{s.session.distanceKm.toFixed(1)}</span>
                              <span className="text-xs text-muted ml-1">km</span>
                            </span>
                            {s.session.avgPaceSecPerKm > 0 && (
                              <span className="text-muted self-end text-xs mb-0.5">
                                {Math.floor(s.session.avgPaceSecPerKm / 60)}:{String(Math.round(s.session.avgPaceSecPerKm % 60)).padStart(2, "0")}/km
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm" style={{ color: "#ff6b00" }}>
                            {s.session.exercises.length > 0 ? `${s.session.exercises.length} exercices` : "Activité Strava"}
                          </span>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-base text-muted">Récupération active</p>
                )}
              </div>
            ) : (
              <div className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-display text-base w-8 flex-shrink-0" style={{ color: sc.color }}>
                    {DAY_FULL_FR[day.dow].slice(0, 3).toUpperCase()}
                  </span>
                  <span className="text-[11px] flex-shrink-0" style={{ color: "#333" }}>
                    {day.date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                  </span>
                  {s.hasPlan
                    ? <span className="text-sm font-medium truncate">{s.planLabel}</span>
                    : <span className="text-xs" style={{ color: "#2a2a2a" }}>Repos</span>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  <span className="text-xs" style={{ color: sc.color }}>{sc.label}</span>
                  {isClickable && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                      <path d="M9 18L15 12L9 6" stroke="#333" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  )}
                </div>
              </div>
            );

            const sheetTarget: "fitness" | "run" | null =
              s.session?.type === "run" ? "run"
              : s.session?.type === "fitness" ? "fitness"
              : s.hasPlan
                ? (isFitnessDay ? "fitness" : s.planType === "run" ? "run" : null)
                : null;

            return isClickable ? (
              <Link key={dateStr} href={href}
                onClick={(e) => handleDayClick(e, href, sheetTarget, dateStr)}
                className="block rounded-2xl overflow-hidden press-effect"
                style={{ border: `1px solid ${sc.border}`, background: sc.bg,
                  boxShadow: day.isToday ? "0 0 20px rgba(57,255,20,0.06)" : "none",
                  opacity: s.isCancelled ? 0.55 : 1 }}
              >{inner}</Link>
            ) : (
              <div key={dateStr} className="rounded-2xl overflow-hidden"
                style={{ border: `1px solid ${sc.border}`, background: sc.bg,
                  opacity: s.isCancelled ? 0.55 : 1 }}
              >{inner}</div>
            );
          })}
          <div className="h-4" />
        </div>
      )}

      {/* ══════════════════════════════════════════
          VUE MENSUELLE (grille)
      ══════════════════════════════════════════ */}
      {view === "month" && (
        <div className="px-4">
          {/* En-têtes colonnes */}
          <div className="grid grid-cols-7 mb-1">
            {GRID_HEADERS.map((h, i) => (
              <div key={i} className="text-center text-[10px] font-bold py-1" style={{ color: "#333" }}>{h}</div>
            ))}
          </div>

          {/* Cellules */}
          <div className="grid grid-cols-7 gap-1">
            {monthCells.map((date, i) => {
              if (!date) return <div key={`pad-${i}`} />;

              const dateStr    = toLocalDateStr(date);
              const s          = getDayStatus(dateStr);
              const isClickable = s.hasPlan || !!s.session;
              const color      = statusColor(s);
              const isFitnessDay =
                s.planType === "fitness" || s.session?.type === "fitness";
              const href = isFitnessDay
                ? `/log/fitness?date=${dateStr}`
                : `/day?date=${dateStr}`;

              // Dot indicator color
              const dotColor =
                s.status === "done"            ? "#39ff14" :
                s.status === "missed"          ? "rgba(255,107,0,0.5)" :
                s.status === "upcoming"        ? planColor(s.planType) :
                s.status === "today-planned"   ? planColor(s.planType) :
                null;

              const cell = (
                <div
                  className="aspect-square flex flex-col items-center justify-center gap-0.5 rounded-xl relative"
                  style={{
                    background: s.isToday ? "#1c1c1c" : "transparent",
                    border:     s.isToday ? "1px solid #333" : "1px solid transparent",
                    opacity:    s.isCancelled ? 0.4 : 1,
                  }}
                >
                  <span className="text-xs font-medium leading-none" style={{ color }}>
                    {date.getDate()}
                  </span>
                  {dotColor && (
                    <div className="w-1 h-1 rounded-full" style={{ background: dotColor }} />
                  )}
                </div>
              );

              const sheetTarget: "fitness" | "run" | null =
                s.session?.type === "run" ? "run"
                : s.session?.type === "fitness" ? "fitness"
                : s.hasPlan
                  ? (isFitnessDay ? "fitness" : s.planType === "run" ? "run" : null)
                  : null;

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

          {/* Légende */}
          <div className="flex items-center gap-4 mt-5 px-1 flex-wrap">
            {[
              { color: "#39ff14",               label: "Fait" },
              { color: "#4f9cf9",               label: "Run prévu" },
              { color: "#ff6b00",               label: "Muscu prévue" },
              { color: "rgba(255,107,0,0.5)",   label: "Manqué" },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                <span className="text-[10px]" style={{ color: "#444" }}>{label}</span>
              </div>
            ))}
          </div>
          <div className="h-24" />
        </div>
      )}
    </div>
  );
}
