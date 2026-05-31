# Design — Refactoring Coach : Tool Use + Mémoire Persistante
**Statut : VALIDÉ — Sprint 3 et 4**
**Date : 2026-05-29**

---

## Problème

Le coach IA présente deux fragilités liées :

1. **Contexte perdu entre sessions** : le coach recommence de zéro à chaque conversation. Il voit les séances brutes mais ne retient pas les tendances, les blessures mentionnées ou les contraintes long terme.

2. **Architecture fragile** : le Edge Function `chat-coach` retourne un JSON monolithique parsé par un depth-counting maison. Ce parser casse si une string contient `{` ou `}`. La gestion des messages alternés (user/assistant) est un workaround manual.

---

## Solution

Deux changements combinés :

1. **Mémoire persistante** (`cc_coach_memory`) — document JSON en Supabase, mis à jour par le chat et par `analyze-session`, injecté dans chaque contexte coach.

2. **Refactoring vers tool use** — remplacer le JSON monolithique par des outils Anthropic natifs. La boucle agentique gère proprement les tool calls/results. Plus de depth-counting.

Ces deux changements se renforcent : le tool use rend `update_memory` naturel ; la mémoire rend le coach pertinent entre sessions.

---

## Architecture : Boucle agentique

### Avant (actuel)

```
User message → chat-coach → 1 appel Claude → JSON parsé manuellement → réponse
```

### Après

```
User message → chat-coach → boucle {
  appel Claude avec tools définis
  si stop_reason == "tool_use" :
    exécuter le(s) outil(s) appelé(s)
    ajouter les tool_results dans la conversation
    reboucler
  si stop_reason == "end_turn" :
    retourner { text, pendingPlans, appliedPlans, memoryUpdated }
}
```

### Les 3 outils

```typescript
// Outil 1 : proposer des plans pour confirmation user
propose_plan_batch: {
  description: "Propose des séances au user. Il devra cliquer Valider pour confirmer.",
  input_schema: {
    plans: CoachPlan[]  // CoachRun | CoachWorkout
  }
}

// Outil 2 : appliquer des plans confirmés textuellement
apply_plan_batch: {
  description: "Applique des plans déjà proposés que le user vient de confirmer en texte.",
  input_schema: {
    plan_ids: string[]
  }
}

// Outil 3 : mettre à jour la mémoire coach
update_memory: {
  description: "Persisté en Supabase. À appeler uniquement pour infos significatives : blessure, objectif, contrainte long terme, tendance confirmée. Pas pour chaque échange.",
  input_schema: {
    run?: Partial<CoachMemory["run"]>,
    fitness?: Partial<CoachMemory["fitness"]>,
    body?: Partial<CoachMemory["body"]>,
    keyNotes?: Array<{ date: string, note: string }>
  }
}
```

---

## Structure de cc_coach_memory

```typescript
interface CoachMemory {
  lastUpdated: string;  // "YYYY-MM-DD"
  run: {
    trend?: string;          // "FC Z2 en baisse sur 6 sem (152→139bpm)"
    lastLongRun?: string;    // "14km Z2 le 26/05"
    nextRace?: string;       // "10km le 28 juin 2026"
    notes?: string;          // "Genou droit sensible"
  };
  fitness: {
    cycle?: string;          // "Semaine 2/4 de charge"
    upperBody?: {
      lastSession?: string;
      keyLifts?: Record<string, string>;  // "Développé couché": "18kg×3×8 — stable"
    };
    lowerBody?: {
      lastSession?: string;
      keyLifts?: Record<string, string>;
    };
  };
  body: {
    currentWeight?: number;   // 74.8 (kg)
    trend?: string;           // "−0.2kg/semaine"
    target?: number;          // 74.0
  };
  keyNotes: Array<{
    date: string;
    note: string;
  }>;
}
```

**Stockage :** localStorage key `cc_coach_memory` + Supabase table `cc_coach_memory` (user_id, profile_id, data JSONB, updated_at).

**Stratégie de merge :** last-write-wins par `updated_at`, identique à `chat_messages`.

---

## Sources de mise à jour de la mémoire

| Source | Quand | Quoi |
|---|---|---|
| `chat-coach` via `update_memory` tool | En temps réel pendant le chat | Blessures, contraintes, objectifs mentionnés par l'user |
| `analyze-session` | Après chaque séance | Tendances run (FC Z2, lastLongRun), charges fitness (keyLifts), poids si disponible |

