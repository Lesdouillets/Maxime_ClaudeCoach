# Spec — Refonte des pages de séances ClaudeCoach

**Date :** 2026-05-15  
**Statut :** En cours — EPIC 1 et 2 livrés (2026-05-22), EPIC 3 à venir  
**GitHub :** issues #91 à #97, label `refonte-seances`

---

## Contexte

La refonte de la home a établi une nouvelle identité visuelle (design system tokens, typographie Archivo/JetBrains Mono, palette #CDFF00/#D07900/#6BD2FF). Les pages de séance — détail avant séance, séance active, et récap post-séance — doivent être entièrement reconstruites pour être cohérentes avec ce nouveau design. Les anciens composants de session ne sont pas réutilisés : ils sont remplacés.

---

## Objectif

L'utilisateur doit pouvoir accéder à une page de détail de séance, démarrer et suivre sa séance exercice par exercice, et consulter un récap enrichi après l'effort — le tout avec une identité visuelle unifiée avec la home.

---

## Périmètre

**Dans le scope :**
- Page de détail séance (avant le démarrage)
- Vue séance active : exercice en cours, timer de repos, progression
- Écran de transition fin de séance
- Page récap post-séance avec analyse coach

**Hors scope :**
- Modification de la logique métier (hooks `useTimer()`, logique de progression restent intacts)
- Séances de type run ou stretch — seule la fitness est dans cette version
- Édition du programme depuis les pages de séance
- Notifications push liées à la séance

---

## Design system de référence

| Token | Valeur |
|---|---|
| Titre | Archivo 700, `fontVariationSettings: '"wdth" 110'` |
| Labels/metadata | JetBrains Mono 700, tracking 0.10em, uppercase |
| Accent principal | `#CDFF00` |
| Accent fitness | `#D07900` |
| Accent run | `#6BD2FF` |
| Background cards | `#1a1a1a` / `#0a1a00` selon contexte |
| Coins arrondis | `rounded-2xl` (16px) |

---

## Stratégie de réutilisation des composants

### Composants réutilisables — issus de la refonte home

| Composant | Usage dans les pages de séance |
|---|---|
| `FitnessCard` (dans `SessionCard.tsx`) | Header de la page de détail et du récap post-séance |
| `SessionTag.tsx` | Badge de statut session |
| `DayHeader.tsx` | Conventions de layout et typographie |
| `WeekProgram.tsx` | Contexte semaine sur la page de détail |

### Composants à créer from scratch

Les anciens composants (`FitnessSessionResults`, `CoachFeedbackCard`, `ActiveCard`, `CollapsedCard`, `SessionSheet` internals) sont **remplacés**.

| Nouveau composant | Remplace | Issue | Statut |
|---|---|---|---|
| `ActiveExerciseCard` | `ActiveCard` | #92 | ✅ Livré 2026-05-22 |
| `ExerciseRowCard` (4 variants) | `CollapsedCard` + `PlannedExerciseRow` | #93 | ✅ Livré 2026-05-22 — architecture diverge de la spec : un seul composant avec variants `planned` / `upcoming` / `completed` / `in_progress` au lieu d'un `CompletedExerciseCard` séparé |
| `RestTimer` | Timer dans `SessionSheet` | #94 | À faire |
| `SessionEndTransition` | Écran de fin ad hoc | #95 | À faire |
| `SessionRecap` | `FitnessSessionResults` | #96 | À faire |
| `CoachAnalysis` | `CoachFeedbackCard` | #97 | À faire |

> Le design de chaque composant est fourni via Figma au moment du développement de chaque US.

---

## EPICs et User Stories

### EPIC 1 — Page de détail séance

| US | Titre | Issue | Complexité | Priorité | Statut |
|---|---|---|---|---|---|
| US-01 | Page de détail séance | #91 | Moyenne | Must have | ✅ Livré 2026-05-22 |

### EPIC 2 — Séance active

| US | Titre | Issue | Complexité | Priorité | Statut |
|---|---|---|---|---|---|
| US-02 | Vue exercice en cours (ActiveExerciseCard) | #92 | Moyenne | Must have | ✅ Livré 2026-05-22 |
| US-03 | Vue exercices terminés/en cours réduits (ExerciseRowCard) | #93 | Faible | Must have | ✅ Livré 2026-05-22 |
| US-04 | Timer de repos (RestTimer) | #94 | Faible | Must have | À faire |

### EPIC 3 — Fin de séance et récap

| US | Titre | Issue | Complexité | Priorité | Statut |
|---|---|---|---|---|---|
| US-05 | Transition fin de séance (SessionEndTransition) | #95 | Faible | Should have | À faire |
| US-06 | Récap post-séance (SessionRecap) | #96 | Moyenne | Must have | À faire |
| US-07 | Analyse coach post-séance (CoachAnalysis) | #97 | Moyenne | Must have | À faire |

---

## Ordre de développement suggéré

```
1. US-01 — Page de détail séance          ✅ (bloque tout le flow)
2. US-02 — ActiveExerciseCard             ✅ (composant central de la séance)
3. US-03 — ExerciseRowCard (4 variants)   ✅ (planned / upcoming / completed / in_progress)
4. US-04 — RestTimer                      ← prochain (dépend de US-02)
5. US-06 — SessionRecap                   (première page de sortie, bloque US-07)
6. US-07 — CoachAnalysis                  (s'ajoute sur la page récap)
7. US-05 — SessionEndTransition           (transition entre séance et récap, intégrée en dernier)
```
