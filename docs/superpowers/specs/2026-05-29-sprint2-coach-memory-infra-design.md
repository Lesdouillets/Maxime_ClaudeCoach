# Sprint 2 — Infrastructure mémoire coach
**Statut : VALIDÉ — Sprint 2**
**Date : 2026-05-29**
**Dépend de : Sprint 1 livré**

---

## Objectif

Créer l'infrastructure de mémoire persistante `cc_coach_memory` : type TypeScript, helpers read/write, table Supabase, et branchement dans `lib/sync.ts`. La mémoire n'est PAS encore lue par `chat-coach` ni `analyze-session` — ça arrive en Sprint 3 et 4.

Ce sprint pose les fondations. À la fin, la mémoire existe, se persiste, et se synchronise. Mais elle est encore vide (aucun écrivain actif).

---

## Fichier 1 — `lib/coachMemory.ts` (à créer)

```typescript
const MEMORY_KEY = "cc_coach_memory";
const MEMORY_UPDATED_AT_KEY = "cc_coach_memory_updated_at";

export interface CoachMemory {
  lastUpdated: string; // "YYYY-MM-DD"
  run: {
    trend?: string;       // ex: "FC Z2 en baisse sur 6 sem (152→139bpm)"
    lastLongRun?: string; // ex: "14km Z2 le 26/05"
    nextRace?: string;    // ex: "10km le 28 juin 2026"
    notes?: string;       // ex: "Genou droit sensible depuis mai"
  };
  fitness: {
    cycle?: string; // ex: "Semaine 2/4 de charge"
    upperBody?: {
      lastSession?: string;                    // ex: "2026-05-27"
      keyLifts?: Record<string, string>;       // ex: {"Développé couché": "18kg×3×8 — stable"}
    };
    lowerBody?: {
      lastSession?: string;
      keyLifts?: Record<string, string>;
    };
  };
  body: {
    currentWeight?: number; // kg, ex: 74.8
    trend?: string;         // ex: "−0.2kg/semaine"
    target?: number;        // kg, ex: 74.0
  };
  keyNotes: Array<{
    date: string; // "YYYY-MM-DD"
    note: string; // ex: "Blessure genou droit — arrêt run 2 semaines"
  }>;
}

const EMPTY_MEMORY: CoachMemory = {
  lastUpdated: "",
  run: {},
  fitness: {},
  body: {},
  keyNotes: [],
};

export function getCoachMemory(): CoachMemory {
  if (typeof window === "undefined") return { ...EMPTY_MEMORY };
  try {
    const raw = localStorage.getItem(MEMORY_KEY);
    if (!raw) return { ...EMPTY_MEMORY };
    return JSON.parse(raw) as CoachMemory;
  } catch {
    return { ...EMPTY_MEMORY };
  }
}

export function setCoachMemory(memory: CoachMemory): void {
  if (typeof window === "undefined") return;
  const now = new Date().toISOString().slice(0, 10);
  const withDate = { ...memory, lastUpdated: now };
  localStorage.setItem(MEMORY_KEY, JSON.stringify(withDate));
  localStorage.setItem(MEMORY_UPDATED_AT_KEY, new Date().toISOString());
}

// Merge partiel — les champs fournis écrasent les champs existants (shallow merge par sous-objet).
// keyNotes s'accumule (append). lastUpdated est mis à jour automatiquement.
export function mergeCoachMemory(
  update: Partial<Omit<CoachMemory, "lastUpdated">>
): void {
  const current = getCoachMemory();
  const merged: CoachMemory = {
    ...current,
    run: { ...current.run, ...update.run },
    fitness: {
      cycle: update.fitness?.cycle ?? current.fitness?.cycle,
      upperBody: update.fitness?.upperBody
        ? {
            lastSession: update.fitness.upperBody.lastSession ?? current.fitness?.upperBody?.lastSession,
            keyLifts: { ...current.fitness?.upperBody?.keyLifts, ...update.fitness.upperBody.keyLifts },
          }
        : current.fitness?.upperBody,
      lowerBody: update.fitness?.lowerBody
        ? {
            lastSession: update.fitness.lowerBody.lastSession ?? current.fitness?.lowerBody?.lastSession,
            keyLifts: { ...current.fitness?.lowerBody?.keyLifts, ...update.fitness.lowerBody.keyLifts },
          }
        : current.fitness?.lowerBody,
    },
    body: { ...current.body, ...update.body },
    keyNotes: [
      ...current.keyNotes,
      ...(update.keyNotes ?? []),
    ],
  };
  setCoachMemory(merged);
}

// Formatte la mémoire pour injection dans un system prompt — compact, quelques lignes.
// Retourne une chaîne vide si la mémoire est vide.
export function formatCoachMemoryForPrompt(memory: CoachMemory): string {
  const lines: string[] = [];

  const runParts: string[] = [];
  if (memory.run.trend) runParts.push(memory.run.trend);
  if (memory.run.lastLongRun) runParts.push(`Dernière sortie longue : ${memory.run.lastLongRun}`);
  if (memory.run.nextRace) runParts.push(`Prochaine course : ${memory.run.nextRace}`);
  if (memory.run.notes) runParts.push(`⚠️ ${memory.run.notes}`);
  if (runParts.length > 0) lines.push(`Run : ${runParts.join(" | ")}`);

  const fitParts: string[] = [];
  if (memory.fitness.cycle) fitParts.push(memory.fitness.cycle);
  if (memory.fitness.upperBody?.keyLifts) {
    const lifts = Object.entries(memory.fitness.upperBody.keyLifts)
      .map(([k, v]) => `${k} ${v}`)
      .join(", ");
    if (lifts) fitParts.push(`Upper: ${lifts}`);
  }
  if (memory.fitness.lowerBody?.keyLifts) {
    const lifts = Object.entries(memory.fitness.lowerBody.keyLifts)
      .map(([k, v]) => `${k} ${v}`)
      .join(", ");
    if (lifts) fitParts.push(`Lower: ${lifts}`);
  }
  if (fitParts.length > 0) lines.push(`Fitness : ${fitParts.join(" | ")}`);

  if (memory.body.currentWeight !== undefined) {
    const bodyParts: string[] = [`${memory.body.currentWeight}kg`];
    if (memory.body.target !== undefined) bodyParts.push(`objectif ${memory.body.target}kg`);
    if (memory.body.trend) bodyParts.push(`tendance ${memory.body.trend}`);
    lines.push(`Poids : ${bodyParts.join(", ")}`);
  }

  const recentNotes = memory.keyNotes.slice(-3);
  if (recentNotes.length > 0) {
    lines.push(
      `Notes : ${recentNotes.map((n) => `[${n.date}] ${n.note}`).join(" | ")}`
    );
  }

  if (lines.length === 0) return "";
  return `## Mémoire coach (contexte persistant)\n${lines.join("\n")}`;
}
```

---

## Fichier 2 — Migration Supabase

```sql
-- Table : cc_coach_memory
-- Une ligne par (user_id, profile_id) — upsert last-write-wins
CREATE TABLE cc_coach_memory (
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id TEXT        NOT NULL,
  data       JSONB       NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, profile_id)
);

