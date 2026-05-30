# Sprint 3 — Refactoring chat-coach : boucle agentique + tool use
**Statut : VALIDÉ — Sprint 3**
**Date : 2026-05-29**
**Dépend de : Sprint 2 livré**

---

## Objectif

Remplacer le JSON monolithique de `chat-coach` par une boucle agentique avec 3 outils Anthropic natifs. Éliminer le depth-counting fragile. Injecter la mémoire coach dans chaque conversation. Adapter `coachChat.ts` pour supprimer le `[pending_plans=...]` embedding (devenu inutile).

L'interface retournée par la Edge Function reste **identique** — `{ response, pending_plans, pending_delete_ids, modified_plans, delete_plan_ids }`. Zéro changement dans le reste du client.

---

## Architecture : boucle agentique

```
sendMessage() → chat-coach Edge Function
  ├── Prépare les messages (comme avant, moins l'embedding)
  ├── Injecte la mémoire dans contextParts
  └── Boucle agentique (max 5 itérations) :
        appel Claude avec tools définis
        si stop_reason == "tool_use" :
          → propose_plan_batch : extraire plans → stocker dans result
          → apply_plan_batch  : résoudre IDs → stocker dans result
          → update_memory     : collecter le delta → stocker dans result
          → ajouter tool_results à la conversation
          → reboucler
        si stop_reason == "end_turn" :
          → retourner { response, pending_plans, pending_delete_ids, modified_plans, delete_plan_ids, memory_update }
```

---

## Fichier 1 — `supabase/functions/chat-coach/index.ts` (réécriture)

### Définitions des outils Anthropic (JSON Schema)

```typescript
const COACH_TOOLS = [
  {
    name: "propose_plan_batch",
    description:
      "Propose des séances au user. Il devra cliquer 'Valider' pour les confirmer. " +
      "Utilise cet outil chaque fois que tu crées ou modifies des séances. " +
      "Ne l'utilise PAS si l'user t'a déjà confirmé ce tour — utilise apply_plan_batch à la place.",
    input_schema: {
      type: "object",
      properties: {
        plans: {
          type: "array",
          items: { type: "object" },
          description: "Tableau de plans CoachRun ou CoachWorkout complets.",
        },
        delete_ids: {
          type: "array",
          items: { type: "string" },
          description: "IDs de plans existants à supprimer (optionnel).",
        },
      },
      required: ["plans"],
    },
  },
  {
    name: "apply_plan_batch",
    description:
      "Applique des plans déjà proposés que l'user vient de confirmer textuellement " +
      "('ok', 'valide', 'go', 'c'est bon', 'applique'). " +
      "Ne l'utilise QUE si l'user confirme explicitement dans sa réponse. " +
      "Résous les IDs depuis les propose_plan_batch précédents dans la conversation.",
    input_schema: {
      type: "object",
      properties: {
        plan_ids: {
          type: "array",
          items: { type: "string" },
          description: "IDs des plans confirmés.",
        },
        delete_ids: {
          type: "array",
          items: { type: "string" },
          description: "IDs à supprimer définitivement (optionnel).",
        },
      },
      required: ["plan_ids"],
    },
  },
  {
    name: "update_memory",
    description:
      "Met à jour la mémoire persistante du coach. " +
      "À utiliser UNIQUEMENT pour des informations significatives long terme : " +
      "blessure, objectif de course, contrainte physique, tendance FC confirmée, poids mentionné. " +
      "PAS pour les détails d'une séance (déjà dans les données brutes). " +
      "La mémoire sera injectée dans toutes les conversations futures.",
    input_schema: {
      type: "object",
      properties: {
        run: {
          type: "object",
          properties: {
            trend: { type: "string", description: "ex: 'FC Z2 en baisse sur 6 sem (152→139bpm)'" },
            lastLongRun: { type: "string", description: "ex: '14km Z2 le 26/05'" },
            nextRace: { type: "string", description: "ex: '10km le 28 juin 2026'" },
            notes: { type: "string", description: "ex: 'Genou droit sensible depuis mai'" },
          },
        },
        fitness: {
          type: "object",
          properties: {
            cycle: { type: "string", description: "ex: 'Semaine 2/4 de charge'" },
            upperBody: {
              type: "object",
              properties: {
                lastSession: { type: "string" },
                keyLifts: {
                  type: "object",
                  description: "ex: {'Développé couché': '18kg×3×8 — stable'}",
                },
              },
            },
            lowerBody: {
              type: "object",
              properties: {
                lastSession: { type: "string" },
                keyLifts: { type: "object" },
              },
            },
          },
        },
        body: {
          type: "object",
          properties: {
            currentWeight: { type: "number", description: "kg" },
            trend: { type: "string", description: "ex: '−0.2kg/semaine'" },
            target: { type: "number", description: "kg" },
          },
        },
        keyNotes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              date: { type: "string", description: "YYYY-MM-DD" },
              note: { type: "string" },
            },
            required: ["date", "note"],
          },
        },
      },
    },
  },
] as const;
```

