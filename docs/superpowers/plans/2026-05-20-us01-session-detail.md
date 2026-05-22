# US-01 — Page de détail séance (pre-session redesign) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Redesigner l'état pré-séance du `SessionSheet` fitness avec un header `FitnessCard`, une carte "Mot du coach" (`SessionBriefCard`) et une liste d'exercices planifiés (`PlannedExerciseRow`).

**Architecture:** Il n'y a pas de nouvelle route ni nouvelle page — c'est un redesign de l'état `!isArchive && !isStarted` dans le `SessionSheet` existant (bottom sheet plein écran). Deux nouveaux composants visuels purs sont créés, sans logique. `FitnessCard` est extraite de `SessionCard.tsx` pour être réutilisée en header.

**Tech Stack:** Next.js 14 static export, React, TypeScript, Tailwind CSS (classes utilitaires), inline styles pour les tokens design system. Aucun test suite existant — la validation est visuelle via `/dev/components` et le dev server sur `localhost:3001`.

---

## File Map

| Action | Fichier | Rôle |
|---|---|---|
| Modifier | `lib/coachPlan.ts` | Ajouter `sessionBrief?: string` sur `CoachWorkout` |
| Modifier | `components/SessionCard.tsx` | Exporter `FitnessCard` comme named export |
| Créer | `components/SessionBriefCard.tsx` | Carte "LE MOT DU COACH", cachée si pas de brief |
| Créer | `components/PlannedExerciseRow.tsx` | Ligne exercice en état planifié (pills vides + stats) |
| Modifier | `components/SessionSheet.tsx` | Remplacer le bloc pré-séance par le nouveau layout |
| Modifier | `app/dev/components/page.tsx` | Ajouter onglet "Détail" avec showcase des nouveaux composants |

---

## Task 1 : Ajouter `sessionBrief` au type `CoachWorkout`

**Files:**
- Modify: `lib/coachPlan.ts:21-29`

- [x] **Étape 1 : Ajouter le champ**

Dans `lib/coachPlan.ts`, modifier `CoachWorkout` :

```typescript
export interface CoachWorkout {
  id: string;
  type: "fitness";
  date: string;
  category: FitnessCategory;
  label: string;
  coachNote?: string;
  sessionBrief?: string;   // ← ajouter cette ligne
  durationMin?: number;
  exercises: CoachExercise[];
}
```

- [x] **Étape 2 : Vérifier que le build ne casse pas**

```bash
npm run build 2>&1 | tail -20
```