-- RLS : chaque user ne voit que sa propre mémoire
ALTER TABLE cc_coach_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cc_coach_memory_self"
  ON cc_coach_memory
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

**Commandes Supabase CLI :**
```bash
# Créer le fichier de migration dans supabase/migrations/
supabase migration new add_coach_memory

# Coller le SQL ci-dessus dans le fichier généré, puis :
supabase db push

# Ou via le dashboard Supabase → SQL Editor
```

---

## Fichier 3 — `lib/sync.ts` — ajouts

### Imports à ajouter en tête de fichier

```typescript
import { getCoachMemory, setCoachMemory } from "./coachMemory";
import type { CoachMemory } from "./coachMemory";
```

### Deux fonctions privées à ajouter (après `pullChatMessages`)

```typescript
async function pushCoachMemory(userId: string, profileId: string): Promise<void> {
  const memory = getCoachMemory();
  if (!memory.lastUpdated) return; // rien à pousser si jamais initialisée
  const updatedAt = localStorage.getItem("cc_coach_memory_updated_at") ?? new Date().toISOString();
  const { error } = await supabase.from("cc_coach_memory").upsert(
    { user_id: userId, profile_id: profileId, data: memory, updated_at: updatedAt },
    { onConflict: "user_id,profile_id" }
  );
  if (error) throw new Error(error.message);
}

async function pullCoachMemory(userId: string, profileId: string): Promise<void> {
  const { data } = await supabase
    .from("cc_coach_memory")
    .select("data, updated_at")
    .eq("user_id", userId)
    .eq("profile_id", profileId)
    .maybeSingle();
  if (!data) return;

  const remoteUpdatedAt = data.updated_at as string;
  const localUpdatedAt = localStorage.getItem("cc_coach_memory_updated_at") ?? "";

  // Last-write-wins : le plus récent gagne (comparaison ISO string)
  if (remoteUpdatedAt > localUpdatedAt) {
    setCoachMemory(data.data as CoachMemory);
    localStorage.setItem("cc_coach_memory_updated_at", remoteUpdatedAt);
  }
}
```

