# Design — Refonte Coach Memory
**Statut : DRAFT — à implémenter après le staging**
**Date : 2026-05-28**

---

## Problème

Le coach repart de zéro à chaque conversation. Il voit les données brutes mais ne synthétise pas les tendances dans le temps. Résultat : il ne retient pas pourquoi une séance a été annulée, ne suit pas les progressions de charges, et peut confondre passé et futur.

---

## Solution retenue : Coach Memory (Option B)

Un document JSON persistant `cc_coach_memory` hébergé en Supabase, lu à chaque appel du coach et mis à jour après chaque interaction significative.

**Ce que la mémoire n'est PAS** : une copie des séances brutes (déjà disponibles via `cc_sessions`).
**Ce qu'elle EST** : des synthèses et tendances que le coach ne pourrait pas déduire en lisant 30 séances une par une.

---

## Structure de cc_coach_memory

```json
{
  "lastUpdated": "2026-05-28",
  "run": {
    "trend": "FC Z2 en baisse régulière sur 6 semaines (152→139bpm). Progression régulière.",
    "lastLongRun": "14km Z2 le 26/04",
    "nextRace": "10km le 28 juin 2026",
    "notes": "Genou droit sensible signalé le 15/05"
  },
  "fitness": {
    "cycle": "Semaine 2/4 de charge — upper + lower",
    "upperBody": {
      "lastSession": "2026-05-25",
      "keyLifts": {
        "Développé couché haltères": {
          "current": "18kg × 3×8",
          "trend": "stable 3 séances — prêt à monter",
          "note": "coudes à 45°, descente 3s"
        },
        "Développé militaire": {
          "current": "9kg × 3×10",
          "trend": "point faible — progression très lente",
          "note": "ne pas forcer avant 4 séances propres"
        }
      }
    },
    "lowerBody": {
      "lastSession": "2026-05-23",
      "keyLifts": {
        "Squat barre": { "current": "100kg × 4×6", "trend": "stable" },
        "Romanian deadlift": { "current": "72kg × 4×10", "trend": "+2kg/semaine" }
      }
    }
  },
  "body": {
    "currentWeight": 74.8,
    "trend": "−0.2kg/semaine sur 6 semaines",
    "target": 74.0
  },
  "keyNotes": [
    { "date": "2026-05-15", "note": "Genou droit sensible — éviter séances jambes lourdes consécutives" },
    { "date": "2026-05-10", "note": "Semaine chargée pro fin mai" }
  ]
}
```

---

## Composants à modifier

### 1. Nouvelle table Supabase `cc_coach_memory`
- Un enregistrement par `user_id + profile_id`
- Colonne `data` de type JSONB
- Lecture à chaque appel coach, écriture après chaque interaction significative

### 2. `analyze-session` enrichi
- Lit `cc_coach_memory` au début
- Après adaptation des plans, met à jour la section `run` ou `fitness` selon le type de séance
- Recalcule les tendances sur les 4-6 dernières séances du même type
- Réécrit la mémoire en Supabase

### 3. `chat-coach` enrichi
- Reçoit `coachMemory` en plus des paramètres existants
- L'injecte dans le contexte système (après les analyses récentes)
- Si l'utilisateur mentionne blessure / contrainte / objectif → génère une mise à jour `keyNotes` en réponse JSON
- Le client persiste cette mise à jour en Supabase

### 4. Champ `reason` sur les annulations
- `cc_cancelled_days` et `cc_rescheduled_days` : ajouter champ `reason?: string`
- UI : proposition de saisie rapide au moment de l'annulation
- `analyze-session` lit les annulations récentes avec leur raison pour contexte

### 5. Poids de corps
- La saisie existe déjà dans les stats
- Brancher la valeur courante sur `cc_coach_memory.body.currentWeight`
- `analyze-session` met à jour la tendance si un nouveau poids est disponible

---

## Format de réponse enrichi (UI)

Les propositions de plans sont rendues en **proposal cards** groupées par domaine :
- Bloc run séparé du bloc fitness
- Résumé par séance (date, type, distance/exercices, durée)
- Actions Adapter / Valider par bloc
- Accessible via le chat coach existant

---

## Ce qui ne change pas
- Format JSON des plans (run et fitness)
- Mécanisme pending/modified/delete
- Logique sync localStorage↔Supabase
- Déploiement GitHub Pages
- Une seule Edge Function coach (pas d'agents séparés run/fitness)

---

## Prérequis
- **Staging opérationnel** (à faire en premier)
- Développer et tester sur staging avant toute modification prod
