# Sprint 4 — Branchement analyze-session sur la mémoire
**Statut : VALIDÉ — Sprint 4**
**Date : 2026-05-29**
**Dépend de : Sprint 3 livré**

---

## Objectif

`analyze-session` devient le second contributeur à la mémoire coach. Après chaque séance analysée, il peut mettre à jour `cc_coach_memory` avec des tendances run/fitness observées. `coachAnalyzer.ts` applique ces mises à jour côté client.

---

## Logique du Sprint 4

La mémoire a deux sources d'écriture :

| Source | Quand | Quoi |
|---|---|---|
| `chat-coach` via `update_memory` tool (Sprint 3) | En temps réel | Blessures, objectifs, contraintes mentionnées par l'user |
| `analyze-session` via `memory_update` (Sprint 4) | Après chaque séance | Tendances run (FC Z2, lastLongRun), keyLifts fitness, poids si mentionné |

La règle : `analyze-session` écrit des tendances **observées sur les données** (pas ce que l'user dit en chat). Il est parcimonieux — mieux vaut ne rien écrire que polluer la mémoire avec des infos éphémères.

---

## Fichier 1 — `supabase/functions/analyze-session/index.ts` — modifications

### 1. Lire la mémoire depuis le body de la requête

Même approche que `chat-coach` : le client passe `coachMemory` dans le body. La Edge Function ne peut pas accéder à localStorage.

```typescript
// Dans le handler, ajouter coachMemory au destructuring du body :
const { session, coachPlans = [], recentSessions = [], profileName = "Maxime", previousAnalyses = [], chatContext, coachMemory } = body;
```

### 2. Injecter la mémoire dans le prompt utilisateur

Dans `buildUserPrompt`, ajouter un paramètre `coachMemory` et une section dédiée :

```typescript
function buildUserPrompt(
  session: unknown,
  coachPlans: unknown[],
  recentSessions: unknown[],
  previousAnalyses: Array<{ date: string; analysis: string }> = [],
  chatContext?: string,
  coachMemory?: Record<string, unknown>,  // ← NOUVEAU
): string {
  // ... code existant ...

  // Ajouter après historySection et chatContextSection :
  const memorySection = coachMemory
    ? formatCoachMemoryForPrompt(coachMemory)
    : "";
  const memoryBlock = memorySection
    ? `\n${memorySection}\n`
    : "";

  return `${historySection}${chatContextSection}${memoryBlock}## Séance réalisée ...`
  // ↑ memoryBlock inséré après le contexte de conversation, avant la séance
}
```

> `formatCoachMemoryForPrompt` doit être dupliquée dans la Edge Function (identique à `chat-coach`).

### 3. Nouveau format de réponse attendu du modèle

La section `## FORMAT DE RÉPONSE — STRICT JSON UNIQUEMENT` du system prompt est modifiée :

**Avant :**
```json
{
  "analysis": "...",
  "modified_plans": []
}
```

**Après :**
```json
{
  "analysis": "...",
  "modified_plans": [],
  "memory_update": null
}
```

`memory_update` est optionnel : `null` si rien à mettre à jour (réponse la plus fréquente).

### 4. Nouvelles instructions dans le system prompt

Ajouter à la fin du system prompt de `analyze-session` :

```
## MISE À JOUR MÉMOIRE (champ memory_update — optionnel)

Après chaque analyse, tu peux mettre à jour la mémoire coach si la séance révèle quelque chose de significatif à long terme.

**Quand remplir memory_update :**
- run.lastLongRun : si c'est une sortie Z2 ≥ 10km (ex: "14km Z2 le 2026-05-26")
- run.trend : si tu observes une tendance FC Z2 sur 4+ séances consécutives (ex: "FC Z2 stable autour de 145bpm sur 4 semaines")
- fitness.cycle : si tu peux identifier la position dans le cycle de charge (ex: "Semaine 3/4 de charge")
- fitness.upperBody.keyLifts ou lowerBody.keyLifts : si un exercice clé franchit un palier notable (PR, régression marquée). Format : {"Développé couché haltères": "20kg×4×8 — PR"}
- body.currentWeight : UNIQUEMENT si le poids est explicitement mentionné dans le commentaire de séance
- keyNotes : si un événement important survient (blessure identifiée dans les données, objectif mentionné en commentaire)

**Quand laisser memory_update: null :**
- Séance ordinaire sans tendance nouvelle
- Aucun commentaire significatif
- Modification mineure du programme sans implications long terme
- En cas de doute : laisser null

memory_update: null est la réponse correcte dans la majorité des cas.
```

### 5. Extraction de `memory_update` dans la réponse

```typescript
// Dans le handler, après la logique d'extraction JSON existante :

// result contient déjà { analysis, modified_plans }
// Extraire memory_update s'il est présent
const memoryUpdate = result.memory_update && result.memory_update !== null
  ? result.memory_update as Record<string, unknown>
  : null;

return new Response(JSON.stringify({
  analysis: result.analysis,
  modified_plans: result.modified_plans ?? [],
  memory_update: memoryUpdate,
}), {
  headers: { "Content-Type": "application/json", ...CORS },
});
```

---

## Fichier 2 — `lib/coachAnalyzer.ts` — modifications

