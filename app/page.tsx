"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toLocalDateStr } from "@/lib/plan";
import { getCurrentUser } from "@/lib/sync";
import { getSessions, getRescheduledDays } from "@/lib/storage";
import { useSession } from "@/contexts/SessionContext";
import { useRunSheet } from "@/contexts/RunSheetContext";
import { getCoachWorkouts, getCoachRuns } from "@/lib/coachPlan";
import { getActiveProfile } from "@/lib/profiles";
import { computeStreak } from "@/lib/streak";
import { buildWeekDays } from "@/lib/weekProgram";
import { SessionCard } from "@/components/SessionCard";
import { StreakCard } from "@/components/StreakCard";
import { WeekProgram } from "@/components/WeekProgram";
import type { WorkoutSession } from "@/lib/types";
import type { CoachWorkout, CoachRun } from "@/lib/coachPlan";
import type { User } from "@supabase/supabase-js";
import type { StreakResult } from "@/lib/streak";
import { ARCHIVO_WIDE_BOLD, JETBRAINS_MONO_LABEL } from "@/lib/typography";

const MOIS = ["JAN","FÉV","MAR","AVR","MAI","JUN","JUL","AOÛ","SEP","OCT","NOV","DÉC"];
const JOURS = ["DIMANCHE","LUNDI","MARDI","MERCREDI","JEUDI","VENDREDI","SAMEDI"];

const TITLE_FONT: React.CSSProperties = { ...ARCHIVO_WIDE_BOLD, letterSpacing: "-0.02em" };
const MONO_LABEL: React.CSSProperties = JETBRAINS_MONO_LABEL;

function formatWeekRange(todayStr: string): string {
  const today = new Date(todayStr + "T00:00:00");
  const dow = today.getDay();
  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) => `${d.getDate()} ${MOIS[d.getMonth()]}`;
  return `Semaine du ${fmt(monday)} au ${fmt(sunday)}`;
}

function getNextSessionLabel(
  todayStr: string,
  nextWorkout: CoachWorkout | null,
  nextRun: CoachRun | null,
): string {
  const next = [nextWorkout, nextRun]
    .filter(Boolean)
    .sort((a, b) => a!.date.localeCompare(b!.date))[0];

  if (!next) return "Aucune séance à venir";

  const diff = Math.round(
    (new Date(next.date + "T00:00:00").getTime() - new Date(todayStr + "T00:00:00").getTime()) / 86400000
  );
  return `Prochaine séance · Dans ${diff} jour${diff > 1 ? "s" : ""}`;
}

