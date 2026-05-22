# Session Completed View — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer l'écran de fin de séance rudimentaire par un composant `SessionCompletedView` conforme au design Figma, avec hero card validée, carte analyse coach redessinée, et rappel des exercices.

**Architecture:** Nouveau composant partagé `CardIconHeader` extrait du pattern de `SessionBriefCard`, utilisé pour uniformiser `CoachFeedbackCard` (redesigné) et `SessionBriefCard` (refactoré). `SessionCompletedView` assemble ces briques et remplace le bloc `isFinishingRunning` inline dans `SessionSheet`.

**Tech Stack:** Next.js 14, React, TypeScript, Tailwind CSS. Pas de test suite — vérification visuelle sur `localhost:3001`.

---

## Fichiers

| Fichier | Action |
|---|---|
| `components/ui/CardIconHeader.tsx` | Créer |
| `components/SessionBriefCard.tsx` | Modifier (refactorer pour utiliser `CardIconHeader`) |
| `components/CoachFeedbackCard.tsx` | Modifier (redesign complet) |
| `components/SessionCompletedView.tsx` | Créer |
| `components/SessionSheet.tsx` | Modifier (brancher `SessionCompletedView`) |

---

## Task 1 : CardIconHeader — composant partagé

**Files:**
- Create: `components/ui/CardIconHeader.tsx`

- [ ] **Créer le fichier**

```tsx
// components/ui/CardIconHeader.tsx
import { JETBRAINS_MONO_LABEL } from "@/lib/typography";

interface CardIconHeaderProps {
  icon: React.ReactNode;
  label: string;
  trailing?: React.ReactNode;
}

export default function CardIconHeader({ icon, label, trailing }: CardIconHeaderProps) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="flex items-center justify-center rounded-full flex-shrink-0"
        style={{
          width: 28,
          height: 28,
          background: "rgba(205,255,0,0.12)",
          border: "1px solid rgba(205,255,0,0.25)",
        }}
      >
        {icon}
      </div>
      <span style={{ ...JETBRAINS_MONO_LABEL, color: "var(--color-neon)" }}>
        {label}
      </span>
      {trailing !== undefined && <div className="ml-auto">{trailing}</div>}
    </div>
  );
}
```

- [ ] **Vérifier que le fichier compile sans erreur**

```bash
cd /Users/famillemillet/Projects/Maxime_ClaudeCoach && npx tsc --noEmit 2>&1 | head -20
```

Attendu : aucune erreur sur ce fichier.

- [ ] **Commit**

```bash
git add components/ui/CardIconHeader.tsx
git commit -m "Ajout CardIconHeader — composant partagé header carte coach"
```

---

## Task 2 : Refactorer SessionBriefCard

**Files:**
- Modify: `components/SessionBriefCard.tsx`

- [ ] **Remplacer le contenu du fichier**

```tsx
// components/SessionBriefCard.tsx
import CardIconHeader from "@/components/ui/CardIconHeader";

interface Props {
  brief: string | null | undefined;
}

const PlusIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
    <path d="M12 5v14M5 12h14" stroke="var(--color-neon)" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

export default function SessionBriefCard({ brief }: Props) {
  if (!brief) return null;
  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: "var(--color-neon-bg)",
        border: "1px solid var(--color-neon-08)",
      }}
    >
      <div className="mb-2">
        <CardIconHeader icon={<PlusIcon />} label="LE MOT DU COACH" />
      </div>
      <p className="text-sm leading-relaxed" style={{ color: "#888" }}>
        {brief}
      </p>
    </div>
  );
}
```

- [ ] **Vérifier visuellement : aucun changement visible sur la page séance**

Ouvrir `localhost:3001`, naviguer vers une séance avec un brief coach. L'apparence doit être identique à avant.

- [ ] **Commit**

```bash
git add components/SessionBriefCard.tsx
git commit -m "Refacto SessionBriefCard — utilise CardIconHeader"
```

---

## Task 3 : Redesign CoachFeedbackCard

**Files:**
- Modify: `components/CoachFeedbackCard.tsx`

- [ ] **Remplacer le contenu du fichier**

