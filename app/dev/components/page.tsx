"use client";

import { useState } from "react";
import Link from "next/link";
import BottomNav, { type BottomNavState } from "@/components/BottomNav";
import { SessionTag } from "@/components/SessionTag";
import type { SessionType, SessionStatus, SessionTagSize } from "@/components/SessionTag";
import Badge from "@/components/Badge";
import { StreakBar } from "@/components/StreakBar";
import { WeekProgram } from "@/components/WeekProgram";
import { SessionCard, FitnessCard } from "@/components/SessionCard";
import { WingLeft, WingRight } from "@/components/RaceBadge";
import { StreakCard } from "@/components/StreakCard";
import { computeStreak } from "@/lib/streak";
import { buildWeekDays } from "@/lib/weekProgram";
import type { DaySlot } from "@/lib/weekProgram";
import { getSessions } from "@/lib/storage";
import { getCoachWorkouts, getCoachRuns } from "@/lib/coachPlan";
import type { WeekStatus } from "@/lib/streak";
import SessionBriefCard from "@/components/SessionBriefCard";
import PlannedExerciseRow from "@/components/PlannedExerciseRow";
import ActiveExerciseCard from "@/components/ActiveExerciseCard";
import ExerciseRowCard from "@/components/ExerciseRowCard";
import type { LiveExercise } from "@/contexts/SessionContext";
import RunPlanClassic from "@/components/RunPlanClassic";
import RunPlanProgressive from "@/components/RunPlanProgressive";
import RunPlanInterval from "@/components/RunPlanInterval";
import RunPlanTempo from "@/components/RunPlanTempo";
import RunPlanSection from "@/components/RunPlanSection";
import { RunCard } from "@/components/SessionCard";
import RunSessionResults from "@/components/RunSessionResults";
import { StravaIcon } from "@/components/icons";
import {
  FIXTURE_RUN_CLASSIC,
  FIXTURE_RUN_INTERVAL,
  FIXTURE_RUN_PROGRESSIVE,
  FIXTURE_RUN_TEMPO,
  FIXTURE_DONE_RUN,
} from "./running-fixtures";
import CoachPlanRunRow from "@/components/coach/CoachPlanRunRow";
import CoachPlanFitnessRow from "@/components/coach/CoachPlanFitnessRow";
import CoachPlanCard from "@/components/coach/CoachPlanCard";
import CoachExerciseDetailModal from "@/components/coach/CoachExerciseDetailModal";
import CoachMessageBubble from "@/components/coach/CoachMessageBubble";
import CoachInputBar from "@/components/coach/CoachInputBar";
import type { CoachRun, CoachWorkout } from "@/lib/coachPlan";

type Section = "atoms" | "semaine" | "streak" | "cartes" | "home" | "nav" | "plan" | "detail" | "seance" | "running" | "coach";

const SECTIONS: { id: Section; label: string; ready: boolean }[] = [
  { id: "atoms",   label: "Atoms",      ready: true },
  { id: "semaine", label: "Semaine",    ready: true },
  { id: "streak",  label: "Streak",     ready: true },
  { id: "cartes",  label: "Cartes",     ready: true },
  { id: "home",    label: "Home",       ready: true },
  { id: "nav",     label: "Nav & CTA",  ready: true },
  { id: "plan",    label: "Plan",       ready: true },
  { id: "detail",  label: "Détail",     ready: true },
  { id: "seance",  label: "Séance",     ready: true },
  { id: "running", label: "Running",    ready: true },
  { id: "coach",   label: "Coach",      ready: true },
];