export default function HomePage() {
  const session = useSession();
  const runSheet = useRunSheet();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [coachWorkouts, setCoachWorkouts] = useState<CoachWorkout[]>([]);
  const [coachRuns, setCoachRuns] = useState<CoachRun[]>([]);
  const [rescheduledDays, setRescheduledDays] = useState<{ from: string; to: string }[]>([]);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [streakResult, setStreakResult] = useState<StreakResult>({ streakCount: 0, weeks: [] });
  const [firstName, setFirstName] = useState<string>("");

  const refresh = useCallback(() => {
    const s = getSessions();
    const cw = getCoachWorkouts();
    const cr = getCoachRuns();
    setSessions(s);
    setCoachWorkouts(cw);
    setCoachRuns(cr);
    setRescheduledDays(getRescheduledDays());
    setStreakResult(computeStreak(s, cw, cr));
  }, []);

  useEffect(() => {
    setAuthUser(getCurrentUser());
    const profile = getActiveProfile();
    setFirstName(profile?.name?.split(" ")[0] ?? "");
  }, []);

  useEffect(() => {
    setMounted(true);
    refresh();
  }, [refresh]);

  if (!mounted) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = toLocalDateStr(today);
  const dateLabel = `${JOURS[today.getDay()]} ${today.getDate()} ${MOIS[today.getMonth()]}`;
  const weekRangeLabel = formatWeekRange(todayStr);

  const reschAway = rescheduledDays.some((r) => r.from === todayStr);
  const reschHere = rescheduledDays.find((r) => r.to === todayStr);

  const todayCoachWorkout: CoachWorkout | null =
    (!reschAway ? coachWorkouts.find((w) => w.date === todayStr) : undefined)
    ?? (reschHere ? coachWorkouts.find((w) => w.date === reschHere.from) : undefined)
    ?? null;

  const todayCoachRun: CoachRun | null =
    (!reschAway ? coachRuns.find((r) => r.date === todayStr) : undefined)
    ?? (reschHere ? coachRuns.find((r) => r.date === reschHere.from) : undefined)
    ?? null;

  const todaySession = sessions.find((s) => s.date.slice(0, 10) === todayStr) ?? null;
  const hasActivity = !!(todayCoachWorkout || todayCoachRun || todaySession);

  // Si repos aujourd'hui, afficher la prochaine séance planifiée
  const futureWorkouts = coachWorkouts.filter((w) => w.date > todayStr).sort((a, b) => a.date.localeCompare(b.date));
  const futureRuns = coachRuns.filter((r) => r.date > todayStr).sort((a, b) => a.date.localeCompare(b.date));
  const nextWorkout = futureWorkouts[0] ?? null;
  const nextRun = futureRuns[0] ?? null;

  let displayCoachWorkout = todayCoachWorkout;
  let displayCoachRun = todayCoachRun;
  let displayDate = todayStr;

  if (!hasActivity) {
    const pickRun = nextRun && (!nextWorkout || nextRun.date <= nextWorkout.date);
    if (pickRun) {
      displayCoachRun = nextRun;
      displayDate = nextRun.date;
    } else if (nextWorkout) {
      displayCoachWorkout = nextWorkout;
      displayDate = nextWorkout.date;
    }
  }

  const sessionSectionLabel = hasActivity
    ? "Séance du jour"
    : getNextSessionLabel(todayStr, nextWorkout, nextRun);

  const { days: weekDays } = buildWeekDays(todayStr, coachWorkouts, coachRuns, sessions);

  return (
    <div className="min-h-screen pb-28" style={{ background: "#0d0d0d" }}>

      {/* ── Header ── */}
      <div
        className="flex items-start justify-between"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 20px)",
          paddingLeft: 12, paddingRight: 12, paddingBottom: 8,
        }}
      >
        <div className="flex flex-col gap-1">
          {/* Date */}
          <p style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 300,
            fontSize: 10.5,
            lineHeight: "12px",
            letterSpacing: "0.10em",
            textTransform: "uppercase",
            color: "#555",
          }}>
            {dateLabel}
          </p>
          {/* Titre */}
          <h1 style={{ ...TITLE_FONT, fontSize: 28, lineHeight: "32px", color: "#fff" }}>
            Bonjour{firstName ? ` ${firstName}` : ""}
          </h1>
        </div>

        {/* Avatar / settings */}
        <Link
          href="/settings"
          className="press-effect flex items-center justify-center relative flex-shrink-0"
          style={{
            width: 40, height: 40, borderRadius: "50%",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.08)",
            marginTop: 2,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="8" r="4" stroke="#aaa" strokeWidth="1.8"/>
            <path d="M4 20c0-4.418 3.582-8 8-8s8 3.582 8 8" stroke="#aaa" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          <span style={{
            position: "absolute", bottom: 2, right: 2,
            width: 8, height: 8, borderRadius: "50%",
            background: authUser ? "#CDFF00" : "#333",
            border: "1.5px solid #0d0d0d",
            boxShadow: authUser ? "0 0 4px #CDFF00" : "none",
          }} />
        </Link>
      </div>

      {/* ── Sections ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 28, padding: "12px 12px 0" }}>

        {/* Streak */}
        <StreakCard streakResult={streakResult} />

        {/* Séance du jour */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={MONO_LABEL}>{sessionSectionLabel}</p>
          <SessionCard
            todayCoachWorkout={displayCoachWorkout}
            todayCoachRun={displayCoachRun}
            todaySession={todaySession}
            onOpenSession={() => session.open(displayDate, { originRoute: "/" })}
            onOpenRun={() => runSheet.open(displayDate, { originRoute: "/" })}
          />
        </div>

        {/* Semaine */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="flex items-center justify-between">
            <p style={MONO_LABEL}>{weekRangeLabel}</p>
            <Link href="/plan">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M9 18L15 12L9 6" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
          </div>
          <WeekProgram
            days={weekDays}
            weekLabel=""
            onDayClick={(date) => router.push(`/day?date=${date}`)}
          />
        </div>

      </div>
    </div>
  );
}