```tsx
// components/CoachFeedbackCard.tsx
import CardIconHeader from "@/components/ui/CardIconHeader";
import type { CoachAnalysisResult } from "@/lib/coachAnalyzer";

interface Props {
  state: "analyzing" | "done";
  result: CoachAnalysisResult | null;
  onRetry?: () => void;
}

const PlusIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
    <path d="M12 5v14M5 12h14" stroke="var(--color-neon)" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

const PulseDots = () => (
  <span className="flex gap-1 items-center">
    {[0, 1, 2].map((i) => (
      <span
        key={i}
        className="w-1 h-1 rounded-full inline-block"
        style={{
          background: "var(--color-neon)",
          animation: `pulse-dot 1.2s ${i * 0.25}s ease-in-out infinite`,
        }}
      />
    ))}
    <style>{`
      @keyframes pulse-dot {
        0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
        40% { opacity: 1; transform: scale(1.2); }
      }
    `}</style>
  </span>
);

export default function CoachFeedbackCard({ state, result, onRetry }: Props) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: "var(--color-neon-bg)", border: "1px solid var(--color-neon-08)" }}
    >
      <div className="mb-2">
        <CardIconHeader
          icon={<PlusIcon />}
          label="ANALYSE DU COACH"
          trailing={state === "analyzing" ? <PulseDots /> : undefined}
        />
      </div>

      {state === "analyzing" ? (
        <p className="text-sm" style={{ color: "#444" }}>
          En cours, l&apos;analyse peut prendre plusieurs secondes
        </p>
      ) : result?.analysis ? (
        <p className="text-sm leading-relaxed" style={{ color: "#888" }}>
          {result.analysis}
        </p>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm" style={{ color: "#444" }}>
            Analyse temporairement indisponible.
          </p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="flex-shrink-0 text-[11px] font-bold tracking-widest px-3 py-1.5 rounded-xl press-effect"
              style={{
                background: "rgba(205,255,0,0.08)",
                color: "var(--color-neon)",
                border: "1px solid rgba(205,255,0,0.25)",
              }}
            >
              RÉESSAYER
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Vérifier visuellement la vue archive**

Ouvrir `localhost:3001`, naviguer vers une séance archivée (en tapant sur une séance passée depuis la home ou le plan). La carte coach doit s'afficher avec le nouveau design : fond neon-bg, header avec `+` et label "ANALYSE DU COACH".

- [ ] **Commit**

```bash
git add components/CoachFeedbackCard.tsx
git commit -m "Redesign CoachFeedbackCard — aligne visuellement avec SessionBriefCard"
```

---

## Task 4 : Créer SessionCompletedView

**Files:**
- Create: `components/SessionCompletedView.tsx`

- [ ] **Créer le fichier**

```tsx
// components/SessionCompletedView.tsx
"use client";

import { FitnessCard } from "@/components/SessionCard";
import CoachFeedbackCard from "@/components/CoachFeedbackCard";
import PlannedExerciseRow from "@/components/PlannedExerciseRow";
import { JETBRAINS_MONO_LABEL } from "@/lib/typography";
import type { FinishingState } from "@/contexts/SessionContext";
import type { CoachWorkout } from "@/lib/coachPlan";

interface Props {
  finishing: FinishingState;
  sessionCoachWorkout: CoachWorkout | null;
  onRetry: () => void;
  onContinue: () => void;
}

