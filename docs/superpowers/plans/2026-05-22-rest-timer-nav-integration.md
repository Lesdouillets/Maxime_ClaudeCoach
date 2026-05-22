# Rest Timer — Intégration dans la BottomNav — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer la `SessionMiniBanner` flottante (avec gap et initiales) par une session strip intégrée directement dans la `BottomNav`.

**Architecture:** La `BottomNav` consomme `useSession()` et `useTimer()` pour rendre conditionnellement une session strip au-dessus des icônes de nav. La `SessionMiniBanner` et le `FloatingTimer` sont supprimés de `GlobalUI`. Le `TimerHalo` (effet glow) reste intact.

**Tech Stack:** React, Next.js 14, TypeScript, Tailwind CSS, CSS variables du design system

---

## Fichiers touchés

| Action | Fichier |
|--------|---------|
| Modifier | `components/BottomNav.tsx` |
| Modifier | `components/GlobalUI.tsx` |
| Supprimer | `components/SessionMiniBanner.tsx` |

---

### Task 1 : Supprimer SessionMiniBanner de GlobalUI

**Files:**
- Modify: `components/GlobalUI.tsx`

- [ ] **Étape 1 : Retirer l'import et les composants FloatingTimer et SessionMiniBanner**

Dans `components/GlobalUI.tsx`, supprimer :
- la fonction `FloatingTimer` (lignes ~33–57)
- l'import `SessionMiniBanner` (ligne ~8)
- le `<FloatingTimer />` dans le JSX (ligne ~74)
- le `<SessionMiniBanner />` dans le JSX (ligne ~76)
- l'import `useSession` s'il n'est plus utilisé ailleurs dans ce fichier

Le fichier doit ressembler à ceci après modification :

```tsx
"use client";

import { usePathname } from "next/navigation";
import { TimerProvider, useTimer } from "@/contexts/TimerContext";
import { SessionProvider, useSession } from "@/contexts/SessionContext";
import { RunSheetProvider, useRunSheet } from "@/contexts/RunSheetContext";
import SessionSheet from "@/components/SessionSheet";
import RunSheet from "@/components/RunSheet";
import BottomNav from "@/components/BottomNav";

function TimerHalo() {
  const { timerKey, timerSec } = useTimer();
  const visible = !!timerKey && timerSec > 0 && timerSec <= 10;

  return (
    <div
      aria-hidden
      style={{
        position:      "fixed",
        inset:         0,
        zIndex:        65,
        pointerEvents: "none",
        borderRadius:  "inherit",
        opacity:       visible ? 1 : 0,
        transition:    "opacity 1.8s ease-out",
        animation:     visible ? "timer-halo-pulse 2.4s ease-in-out infinite" : "none",
      }}
    />
  );
}

function BottomNavGate() {
  const session = useSession();
  const runSheet = useRunSheet();
  const pathname = usePathname();
  if (pathname.startsWith("/dev/")) return null;
  if (session.view === "expanded" || runSheet.view === "expanded") return null;
  return <BottomNav state="nav" />;
}

export default function GlobalUI({ children }: { children: React.ReactNode }) {
  return (
    <TimerProvider>
      <SessionProvider>
        <RunSheetProvider>
          <TimerHalo />
          {children}
          <BottomNavGate />
          <SessionSheet />
          <RunSheet />
        </RunSheetProvider>
      </SessionProvider>
    </TimerProvider>
  );
}
```

- [ ] **Étape 2 : Vérifier que le build ne plante pas**

```bash
cd /Users/famillemillet/Projects/Maxime_ClaudeCoach && npm run build 2>&1 | tail -20
```

Résultat attendu : aucune erreur TypeScript ni import manquant. Des warnings sur `SessionMiniBanner` non trouvé sont attendus si l'import subsiste — les corriger.

- [ ] **Étape 3 : Commit**

```bash
git add components/GlobalUI.tsx
git commit -m "Suppression de FloatingTimer et SessionMiniBanner de GlobalUI"
```

---

### Task 2 : Supprimer le fichier SessionMiniBanner.tsx

**Files:**
- Delete: `components/SessionMiniBanner.tsx`

- [ ] **Étape 1 : Supprimer le fichier**

```bash
rm /Users/famillemillet/Projects/Maxime_ClaudeCoach/components/SessionMiniBanner.tsx
```

- [ ] **Étape 2 : Vérifier qu'aucun fichier n'importe encore SessionMiniBanner**

```bash
grep -r "SessionMiniBanner" /Users/famillemillet/Projects/Maxime_ClaudeCoach --include="*.tsx" --include="*.ts"
```

Résultat attendu : aucun résultat.

- [ ] **Étape 3 : Commit**

```bash
git add -u
git commit -m "Suppression du composant SessionMiniBanner"
```

---

### Task 3 : Ajouter la session strip dans BottomNav

**Files:**
- Modify: `components/BottomNav.tsx`