### Modification de `_runSync`

Dans le `Promise.all` de pull (ligne ~380), ajouter `pullCoachMemory(userId, profileId)` :

```typescript
const [remoteSessions, remoteCoachPlans, remoteDayEvents, remoteWeightEntries, remoteExNotes, remoteCoachAnalyses] =
  await Promise.all([
    pullSessions(userId, profileId),
    pullCoachPlans(userId, profileId),
    pullDayEvents(userId, profileId),
    pullWeightEntries(userId, profileId),
    pullExNotes(userId, profileId),
    pullCoachAnalyses(userId, profileId),
  ]);
```

Après les merges et writes, dans le `Promise.all` de push, ajouter :
```typescript
await Promise.all([
  // ... toutes les pushes existantes ...
  pushCoachMemory(userId, profileId),
  pullCoachMemory(userId, profileId),  // ← last-write-wins, gère son propre merge
]);
```

> **Note :** contrairement aux sessions, la mémoire ne se merge PAS ligne par ligne — c'est un document unique, last-write-wins global par `updated_at`. `pullCoachMemory` gère cette logique en interne.

### Modification de `autoSyncPush`

Dans le `Promise.all` de `autoSyncPush`, ajouter :
```typescript
pushCoachMemory(userId.id, profileId),
```

---

## Référence clés localStorage

| Clé | Contenu |
|---|---|
| `cc_coach_memory` | `CoachMemory` JSON sérialisé |
| `cc_coach_memory_updated_at` | ISO timestamp de la dernière écriture (pour last-write-wins) |

---

## Ordre de développement

1. Créer `lib/coachMemory.ts` avec les types et helpers
2. Appliquer la migration Supabase
3. Modifier `lib/sync.ts` (imports + fonctions + branchement)
4. Vérification

---

## Vérification

```bash
npm run lint && npm run build
# Attendu : 0 erreur TypeScript
```

Tests manuels en console browser (F12 → Console) :

```javascript
// Import indirect — ouvrir la page et taper dans la console :

// 1. Écrire une mémoire test
import('/Maxime_ClaudeCoach/_next/static/chunks/...').then() 
// Alternative : déclencher depuis la page avec window.__DEBUG__ si disponible

// 2. Vérifier via localStorage
localStorage.getItem('cc_coach_memory')
// → null au premier lancement (normal)

// 3. Après syncFull(), vérifier dans Supabase dashboard
// Table cc_coach_memory → doit contenir 0 lignes (mémoire vide → pas pushée)
```

Test Supabase direct :
```sql
-- Dans le SQL Editor Supabase
SELECT * FROM cc_coach_memory;
-- → 0 lignes (mémoire non encore écrite par un Sprint actif)
```

Le Sprint 2 est terminé quand :
- `lib/coachMemory.ts` existe avec les 5 exports (`getCoachMemory`, `setCoachMemory`, `mergeCoachMemory`, `formatCoachMemoryForPrompt`, `CoachMemory`)
- La table `cc_coach_memory` existe en Supabase
- `sync.ts` compile sans erreur avec les nouvelles fonctions branchées
- `npm run build` réussit