export default function ComponentsPage() {
  const [active, setActive] = useState<Section>("atoms");
  const [navPreview, setNavPreview] = useState<BottomNavState>("nav");
  const [showcaseDetailWorkout, setShowcaseDetailWorkout] = useState<CoachWorkout | null>(null);
  const [showcaseInput, setShowcaseInput] = useState("");

  return (
    <>
    <div className="min-h-screen p-6 pb-32" style={{ background: "#0d0d0d" }}>

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/dev" className="text-xs press-effect" style={{ color: "#555" }}>
          ← DEV
        </Link>
        <h1 className="font-display text-2xl" style={{ color: "#CDFF00" }}>COMPOSANTS</h1>
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 mb-8 flex-wrap">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => s.ready && setActive(s.id)}
            className="px-4 py-1.5 rounded-full text-xs font-bold press-effect"
            style={{
              background: active === s.id ? "#CDFF00" : "#1a1a1a",
              color:      active === s.id ? "#000"    : s.ready ? "#666" : "#333",
              border:     active === s.id ? "none"    : "1px solid #222",
              cursor:     s.ready ? "pointer" : "default",
            }}
          >
            {s.label}{!s.ready && <span className="ml-1 opacity-40">·</span>}
          </button>
        ))}
      </div>

      {/* ── ATOMS ── */}
      {active === "atoms" && (
        <div className="space-y-10">

          {/* SessionTag */}
          <ComponentBlock title="SessionTag" description="Tag de séance — type × statut × taille">

            {(["run", "fitness", "rest"] as SessionType[]).map((type) => {
              const statuses: SessionStatus[] =
                type === "rest" ? ["planned", "today"] : ["planned", "today", "done", "missed"];
              return (
                <Row key={type} label={type}>
                  {statuses.map((status) => (
                    <Cell key={status} label={status}>
                      <SessionTag type={type} status={status} size="md" />
                    </Cell>
                  ))}
                </Row>
              );
            })}

            <Row label="tailles (run / done)">
              {(["sm", "md", "lg"] as SessionTagSize[]).map((size) => (
                <Cell key={size} label={size}>
                  <SessionTag type="run" status="done" size={size} />
                </Cell>
              ))}
            </Row>
          </ComponentBlock>

          {/* Badge */}
          <ComponentBlock title="Badge" description="Étiquette inline — 4 variantes, 2 tailles">
            <Row label="variantes">
              {(["neon", "orange", "muted", "surface"] as const).map((v) => (
                <Cell key={v} label={v}>
                  <Badge label={v.toUpperCase()} variant={v} />
                </Cell>
              ))}
            </Row>
            <Row label="tailles (neon)">
              {(["sm", "md"] as const).map((s) => (
                <Cell key={s} label={s}>
                  <Badge label="ZONE 2" variant="neon" size={s} />
                </Cell>
              ))}
            </Row>
          </ComponentBlock>

        </div>
      )}

      {/* ── STREAK ── */}
      {active === "streak" && (
        <div className="space-y-10">
          <ComponentBlock title="StreakBar" description="Barre de 8 semaines — données réelles du localStorage">
            <StreakBar streakResult={computeStreak(getSessions(), getCoachWorkouts(), getCoachRuns())} />
          </ComponentBlock>

          <ComponentBlock title="StreakBar — états mockés" description="Toutes les combinaisons de statut">
            {(
              [
                { label: "5 validées + 1 partielle",    weeks: ["empty","empty","validated","validated","validated","validated","validated","partial"] },
                { label: "Streak cassé",                 weeks: ["validated","validated","empty","empty","validated","validated","empty","partial"] },
                { label: "Aucun streak",                 weeks: ["empty","empty","empty","empty","empty","empty","empty","partial"] },
                { label: "Semaines futures",             weeks: ["validated","validated","validated","validated","validated","partial","future","future"] },
              ] as { label: string; weeks: WeekStatus[] }[]
            ).map(({ label, weeks }) => (
              <Row key={label} label={label}>
                <div className="w-full">
                  <StreakBar streakResult={{
                    streakCount: weeks.filter((w, i) => {
                      if (w !== "validated") return false;
                      for (let j = i + 1; j < weeks.length; j++) {
                        if (weeks[j] === "empty") return false;
                      }
                      return true;
                    }).length,
                    weeks: weeks.map((status, i) => ({
                      weekStart: `2026-0${i + 1}-01`,
                      weekEnd:   `2026-0${i + 1}-07`,
                      status,
                      plannedCount: status === "future" ? 0 : 3,
                      doneCount: status === "validated" ? 3 : status === "partial" ? 1 : 0,
                      isCurrent: i === weeks.length - 1,
                    })),
                  }} />
                </div>
              </Row>
            ))}
          </ComponentBlock>
        </div>
      )}

      {/* ── SEMAINE ── */}
      {active === "semaine" && (
        <div className="space-y-10">

          <ComponentBlock title="WeekProgram — données réelles" description="Calculé depuis le localStorage">
            <WeekProgram
              days={buildWeekDays(
                new Date().toISOString().slice(0, 10),
                getCoachWorkouts(),
                getCoachRuns(),
                getSessions(),
              ).days}
              weekLabel={buildWeekDays(
                new Date().toISOString().slice(0, 10),
                getCoachWorkouts(),
                getCoachRuns(),
                getSessions(),
              ).weekLabel}
              onDayClick={(date, type) => alert(`Jour cliqué : ${date} (${type})`)}
            />
          </ComponentBlock>

          <ComponentBlock title="WeekProgram — scénarios mockés" description="Toutes les combinaisons de statut">
            {WEEK_SCENARIOS.map(({ label, days }) => (
              <Row key={label} label={label}>
                <div className="w-full">
                  <WeekProgram
                    days={days}
                    weekLabel="SEMAINE DU 14 AU 20 AVRIL"
                    onDayClick={(date, type) => alert(`Jour cliqué : ${date} (${type})`)}
                  />
                </div>
              </Row>
            ))}
          </ComponentBlock>

        </div>
      )}

      {/* ── CARTES ── */}
      {active === "cartes" && (
        <div className="space-y-8">

          <ComponentBlock title="SessionCard — Fitness planifié (upper)" description="Haut du corps, 6 exos, montée en charge">
            <SessionCard
              todayCoachWorkout={{ id: "1", type: "fitness", date: "2026-05-15", category: "upper", label: "Haut du corps", exercises: Array(6).fill({ name: "Ex", sets: 3, reps: 10, weight: 0 }), durationMin: 60, coachNote: "MONTEE EN CHARGE" }}
              todayCoachRun={null}
              todaySession={null}
              onOpenSession={() => alert("Ouvrir session")}
              onOpenRun={() => {}}
            />
          </ComponentBlock>

          <ComponentBlock title="SessionCard — Fitness complété (lower)" description="Bas du corps fait, 6 exos, décharge">
            <SessionCard
              todayCoachWorkout={{ id: "2", type: "fitness", date: "2026-05-15", category: "lower", label: "Bas du corps", exercises: Array(6).fill({ name: "Ex", sets: 3, reps: 10, weight: 0 }), durationMin: 60, coachNote: "DECHARGE" }}
              todayCoachRun={null}
              todaySession={{ id: "s2", type: "fitness", date: "2026-05-15", category: "lower", exercises: Array(6).fill({ name: "Ex", sets: [], comment: "" }), comment: "", coachWorkoutId: "2" }}
              onOpenSession={() => alert("Ouvrir session")}
              onOpenRun={() => {}}
            />
          </ComponentBlock>

          <ComponentBlock title="SessionCard — COURSE (semi-marathon)" description="21.1 km, 5:10/km — badge ailes dorées, bordure dorée">
            <SessionCard
              todayCoachWorkout={null}
              todayCoachRun={{ id: "r0", type: "run", date: "2026-05-15", label: "Semi-marathon", distanceKm: 21.1, pace: "5:10", durationMin: 110, isRace: true, runType: "course" }}
              todaySession={null}
              onOpenSession={() => {}}
              onOpenRun={() => alert("Ouvrir course")}
            />
          </ComponentBlock>

          <ComponentBlock title="SessionCard — Run planifié (sortie longue)" description="16 km, 90 min, 5:37/km, Zone 2">
            <SessionCard
              todayCoachWorkout={null}
              todayCoachRun={{ id: "r1", type: "run", date: "2026-05-15", label: "Sortie Longue", distanceKm: 16, pace: "5:37", durationMin: 90, runType: "z2" }}
              todaySession={null}
              onOpenSession={() => {}}
              onOpenRun={() => alert("Ouvrir run")}
            />
          </ComponentBlock>

          <ComponentBlock title="SessionCard — Run planifié (fractionné)" description="8.5 km, ~48 min, sans pace, FRACTIONNÉ">
            <SessionCard
              todayCoachWorkout={null}
              todayCoachRun={{ id: "r2", type: "run", date: "2026-05-15", label: "10x400m", distanceKm: 8.5, durationMin: 48, runType: "fractionne" }}
              todaySession={null}
              onOpenSession={() => {}}
              onOpenRun={() => alert("Ouvrir run")}
            />
          </ComponentBlock>

          <ComponentBlock title="SessionCard — Run complété" description="Run fait : 16.2 km, 5:41/km">
            <SessionCard
              todayCoachWorkout={null}
              todayCoachRun={{ id: "r3", type: "run", date: "2026-05-15", label: "Sortie Longue", distanceKm: 16, pace: "5:37", durationMin: 90, runType: "z2" }}
              todaySession={{ id: "s3", type: "run", date: "2026-05-15T08:30:00", distanceKm: 16.2, durationSeconds: 5530, avgPaceSecPerKm: 341, comment: "" }}
              onOpenSession={() => {}}
              onOpenRun={() => alert("Ouvrir run")}
            />
          </ComponentBlock>

          <ComponentBlock title="SessionCard — Repos" description="Aucune séance planifiée">
            <SessionCard
              todayCoachWorkout={null}
              todayCoachRun={null}
              todaySession={null}
              onOpenSession={() => {}}
              onOpenRun={() => {}}
            />
          </ComponentBlock>

        </div>
      )}

      {/* ── PLAN ── */}
      {active === "plan" && (
        <div className="space-y-10">

          <ComponentBlock title="Cellule jour — tous les états" description="Couleur du chiffre selon le statut du jour">
            <Row label="fitness">
              {PLAN_DAY_STATES.filter(d => d.group === "fitness").map(({ label, color, ring }) => (
                <Cell key={label} label={label}>
                  <PlanDayCell day={18} color={color} ring={ring} />
                </Cell>
              ))}
            </Row>
            <Row label="run">
              {PLAN_DAY_STATES.filter(d => d.group === "run").map(({ label, color, ring }) => (
                <Cell key={label} label={label}>
                  <PlanDayCell day={18} color={color} ring={ring} />
                </Cell>
              ))}
            </Row>
            <Row label="course (isRace)">
              {PLAN_DAY_STATES.filter(d => d.group === "course").map(({ label, color, raceRing }) => (
                <Cell key={label} label={label}>
                  <PlanDayCell day={18} color={color} raceRing={raceRing} />
                </Cell>
              ))}
            </Row>
            <Row label="repos / commun">
              {PLAN_DAY_STATES.filter(d => d.group === "rest").map(({ label, color, ring, cancelled }) => (
                <Cell key={label} label={label}>
                  <PlanDayCell day={18} color={color} ring={ring} cancelled={cancelled} />
                </Cell>
              ))}
            </Row>
          </ComponentBlock>

          <ComponentBlock title="Grille mois" description="Rendu calendaire — structure réelle de /plan">
            <div className="w-full">
              <PlanMonthMock />
            </div>
          </ComponentBlock>

        </div>
      )}

      {/* ── DÉTAIL SÉANCE ── */}
      {active === "detail" && (
        <div className="space-y-10">

          {/* FitnessCard — variant embedded */}
          <ComponentBlock title="FitnessCard — variant embedded" description="Affichée dans le sheet de détail — sans &laquo; Voir le détail &raquo;">
            <FitnessCard
              todayCoachWorkout={{ id: "1", type: "fitness", date: "2026-05-21", category: "upper", label: "Haut du corps", exercises: Array(6).fill({ name: "Ex", sets: 3, reps: 10, weight: 0 }), durationMin: 60, coachNote: "MONTEE EN CHARGE" }}
              todaySession={null}
              onOpenSession={() => {}}
              variant="embedded"
            />
          </ComponentBlock>

          {/* SessionBriefCard */}
          <div className="space-y-4">
            <div>
              <p className="font-display text-xl" style={{ color: "#fff" }}>SessionBriefCard</p>
              <p className="text-xs mt-0.5" style={{ color: "#444" }}>Mot du coach pré-séance — cachée si pas de brief</p>
            </div>
            <div className="rounded-2xl px-3 py-4 space-y-3" style={{ background: "#0a0a0a" }}>
              <p className="text-[10px] uppercase tracking-widest" style={{ color: "#444" }}>alimentée</p>
              <SessionBriefCard brief="Montée en charge sur le développé haltères, le rowing assis et le tirage vertical. C'est ta séance la plus exigeante de la semaine — elle est là pour ça. On y va." />
              <p className="text-[10px] uppercase tracking-widest pt-2" style={{ color: "#444" }}>vide (return null)</p>
              <div
                className="rounded-xl px-3 py-2 text-xs"
                style={{ background: "#111", border: "1px dashed #2a2a2a", color: "#333" }}
              >
                SessionBriefCard sans brief → invisible (ce bloc est un indicateur dev)
              </div>
            </div>
          </div>

          {/* PlannedExerciseRow */}
          <div className="space-y-4">
            <div>
              <p className="font-display text-xl" style={{ color: "#fff" }}>PlannedExerciseRow</p>
              <p className="text-xs mt-0.5" style={{ color: "#444" }}>Exercice planifié — état lecture seule, pills vides</p>
            </div>
            <div className="rounded-2xl px-3 py-4 space-y-2" style={{ background: "#0a0a0a" }}>
              <PlannedExerciseRow name="Développé haltères" sets={4} reps={8} weight={22} />
              <PlannedExerciseRow name="Rowing assis" sets={4} reps={8} weight={42} />
              <PlannedExerciseRow name="Tirage vertical" sets={3} reps={10} weight={60} />
              <PlannedExerciseRow name="Curl biceps" sets={3} reps={12} weight={14} />
            </div>
          </div>

        </div>
      )}

      {/* ── NAV & CTA ── */}
      {active === "nav" && (
        <div className="space-y-6 pb-48">
          <ComponentBlock title="BottomNav" description="2 états — tab bar fixe toutes pages">
            <Row label="état affiché">
              <div className="flex gap-2 flex-wrap">
                {(["nav", "hidden"] as BottomNavState[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setNavPreview(s)}
                    className="px-4 py-2 rounded-full text-xs font-bold press-effect"
                    style={{
                      background: navPreview === s ? "#CDFF00" : "#1a1a1a",
                      color:      navPreview === s ? "#000"    : "#666",
                      border:     navPreview === s ? "none"    : "1px solid #222",
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </Row>
            <Row label="description">
              <p className="text-xs" style={{ color: "#555" }}>
                {navPreview === "nav"    && "Nav classique — pages Home / Plan / Stats / Coach"}
                {navPreview === "hidden" && "Invisible — quand une sheet modale est ouverte"}
              </p>
            </Row>
          </ComponentBlock>

        </div>
      )}

      {/* ── HOME ── */}
      {active === "home" && (
        <div className="space-y-8">
          <ComponentBlock title="StreakCard — données réelles" description="Calculé depuis le localStorage">
            <StreakCard streakResult={computeStreak(getSessions(), getCoachWorkouts(), getCoachRuns())} />
          </ComponentBlock>
          <ComponentBlock title="StreakCard — 6 semaines (mocké)" description="Streak en cours">
            <StreakCard streakResult={{
              streakCount: 6,
              weeks: [
                { weekStart: "2026-03-09", weekEnd: "2026-03-15", status: "empty",     plannedCount: 3, doneCount: 0, isCurrent: false },
                { weekStart: "2026-03-16", weekEnd: "2026-03-22", status: "empty",     plannedCount: 3, doneCount: 0, isCurrent: false },
                { weekStart: "2026-03-23", weekEnd: "2026-03-29", status: "validated", plannedCount: 3, doneCount: 3, isCurrent: false },
                { weekStart: "2026-03-30", weekEnd: "2026-04-05", status: "validated", plannedCount: 3, doneCount: 3, isCurrent: false },
                { weekStart: "2026-04-06", weekEnd: "2026-04-12", status: "validated", plannedCount: 3, doneCount: 3, isCurrent: false },
                { weekStart: "2026-04-13", weekEnd: "2026-04-19", status: "validated", plannedCount: 3, doneCount: 3, isCurrent: false },
                { weekStart: "2026-04-20", weekEnd: "2026-04-26", status: "validated", plannedCount: 3, doneCount: 3, isCurrent: false },
                { weekStart: "2026-04-27", weekEnd: "2026-05-03", status: "validated", plannedCount: 3, doneCount: 2, isCurrent: true  },
              ],
            }} />
          </ComponentBlock>
          <ComponentBlock title="StreakCard — 0 semaine" description="Aucun streak">
            <StreakCard streakResult={{
              streakCount: 0,
              weeks: Array(8).fill(null).map((_, i) => ({
                weekStart: `2026-03-${9 + i * 7}`, weekEnd: `2026-03-${15 + i * 7}`,
                status: (i === 7 ? "partial" : "empty") as "partial" | "empty",
                plannedCount: 3, doneCount: 0, isCurrent: i === 7,
              })),
            }} />
          </ComponentBlock>
        </div>
      )}

      {/* ── SÉANCE ── */}
      {active === "seance" && (
        <div className="space-y-8">

          <SectionLabel title="ActiveExerciseCard" description="Exercice en cours — 2 séries validées, 1 active, 1 à faire" />
          <ActiveExerciseCard exercise={MOCK_EXERCISE} onOpenNote={() => alert("Ouvrir la note")} />

          <SectionLabel title="ActiveExerciseCard — notes" description="Avec note coach + commentaire utilisateur" />
          <ActiveExerciseCard exercise={MOCK_EXERCISE_WITH_NOTE} onOpenNote={() => alert("Ouvrir la note")} />

          <SectionLabel title="ExerciseRowCard" description="3 variants : planned / upcoming / completed" />
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-widest" style={{ color: "#444" }}>planned</p>
            <ExerciseRowCard name="Rowing assis" sets={4} reps={8} weight={42} variant="planned" />
            <p className="text-[10px] uppercase tracking-widest pt-2" style={{ color: "#444" }}>upcoming</p>
            <ExerciseRowCard name="Tirage vertical" sets={3} reps={10} weight={60} variant="upcoming" onTap={() => alert("tap")} />
            <p className="text-[10px] uppercase tracking-widest pt-2" style={{ color: "#444" }}>completed</p>
            <ExerciseRowCard name="Curl biceps" sets={3} reps={12} weight={14} variant="completed" onTap={() => alert("tap")} />
          </div>

        </div>
      )}

      {/* ═══════════════ COACH ═══════════════ */}
      {active === "coach" && (
        <div className="space-y-12">

          <ComponentBlock title="CoachPlanRunRow — tous types" description="Z2 · Tempo · Fractionné · Progressif · Course">
            <div style={{ background: "var(--color-surface-2)", borderRadius: 16, padding: "12px 16px" }}>
              <CoachPlanRunRow plan={COACH_RUN_Z2} />
              <hr style={{ border: "none", borderTop: "1px solid var(--color-white-06)", margin: 0 }} />
              <CoachPlanRunRow plan={COACH_RUN_TEMPO} />
              <hr style={{ border: "none", borderTop: "1px solid var(--color-white-06)", margin: 0 }} />
              <CoachPlanRunRow plan={COACH_RUN_FRACTIONNE} />
              <hr style={{ border: "none", borderTop: "1px solid var(--color-white-06)", margin: 0 }} />
              <CoachPlanRunRow plan={COACH_RUN_PROGRESSIF} />
              <hr style={{ border: "none", borderTop: "1px solid var(--color-white-06)", margin: 0 }} />
              <CoachPlanRunRow plan={COACH_RUN_COURSE} />
            </div>
          </ComponentBlock>

          <ComponentBlock title="CoachPlanFitnessRow" description="Ligne d'une séance fitness avec bouton Détail">
            <div style={{ background: "var(--color-surface-2)", borderRadius: 16, padding: "12px 16px" }}>
              <CoachPlanFitnessRow plan={FIXTURE_FITNESS} onDetailClick={setShowcaseDetailWorkout} />
              <hr style={{ border: "none", borderTop: "1px solid var(--color-white-06)", margin: 0 }} />
              <CoachPlanFitnessRow plan={FIXTURE_FITNESS_2} onDetailClick={setShowcaseDetailWorkout} />
            </div>
          </ComponentBlock>

          <ComponentBlock title="CoachPlanCard — run (état normal)" description="Z2 + fractionné, boutons Adapter / Valider">
            <CoachPlanCard
              plans={[COACH_RUN_Z2, COACH_RUN_FRACTIONNE]}
              onApply={() => {}}
              onAdapt={() => {}}
              onDetailClick={setShowcaseDetailWorkout}
            />
          </ComponentBlock>

          <ComponentBlock title="CoachPlanCard — run (tous types)" description="Les 5 types en une seule semaine">
            <CoachPlanCard
              plans={[COACH_RUN_Z2, COACH_RUN_TEMPO, COACH_RUN_FRACTIONNE, COACH_RUN_PROGRESSIF, COACH_RUN_COURSE]}
              onApply={() => {}}
              onAdapt={() => {}}
              onDetailClick={setShowcaseDetailWorkout}
            />
          </ComponentBlock>

          <ComponentBlock title="CoachPlanCard — fitness (état normal)" description="Upper + lower, boutons Adapter / Valider">
            <CoachPlanCard
              plans={[FIXTURE_FITNESS, FIXTURE_FITNESS_2]}
              onApply={() => {}}
              onAdapt={() => {}}
              onDetailClick={setShowcaseDetailWorkout}
            />
          </ComponentBlock>

          <ComponentBlock title="CoachPlanCard — en cours d'application" description="État pendant applyPendingPlans (run)">
            <CoachPlanCard
              plans={[COACH_RUN_Z2, COACH_RUN_FRACTIONNE]}
              applying
              onApply={() => {}}
              onAdapt={() => {}}
              onDetailClick={setShowcaseDetailWorkout}
            />
          </ComponentBlock>

          <ComponentBlock title="CoachPlanCard — validée (running)" description="Même structure, bordure neon, sans boutons">
            <CoachPlanCard
              plans={[COACH_RUN_Z2, COACH_RUN_FRACTIONNE]}
              validated
              onApply={() => {}}
              onAdapt={() => {}}
              onDetailClick={setShowcaseDetailWorkout}
            />
          </ComponentBlock>

          <ComponentBlock title="CoachPlanCard — validée (fitness)" description="Même structure, bordure neon, sans boutons">
            <CoachPlanCard
              plans={[FIXTURE_FITNESS, FIXTURE_FITNESS_2]}
              validated
              onApply={() => {}}
              onAdapt={() => {}}
              onDetailClick={setShowcaseDetailWorkout}
            />
          </ComponentBlock>

          <ComponentBlock title="CoachMessageBubble — message user" description="Bulle grise alignée à droite">
            <CoachMessageBubble
              message={FIXTURE_MSG_USER}
              applying={false}
              onApply={() => {}}
              onAdapt={() => {}}
            />
          </ComponentBlock>

          <ComponentBlock title="CoachMessageBubble — texte coach sans plans" description="Texte libre sans bulle, pas de label ALEX">
            <CoachMessageBubble
              message={FIXTURE_MSG_COACH_TEXT}
              applying={false}
              onApply={() => {}}
              onAdapt={() => {}}
            />
          </ComponentBlock>

          <ComponentBlock title="CoachMessageBubble — avec plans pending" description="Texte + CoachPlanCard avec run + fitness">
            <CoachMessageBubble
              message={FIXTURE_MSG_COACH_WITH_PLANS}
              applying={false}
              onApply={() => {}}
              onAdapt={() => {}}
            />
          </ComponentBlock>

          <ComponentBlock title="CoachMessageBubble — plans validés" description="Badge Programme appliqué ✓ avec bordure lime">
            <CoachMessageBubble
              message={FIXTURE_MSG_COACH_VALIDATED}
              applying={false}
              onApply={() => {}}
              onAdapt={() => {}}
            />
          </ComponentBlock>

          <ComponentBlock title="CoachInputBar" description="Barre d'input pill shape — bouton orange si texte présent">
            <div className="-mx-6">
              <CoachInputBar
                value={showcaseInput}
                sending={false}
                textareaRef={{ current: null } as React.RefObject<HTMLTextAreaElement>}
                onChange={setShowcaseInput}
                onSend={() => setShowcaseInput("")}
              />
            </div>
          </ComponentBlock>

          {/* Modale détail — déclenchée par onDetailClick dans les composants ci-dessus */}
          <CoachExerciseDetailModal
            workout={showcaseDetailWorkout}
            onClose={() => setShowcaseDetailWorkout(null)}
          />

        </div>
      )}

      {/* ── RUNNING ── */}
      {active === "running" && (
        <div className="space-y-10">

          {/* RunPlanClassic */}
          <ComponentBlock title="RunPlanClassic" description="Sortie classique Z2/course — 3 cartes stats">
            <RunPlanClassic coachRun={FIXTURE_RUN_CLASSIC} />
          </ComponentBlock>

          {/* RunPlanProgressive */}
          <ComponentBlock title="RunPlanProgressive" description="Séance progressive — zones empilées Z2/Z3/Z4">
            <RunPlanProgressive coachRun={FIXTURE_RUN_PROGRESSIVE} />
          </ComponentBlock>

          {/* RunPlanInterval */}
          <ComponentBlock title="RunPlanInterval" description="Fractionné — échauffement + bloc reps + retour au calme">
            <RunPlanInterval coachRun={FIXTURE_RUN_INTERVAL} />
          </ComponentBlock>

          {/* RunPlanTempo */}
          <ComponentBlock title="RunPlanTempo" description="Tempo — échauffement + bloc tempo highlighté + récup">
            <RunPlanTempo coachRun={FIXTURE_RUN_TEMPO} />
          </ComponentBlock>

          {/* RunPlanSection — routeur */}
          <ComponentBlock title="RunPlanSection" description="Routeur — teste les 4 types">
            <div className="space-y-6">
              <div>
                <p className="text-xs mb-2" style={{ color: "#555" }}>z2 (classic)</p>
                <RunPlanSection coachRun={FIXTURE_RUN_CLASSIC} />
              </div>
              <div>
                <p className="text-xs mb-2" style={{ color: "#555" }}>fractionne</p>
                <RunPlanSection coachRun={FIXTURE_RUN_INTERVAL} />
              </div>
              <div>
                <p className="text-xs mb-2" style={{ color: "#555" }}>progressif</p>
                <RunPlanSection coachRun={FIXTURE_RUN_PROGRESSIVE} />
              </div>
              <div>
                <p className="text-xs mb-2" style={{ color: "#555" }}>tempo</p>
                <RunPlanSection coachRun={FIXTURE_RUN_TEMPO} />
              </div>
            </div>
          </ComponentBlock>

          {/* RunCard (variant embedded — hero dans RunSheet) */}
          <ComponentBlock title="RunCard (embedded)" description="Carte hero de RunSheet — même composant que la home, sans 'Voir le détail'">
            <div className="space-y-4">
              <p className="text-xs" style={{ color: "#555" }}>Prévu — z2</p>
              <RunCard todayCoachRun={FIXTURE_RUN_CLASSIC} todaySession={null} onOpenRun={() => {}} variant="embedded" />
              <p className="text-xs" style={{ color: "#555" }}>Prévu — fractionné</p>
              <RunCard todayCoachRun={FIXTURE_RUN_INTERVAL} todaySession={null} onOpenRun={() => {}} variant="embedded" />
              <p className="text-xs" style={{ color: "#555" }}>Post-sync (doneSession)</p>
              <RunCard todayCoachRun={FIXTURE_RUN_CLASSIC} todaySession={FIXTURE_DONE_RUN} onOpenRun={() => {}} variant="embedded" />
            </div>
          </ComponentBlock>

          {/* RunSessionResults */}
          <ComponentBlock title="RunSessionResults" description="Tableau fractions/tours avec dénivelé et ligne Total">
            <RunSessionResults session={FIXTURE_DONE_RUN} />
          </ComponentBlock>

          {/* Strava Sync CTA */}
          <ComponentBlock title="Strava Sync CTA" description="Bouton de synchronisation Strava — même composant pour import initial et sync post-séance">
            <div className="space-y-3">
              <p className="text-xs" style={{ color: "#555" }}>État par défaut</p>
              <button
                className="w-full flex items-center justify-center gap-2.5"
                style={{ background: "#FC4C02", borderRadius: "12px", padding: "15px 20px", fontWeight: 600, fontSize: "15px", color: "white" }}
              >
                <StravaIcon size={20} />
                Sync Strava
              </button>
              <p className="text-xs" style={{ color: "#555" }}>Mode dev (simulé)</p>
              <button
                className="w-full flex items-center justify-center gap-2.5"
                style={{ background: "#FC4C02", borderRadius: "12px", padding: "15px 20px", fontWeight: 600, fontSize: "15px", color: "white" }}
              >
                <StravaIcon size={20} />
                Simuler synchro (dev)
              </button>
              <p className="text-xs" style={{ color: "#555" }}>En cours</p>
              <button
                disabled
                className="w-full flex items-center justify-center gap-2.5"
                style={{ background: "#7a2500", borderRadius: "12px", padding: "15px 20px", fontWeight: 600, fontSize: "15px", color: "white", opacity: 0.7 }}
              >
                Recherche en cours…
              </button>
            </div>
          </ComponentBlock>

          {/* Strava CTA — pièces jointes */}
          <ComponentBlock title="Strava CTA — pièces jointes" description="Chips au-dessus du CTA — 3 états : note seule, image seule, note + image">
            <div className="space-y-6">

              <div>
                <p className="text-xs mb-3" style={{ color: "#555" }}>Note seule</p>
                <div style={{ background: "var(--color-background)", borderRadius: 16, padding: "12px 16px" }}>
                  <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" as const }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 20, padding: "5px 8px 5px 10px", fontSize: 12, color: "#ddd" }}>
                      <span>📝 &ldquo;Jambes lourdes dès le km 8…&rdquo;</span>
                      <div style={{ width: 16, height: 16, borderRadius: "50%", background: "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#aaa" }}>✕</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 12 }}>
                    <div style={{ width: 56, height: 56, borderRadius: 14, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
                    </div>
                    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, background: "#FC4C02", borderRadius: 12, padding: "15px 20px", fontWeight: 600, fontSize: 15, color: "white" }}>
                      <StravaIcon size={20} />
                      Sync Strava
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs mb-3" style={{ color: "#555" }}>Image seule</p>
                <div style={{ background: "var(--color-background)", borderRadius: 16, padding: "12px 16px" }}>
                  <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" as const }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 20, padding: "4px 8px 4px 4px", fontSize: 12, color: "#ddd" }}>
                      <div style={{ width: 22, height: 22, borderRadius: 4, background: "linear-gradient(135deg, #1e3a2f, #2a4a3f)", flexShrink: 0 }} />
                      <span>photo_run.jpg</span>
                      <div style={{ width: 16, height: 16, borderRadius: "50%", background: "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#aaa" }}>✕</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 12 }}>
                    <div style={{ width: 56, height: 56, borderRadius: 14, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
                    </div>
                    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, background: "#FC4C02", borderRadius: 12, padding: "15px 20px", fontWeight: 600, fontSize: 15, color: "white" }}>
                      <StravaIcon size={20} />
                      Sync Strava
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs mb-3" style={{ color: "#555" }}>Note + image</p>
                <div style={{ background: "var(--color-background)", borderRadius: 16, padding: "12px 16px" }}>
                  <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" as const }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 20, padding: "4px 8px 4px 4px", fontSize: 12, color: "#ddd" }}>
                      <div style={{ width: 22, height: 22, borderRadius: 4, background: "linear-gradient(135deg, #1e3a2f, #2a4a3f)", flexShrink: 0 }} />
                      <span>photo_run.jpg</span>
                      <div style={{ width: 16, height: 16, borderRadius: "50%", background: "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#aaa" }}>✕</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 20, padding: "5px 8px 5px 10px", fontSize: 12, color: "#ddd" }}>
                      <span>📝 &ldquo;Jambes lourdes dès le km 8…&rdquo;</span>
                      <div style={{ width: 16, height: 16, borderRadius: "50%", background: "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#aaa" }}>✕</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 12 }}>
                    <div style={{ width: 56, height: 56, borderRadius: 14, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
                    </div>
                    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, background: "#FC4C02", borderRadius: 12, padding: "15px 20px", fontWeight: 600, fontSize: 15, color: "white" }}>
                      <StravaIcon size={20} />
                      Sync Strava
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </ComponentBlock>

        </div>
      )}

    </div>

    <BottomNav state={active === "nav" ? navPreview : "nav"} />
    </>
  );
}

