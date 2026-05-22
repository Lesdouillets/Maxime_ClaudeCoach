# Spec — Écran séance validée (US-05 / US-06 / US-07)

**Date :** 2026-05-22  
**Issues fermées :** #95, #96, #97  
**Issue créée :** #103 (contenu structuré coach — hors scope)

---

## Contexte

US-05 (transition fin), US-06 (récap), US-07 (analyse coach) sont regroupées en un **seul écran** : la vue "séance validée". C'est ce qui s'affiche dans le `SessionSheet` dès que l'utilisateur confirme la fin de sa séance, remplaçant la vue live.

L'écran actuel (`isFinishingRunning`) est rudimentaire — un `CoachFeedbackCard` inline + un bouton "Continuer →". Cette spec le remplace par un composant dédié, conforme au design Figma.

---

## Ce qui change

### 1. `CardIconHeader` — nouveau composant partagé

`components/ui/CardIconHeader.tsx`

Micro-composant extrait du pattern commun entre `SessionBriefCard` et la carte d'analyse coach.

**Props :**
```ts
interface CardIconHeaderProps {
  icon: React.ReactNode       // SVG passé en prop
  label: string               // ex : "LE MOT DU COACH", "ANALYSE DU COACH"
  trailing?: React.ReactNode  // optionnel : dots animés, badge, etc.
}
```

**Rendu :** icône dans un cercle neon (`rgba(205,255,0,0.12)` + bordure `rgba(205,255,0,0.25)`) + label JetBrains Mono neon + trailing aligné à droite.

`SessionBriefCard` est refactoré pour utiliser `CardIconHeader` (aucun changement visuel).

---

### 2. `CoachFeedbackCard` — redesign visuel

Même container que `SessionBriefCard` : fond `var(--color-neon-bg)`, bordure `var(--color-neon-08)`, `rounded-2xl p-4`.

Header via `CardIconHeader` :
- Icône : `+` (même SVG que `SessionBriefCard`)
- Label : `"ANALYSE DU COACH"`
- Trailing : `...` dots animés (3 points pulse) quand état `analyzing`, sinon rien

**3 états du body :**

| État | Contenu |
|---|---|
| `analyzing` | Texte grisé : "En cours, l'analyse peut prendre plusieurs secondes" |
| `done` | `result.analysis` en texte brut `text-sm` `color: #888` (format structuré tracké dans #103) |
| `error` | "Analyse temporairement indisponible." + bouton RÉESSAYER si `onRetry` fourni |

**Interface inchangée** — les consommateurs existants (archive view dans `SessionSheet`) n'ont rien à modifier.

---

### 3. `SessionCompletedView` — nouveau composant

`components/SessionCompletedView.tsx`

Rendu quand `finishing.status` est `saving | analyzing | done | error`.

**Layout (scrollable, `flex-col gap-3 px-3 pt-2 pb-32`) :**

```
┌─────────────────────────────┐
│  FitnessCard                │  variant="embedded", todaySession=finishing.session,
│  (état validé)              │  todayCoachWorkout=sessionCoachWorkout, onOpenSession=no-op
└─────────────────────────────┘
┌─────────────────────────────┐
│  CoachFeedbackCard          │  state dérivé de finishing.status
│  (analyse coach)            │  result=finishing.result, onRetry si error
└─────────────────────────────┘
  RAPPEL DE LA SÉANCE          ← label JETBRAINS_MONO_LABEL color #555
┌─────────────────────────────┐
│  ExerciseRowCard ×N         │  variant="completed" pour chaque exercice
└─────────────────────────────┘
```

**Bouton "Continuer →" :** fixed bottom, fond `rgba(205,255,0,0.12)` + bordure + texte `#CDFF00`. Visible dès que `finishing.status === "done" || "error"`. Appelle `session.close()` + `router.push("/")`.

**Mapping `finishing.status` → état `CoachFeedbackCard` :**
- `saving` → `analyzing`
- `analyzing` → `analyzing`
- `done` → `done`
- `error` → `done` (avec `result: null` → affiche le message erreur + retry)

**Props du composant :**
```ts
interface SessionCompletedViewProps {
  finishing: FinishingState
  sessionCoachWorkout: CoachWorkout | null
  onRetry: () => void
  onContinue: () => void
}
```

---

### 4. `SessionSheet` — mise à jour

Remplacer le bloc `{isFinishingRunning && (...)}` dans le `<div className="flex-1 overflow-y-auto ...">` par `<SessionCompletedView ... />`.

Le bouton "Continuer →" inline existant est supprimé (il est dans `SessionCompletedView`).

---

## Hors scope

- **#103** — Format structuré du contenu `done` de `CoachFeedbackCard` (texte brut pour l'instant)
- Design des exercise cards du récap : `ExerciseRowCard variant="completed"` existant, pas de nouveau variant

---

## Fichiers touchés

| Fichier | Action |
|---|---|
| `components/ui/CardIconHeader.tsx` | Créer |
| `components/SessionBriefCard.tsx` | Refactorer (utilise `CardIconHeader`) |
| `components/CoachFeedbackCard.tsx` | Mettre à jour (design + `CardIconHeader`) |
| `components/SessionCompletedView.tsx` | Créer |
| `components/SessionSheet.tsx` | Mettre à jour (utilise `SessionCompletedView`) |