La `BottomNav` doit afficher une strip au-dessus des icônes de nav quand une session est minimisée. Elle consomme `useSession()` et `useTimer()`.

- [ ] **Étape 1 : Ajouter les imports nécessaires**

En haut de `components/BottomNav.tsx`, ajouter :

```tsx
import type { CSSProperties } from "react";
import { useSession } from "@/contexts/SessionContext";
import { useTimer } from "@/contexts/TimerContext";
```

- [ ] **Étape 2 : Ajouter la fonction helper formatMMSS**

Juste avant le composant `BottomNav`, ajouter :

```tsx
function formatMMSS(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.max(0, sec) % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
```

- [ ] **Étape 3 : Ajouter le sous-composant SessionStrip**

Juste avant `export default function BottomNav`, ajouter :

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
  const timerColor =
    timerSec > 10 ? "var(--color-neon)" :
    timerSec > 3  ? "var(--color-orange)" :
                    "var(--color-error)";
  const restProgress =
    timerTotalSec > 0
      ? Math.min(1, Math.max(0, (timerTotalSec - timerSec) / timerTotalSec))
      : 0;

  const STRIP_STYLE: CSSProperties = {
    height: 40,
    display: "flex",
    alignItems: "center",
    padding: "0 16px",
    gap: 8,
    borderBottom: "1px solid var(--color-white-08)",
    cursor: "pointer",
    position: "relative",
  };

  return (
    <button
      onClick={session.expand}
      className="w-full press-effect"
      style={STRIP_STYLE}
    >
      {/* Point indicateur */}
      <div
        className="flex-shrink-0 rounded-full"
        style={{ width: 6, height: 6, background: "var(--color-neon)" }}
      />

      {/* Nom de l'exercice */}
      <p className="flex-1 text-left text-sm font-semibold truncate">
        {ex.name}
      </p>

      {/* Timer ou badge EN COURS */}
      {isResting ? (
        <span
          className="font-display text-base leading-none tabular-nums flex-shrink-0"
          style={{ color: timerColor }}
        >
          {formatMMSS(timerSec)}
        </span>
      ) : (
        <span
          className="text-xs font-medium flex-shrink-0"
          style={{ color: "var(--color-neon)", opacity: 0.5 }}
        >
          EN COURS
        </span>
      )}

      {/* Progress bar en bas de la strip (visible seulement si timer actif) */}
      {isResting && (
        <div
          className="absolute bottom-0 left-0 right-0"
          style={{ height: 2, background: "var(--color-surface-3)" }}
        >
          <div
            style={{
              height: 2,
              width: `${restProgress * 100}%`,
              background: timerColor,
              transition: "width 600ms linear",
            }}
          />
        </div>
      )}
    </button>
  );
}
```

- [ ] **Étape 4 : Intégrer SessionStrip dans le JSX de BottomNav**

Dans `export default function BottomNav`, modifier le `return` pour inclure `<SessionStrip />` au-dessus du `<nav>` :

```tsx
return (
  <div
    className="fixed left-0 right-0 bottom-0 z-nav"
    style={{
      background: "linear-gradient(to bottom, rgba(0,0,0,0) 0%, #000000 35%)",
      paddingBottom: "env(safe-area-inset-bottom, 0px)",
    }}
  >
    <SessionStrip />
    <nav className="flex items-center justify-around px-2 pt-3 pb-2">
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
        const isActivating = activating === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
            className="flex flex-col items-center gap-0.5 press-effect"
            style={{
              animation: isActivating ? "nav-activate 0.35s ease-out" : undefined,
            }}
          >
            {item.icon(isActive)}
            <span
              className="text-[10px] font-medium uppercase tracking-[0.08em]"
              style={{ color: isActive ? ACTIVE : MUTED }}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  </div>
);
```

- [ ] **Étape 5 : Vérifier le build**

```bash
cd /Users/famillemillet/Projects/Maxime_ClaudeCoach && npm run build 2>&1 | tail -20
```

Résultat attendu : build propre, aucune erreur TypeScript.

- [ ] **Étape 6 : Vérifier le lint**

```bash
cd /Users/famillemillet/Projects/Maxime_ClaudeCoach && npm run lint 2>&1 | tail -20
```

Résultat attendu : aucune erreur, warnings acceptables.

- [ ] **Étape 7 : Commit**

```bash
git add components/BottomNav.tsx
git commit -m "Ajout de la SessionStrip dans la BottomNav (US-04)"
```

---

## Vérification manuelle

Après les 3 tasks :

1. Lancer `npm run dev`
2. Ouvrir une session fitness, la démarrer, puis minimiser (drag down ou bouton retour)
3. Naviguer sur Home / Plan / Stats → la session strip doit apparaître au-dessus des icônes de nav, sans gap
4. Déclencher un rest timer → le countdown doit apparaître avec la progress bar et les couleurs vert/orange/rouge
5. Laisser le timer descendre sous 10s → le `TimerHalo` (glow) doit s'activer
6. Taper sur la strip → la session sheet doit se rouvrir