// ── Coach fixtures ────────────────────────────────────────────────────────────

const COACH_RUN_Z2: CoachRun = {
  id: "cr-z2",
  type: "run",
  date: new Date(Date.now() + 1 * 86400000).toISOString(),
  label: "ENDURANCE Z2",
  distanceKm: 10,
  pace: "5:45",
  durationMin: 58,
  targetZone: "Z2",
  runType: "z2",
};

const COACH_RUN_TEMPO: CoachRun = {
  id: "cr-tempo",
  type: "run",
  date: new Date(Date.now() + 2 * 86400000).toISOString(),
  label: "TEMPO",
  distanceKm: 8,
  durationMin: 42,
  runType: "tempo",
};

const COACH_RUN_FRACTIONNE: CoachRun = {
  id: "cr-fractionne",
  type: "run",
  date: new Date(Date.now() + 3 * 86400000).toISOString(),
  label: "FRACTIONNÉ",
  distanceKm: 10,
  durationMin: 55,
  runType: "fractionne",
  intervals: [{ distanceKm: 0.4, reps: 8, pace: "4:30", restSeconds: 90 }],
};

const COACH_RUN_PROGRESSIF: CoachRun = {
  id: "cr-progressif",
  type: "run",
  date: new Date(Date.now() + 4 * 86400000).toISOString(),
  label: "PROGRESSIF",
  distanceKm: 15,
  durationMin: 90,
  targetZone: "Z2>Z4",
  runType: "progressif",
};