### Structure de la réponse interne

```typescript
interface ChatCoachResult {
  response: string;
  pending_plans: unknown[];       // depuis propose_plan_batch
  pending_delete_ids: string[];   // depuis propose_plan_batch.delete_ids
  modified_plans: unknown[];      // depuis apply_plan_batch (plans résolus)
  delete_plan_ids: string[];      // depuis apply_plan_batch.delete_ids
  memory_update: Record<string, unknown> | null; // depuis update_memory, écrit par le client
}
```

### Boucle agentique

Remplace l'appel unique `anthropicResp` actuel. Le reste du setup (contextParts, slicing messages, etc.) reste identique.

```typescript
const MAX_ITERATIONS = 5;

// conversationMessages = apiMessages tel que construit actuellement
// (user+assistant context pair + recentMessages)
const conversationMessages: unknown[] = [...apiMessages];

const result: ChatCoachResult = {
  response: "",
  pending_plans: [],
  pending_delete_ids: [],
  modified_plans: [],
  delete_plan_ids: [],
  memory_update: null,
};

for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
  const anthropicResp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": Deno.env.get("ANTHROPIC_API_KEY") ?? "",
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "prompt-caching-2024-07-31",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system: [
        {
          type: "text",
          text: systemPrompt,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: COACH_TOOLS,
      messages: conversationMessages,
    }),
  });

  if (!anthropicResp.ok) {
    const errText = await anthropicResp.text();
    throw new Error(`Anthropic API error ${anthropicResp.status}: ${errText}`);
  }

  const anthropicData = await anthropicResp.json();
  const stopReason = anthropicData.stop_reason as string;

  if (anthropicData.usage) {
    console.log(`[chat-coach] iter=${iteration} usage:`, JSON.stringify(anthropicData.usage), "stop:", stopReason);
  }

  // Extraire le bloc texte (réponse visible)
  const textBlock = Array.isArray(anthropicData.content)
    ? anthropicData.content.find((b: { type: string }) => b.type === "text")
    : null;
  if (textBlock?.text) result.response = textBlock.text;

  // Fin normale — pas de tool call
  if (stopReason !== "tool_use") break;

  // Traiter les tool calls
  const toolUseBlocks = (anthropicData.content as Array<{ type: string; id: string; name: string; input: Record<string, unknown> }>)
    .filter((b) => b.type === "tool_use");

  const toolResults: Array<{ type: "tool_result"; tool_use_id: string; content: string }> = [];

  for (const toolBlock of toolUseBlocks) {
    const { id, name, input } = toolBlock;
    let toolResultContent = "";

    if (name === "propose_plan_batch") {
      result.pending_plans = Array.isArray(input.plans) ? input.plans : [];
      result.pending_delete_ids = Array.isArray(input.delete_ids) ? (input.delete_ids as string[]) : [];
      toolResultContent = `OK — ${result.pending_plans.length} plan(s) proposé(s), en attente de confirmation user.`;
      console.log("[chat-coach] propose_plan_batch:", result.pending_plans.length, "plans");
    } else if (name === "apply_plan_batch") {
      const planIds = Array.isArray(input.plan_ids) ? (input.plan_ids as string[]) : [];
      result.modified_plans = resolvePlansByIds(planIds, conversationMessages);
      result.delete_plan_ids = Array.isArray(input.delete_ids) ? (input.delete_ids as string[]) : [];
      toolResultContent = `OK — ${result.modified_plans.length} plan(s) appliqué(s).`;
      console.log("[chat-coach] apply_plan_batch:", result.modified_plans.length, "plans résolus");
    } else if (name === "update_memory") {
      result.memory_update = input;
      toolResultContent = "Mémoire mise à jour.";
      console.log("[chat-coach] update_memory appelé");
    }

    toolResults.push({ type: "tool_result", tool_use_id: id, content: toolResultContent });
  }

  // Ajouter le tour assistant + les tool_results dans la conversation pour reboucler
  conversationMessages.push({ role: "assistant", content: anthropicData.content });
  conversationMessages.push({ role: "user", content: toolResults });
}

if (!result.response && result.pending_plans.length === 0) {
  result.response = "Désolé, je n'ai pas pu formuler de réponse. Réessaie.";
}
```

