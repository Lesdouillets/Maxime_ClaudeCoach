# SessionStrip Visual Refresh — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Affiner le visuel de la SessionStrip dans la BottomNav : typographie Archivo cohérente avec les exercise cards, couleur orange unifiée avec la session sheet, format "Tractions, repos S2 · 01:24 / 1:30", suppression du dot vert.

**Architecture:** 3 fichiers touchés dans l'ordre : d'abord le token DS manquant (`globals.css`), ensuite le nettoyage des hardcodes dans `SessionSheet.tsx`, enfin le rework de `SessionStrip` dans `BottomNav.tsx`.

**Tech Stack:** Next.js 14, React, TypeScript, Tailwind CSS, Archivo variable font (`wdth` axis), JetBrains Mono

---

## Fichiers touchés

| Action | Fichier | Raison |
|--------|---------|--------|
| Modifier | `app/globals.css` | Ajouter `--color-orange-light: #ff9a3c` |
| Modifier | `components/SessionSheet.tsx` | Remplacer `#D07900` et `#ff9a3c` hardcodés par les tokens |
| Modifier | `components/BottomNav.tsx` | Rework visuel complet de `SessionStrip` |

---

### Task 1 : Ajouter le token `--color-orange-light` dans le DS

**Files:**
- Modify: `app/globals.css`

- [ ] **Étape 1 : Ajouter le token dans `:root`**

Dans `app/globals.css`, à la ligne qui suit `--color-orange: #D07900;` (ligne ~14), ajouter :

```css
--color-orange-light: #ff9a3c;
```

Le bloc des couleurs orange doit ressembler à :

```css
--color-orange: #D07900;
--color-orange-light: #ff9a3c;
--color-orange-dim: #5a3200;
```

- [ ] **Étape 2 : Vérifier le build**

```bash
cd /Users/famillemillet/Projects/Maxime_ClaudeCoach && npm run build 2>&1 | tail -5
```

Résultat attendu : build propre.

- [ ] **Étape 3 : Commit**

```bash
git add app/globals.css
git commit -m "Ajout du token --color-orange-light au design system"
```

---

### Task 2 : Corriger les hardcodes dans SessionSheet

**Files:**
- Modify: `components/SessionSheet.tsx`

La session sheet hardcode `"#D07900"` (timer color) et le gradient `"linear-gradient(90deg, #D07900, #ff9a3c)"` (progress bar fill) au lieu d'utiliser les tokens DS.

- [ ] **Étape 1 : Remplacer la couleur du countdown**

Chercher la ligne qui contient `color: "#D07900"` près du countdown (ligne ~613) et remplacer :

```tsx
// Avant
<span className="font-display text-xl tabular-nums" style={{ color: "#D07900" }}>

// Après
<span className="font-display text-xl tabular-nums" style={{ color: "var(--color-orange)" }}>
```

- [ ] **Étape 2 : Remplacer le gradient de la progress bar**

Chercher `linear-gradient(90deg, #D07900, #ff9a3c)` (ligne ~623) et remplacer :

```tsx
// Avant
background: "linear-gradient(90deg, #D07900, #ff9a3c)",

// Après
background: "linear-gradient(90deg, var(--color-orange), var(--color-orange-light))",
```

- [ ] **Étape 3 : Vérifier le build**

```bash
cd /Users/famillemillet/Projects/Maxime_ClaudeCoach && npm run build 2>&1 | tail -5
```

Résultat attendu : build propre.

- [ ] **Étape 4 : Commit**

```bash
git add components/SessionSheet.tsx
git commit -m "SessionSheet : remplacement des hardcodes couleur orange par les tokens DS"
```

---

### Task 3 : Rework visuel de SessionStrip dans BottomNav

**Files:**
- Modify: `components/BottomNav.tsx`

Rework complet du composant `SessionStrip` :
- Suppression du dot vert
- Typographie : `ARCHIVO_WIDE_BOLD` (14px) pour le nom, `JETBRAINS_MONO_TINY` pour "REPOS S2"
- Couleur timer : `var(--color-orange)` fixe (plus de système trois couleurs)
- Format countdown : `01:24 / 1:30` (current + total)
- Progress bar : gradient `var(--color-orange)` → `var(--color-orange-light)`
- Import des constantes depuis `lib/typography.ts`