const COACH_RUN_COURSE: CoachRun = {
  id: "cr-course",
  type: "run",
  date: new Date(Date.now() + 6 * 86400000).toISOString(),
  label: "SEMI-MARATHON",
  distanceKm: 21.1,
  durationMin: 109,
  isRace: true,
  runType: "course",
};

const FIXTURE_FITNESS: CoachWorkout = {
  id: "f1",
  type: "fitness",
  date: new Date(Date.now() + 1 * 86400000).toISOString(),
  category: "upper",
  label: "Haut du corps",
  exercises: [
    { name: "Développé couché", sets: 4, reps: 8, weight: 70, restSeconds: 90 },
    { name: "Rowing haltère", sets: 3, reps: 10, weight: 20, coachNote: "Contrôle la descente" },
    { name: "Curl biceps", sets: 3, reps: 12, weight: 12 },
  ],
};

const FIXTURE_FITNESS_2: CoachWorkout = {
  id: "f2",
  type: "fitness",
  date: new Date(Date.now() + 3 * 86400000).toISOString(),
  category: "lower",
  label: "Bas du corps",
  exercises: [
    { name: "Squat", sets: 4, reps: 6, weight: 80 },
    { name: "Fentes", sets: 3, reps: 10, weight: 0 },
  ],
};