Attendu : `✓ Compiled successfully` ou uniquement des warnings (pas d'erreurs TypeScript).

- [x] **Étape 3 : Commit**

```bash
git add lib/coachPlan.ts
git commit -m "Ajout du champ sessionBrief sur CoachWorkout"
```

---

## Task 2 : Exporter `FitnessCard` depuis `SessionCard.tsx`

**Files:**
- Modify: `components/SessionCard.tsx:161`

`FitnessCard` est actuellement une fonction locale non exportée dans `SessionCard.tsx`. Elle doit être accessible depuis `SessionSheet.tsx` pour servir de header read-only.

- [x] **Étape 1 : Exporter la fonction**

Dans `components/SessionCard.tsx`, changer la ligne 161 :

```typescript
// avant
function FitnessCard({ todayCoachWorkout, todaySession, onOpenSession }: Pick<SessionCardProps, "todayCoachWorkout" | "todaySession" | "onOpenSession">) {

// après
export function FitnessCard({ todayCoachWorkout, todaySession, onOpenSession }: Pick<SessionCardProps, "todayCoachWorkout" | "todaySession" | "onOpenSession">) {
```

- [x] **Étape 2 : Vérifier que le build ne casse pas**

```bash
npm run build 2>&1 | tail -20
```

Attendu : pas d'erreur TypeScript.

- [x] **Étape 3 : Commit**

```bash
git add components/SessionCard.tsx
git commit -m "Export FitnessCard pour réutilisation dans SessionSheet"
```

---

## Task 3 : Créer `SessionBriefCard`

**Files:**
- Create: `components/SessionBriefCard.tsx`

Carte "LE MOT DU COACH" — même DNA visuel que `StreakCard` (fond `var(--color-neon-bg)` = `#0a1a00`, border `var(--color-neon-08)`). Invisible si `sessionBrief` est null ou undefined.

- [x] **Étape 1 : Créer le fichier**

```typescript
// components/SessionBriefCard.tsx
interface Props {
  brief: string | null | undefined;
}

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
      <div className="flex items-center gap-2 mb-2">
        <div
          className="flex items-center justify-center rounded-full flex-shrink-0"
          style={{
            width: 28,
            height: 28,
            background: "rgba(205,255,0,0.12)",
            border: "1px solid rgba(205,255,0,0.25)",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12h14" stroke="#CDFF00" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </div>
        <span
          className="text-[11px] font-bold tracking-widest"
          style={{ color: "#CDFF00" }}
        >
          LE MOT DU COACH
        </span>
      </div>
      <p className="text-sm leading-relaxed" style={{ color: "#888" }}>
        {brief}
      </p>
    </div>
  );
}
```

- [x] **Étape 2 : Vérifier que le build ne casse pas**

```bash
npm run build 2>&1 | tail -20
```

Attendu : pas d'erreur TypeScript.

- [x] **Étape 3 : Commit**

```bash
git add components/SessionBriefCard.tsx
git commit -m "Ajout du composant SessionBriefCard (mot du coach pré-séance)"
```

---

## Task 4 : Créer `PlannedExerciseRow`

**Files:**
- Create: `components/PlannedExerciseRow.tsx`

Ligne d'exercice en état "planifié" — lecture seule. Affiche le nom en Archivo 700, N pills vides (N = nombre de séries), les reps et le poids. Même langage visuel que `ProgressDots` dans `SessionSheet.tsx` mais en état non démarré (`#2a2a2a`).

- [x] **Étape 1 : Créer le fichier**

```typescript
// components/PlannedExerciseRow.tsx
import { ARCHIVO_WIDE_BOLD } from "@/lib/typography";

interface Props {
  name: string;
  sets: number;
  reps: number;
  weight: number;
}

function PlannedPills({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className="inline-block rounded-full"
          style={{ width: 18, height: 4, background: "#2a2a2a" }}
        />
      ))}
    </div>
  );
}

export default function PlannedExerciseRow({ name, sets, reps, weight }: Props) {
  return (
    <div
      className="rounded-2xl px-4 py-3"
      style={{ background: "#141414", border: "1px solid #1d1d1d" }}
    >
      <p
        className="text-base mb-2"
        style={{ ...ARCHIVO_WIDE_BOLD, fontSize: 17, lineHeight: "22px", color: "#fff" }}
      >
        {name}
      </p>
      <div className="flex items-center gap-2">
        <PlannedPills count={sets} />
        <span className="text-xs" style={{ color: "#555" }}>
          · {reps} reps{weight > 0 ? ` · ${weight} kg` : ""}
        </span>
      </div>
    </div>
  );
}
```

- [x] **Étape 2 : Vérifier que le build ne casse pas**

```bash
npm run build 2>&1 | tail -20
```

- [x] **Étape 3 : Commit**

```bash
git add components/PlannedExerciseRow.tsx
git commit -m "Ajout du composant PlannedExerciseRow (exercice planifié)"
```

---

## Task 5 : Redesign du bloc pré-séance dans `SessionSheet`

**Files:**
- Modify: `components/SessionSheet.tsx`

Remplacer dans le body scrollable le bloc `!isArchive && !isStarted` (label "À FAIRE") et adapter le rendu des exercices pour utiliser `PlannedExerciseRow` quand la séance n'est pas encore démarrée.

- [x] **Étape 1 : Ajouter les imports**

En haut de `components/SessionSheet.tsx`, ajouter après les imports existants :

```typescript
import { FitnessCard } from "@/components/SessionCard";
import SessionBriefCard from "@/components/SessionBriefCard";
import PlannedExerciseRow from "@/components/PlannedExerciseRow";
```

- [x] **Étape 2 : Remplacer le label "À FAIRE" par le header pré-séance**

Dans le body scrollable (vers la ligne 816), remplacer :

```typescript
{!isArchive && !isStarted && (
  <p className="px-1 pb-1 text-[11px] tracking-widest font-bold" style={{ color: "#CDFF00" }}>
    À FAIRE · {session.state!.exercises.length} exercice{session.state!.exercises.length > 1 ? "s" : ""}
  </p>
)}
```

par :

```typescript
{!isArchive && !isStarted && (
  <div className="space-y-3">
    <FitnessCard
      todayCoachWorkout={sessionCoachWorkout}
      todaySession={null}
      onOpenSession={() => {}}
    />
    <SessionBriefCard brief={sessionCoachWorkout?.sessionBrief} />
    <div className="flex items-center justify-between px-1 pt-1">
      <span
        className="text-[11px] font-bold tracking-widest"
        style={{ color: "#555" }}
      >
        PROGRAMME
      </span>
      <span
        className="text-[11px] font-bold tracking-widest"
        style={{ color: "#555" }}
      >
        {session.state!.exercises.length} EXERCICE{session.state!.exercises.length > 1 ? "S" : ""}
      </span>
    </div>
  </div>
)}
```

- [x] **Étape 3 : Adapter le rendu des exercices**

Juste après le bloc qu'on vient de modifier, le `.map()` des exercices (vers la ligne 821) :

```typescript
{!isArchive && session.state!.exercises.map((ex, i) => {
  const isActive = isStarted && i === session.state!.activeExIdx;
  if (isActive) {
    return (
      <ActiveCard
        key={ex.id}
        exercise={ex}
        onOpenNote={() => setNoteModalExId(ex.id)}
      />
    );
  }
  if (!isStarted) {
    return (
      <PlannedExerciseRow
        key={ex.id}
        name={ex.name}
        sets={ex.setLogs?.length ?? ex.sets ?? 0}
        reps={ex.reps ?? 0}
        weight={ex.weight ?? 0}
      />
    );
  }
  return (
    <CollapsedCard
      key={ex.id}
      exercise={ex}
      showMenu={isStarted}
      menuOpen={openMenuExId === ex.id}
      onMenuClose={() => setOpenMenuExId(null)}
      onTap={() => { if (isStarted) session.setActiveIdx(i); }}
      onMenu={() => setOpenMenuExId(ex.id)}
      onAction={(kind) => {
        if (kind === "delete") session.removeExercise(ex.id);
        else if (kind === "note") setNoteModalExId(ex.id);
      }}
    />
  );
})}
```

- [x] **Étape 4 : Vérifier visuellement sur le dev server**

```bash
npm run dev
```

Ouvrir `http://localhost:3001`. Taper sur une séance fitness planifiée depuis la home. Vérifier :
- La `FitnessCard` s'affiche en header
- La `SessionBriefCard` n'apparaît pas (pas de brief en données réelles)
- Le header "PROGRAMME · N EXERCICES" est visible
- Les exercices s'affichent avec pills vides + reps + kg
- Le CTA "Commencer la séance" est toujours sticky en bas
- Le menu "..." fonctionne toujours (Décaler / Annuler)
- Une fois la séance démarrée, les `CollapsedCard` / `ActiveCard` reprennent normalement

- [x] **Étape 5 : Commit**

```bash
git add components/SessionSheet.tsx
git commit -m "Refonte de l'état pré-séance : FitnessCard header, SessionBriefCard, PlannedExerciseRow"
```

---

## Task 6 : Showcase dans `/dev/components`

**Files:**
- Modify: `app/dev/components/page.tsx`

Ajouter un onglet "Détail" dans le showcase avec `SessionBriefCard` en état alimenté et 3 `PlannedExerciseRow` mockés.

- [x] **Étape 1 : Ajouter les imports**

En haut de `app/dev/components/page.tsx` :

```typescript
import SessionBriefCard from "@/components/SessionBriefCard";
import PlannedExerciseRow from "@/components/PlannedExerciseRow";
```

- [x] **Étape 2 : Ajouter "detail" dans le type `Section` et le tableau `SECTIONS`**

Modifier :

```typescript
type Section = "atoms" | "semaine" | "streak" | "cartes" | "home" | "nav" | "plan" | "detail";

const SECTIONS: { id: Section; label: string; ready: boolean }[] = [
  { id: "atoms",   label: "Atoms",      ready: true },
  { id: "semaine", label: "Semaine",    ready: true },
  { id: "streak",  label: "Streak",     ready: true },
  { id: "cartes",  label: "Cartes",     ready: true },
  { id: "home",    label: "Home",       ready: true },
  { id: "nav",     label: "Nav & CTA",  ready: true },
  { id: "plan",    label: "Plan",       ready: true },
  { id: "detail",  label: "Détail",     ready: true },  // ← ajouter
];
```

- [x] **Étape 3 : Ajouter la section de rendu**

Avant la fermeture de la `<div className="min-h-screen ...">`, ajouter :

```typescript
{/* ── DÉTAIL SÉANCE ── */}
{active === "detail" && (
  <div className="space-y-10">

    <ComponentBlock
      title="SessionBriefCard"
      description="Mot du coach pré-séance — cachée si pas de brief"
    >
      <div className="space-y-3">
        <p className="text-[10px] uppercase tracking-widest" style={{ color: "#444" }}>alimentée</p>
        <SessionBriefCard brief="Montée en charge sur le développé haltères, le rowing assis et le tirage vertical. C'est ta séance la plus exigeante de la semaine — elle est là pour ça. On y va." />
        <p className="text-[10px] uppercase tracking-widest mt-4" style={{ color: "#444" }}>vide (return null)</p>
        <div
          className="rounded-xl px-3 py-2 text-xs"
          style={{ background: "#111", border: "1px dashed #2a2a2a", color: "#333" }}
        >
          SessionBriefCard sans brief → invisible (ce bloc est un indicateur dev)
        </div>
      </div>
    </ComponentBlock>

    <ComponentBlock
      title="PlannedExerciseRow"
      description="Exercice planifié — état lecture seule, pills vides"
    >
      <div className="space-y-2">
        <PlannedExerciseRow name="Développé haltères" sets={4} reps={8} weight={22} />
        <PlannedExerciseRow name="Rowing assis" sets={4} reps={8} weight={42} />
        <PlannedExerciseRow name="Tirage vertical" sets={3} reps={10} weight={60} />
        <PlannedExerciseRow name="Curl biceps" sets={3} reps={12} weight={14} />
      </div>
    </ComponentBlock>

  </div>
)}
```

- [x] **Étape 4 : Vérifier visuellement**

Ouvrir `http://localhost:3001/dev/components`. Cliquer sur l'onglet "Détail". Vérifier :
- `SessionBriefCard` s'affiche avec le fond `#0a1a00`, border neon, texte correct
- L'indicateur "vide" s'affiche bien (la carte réelle est invisible)
- Les 4 `PlannedExerciseRow` s'affichent avec pills vides et bonne typographie

- [x] **Étape 5 : Commit**

```bash
git add app/dev/components/page.tsx
git commit -m "Showcase des composants de détail séance dans /dev/components"
```

---

## Self-Review

### Spec coverage

| Critère US-01 | Tâche |
|---|---|
| `FitnessCard` en header avec image, titre, stats | Task 2 + Task 5 |
| Carte "Mot du coach" avec icône "+" | Task 3 |
| Section PROGRAMME · N EXERCICES | Task 5 |
| Liste exercices : nom, séries (pills), reps, kg | Task 4 |
| Bouton "Commencer" sticky visible | Déjà existant, conservé |
| Menu "..." Décaler / Annuler | Déjà existant, conservé |
| Design system tokens respectés | Tasks 3, 4 |
| Testable dans `/dev/components` | Task 6 |
| `SessionBriefCard` cachée si pas de brief | Task 3 (return null) |

### Placeholder scan

Aucun "TBD", "TODO" ou step sans code dans ce plan.

### Type consistency

- `sessionBrief?: string` défini en Task 1, utilisé dans Task 5 (`sessionCoachWorkout?.sessionBrief`) ✓
- `FitnessCard` exportée en Task 2, importée en Task 5 ✓
- `SessionBriefCard` créée en Task 3, importée en Tasks 5 et 6 ✓
- `PlannedExerciseRow` créée en Task 4, importée en Tasks 5 et 6 ✓
- Props de `PlannedExerciseRow` : `{ name, sets, reps, weight }` — utilisées de façon cohérente en Tasks 4, 5 et 6 ✓
