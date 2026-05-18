# Page Plan — Calendrier scrollable mensuel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer la page Plan (deux vues hebdo/mensuel avec navigation prev/next) par une unique vue mensuelle scrollable sur 7 mois glissants (-3 / +3 autour du mois courant), centrée sur aujourd'hui à l'ouverture.

**Architecture:** Refonte du seul fichier `app/plan/page.tsx`. On supprime toute la logique de toggle de vue et de navigation par flèches. On extrait la grille mensuelle dans un composant local `MonthSection`. `PlanPage` mappe 7 offsets sur `MonthSection` et scrolle vers le mois courant au montage via un `useRef`. La logique métier (`getDayStatus`, `handleDayClick`) est conservée intacte.

**Tech Stack:** Next.js 14, React 18, TypeScript, Tailwind CSS, variables CSS du design system (`globals.css`)

---

## Fichiers modifiés

| Fichier | Action |
|---|---|
| `app/plan/page.tsx` | Réécriture complète — seul fichier touché |

---

## Task 1 : Réécrire `app/plan/page.tsx`

**Fichiers :**
- Modifier : `app/plan/page.tsx`

Ce qui change par rapport à l'existant :
- **Imports supprimés :** `PageHeader`, `Badge`, `getWeekDays`
- **Import ajouté :** `useRef`
- **États supprimés :** `view`, `weekOffset`, `monthOffset` et leur persistance `sessionStorage`
- **Fonctions supprimées :** `formatWeekLabel`, `formatMonthLabel`, `DAY_FULL_FR`, `GRID_HEADERS` (redéfini à niveau module), `setWeek`, `setMonth`, `setViewMode`, `handlePrev`, `handleNext`, `handleToday`, `isAtToday`, `isWeek`, `subtitle`
- **Helpers promus au niveau module :** `planColor`, `statusColor` (version token CSS), nouveau `dotColor`
- **Nouveaux éléments :** type `DayStatus`, `getVisibleMonths()`, `getMonthLabel()`, `MonthSection`, `todayMonthRef`, `useEffect` dédié pour le scroll
- **JSX supprimé :** `<PageHeader>`, toggle Hebdo/Mensuel, boutons prev/next/Auj., toute la section week view, légende couleurs
- **Couleurs alignées design system :** `#cc3333` → `var(--color-error)`, `#CDFF00` → `var(--color-neon)`, `#555` → `var(--color-muted)`, `rgba(205,255,0,0.08)` → `var(--color-neon-08)`, `pb-24` → `pb-nav`

- [ ] **Écrire le fichier complet**

Remplacer l'intégralité de `app/plan/page.tsx` par :

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toLocalDateStr } from "@/lib/plan";
import { getSessions, getCancelledDays, getRescheduledDays } from "@/lib/storage";
import { getCoachWorkouts, getCoachRuns } from "@/lib/coachPlan";
import { syncFull } from "@/lib/sync";
import { useSession } from "@/contexts/SessionContext";
import { useRunSheet } from "@/contexts/RunSheetContext";
import type { WorkoutSession, CancelledDay as CancelledDayType } from "@/lib/types";
import type { CoachWorkout, CoachRun } from "@/lib/coachPlan";

// ── Constants ──────────────────────────────────────────────────────────────
const GRID_HEADERS = ["L", "M", "M", "J", "V", "S", "D"];

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

function dotColor(s: DayStatus): string | null {
  if (s.status === "done")                                        return "var(--color-neon)";
  if (s.status === "missed")                                      return "var(--color-error-border)";
  if (s.status === "upcoming" || s.status === "today-planned")   return planColor(s.planType);
  return null;
}

// ── Calendar utilities ─────────────────────────────────────────────────────
function getVisibleMonths(): number[] {
  return [-3, -2, -1, 0, 1, 2, 3];
}