// ChatMessage-like pour CoachMessageBubble
const FIXTURE_MSG_USER = {
  id: "m1",
  role: "user" as const,
  content: "Propose-moi une semaine running équilibrée",
  timestamp: new Date().toISOString(),
};

const FIXTURE_MSG_COACH_TEXT = {
  id: "m2",
  role: "assistant" as const,
  content: "Voilà une semaine bien structurée pour progresser en endurance tout en ménageant ta récupération.",
  timestamp: new Date().toISOString(),
};

const FIXTURE_MSG_COACH_WITH_PLANS = {
  id: "m3",
  role: "assistant" as const,
  content: "Je te propose ces séances pour la semaine :",
  timestamp: new Date().toISOString(),
  card: { plans: [COACH_RUN_Z2, FIXTURE_FITNESS], deleteIds: [], status: "pending" as const },
};

const FIXTURE_MSG_COACH_VALIDATED = {
  id: "m4",
  role: "assistant" as const,
  content: "Programme mis à jour !",
  timestamp: new Date().toISOString(),
  modifiedCount: 2,
};

// ── Séance mock data ──────────────────────────────────────────────────────────

const MOCK_EXERCISE: LiveExercise = {
  id: "dev-mock",
  name: "Développé haltères",
  sets: 4,
  reps: 8,
  weight: 22,
  comment: "",
  setLogs: [
    { reps: 8, weight: 22, done: true },
    { reps: 8, weight: 24, done: true },
    { reps: 8, weight: 24, done: false },
    { reps: 8, weight: 24, done: false },
  ],
};

