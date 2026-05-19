# Design — #90 : runType + durationMin sur les runs coach

**Date :** 2026-05-19
**Issue :** [#90](https://github.com/Lesdouillets/Maxime_ClaudeCoach/issues/90)
**Statut :** Approuvé

---

## Problème

Le coach (Edge Function `chat-coach`) ne renseigne jamais `durationMin` sur les `CoachRun` qu'il génère, et le champ `label` est utilisé comme mélange de type et de titre ("RUN Z2", "FRACTIONNÉ 400m"), rendant l'affichage incohérent.

Deux besoins distincts n'étaient pas séparés :
1. Le **type** de séance (badge visuel) : Zone 2, Tempo, Fractionné, Progressif, Course
2. Le **titre** descriptif court : Sortie Longue, 10×400m, Z2>Z3>Z4

---

## Décision : Option A — champ `runType` explicite

Le coach décide du type de séance directement dans le JSON. Pas de dérivation côté UI depuis `targetZone` ou `intervals` — trop fragile car les runs ont presque toujours un échauffement en `intervals`, ce qui court-circuiterait la détection automatique.

**Rejeté : dérivation automatique** (`targetZone` + analyse des `intervals`) — un long run Z2 avec échauffement sortirait "Intervals" au lieu de "Zone 2".

---

## Changements

### 1. Type TypeScript — `lib/coachPlan.ts`

Ajout d'un champ optionnel dans `CoachRun` :

```typescript
runType?: "z2" | "tempo" | "fractionne" | "progressif" | "course"
```

Ajout dans le parser `parseRun()` :

```typescript
runType: ["z2","tempo","fractionne","progressif","course"].includes(data.runType as string)
  ? (data.runType as CoachRun["runType"])
  : undefined,
```

Ajout de la fonction utilitaire :

```typescript
export function getRunBadge(run: CoachRun): string | null {
  const labels: Record<NonNullable<CoachRun["runType"]>, string> = {
    z2: "Zone 2", tempo: "Tempo", fractionne: "Fractionné",
    progressif: "Progressif", course: "Course",
  };
  return run.runType ? labels[run.runType] : null;
}
```

### 2. System prompt — `supabase/functions/chat-coach/index.ts`

Dans `buildSystemPrompt()`, ajouter dans la section formats de séance :

**Règles obligatoires pour les runs :**
- `runType` est OBLIGATOIRE : `"z2"` | `"tempo"` | `"fractionne"` | `"progressif"` | `"course"`
- `durationMin` est OBLIGATOIRE : temps total terrain en minutes, arrondi à l'entier
  - Run continu : `distanceKm × pace (sec/km) ÷ 60`
  - Avec intervals : somme de `(distanceKm × pace × (reps ?? 1))` pour chaque segment + total des `restSeconds`
- `label` est un TITRE COURT descriptif (ex: "Sortie Longue", "10×400m", "Z2>Z3>Z4", "Seuil 6km") — jamais le type seul

**Exemples mis à jour avec `runType` et `durationMin` :**

```json
// Z2
{"id":"...","date":"...","type":"run","runType":"z2","label":"Sortie Longue",
 "distanceKm":12,"pace":"6:00","targetZone":"Z2","targetHR":"112-149","durationMin":72}

// Fractionné
{"id":"...","date":"...","type":"run","runType":"fractionne","label":"10×400m",
 "distanceKm":8,"durationMin":54,
 "intervals":[
   {"label":"Échauffement","distanceKm":2,"pace":"6:30","targetZone":"Z2"},
   {"label":"400m","reps":10,"distanceKm":0.4,"pace":"4:00","targetZone":"Z4","restSeconds":90},
   {"label":"Retour au calme","distanceKm":1.5,"pace":"6:30","targetZone":"Z2"}
 ]}

// Progressif
{"id":"...","date":"...","type":"run","runType":"progressif","label":"Z2>Z3>Z4",
 "distanceKm":9,"durationMin":49,
 "intervals":[
   {"label":"Phase 1","distanceKm":4,"pace":"6:00","targetZone":"Z2"},
   {"label":"Phase 2","distanceKm":3,"pace":"5:20","targetZone":"Z3"},
   {"label":"Phase 3","distanceKm":2,"pace":"4:50","targetZone":"Z4"}
 ]}

// Tempo
{"id":"...","date":"...","type":"run","runType":"tempo","label":"Seuil 6km",
 "distanceKm":9,"durationMin":49,
 "intervals":[
   {"label":"Échauffement","distanceKm":2,"pace":"6:30","targetZone":"Z2"},
   {"label":"Tempo","distanceKm":6,"pace":"4:50","targetZone":"Z3","targetHR":"149-168"},
   {"label":"Récup","distanceKm":1,"pace":"6:30","targetZone":"Z2"}
 ]}
```

### 3. Composant UI — `components/CoachRunPlan.tsx`

- Suppression de l'ancienne logique de badge
- Affichage du badge depuis `getRunBadge(run)` — `null` → pas de badge (runs legacy sans `runType`)
- Affichage du `label` comme titre
- Affichage de `durationMin` si présent : format `~72 min`

---

## Rétrocompatibilité

Coupure nette. Les runs existants en localStorage sans `runType` n'affichent pas de badge. Pas de migration rétrospective — ils seront naturellement remplacés par les prochains plans générés par le coach.

---

## Fichiers touchés

| Fichier | Changement |
|---|---|
| `lib/coachPlan.ts` | Ajout `runType` dans `CoachRun`, `parseRun()`, `getRunBadge()` |
| `supabase/functions/chat-coach/index.ts` | `buildSystemPrompt()` : règles + exemples mis à jour |
| `components/CoachRunPlan.tsx` | Remplacement ancienne logique badge, affichage titre + durée |

---

## Hors scope

- `analyze-session` (autre issue)
- `isRace` complet (issues #98, #99, #100 — sprint suivant)
- Migration des runs existants en localStorage
