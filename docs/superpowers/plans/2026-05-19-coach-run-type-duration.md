# Coach Run Type + Duration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter `runType` (badge explicite) et `durationMin` (durée terrain) aux runs générés par le coach, et les afficher dans `CoachRunPlan`.

**Architecture:** Trois changements indépendants et séquentiels — type TS + parser + utilitaire, puis system prompt de l'Edge Function, puis composant UI. Aucune migration de données.

**Tech Stack:** TypeScript, React/Next.js 14, Deno (Edge Function Supabase), Tailwind CSS

**Spec :** `docs/superpowers/specs/2026-05-19-coach-run-type-duration-design.md`

---

## Fichiers touchés

| Fichier | Action |
|---|---|
| `lib/coachPlan.ts` | Modifier : ajout `runType` dans `CoachRun`, `parseRun()`, nouvelle fonction `getRunBadge()` |
| `supabase/functions/chat-coach/index.ts` | Modifier : `buildSystemPrompt()` — nouvelles instructions + exemples JSON |
| `components/CoachRunPlan.tsx` | Modifier : affichage badge depuis `getRunBadge()`, titre `label`, durée `durationMin` |

---

## Task 1 : Ajout de `runType` dans le type, le parser et `getRunBadge()`

**Fichier :** `lib/coachPlan.ts`

- [ ] **Étape 1 : Ajouter `runType` dans l'interface `CoachRun`**

Ouvrir `lib/coachPlan.ts`. Localiser l'interface `CoachRun` (autour de la ligne 30). Ajouter le champ après `isRace?` :

```typescript
export interface CoachRun {
  id: string;
  type: "run";
  date: string;
  label: string;
  coachNote?: string;
  distanceKm: number;
  pace?: string;
  durationMin?: number;
  targetHR?: string;
  targetZone?: string;
  intervals?: CoachRunInterval[];
  isRace?: boolean;
  runType?: "z2" | "tempo" | "fractionne" | "progressif" | "course";
}
```

- [ ] **Étape 2 : Ajouter `runType` dans `parseRun()`**

Dans la fonction `parseRun()`, ajouter après la ligne `isRace: data.isRace === true,` :

```typescript
runType: (["z2", "tempo", "fractionne", "progressif", "course"] as const).includes(
  data.runType as CoachRun["runType"]
)
  ? (data.runType as CoachRun["runType"])
  : undefined,
```

- [ ] **Étape 3 : Ajouter la fonction `getRunBadge()` entre les storage helpers et le parser**

Localiser la ligne `// ─── JSON Parser ───` dans `lib/coachPlan.ts`. Insérer le bloc suivant **juste avant** cette ligne (après `getTodayCoachWorkout`) :

```typescript
// ─── Run badge ────────────────────────────────────────────────────────────────

const RUN_BADGE_LABELS: Record<NonNullable<CoachRun["runType"]>, string> = {
  z2: "Zone 2",
  tempo: "Tempo",
  fractionne: "Fractionné",
  progressif: "Progressif",
  course: "Course",
};

export function getRunBadge(run: CoachRun): string | null {
  return run.runType ? RUN_BADGE_LABELS[run.runType] : null;
}
```

- [ ] **Étape 4 : Vérifier la compilation**

```bash
cd /Users/famillemillet/Projects/Maxime_ClaudeCoach && npm run lint
```

Résultat attendu : aucune erreur TypeScript sur `lib/coachPlan.ts`.

- [ ] **Étape 5 : Commit**

```bash
git add lib/coachPlan.ts
git commit -m "Ajout runType dans CoachRun et fonction getRunBadge"
```

---

## Task 2 : Mise à jour du system prompt `chat-coach`

**Fichier :** `supabase/functions/chat-coach/index.ts`

- [ ] **Étape 1 : Localiser la section à modifier**

Dans `buildSystemPrompt()`, repérer la section `## FORMATS DE SÉANCE (pour modified_plans)`. Cette section contient les blocs `**Run continu (Z2, long run)**`, `**Fractionné (intervals)**`, `**Run progressif (multi-allures)**` et `**Tempo (seuil)**`.

- [ ] **Étape 2 : Remplacer ces quatre blocs run par les nouveaux**

Supprimer les quatre blocs run existants et les remplacer par :