const MOCK_EXERCISE_WITH_NOTE: LiveExercise = {
  id: "dev-mock-note",
  name: "Rowing assis",
  sets: 4,
  reps: 8,
  weight: 42,
  comment: "Bien garder le dos droit",
  coachNote: "Progresser si tu te sens fort",
  setLogs: [
    { reps: 8, weight: 42, done: true },
    { reps: 8, weight: 42, done: false },
    { reps: 8, weight: 42, done: false },
    { reps: 8, weight: 42, done: false },
  ],
};

// ── WeekProgram mock scenarios ────────────────────────────────────────────────

function mockDay(i: number, type: DaySlot["type"], status: DaySlot["status"], isToday = false): DaySlot {
  const letters = ["L", "M", "M", "J", "V", "S", "D"];
  return { date: `2026-04-${14 + i}`, letter: letters[i], type, status, isToday };
}

const WEEK_SCENARIOS: { label: string; days: DaySlot[] }[] = [
  {
    label: "semaine type (fitness + run + repos)",
    days: [
      mockDay(0, "rest",    "planned"),
      mockDay(1, "fitness", "done"),
      mockDay(2, "run",     "done"),
      mockDay(3, "rest",    "planned"),
      mockDay(4, "fitness", "today", true),
      mockDay(5, "rest",    "planned"),
      mockDay(6, "run",     "planned"),
    ],
  },
  {
    label: "semaine avec séances manquées",
    days: [
      mockDay(0, "fitness", "missed"),
      mockDay(1, "rest",    "planned"),
      mockDay(2, "run",     "missed"),
      mockDay(3, "fitness", "missed"),
      mockDay(4, "rest",    "today", true),
      mockDay(5, "run",     "planned"),
      mockDay(6, "fitness", "planned"),
    ],
  },
  {
    label: "semaine tout repos",
    days: [
      mockDay(0, "rest", "planned"),
      mockDay(1, "rest", "planned"),
      mockDay(2, "rest", "today", true),
      mockDay(3, "rest", "planned"),
      mockDay(4, "rest", "planned"),
      mockDay(5, "rest", "planned"),
      mockDay(6, "rest", "planned"),
    ],
  },
];

