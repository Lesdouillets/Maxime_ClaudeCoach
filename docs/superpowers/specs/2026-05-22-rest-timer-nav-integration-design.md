# Rest Timer — Intégration dans la BottomNav

**Date :** 2026-05-22
**US :** US-04

---

## Problème

La `SessionMiniBanner` (composant flottant au-dessus de la nav) présente trois défauts :
1. Un gap visuel entre le bas du banner et le haut de la nav bar
2. Un `ExerciseThumb` avec les deux initiales de l'exercice — pattern abandonné sur les exercise cards
3. Un style de timer différent de celui de la session sheet (cercle `FloatingTimer` à `top-12 right-5` pour le cas `session.view === "hidden"`)

## Solution retenue

Supprimer `SessionMiniBanner` et le `FloatingTimer`. La `BottomNav` devient consciente de la session et affiche une **session strip** intégrée au-dessus des icônes de navigation, sans gap.

---

## Design

### Session strip — deux états

**Timer actif** (`timerKey && timerSec > 0`) :
- Point vert + nom de l'exercice (tronqué) + countdown coloré (vert → orange ≤10s → rouge ≤3s) + progress bar 2px en bas de la strip

**Pas de timer** :
- Point vert + nom de l'exercice + badge "EN COURS" (texte, semi-transparent, couleur néon)
- Pas de progress bar

**Tap sur la strip** → appelle `session.expand()` pour rouvrir la session sheet.

### Dimensions
- Hauteur de la strip : ~40px
- Progress bar : 2px, collée en bas de la strip (fond `--color-surface-3`, fill coloré comme le timer)
- Séparateur entre strip et icons : `1px solid var(--color-white-08)` (même que les autres dividers de l'app)

### Quand afficher
Même condition que l'ancienne `SessionMiniBanner` : `session.view === "minimized"` et `session.state?.started` et `session.finishing.status === "idle"` et l'exercice actif existe.

---

## Changements techniques

### Fichiers modifiés
- `components/BottomNav.tsx` — consomme `useSession()` + `useTimer()`, rend la strip conditionnellement au-dessus du `<nav>`
- `components/GlobalUI.tsx` — retire `<SessionMiniBanner />` et `<FloatingTimer />`

### Fichiers supprimés
- `components/SessionMiniBanner.tsx`

### Pas de changement
- `contexts/SessionContext.tsx`, `contexts/TimerContext.tsx` — interfaces inchangées
- Tous les autres composants

---

## Ce qui ne change pas

Le timer **dans** la session sheet (quand elle est ouverte) reste identique. Cette spec ne touche qu'à l'état minimisé.

---

## Hors scope

- Animations de transition (slide-in/out de la strip)
- Vibration / notification audio à la fin du timer
