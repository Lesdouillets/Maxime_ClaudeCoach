# US-07 — Composant WeekProgram

**Date :** 2026-05-14  
**Projet :** Claude Coach  
**Priorité :** Must have  
**Complexité :** Moyenne

---

## Contexte

La home page doit afficher un aperçu de la semaine en cours pour que l'utilisateur visualise d'un coup d'oeil son programme des 7 jours, l'avancement réel (fait / raté / à venir) et puisse naviguer vers n'importe quel jour.

---

## Objectif

En tant qu'utilisateur de Claude Coach, je veux voir les 7 jours de ma semaine en cours sur la home page, afin de savoir d'un coup d'oeil ce que j'ai prévu, ce que j'ai fait, et pouvoir accéder à n'importe quel jour.

---

## Périmètre

**Dans le scope :**
- Affichage des 7 jours de la semaine courante (lundi au dimanche)
- Dérivation du type et du statut pour chaque jour à partir des données existantes
- Navigation au clic vers `/day?date=`
- Header de section avec label de semaine formaté
- Chevron `>` navigant vers `/plan`

**Hors scope (cette version) :**
- Navigation semaine précédente / suivante (le chevron pointe vers `/plan`, pas de swipe inline)
- Prise en compte des `cancelledDays`
- Prise en compte des `rescheduledDays`
- Tooltip au survol des cases
- Animation ou transition entre semaines

---

## Critères d'acceptation

- En tant qu'utilisateur, quand j'arrive sur la home, alors je vois 7 cases côte à côte représentant les jours de la semaine du lundi au dimanche, avec la lettre du jour sous chaque case.
- En tant qu'utilisateur, quand la date d'aujourd'hui correspond à un jour, alors ce jour affiche un `SessionTag` au statut `today` (fond blanc).
- En tant qu'utilisateur, quand un jour passé a une session réalisée correspondant au plan, alors ce jour affiche le statut `done` (fond vert neon).
- En tant qu'utilisateur, quand un jour passé a un plan mais aucune session réalisée et que ce n'est pas aujourd'hui, alors ce jour affiche le statut `missed` (fond rouge sombre).
- En tant qu'utilisateur, quand un jour futur a un plan coach, alors ce jour affiche le statut `planned` avec la bordure colorée correspondant au type (orange fitness, bleu run).
- En tant qu'utilisateur, quand un jour n'a aucun plan (repos), alors il affiche `type: "rest"` quel que soit son statut.
- En tant qu'utilisateur, quand je clique sur n'importe quel jour, alors je suis redirigé vers `/day?date=YYYY-MM-DD`.
- En tant qu'utilisateur, quand j'ouvre la section semaine, alors le header affiche `SEMAINE DU [D1] AU [D7] [MOIS]` avec un chevron `>` cliquable vers `/plan`.

---

## Fichiers à créer / modifier

| Action   | Fichier                      | Rôle                                           |
|----------|------------------------------|------------------------------------------------|
| Créer    | `lib/weekProgram.ts`         | Logique pure de dérivation des 7 DaySlot       |
| Créer    | `components/WeekProgram.tsx` | Composant pur, sans état interne               |
| Modifier | `app/page.tsx`               | Appel à buildWeekDays + rendu du composant     |

---

## Types TypeScript

### `lib/weekProgram.ts`

```typescript
import type { SessionType, SessionStatus } from "@/components/SessionTag";

export interface DaySlot {
  date: string;           // "YYYY-MM-DD"
  letter: string;         // "L" | "M" | "M" | "J" | "V" | "S" | "D"
  type: SessionType;      // "run" | "fitness" | "rest"
  status: SessionStatus;  // "planned" | "today" | "done" | "missed"
  isToday: boolean;
}

export function buildWeekDays(
  today: string,
  coachWorkouts: CoachWorkout[],
  coachRuns: CoachRun[],
  sessions: WorkoutSession[],
): { days: DaySlot[]; weekLabel: string }
```

### `components/WeekProgram.tsx`

```typescript
import type { DaySlot } from "@/lib/weekProgram";

export interface WeekProgramProps {
  days: DaySlot[];        // toujours 7 éléments, lundi en index 0
  weekLabel: string;      // ex: "SEMAINE DU 17 AU 23 AVRIL"
  onDayClick: (date: string) => void;
}
```

Le composant est pur : il ne lit pas localStorage, ne calcule rien. La logique de calcul vit dans `lib/weekProgram.ts` et est appelée depuis `app/page.tsx`.

---

## Logique de dérivation — `buildWeekDays`

```
Pour chaque jour D de la semaine (lundi J+0 → dimanche J+6) :

1. Chercher un plan coach pour D :
   - coachWorkouts.find(w => w.date === D) → type "fitness"
   - coachRuns.find(r => r.date === D)     → type "run"
   - Si aucun des deux                     → type "rest"

2. Chercher une session réalisée pour D :
   - sessions.find(s => s.date.slice(0,10) === D)
   - Si trouvée → sessionDone = true, sessionType = s.type

3. Déterminer le statut :
   - Si D === today                → status = "today"
   - Sinon si D > today            → status = "planned"
   - Sinon si D < today :
       - Si sessionDone ET sessionType === planType → status = "done"
       - Sinon si type === "rest"                  → status = "done"
         (un jour repos passé = automatiquement "done", pas "missed")
       - Sinon                                     → status = "missed"
```

**Cas particulier repos passé :** un jour sans plan (`type: "rest"`) qui est dans le passé reçoit le statut `done`, pas `missed`. On ne peut pas "rater" un jour de repos.

### Lettres des jours (index 0 = lundi)

```typescript
const DAY_LETTERS = ["L", "M", "M", "J", "V", "S", "D"];
```

### Formatage du weekLabel

```
Si lundi.month === dimanche.month :
  → "SEMAINE DU 17 AU 23 AVRIL"
Sinon :
  → "SEMAINE DU 28 AVRIL AU 4 MAI"
```

Utiliser `toLocaleDateString("fr-FR", { day: "numeric", month: "long" })` et mettre en majuscules.

---

## Structure visuelle du composant

```
┌─────────────────────────────────────┐
│ SEMAINE DU 17 AU 23 AVRIL         > │  ← header, tracking large, chevron Link vers /plan
├─────────────────────────────────────┤
│  [60] [60] [60] [60] [60] [60] [60] │  ← SessionTag size="lg", flex avec justify-between
│   L    M    M    J    V    S    D   │  ← lettre, text-xs, text-muted, text-center
└─────────────────────────────────────┘
```

Chaque case appelle `onDayClick(day.date)` au clic via la prop `onClick` du `SessionTag`.

---

## Intégration dans `app/page.tsx`

Les données `coachWorkouts`, `coachRuns` et `sessions` sont déjà chargées dans le `refresh` callback (lignes 49-52). Il suffit d'appeler `buildWeekDays(todayStr, coachWorkouts, coachRuns, sessions)` et de passer le résultat à `<WeekProgram>`.

Le `onDayClick` redirige via `router.push(`/day?date=${date}`)` — le router Next.js via `useRouter`.

---

## Ordre de développement suggéré

1. Créer `lib/weekProgram.ts` avec `buildWeekDays` — valider les cas limites (repos passé, aujourd'hui, semaine sans plan)
2. Créer `components/WeekProgram.tsx` — tester avec des données mock depuis `/dev/components`
3. Intégrer dans `app/page.tsx`