// ── Plan mock data ────────────────────────────────────────────────────────────

const RACE_COLOR_MOCK = "#FEED00";

const PLAN_DAY_STATES: {
  label: string;
  group: "fitness" | "run" | "rest" | "course";
  color: string;
  ring?: boolean;
  raceRing?: boolean;
  cancelled?: boolean;
}[] = [
  { label: "done",          group: "fitness", color: "var(--color-neon)" },
  { label: "missed",        group: "fitness", color: "var(--color-error)" },
  { label: "upcoming",      group: "fitness", color: "var(--color-orange)" },
  { label: "today-planned", group: "fitness", color: "var(--color-orange)", ring: true },
  { label: "done",          group: "run",     color: "var(--color-neon)" },
  { label: "missed",        group: "run",     color: "var(--color-error)" },
  { label: "upcoming",      group: "run",     color: "var(--color-blue)" },
  { label: "today-planned", group: "run",     color: "var(--color-blue)", ring: true },
  { label: "upcoming",      group: "course",  color: RACE_COLOR_MOCK, raceRing: true },
  { label: "today",         group: "course",  color: RACE_COLOR_MOCK, raceRing: true },
  { label: "done",          group: "course",  color: "var(--color-neon)" },
  { label: "today-rest",    group: "rest",    color: "var(--color-muted)", ring: true },
  { label: "rest",          group: "rest",    color: "var(--color-muted)" },
  { label: "annulé",        group: "rest",    color: "var(--color-orange)", cancelled: true },
];