### 1. Passer `coachMemory` dans le body de la requête

```typescript
import { getCoachMemory, mergeCoachMemory } from "./coachMemory";

// Dans analyzeSession(), avant l'appel supabase.functions.invoke :
const coachMemory = getCoachMemory();

const { data, error } = await supabase.functions.invoke("analyze-session", {
  body: { session, coachPlans: annotatedPlans, recentSessions, profileName, previousAnalyses, chatContext, coachMemory },
});
```

### 2. Appliquer `memory_update` retourné

```typescript
// Dans analyzeSession(), après le bloc d'application des modified_plans :

if (data.memory_update) {
  try {
    mergeCoachMemory(data.memory_update);
    console.log("[analyzeSession] mémoire mise à jour");
  } catch (e) {
    console.error("[analyzeSession] échec merge mémoire:", e);
  }
}

// autoSyncPush() est déjà appelé à la fin — il poussera la mémoire mise à jour
```

> `autoSyncPush()` pousse `cc_coach_memory` depuis Sprint 2. Aucun changement supplémentaire nécessaire.

---

## Règles de contenu pour la mémoire (guide d'implémentation pour le prompt)

### Run

| Champ | Condition | Exemple |
|---|---|---|
| `lastLongRun` | Sortie Z2 ≥ 10km | `"14km Z2 le 2026-05-26"` |
| `trend` | FC Z2 observée sur 4+ runs | `"FC Z2 stable ~145bpm (5 sem)"` |
| `nextRace` | Mentionné dans le commentaire | `"10km le 28 juin 2026"` |
| `notes` | Blessure identifiable dans les données | `"Genou droit : arrêt run 2026-05-15 à 2026-05-25"` |

### Fitness

| Champ | Condition | Exemple |
|---|---|---|
| `cycle` | Position dans le cycle identifiable | `"Semaine 2/4 de charge"` |
| `upperBody.keyLifts` | PR ou régression marquée | `{"Développé couché": "20kg×4×8 — PR 2026-05-27"}` |
| `lowerBody.keyLifts` | Idem | `{"Squat": "80kg×3×8 — stable"}` |
| `upperBody.lastSession` | Systématique à chaque séance upper | `"2026-05-27"` |
| `lowerBody.lastSession` | Idem | `"2026-05-28"` |

### Body

| Champ | Condition | Exemple |
|---|---|---|
| `currentWeight` | Mentionné dans le commentaire de séance | `74.5` |
| `trend` | Calculable si poids mentionné plusieurs fois | `"−0.2kg/semaine"` |

---

## Ce qui ne change PAS dans `analyze-session`

- `phantom guard` (filtre les plans fantômes) — identique
- `dedup by slot` — identique
- Logique fire-and-forget — identique
- `CoachAnalysisResult` dans `coachAnalyzer.ts` — identique (pas de champ mémoire dedans, c'est un effet de bord)
- `storeCoachAnalysis()` — identique

---

## Ordre de développement

1. Modifier `buildUserPrompt` dans `analyze-session/index.ts` :
   - Ajouter paramètre `coachMemory`
   - Injecter via `formatCoachMemoryForPrompt`

2. Mettre à jour le system prompt de `analyze-session` :
   - Ajouter la section `## MISE À JOUR MÉMOIRE`
   - Mettre à jour le format JSON attendu (ajouter `memory_update`)

3. Mettre à jour l'extraction de réponse dans le handler :
   - Extraire `memory_update` depuis le JSON parsé
   - L'inclure dans la réponse

4. Modifier `lib/coachAnalyzer.ts` :
   - Importer `getCoachMemory`, `mergeCoachMemory`
   - Passer `coachMemory` dans le body
   - Appliquer `data.memory_update` si présent

5. Déployer : `supabase functions deploy analyze-session --no-verify-jwt`

6. Vérification

---

## Vérification

```bash
supabase functions deploy analyze-session --no-verify-jwt
npm run lint && npm run build
```

Tests manuels :

| Scénario | Attendu |
|---|---|
| Sortie Z2 de 14km → analyse | `memory_update.run.lastLongRun = "14km Z2 le YYYY-MM-DD"` dans la réponse Edge Function |
| Séance fitness upper ordinaire | `memory_update.fitness.upperBody.lastSession` mis à jour |
| PR sur Développé couché | `memory_update.fitness.upperBody.keyLifts` inclut le PR |
| Poids mentionné dans le commentaire | `memory_update.body.currentWeight` mis à jour |
| Séance ordinaire sans événement | `memory_update: null` |
| Après analyse → `cc_coach_memory` en Supabase | Données mises à jour (via `autoSyncPush`) |
| Analyse suivante | Mémoire injectée dans le prompt (vérifier les logs Edge Function) |

Vérifier les logs :
```bash
supabase functions logs analyze-session --tail
# Attendu : [analyzeSession] mémoire mise à jour (si memory_update non null)
```

Vérifier en localStorage :
```javascript
JSON.parse(localStorage.getItem('cc_coach_memory'))
// → Doit refléter les mises à jour de la dernière analyse
```

Le Sprint 4 est terminé quand la mémoire coach se remplit naturellement après chaque séance, est visible dans Supabase, et est injectée dans les analyses suivantes.