### Helper `resolvePlansByIds`

Parcourt l'historique de la conversation (côté Edge Function, dans `conversationMessages`) pour retrouver les plans proposés dans des `propose_plan_batch` précédents.

```typescript
function resolvePlansByIds(
  planIds: string[],
  conversationMessages: unknown[],
): unknown[] {
  if (planIds.length === 0) return [];
  const allProposedPlans: Record<string, unknown>[] = [];

  for (const msg of conversationMessages) {
    const m = msg as { role: string; content: unknown };
    if (m.role !== "assistant" || !Array.isArray(m.content)) continue;
    for (const block of m.content as Array<{ type: string; name?: string; input?: Record<string, unknown> }>) {
      if (block.type === "tool_use" && block.name === "propose_plan_batch") {
        const plans = block.input?.plans;
        if (Array.isArray(plans)) {
          allProposedPlans.push(...(plans as Record<string, unknown>[]));
        }
      }
    }
  }

  const idSet = new Set(planIds);
  return allProposedPlans.filter((p) => idSet.has(p.id as string));
}
```

### Injection de la mémoire dans le prompt

Dans le handler, après avoir construit `contextParts` (date, analyses récentes, séances récentes) et AVANT les plans, ajouter :

```typescript
import { getCoachMemory, formatCoachMemoryForPrompt } from "../../lib/coachMemory.ts";
// Note : les Edge Functions Deno peuvent importer depuis lib/ avec un path relatif
// OU via un import map — à ajuster selon la config du projet

// Dans le handler :
const memory = getCoachMemory();
const memorySection = formatCoachMemoryForPrompt(memory);
if (memorySection) {
  contextParts.push(`\n${memorySection}`);
}
```

> **Attention :** les Edge Functions Deno n'ont PAS accès à `localStorage`. La mémoire doit être lue depuis Supabase et passée dans le `body` de la requête par le client.

**Approche retenue :** le client `coachChat.ts` passe `coachMemory` dans le body de la requête. La Edge Function lit `body.coachMemory` et appelle `formatCoachMemoryForPrompt(coachMemory)`.

```typescript
// Dans le handler, lecture du body :
const { messages, coachPlans, recentSessions, profileName, previousAnalyses, today, coachMemory } = body;

// Injection dans contextParts :
if (coachMemory) {
  const memoryText = formatCoachMemoryForPrompt(coachMemory);
  if (memoryText) contextParts.push(`\n${memoryText}`);
}
```

> `formatCoachMemoryForPrompt` doit être dupliquée dans la Edge Function (ou importée via import map) car les Edge Functions n'accèdent pas à `lib/` du projet Next.js directement.

### Mise à jour du system prompt

**Supprimer :**
- La section entière `## FORMAT DE RÉPONSE — STRICT JSON UNIQUEMENT`
- La section `## CONTINUITÉ ENTRE LES TOURS`

**Remplacer par :**
```
## OUTILS DISPONIBLES

Tu disposes de 3 outils. Utilise-les comme un vrai coach qui planifie et mémorise :

1. **propose_plan_batch** — quand tu crées ou modifies des séances. Toujours demander confirmation.
2. **apply_plan_batch** — quand l'user confirme explicitement un plan ("ok", "valide", "go"). Résous les IDs depuis tes propose_plan_batch précédents dans cette conversation.
3. **update_memory** — quand l'user mentionne une blessure, un objectif de course, une contrainte physique, ou que tu observes une tendance significative. PAS pour chaque échange.

Si tu réponds juste à une question sans modifier le programme, n'appelle aucun outil.
```

---

## Fichier 2 — `lib/coachChat.ts` — modifications

### 1. Supprimer le `[pending_plans=...]` embedding

Dans la construction de `apiMessages` (ligne ~145), supprimer le bloc `if (m.role === "assistant" && (m.pendingPlans?.length || m.pendingDeleteIds?.length))` qui injectait l'embedding.

Remplacer par un simple mapping :
```typescript
const apiMessages = history.map((m) => ({
  role: m.role,
  content: m.content,
}));
```

### 2. Passer `coachMemory` dans le body

```typescript
import { getCoachMemory } from "./coachMemory";

// Dans sendMessage(), avant l'appel supabase.functions.invoke :
const coachMemory = getCoachMemory();

const { data, error } = await supabase.functions.invoke("chat-coach", {
  body: { messages: apiMessages, coachPlans, recentSessions, profileName, previousAnalyses, today, coachMemory },
});
```

### 3. Appliquer `memory_update` retourné par la Edge Function