```
## RÈGLES OBLIGATOIRES POUR LES RUNS

- \`runType\` est OBLIGATOIRE sur chaque run : "z2" | "tempo" | "fractionne" | "progressif" | "course"
- \`durationMin\` est OBLIGATOIRE : temps total terrain en minutes entières (course + repos)
  - Run continu : Math.round(distanceKm × pace_en_secondes_par_km / 60)
  - Avec intervals : somme pour chaque segment de (distanceKm × pace_sec × (reps ?? 1) / 60) + total des restSeconds / 60, arrondi
- \`label\` est un TITRE COURT descriptif, jamais le type seul :
  - Z2 long → "Sortie Longue"
  - Z2 moyen → "Footing"
  - Tempo → "Seuil Xkm"
  - Fractionné → "N×Xm" (ex: "10×400m")
  - Progressif → "Z2>Z3>Z4"
  - Le coach peut proposer librement si ces exemples ne matchent pas (ex: "Fartlek 30min", "Reprise légère")

**Run continu Z2**
{"id":"coach-chat-YYYY-MM-DD-0","date":"YYYY-MM-DD","type":"run","runType":"z2","label":"Sortie Longue","distanceKm":12,"pace":"6:00","targetZone":"Z2","targetHR":"112-149","durationMin":72}

**Fractionné**
{"id":"coach-chat-YYYY-MM-DD-0","date":"YYYY-MM-DD","type":"run","runType":"fractionne","label":"10×400m","distanceKm":8,"durationMin":54,
 "intervals":[
   {"label":"Échauffement","distanceKm":2,"pace":"6:30","targetZone":"Z2"},
   {"label":"400m rapide","reps":10,"distanceKm":0.4,"pace":"4:00","targetZone":"Z4","restSeconds":90},
   {"label":"Retour au calme","distanceKm":1.5,"pace":"6:30","targetZone":"Z2"}
 ]}

**Run progressif**
{"id":"coach-chat-YYYY-MM-DD-0","date":"YYYY-MM-DD","type":"run","runType":"progressif","label":"Z2>Z3>Z4","distanceKm":9,"durationMin":49,
 "intervals":[
   {"label":"Phase 1","distanceKm":4,"pace":"6:00","targetZone":"Z2"},
   {"label":"Phase 2","distanceKm":3,"pace":"5:20","targetZone":"Z3"},
   {"label":"Phase 3","distanceKm":2,"pace":"4:50","targetZone":"Z4"}
 ]}

**Tempo**
{"id":"coach-chat-YYYY-MM-DD-0","date":"YYYY-MM-DD","type":"run","runType":"tempo","label":"Seuil 6km","distanceKm":9,"durationMin":49,
 "intervals":[
   {"label":"Échauffement","distanceKm":2,"pace":"6:30","targetZone":"Z2"},
   {"label":"Tempo","distanceKm":6,"pace":"4:50","targetZone":"Z3","targetHR":"149-168"},
   {"label":"Récup","distanceKm":1,"pace":"6:30","targetZone":"Z2"}
 ]}
```

- [ ] **Étape 3 : Commit**

```bash
git add supabase/functions/chat-coach/index.ts
git commit -m "Mise à jour system prompt chat-coach : runType + durationMin obligatoires"
```

- [ ] **Étape 4 : Déployer l'Edge Function**

```bash
supabase functions deploy chat-coach --no-verify-jwt
```

Résultat attendu : `Deployed Function chat-coach`

---

## Task 3 : Mise à jour du composant `CoachRunPlan`

**Fichier :** `components/CoachRunPlan.tsx`

- [ ] **Étape 1 : Ajouter l'import de `getRunBadge`**

Modifier la ligne d'import :

```typescript
import Badge from "@/components/Badge";
import { getRunBadge } from "@/lib/coachPlan";
import type { CoachRun, CoachRunInterval } from "@/lib/coachPlan";
```

- [ ] **Étape 2 : Réécrire le composant**

Remplacer la fonction `CoachRunPlan` en entier (garder `parsePaceSec`, `segDuration`, `segDistLabel` intactes) :