- [ ] **Étape 1 : Ajouter l'import des constantes typo**

En haut de `components/BottomNav.tsx`, ajouter l'import :

```tsx
import { ARCHIVO_WIDE_BOLD, JETBRAINS_MONO_TINY } from "@/lib/typography";
```

- [ ] **Étape 2 : Remplacer `SessionStrip` entièrement**

Remplacer la fonction `SessionStrip` par :

```tsx
function SessionStrip() {
  const session = useSession();
  const { timerKey, timerSec, timerTotalSec } = useTimer();

  if (
    session.view !== "minimized" ||
    !session.state?.started ||
    session.finishing.status !== "idle"
  ) return null;

  const ex = session.state.exercises[session.state.activeExIdx];
  if (!ex) return null;

  const isResting = !!timerKey && timerSec > 0;

  // Extrait le numéro de série depuis la clé "exId-set-N" (0-indexé → affiché en 1-indexé)
  const setMatch = timerKey?.match(/-set-(\d+)$/);
  const setLabel = setMatch ? `REPOS S${parseInt(setMatch[1], 10) + 1}` : null;

  const restProgress =
    isResting && timerTotalSec > 0
      ? Math.min(1, Math.max(0, (timerTotalSec - timerSec) / timerTotalSec))
      : 0;

  return (
    <button
      type="button"
      onClick={session.expand}
      className="w-full press-effect"
      style={STRIP_STYLE}
    >
      {/* Nom de l'exercice + label repos */}
      <div className="flex-1 flex flex-col justify-center gap-0.5 min-w-0">
        <span
          className="truncate"
          style={{ ...ARCHIVO_WIDE_BOLD, fontSize: 14, lineHeight: "17px", color: "#fff" }}
        >
          {ex.name}
        </span>
        {isResting && setLabel && (
          <span style={{ ...JETBRAINS_MONO_TINY, color: "var(--color-orange)" }}>
            {setLabel}
          </span>
        )}
      </div>

      {/* Timer ou badge EN COURS */}
      {isResting ? (
        <span
          className="font-display text-sm leading-none tabular-nums flex-shrink-0"
          style={{ color: "var(--color-orange)" }}
        >
          {formatMMSS(timerSec)}
          <span style={{ color: "var(--color-muted)", fontWeight: 400 }}>
            {" "}/ {formatMMSS(timerTotalSec)}
          </span>
        </span>
      ) : (
        <span
          className="text-xs font-medium flex-shrink-0"
          style={{ color: "var(--color-neon)", opacity: 0.5 }}
        >
          EN COURS
        </span>
      )}

      {/* Progress bar en bas de la strip */}
      {isResting && (
        <div
          className="absolute bottom-0 left-0 right-0"
          style={{ height: 2, background: "var(--color-surface-3)" }}
        >
          <div
            style={{
              height: 2,
              width: `${restProgress * 100}%`,
              background: "linear-gradient(90deg, var(--color-orange), var(--color-orange-light))",
              transition: "width 600ms linear",
            }}
          />
        </div>
      )}
    </button>
  );
}
```

- [ ] **Étape 3 : Vérifier le build**

```bash
cd /Users/famillemillet/Projects/Maxime_ClaudeCoach && npm run build 2>&1 | tail -5
```

Résultat attendu : build propre, aucune erreur TypeScript.

- [ ] **Étape 4 : Commit**

```bash
git add components/BottomNav.tsx
git commit -m "SessionStrip : typo Archivo, couleur orange unifiée, format repos S2 / chrono"
```

---

## Vérification manuelle

Après les 3 tasks :

1. `npm run dev`
2. Ouvrir une séance fitness, démarrer, valider une série → le timer de repos doit se lancer
3. Minimiser la session → naviguer sur Home/Plan
4. La strip affiche : nom en Archivo Wide Bold, "REPOS S2" en mono orange, "01:24 / 1:30" en orange, progress bar en gradient orange
5. À ≤10s : le `TimerHalo` (glow) s'active — la strip reste en orange fixe (pas de changement de couleur)
6. Sans timer actif : "EN COURS" en vert semi-transparent
7. Tap sur la strip → session sheet se rouvre
8. Dans la session sheet : progress bar et countdown en `var(--color-orange)` (plus de hardcode)