```typescript
import { mergeCoachMemory } from "./coachMemory";
import { autoSyncPush } from "./sync";

// Dans sendMessage(), après avoir extrait pending_plans/modified_plans :
if (data.memory_update) {
  mergeCoachMemory(data.memory_update);
  // autoSyncPush() est déjà appelé si modifiedCount > 0,
  // sinon on l'appelle pour pousser la mémoire mise à jour
  if (modifiedCount === 0 && deletedCount === 0) {
    try { await autoSyncPush(); } catch { /* silent */ }
  }
}
```

### Ce qui ne change PAS dans `coachChat.ts`

- `ChatMessage` interface — identique
- `applyPendingPlans()` — identique (le bouton Valider fonctionne pareil)
- `getChatHistory()`, `clearChatHistory()`, `loadChatFromSupabase()` — identiques
- La structure de la réponse reçue de la Edge Function — identique

---

## Points d'attention

### Continuité entre tours (pending_plans cross-request)

Le `[pending_plans=...]` embedding est supprimé du côté OUTPUT, mais les messages passés (stockés dans `cc_chat_history`) avaient cet embedding. Pour la **continuité cross-request** :

- Les anciens messages avec `[pending_plans=...]` continuent à fonctionner : le system prompt (ancienne instruction) les comprenait. Avec la nouvelle instruction, la section "CONTINUITÉ ENTRE LES TOURS" est supprimée, mais les embeddings dans l'historique seront compréhensibles par le modèle (ce sont des blocs JSON lisibles).
- Les NOUVEAUX messages n'ont plus d'embedding. Le modèle voit ses tool calls précédents directement dans `conversationMessages` (au sein de la même Edge Function call — boucle agentique).

> Ce système fonctionne pour les confirmations dans le MÊME échange (un seul appel Edge Function). Pour les confirmations cross-turn (le user dit "valide" dans un NOUVEAU message), le modèle s'appuie sur la reconstruction via `apply_plan_batch` — il voit dans son historique les `propose_plan_batch` qu'il a faits (réinjectés via les messages de la boucle agentique, qui font partie de `conversationMessages`).

### Limites de la boucle agentique

- Max 5 itérations. En pratique : 1-2 max (un outil par tour).
- Si 5 itérations atteintes sans `end_turn`, logguer et retourner `result` en l'état.
- `max_tokens: 8192` par appel — identique à l'actuel.

### Prompt cache

Le cache prompt (`cache_control: ephemeral`) reste sur le system prompt. Il fonctionne par hachage du contenu — si la mémoire change à chaque conversation, le cache sera invalidé sur la partie mémoire. Pour minimiser les invalidations, mettre `formatCoachMemoryForPrompt(memory)` AVANT les plans dans `contextParts`, pas dans `systemPrompt`.

---

## Ordre de développement

1. Réécrire `chat-coach/index.ts` :
   a. Définir `COACH_TOOLS`
   b. Implémenter `resolvePlansByIds`
   c. Implémenter la boucle agentique
   d. Mettre à jour le system prompt (supprimer JSON instructions, ajouter OUTILS)
   e. Ajouter lecture de `coachMemory` depuis le body

2. Modifier `lib/coachChat.ts` :
   a. Supprimer le `[pending_plans=...]` embedding
   b. Passer `coachMemory` dans le body
   c. Appliquer `memory_update` retourné

3. Déployer sur staging : `supabase functions deploy chat-coach --no-verify-jwt`

4. Vérification manuelle (voir ci-dessous)

---

## Vérification

```bash
supabase functions deploy chat-coach --no-verify-jwt
npm run lint && npm run build
```

Tests manuels sur staging (page `/coach`) :

| Scénario | Attendu |
|---|---|
| "Propose-moi un plan Z2 pour dimanche" | `propose_plan_batch` appelé → carte de plan visible + bouton Valider |
| "ok valide" (réponse à une proposition) | `apply_plan_batch` appelé → `modifiedCount > 0` → bordure lime sur la carte |
| "Je me suis blessé au genou" | `update_memory` appelé → `cc_coach_memory` en localStorage mis à jour → Supabase mis à jour après autoSyncPush |
| "Quelle est ma FC Z2 ?" | Réponse texte sans appel d'outil |
| 5 messages consécutifs | Boucle ne dépasse jamais 5 itérations (vérifier logs Supabase Edge Function) |

Vérifier les logs de la Edge Function :
```bash
supabase functions logs chat-coach --tail
# Doit afficher : [chat-coach] iter=0 usage: {...} stop: tool_use
# Puis : [chat-coach] propose_plan_batch: 2 plans
```