```typescript
export default function CoachRunPlan({ coachRun }: Props) {
  const badge = getRunBadge(coachRun);

  return (
    <div className="rounded-2xl p-4" style={{ background: "rgba(205,255,0,0.04)", border: "1px solid rgba(205,255,0,0.15)" }}>
      <p className="text-[10px] font-bold tracking-widest mb-3" style={{ color: "#CDFF00" }}>PLAN COACH</p>

      {/* En-tête : badge + titre + durée */}
      <div className="flex items-center gap-2 mb-3">
        {badge && <Badge label={badge} variant="neon" />}
        <span className="text-sm font-bold">{coachRun.label}</span>
        {coachRun.durationMin && (
          <span className="text-xs ml-auto" style={{ color: "#888" }}>~{coachRun.durationMin} min</span>
        )}
      </div>

      {coachRun.intervals && coachRun.intervals.length > 0 ? (
        <div className="space-y-3">
          {coachRun.intervals.map((seg, i) => (
            <div key={i} className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium">{seg.label ?? segDistLabel(seg)}</p>
                {seg.label && (
                  <p className="text-xs mt-0.5" style={{ color: "#555" }}>{segDistLabel(seg)}</p>
                )}
              </div>
              <div className="text-right ml-4">
                <p className="text-sm font-semibold" style={{ color: "#ccc" }}>{segDuration(seg)}</p>
                <p className="text-xs mt-0.5" style={{ color: "#555" }}>
                  {seg.pace}/km
                  {seg.targetHR && ` · ♥ ${seg.targetHR}`}
                </p>
                {seg.restSeconds && (
                  <p className="text-xs" style={{ color: "#555" }}>récup {seg.restSeconds}s</p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex gap-4 items-end">
          <div>
            <span className="font-display text-3xl" style={{ color: "#CDFF00" }}>{coachRun.distanceKm}</span>
            <span className="text-xs text-muted ml-1">km</span>
          </div>
          <span className="font-display text-2xl" style={{ color: "#CDFF00" }}>{coachRun.pace}/km</span>
          {coachRun.targetHR && <span className="text-sm text-muted self-end mb-1">♥ {coachRun.targetHR}</span>}
        </div>
      )}
    </div>
  );
}
```

> Note : le badge `targetZone` qui existait sur les runs simples est supprimé — remplacé par le badge `runType` en en-tête, valable pour tous les cas.

- [ ] **Étape 3 : Lancer le dev server et vérifier manuellement**

```bash
npm run dev
```

Ouvrir `http://localhost:3000/dev/components` → onglet **Cartes**.

Vérifier sur les runs du seed data :
- [ ] Un run avec `runType` affiche le badge correct (Zone 2, Fractionné, etc.)
- [ ] Le `label` apparaît comme titre à côté du badge
- [ ] `durationMin` s'affiche en `~XX min` à droite si présent
- [ ] Un run sans `runType` (runs legacy) affiche le titre sans badge — pas d'erreur
- [ ] Les intervals s'affichent comme avant

- [ ] **Étape 4 : Vérifier la compilation complète**

```bash
npm run build
```

Résultat attendu : build sans erreur.

- [ ] **Étape 5 : Commit**

```bash
git add components/CoachRunPlan.tsx
git commit -m "CoachRunPlan : badge runType, titre label, durée durationMin"
```

---

## Task 4 : Vérification end-to-end avec le coach

- [ ] **Étape 1 : Aller dans la page Coach**

Ouvrir `http://localhost:3000/coach` et demander au coach de planifier un run pour la semaine prochaine. Exemple : *"Planifie-moi un long run Z2 de 12km dimanche prochain"*

- [ ] **Étape 2 : Vérifier le JSON retourné**

Dans la réponse du coach (visible dans les DevTools → Network → `chat-coach`), vérifier que le run dans `pending_plans` ou `modified_plans` contient :
- `"runType": "z2"` (ou autre type approprié)
- `"durationMin": <nombre>` (non nul)
- `"label": "Sortie Longue"` (titre descriptif, pas "RUN Z2")

- [ ] **Étape 3 : Confirmer le plan et vérifier l'affichage**

Confirmer la proposition du coach. Aller sur la page plan (`/plan`) et vérifier que la carte run affiche bien badge + titre + durée.

- [ ] **Étape 4 : Commit final si tout est bon**

Aucun fichier supplémentaire — les commits précédents couvrent tout. Pousser si validé.

```bash
git push
```