**Règle coach** : n'appeler `update_memory` que pour des informations significatives sur le long terme. Pas pour des détails de séance (déjà dans les données brutes).

---

## Mapping tool calls → ChatMessage (continuité avec l'existant)

Le type `ChatMessage` conserve `pendingPlans` et les champs `modifiedCount`/`deletedCount`. La source change, pas la structure.

| Ancien (JSON monolithique) | Nouveau (tool use) |
|---|---|
| `response.pending_plans` → `msg.pendingPlans` | Tool call `propose_plan_batch.plans` → `msg.pendingPlans` |
| `response.modified_plans` → appliquer immédiatement | Tool call `apply_plan_batch.plan_ids` → appliquer immédiatement |
| `response.pending_delete_ids` → `msg.pendingDeleteIds` | `propose_plan_batch` peut inclure des suppressions (à définir) |

Le bouton "Valider" appelle toujours `applyPendingPlans(msgId)` côté client — ça ne change pas. Ce que change le Sprint 3 c'est comment `sendMessage()` dans `lib/coachChat.ts` extrait les `pendingPlans` de la réponse Edge Function.

L'embedding `[pending_plans=...]` dans les messages (pour la continuité cross-turn) peut être supprimé en Sprint 3 : avec tool use, le modèle voit ses propres tool calls dans l'historique natif.

---

## Fichiers impactés

### Sprint 2 — Infrastructure mémoire

| Fichier | Action |
|---|---|
| `lib/coachMemory.ts` | **Créer** — type `CoachMemory`, helpers `getCoachMemory()` / `setCoachMemory()` / merge |
| `lib/sync.ts` | **Modifier** — ajouter `pushCoachMemoryToSupabase()` + `pullCoachMemoryFromSupabase()` |
| Migration Supabase | **Créer** — table `cc_coach_memory` (user_id UUID, profile_id TEXT, data JSONB, updated_at TIMESTAMPTZ) |

### Sprint 3 — Refactoring chat-coach

| Fichier | Action |
|---|---|
| `supabase/functions/chat-coach/index.ts` | **Réécrire** — définir les 3 tools, implémenter la boucle agentique, supprimer le depth-counting JSON |
| `lib/coachChat.ts` | **Modifier** — adapter `sendMessage()` pour lire les tool calls (pendingPlans depuis `propose_plan_batch`, appliedPlans depuis `apply_plan_batch`) |

### Sprint 4 — Branchement analyze-session

| Fichier | Action |
|---|---|
| `supabase/functions/analyze-session/index.ts` | **Modifier** — lire `cc_coach_memory` au début, retourner `memory_update` après chaque séance |
| `lib/coachAnalyzer.ts` | **Modifier** — appliquer `memory_update` retourné, pusher en Supabase |

---

## Ce qui ne change pas

- Types `CoachWorkout`, `CoachRun`, `CoachExercise` dans `lib/coachPlan.ts`
- Le mécanisme pending → user confirme → applied (même flow UX)
- Le bouton "Valider" dans l'UI (appelle toujours `applyPendingPlans`)
- Le bouton "Adapter" (même comportement)
- Le déploiement GitHub Pages (static export)
- `analyze-session` reste fire-and-forget

---

## Impact sur le prompt system

La mémoire est injectée dans le system prompt de `chat-coach`, après les analyses récentes :

```
[Contexte date]
[Analyses récentes]
[Coach memory]  ← NOUVEAU
[Plans futurs J0-J3]
[Plans futurs J4+]
```

La section `coach memory` est compacte (quelques lignes, pas les séances brutes). Elle est incluse dans le cache prompt (ephemeral) comme le reste du contexte.

---

## Prérequis

- **Sprint 1 (UI refonte) livré** — pas de dépendance technique, mais on veut éviter des conflits de merge
- **Staging opérationnel** — tester le refactoring coach sur staging avant tout push prod

---

## Risques

| Risque | Mitigation |
|---|---|
| Boucle agentique infinie | Limiter à max 5 itérations ; logguer et couper si dépassé |
| Le coach abuse de `update_memory` | Instruction explicite dans le system prompt : "seulement pour infos long terme significatives" |
| Latence accrue (multi-tour) | En pratique, 1-2 tool calls max par réponse coach — latence marginale |
| Régression sur les plans existants | Tests manuels complets sur staging avant prod |