export default function SessionCompletedView({ finishing, sessionCoachWorkout, onRetry, onContinue }: Props) {
  const fitnessSession = finishing.session ?? null;
  const coachState: "analyzing" | "done" =
    finishing.status === "done" || finishing.status === "error" ? "done" : "analyzing";
  const showContinue = finishing.status === "done" || finishing.status === "error";
  const exercises = fitnessSession?.exercises ?? [];

  return (
    <div className="flex-1 overflow-y-auto px-3 pt-2 pb-32 space-y-3">
      <FitnessCard
        todayCoachWorkout={sessionCoachWorkout}
        todaySession={fitnessSession}
        onOpenSession={() => {}}
        variant="embedded"
      />

      <CoachFeedbackCard
        state={coachState}
        result={finishing.result ?? null}
        onRetry={finishing.status === "error" ? onRetry : undefined}
      />

      {exercises.length > 0 && (
        <>
          <p className="px-1 pt-1" style={{ ...JETBRAINS_MONO_LABEL, color: "#555" }}>
            RAPPEL DE LA SÉANCE
          </p>
          {exercises.map((ex) => (
            <PlannedExerciseRow
              key={ex.id}
              name={ex.name}
              sets={ex.setLogs?.length ?? ex.sets}
              reps={ex.reps}
              weight={ex.weight}
            />
          ))}
        </>
      )}

      {showContinue && (
        <div
          className="fixed left-0 right-0 px-4 pt-3"
          style={{
            bottom: 0,
            paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
            background: "linear-gradient(to top, #0a0a0a 70%, transparent)",
            zIndex: 10,
          }}
        >
          <button
            type="button"
            onClick={onContinue}
            className="w-full flex items-center justify-center gap-2 press-effect"
            style={{
              background: "rgba(205,255,0,0.12)",
              border: "1px solid rgba(205,255,0,0.4)",
              color: "var(--color-neon)",
              borderRadius: "12px",
              padding: "15px 24px",
              fontWeight: 600,
              fontSize: "15px",
            }}
          >
            Continuer →
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Vérifier la compilation**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Attendu : aucune erreur.

- [ ] **Commit**

```bash
git add components/SessionCompletedView.tsx
git commit -m "Ajout SessionCompletedView — écran séance validée (US-05/06/07)"
```

---

## Task 5 : Brancher SessionCompletedView dans SessionSheet

**Files:**
- Modify: `components/SessionSheet.tsx`

- [ ] **Ajouter l'import de SessionCompletedView** en haut du fichier, après les imports existants

```tsx
import SessionCompletedView from "@/components/SessionCompletedView";
```

- [ ] **Remplacer le bloc Body + isFinishingRunning**

Localiser ce bloc dans `SessionSheet.tsx` (autour de la ligne 260) :

```tsx
        {/* Body */}
        <div className="flex-1 overflow-y-auto px-3 pt-2 pb-40 space-y-3">
```

Le remplacer par une condition : si `isFinishingRunning`, on rend `SessionCompletedView` ; sinon, le corps existant sans le bloc `{isFinishingRunning && (...)}`.

```tsx
        {/* Body */}
        {isFinishingRunning ? (
          <SessionCompletedView
            finishing={session.finishing}
            sessionCoachWorkout={sessionCoachWorkout}
            onRetry={session.retryAnalysis}
            onContinue={() => { session.close(); router.push("/"); }}
          />
        ) : (
          <div className="flex-1 overflow-y-auto px-3 pt-2 pb-40 space-y-3">
```

- [ ] **Supprimer le bloc `{isFinishingRunning && (...)}` dans le corps existant**

Ce bloc se trouve à la fin du corps scrollable (avant la fermeture du `</div>` du body). Il ressemble à :

```tsx
          {isFinishingRunning && (
            <div className="pt-2">
              <CoachFeedbackCard
                state={session.finishing.status === "analyzing" || session.finishing.status === "saving" ? "analyzing" : "done"}
                result={session.finishing.result ?? null}
                onRetry={session.finishing.status === "error" ? session.retryAnalysis : undefined}
              />
              {(session.finishing.status === "done" || session.finishing.status === "error") && (
                <button
                  onClick={() => { session.close(); router.push("/"); }}
                  className="mt-3 w-full py-3 rounded-2xl font-bold press-effect"
                  style={{ background: "rgba(205,255,0,0.12)", border: "1px solid rgba(205,255,0,0.4)", color: "#CDFF00" }}
                >
                  Continuer →
                </button>
              )}
            </div>
          )}
```

Supprimer ce bloc entier. Fermer correctement le `</div>` du corps et ajouter `)}` pour fermer le ternaire :

```tsx
          </div>
        )}
```

- [ ] **Vérifier la compilation**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Attendu : aucune erreur.

- [ ] **Vérifier visuellement le flow complet**

1. Ouvrir `localhost:3001`
2. Démarrer une séance fitness (via la home ou la page plan)
3. Valider quelques séries, puis appuyer sur le bouton "Finir" (drapeau)
4. Confirmer dans le modal
5. Vérifier que l'écran validé s'affiche : hero card avec ✓, carte "ANALYSE DU COACH" en état loading, section "RAPPEL DE LA SÉANCE" avec les exercices
6. Attendre que l'analyse se termine → l'état de la carte passe à `done` avec le texte du coach
7. Le bouton "Continuer →" apparaît → cliquer → retour sur la home

- [ ] **Commit**

```bash
git add components/SessionSheet.tsx
git commit -m "SessionSheet : branchement SessionCompletedView (fin du flow séance)"
```

---

## Task 6 : Fermer les issues GitHub

- [ ] **Fermer les issues US-05, US-06, US-07**

```bash
gh issue close 95 --comment "Livré dans SessionCompletedView — hero card validée avec animation d'entrée"
gh issue close 96 --comment "Livré dans SessionCompletedView — section RAPPEL DE LA SÉANCE avec PlannedExerciseRow"
gh issue close 97 --comment "Livré dans SessionCompletedView — CoachFeedbackCard redesigné avec états analyzing/done/error"
```