function getMonthLabel(monthOffset: number): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + monthOffset);
  return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }).toUpperCase();
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
    <div ref={scrollRef} className={isFirst ? "" : "mt-12"}>
      {/* Header mois */}
      <div
        className="font-display mb-2 tracking-[0.10em] text-muted"
        style={{ fontSize: "14px", fontVariationSettings: "'wdth' 110" }}
      >
        {getMonthLabel(monthOffset)}
      </div>

      {/* Headers colonnes */}
      <div className="grid grid-cols-7 mb-1">
        {GRID_HEADERS.map((h, i) => (
          <div
            key={i}
            className="text-center font-mono text-subtle py-1"
            style={{ fontSize: "10px", letterSpacing: "0.10em" }}
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
            : "/";
          const dot = dotColor(s);

          const sheetTarget: "fitness" | "run" | null =
            s.session?.type === "run"     ? "run"
            : s.session?.type === "fitness" ? "fitness"
            : s.hasPlan
              ? isFitnessDay              ? "fitness"
                : s.planType === "run"    ? "run"
                : null
              : null;

          const cell = (
            <div
              className="aspect-square flex flex-col items-center justify-center gap-0.5"
              style={{
                background:   s.status === "done" ? "var(--color-neon-08)" : "transparent",
                border:       s.isToday
                                ? "1px solid rgba(255,255,255,0.85)"
                                : "1px solid transparent",
                borderRadius: s.isToday ? "50%" : "10px",
                boxShadow:    s.isToday ? "0 0 8px rgba(255,255,255,0.15)" : "none",
                opacity:      s.isCancelled ? 0.4 : 1,
              }}
            >
              <span
                className="text-xs font-medium leading-none"
                style={{ color: statusColor(s) }}
              >
                {date.getDate()}
              </span>
              {dot && (
                <div className="w-1 h-1 rounded-full" style={{ background: dot }} />
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
    if (!target) return;
    e.preventDefault();
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
    syncFull().then(() => refresh()).catch(() => {});
  }, []);

  useEffect(() => {
    todayMonthRef.current?.scrollIntoView({ behavior: "instant", block: "start" });
  }, []);

  if (!mounted) return null;

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

  const months = getVisibleMonths();

  return (
    <div className="max-w-md mx-auto animate-fade-in px-4 pb-nav">
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
  );
}
```

- [ ] **Vérifier que le lint passe**

```bash
cd /Users/famillemillet/Projects/Maxime_ClaudeCoach && npm run lint
```

Résultat attendu : aucune erreur.

---

## Task 2 : Vérification visuelle

**Fichiers :** aucun

- [ ] **Démarrer le serveur de dev**

```bash
cd /Users/famillemillet/Projects/Maxime_ClaudeCoach && npm run dev
```

Ouvrir `http://localhost:3000/plan`

- [ ] **Vérifier les points suivants**

| Point | Attendu |
|---|---|
| Page s'ouvre | Pas de titre PLAN, pas de toggle, pas de boutons de navigation |
| Scroll initial | Le mois courant est visible sans scroller |
| 7 mois présents | 3 mois passés + courant + 3 futurs, chacun avec son header |
| Headers colonnes | L M M J V S D répétés à chaque mois |
| Aujourd'hui | Cerclé blanc, avec légère glow |
| Jours "done" | Fond neon-08 + chiffre neon + point neon |
| Jours "missed" | Chiffre rouge (`--color-error`) + point rouge foncé |
| Jours run prévus | Chiffre bleu + point bleu |
| Jours fitness prévus | Chiffre orange + point orange |
| Clic sur un jour planifié | Ouvre le bon sheet (fitness ou run) |
| Scroll bas de page | Dernier mois visible sans être masqué par la bottom nav |

---

## Task 3 : Commit

**Fichiers :** `app/plan/page.tsx`

- [ ] **Committer**

```bash
cd /Users/famillemillet/Projects/Maxime_ClaudeCoach && git add app/plan/page.tsx && git commit -m "Refonte page Plan : calendrier scrollable 7 mois, suppression vue hebdo"
```

---

## Self-review

**Couverture spec :**
- ✅ Suppression vue hebdo et toggle
- ✅ Suppression PageHeader et légende
- ✅ 7 mois glissants via `getVisibleMonths()`
- ✅ Scroll vers mois courant via `useEffect` dédié + `scrollIntoView`
- ✅ `MonthSection` composant local dans le même fichier
- ✅ `getDayStatus` et `handleDayClick` inchangés
- ✅ Couleurs alignées sur tokens CSS design system
- ✅ Fond subtil `var(--color-neon-08)` sur jours "done"
- ✅ Anneau blanc + glow sur aujourd'hui
- ✅ `.pb-nav` pour safe area iOS
- ✅ Headers de colonnes répétés par mois
- ✅ Archivo (`font-display`) pour le nom du mois, JetBrains Mono pour les colonnes

**Placeholders :** aucun — tout le code est complet.

**Cohérence des types :** `DayStatus` défini en Task 1 et utilisé dans `MonthSection` et `getDayStatus` de façon cohérente. `handleDayClick` a la même signature dans la prop `MonthSectionProps` et dans `PlanPage`.