function PlanDayCell({
  day,
  color,
  ring,
  raceRing,
  cancelled,
}: {
  day: number;
  color: string;
  ring?: boolean;
  raceRing?: boolean;
  cancelled?: boolean;
}) {
  return (
    <div
      className="aspect-square flex items-center justify-center"
      style={{ opacity: cancelled ? 0.4 : 1, width: 36, height: 36 }}
    >
      {raceRing ? (
        <div className="flex items-center justify-center" style={{ gap: 3, color: RACE_COLOR_MOCK }}>
          <WingLeft size={6} />
          <span className="text-xs font-medium leading-none" style={{ color: RACE_COLOR_MOCK }}>{day}</span>
          <WingRight size={6} />
        </div>
      ) : (
        <div
          className="w-7 h-7 flex items-center justify-center rounded-full border border-transparent"
          style={ring ? { border: "1px solid var(--color-white-85)", boxShadow: "0 0 8px var(--color-white-15)" } : undefined}
        >
          <span className="text-xs font-medium leading-none" style={{ color }}>{day}</span>
        </div>
      )}
    </div>
  );
}

const GRID_HEADERS_MOCK = ["LUN.", "MAR.", "MER.", "JEU.", "VEN.", "SAM.", "DIM."];

// Grille mai 2026 avec statuts représentatifs
const PLAN_MONTH_CELLS: { day: number | null; color: string; ring?: boolean; raceRing?: boolean; cancelled?: boolean }[] = [
  { day: null,  color: "" },
  { day: null,  color: "" },
  { day: null,  color: "" },
  { day: null,  color: "" },
  { day: 1,     color: "var(--color-muted)" },
  { day: 2,     color: "var(--color-muted)" },
  { day: 3,     color: "var(--color-muted)" },
  { day: 4,     color: "var(--color-muted)" },
  { day: 5,     color: "var(--color-neon)" },
  { day: 6,     color: "var(--color-neon)" },
  { day: 7,     color: "var(--color-muted)" },
  { day: 8,     color: "var(--color-neon)" },
  { day: 9,     color: "var(--color-error)" },
  { day: 10,    color: "var(--color-muted)" },
  { day: 11,    color: "var(--color-muted)" },
  { day: 12,    color: "var(--color-neon)" },
  { day: 13,    color: "var(--color-neon)" },
  { day: 14,    color: "var(--color-muted)" },
  { day: 15,    color: "var(--color-error)" },
  { day: 16,    color: "var(--color-error)" },
  { day: 17,    color: "var(--color-muted)" },
  { day: 18,    color: "var(--color-orange)", ring: true },
  { day: 19,    color: "var(--color-blue)" },
  { day: 20,    color: "var(--color-muted)" },
  { day: 21,    color: "var(--color-muted)" },
  { day: 22,    color: "var(--color-orange)" },
  { day: 23,    color: "var(--color-muted)" },
  { day: 24,    color: "var(--color-blue)" },
  { day: 25,    color: RACE_COLOR_MOCK, raceRing: true },
  { day: 26,    color: "var(--color-orange)", cancelled: true },
  { day: 27,    color: "var(--color-muted)" },
  { day: 28,    color: "var(--color-orange)" },
  { day: 29,    color: "var(--color-muted)" },
  { day: 30,    color: "var(--color-blue)" },
  { day: 31,    color: "var(--color-muted)" },
];

function PlanMonthMock() {
  return (
    <div>
      <div
        className="font-display font-bold mb-3"
        style={{ fontSize: "20px", lineHeight: "22px", letterSpacing: "-0.43px", color: "var(--color-white-65)" }}
      >
        mai 2026
      </div>
      <div className="grid grid-cols-7 mb-1">
        {GRID_HEADERS_MOCK.map((h) => (
          <div
            key={h}
            className="text-center font-mono font-bold text-subtle py-1"
            style={{ fontSize: "12px", letterSpacing: "0.10em" }}
          >
            {h}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {PLAN_MONTH_CELLS.map((cell, i) =>
          cell.day === null ? (
            <div key={`pad-${i}`} />
          ) : (
            <div
              key={cell.day}
              className="aspect-square flex items-center justify-center"
              style={{ opacity: cell.cancelled ? 0.4 : 1 }}
            >
              {cell.raceRing ? (
                <div className="flex items-center justify-center" style={{ gap: 3, color: RACE_COLOR_MOCK }}>
                  <WingLeft size={6} />
                  <span className="text-xs font-medium leading-none" style={{ color: RACE_COLOR_MOCK }}>{cell.day}</span>
                  <WingRight size={6} />
                </div>
              ) : (
                <div
                  className="w-7 h-7 flex items-center justify-center rounded-full border border-transparent"
                  style={cell.ring ? { border: "1px solid var(--color-white-85)", boxShadow: "0 0 8px var(--color-white-15)" } : undefined}
                >
                  <span className="text-xs font-medium leading-none" style={{ color: cell.color }}>{cell.day}</span>
                </div>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}

// ── Layout helpers ─────────────────────────────────────────────────────────────

function ComponentBlock({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="font-display text-xl" style={{ color: "#fff" }}>{title}</p>
        <p className="text-xs mt-0.5" style={{ color: "#444" }}>{description}</p>
      </div>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] uppercase tracking-widest" style={{ color: "#444" }}>{label}</p>
      <div className="flex gap-4 flex-wrap items-end">{children}</div>
    </div>
  );
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      {children}
      <span className="text-[9px]" style={{ color: "#444" }}>{label}</span>
    </div>
  );
}

function SectionLabel({ title, description }: { title: string; description: string }) {
  return (
    <div className="pt-2">
      <p className="font-display text-xl" style={{ color: "#fff" }}>{title}</p>
      <p className="text-xs mt-0.5" style={{ color: "#444" }}>{description}</p>
    </div>
  );
}
