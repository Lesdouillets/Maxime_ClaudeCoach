# Design — Environnement Staging (Option B)
**Statut : À IMPLÉMENTER**
**Date : 2026-05-28**

---

## Objectif

Créer un environnement de développement isolé pour tester la refonte du coach sans impacter la production. Isolation complète : base de données, Edge Functions, secrets.

---

## Contexte

- **Prod Supabase** : projet `mwjnryfudxfcwqbwlafe` ("Claude Coach")
- **Prod déploiement** : GitHub Pages via `main`, base path `/Maxime_ClaudeCoach`
- **Dev local actuel** : `.env.local` + `NEXT_PUBLIC_DISABLE_SYNC=true` (sync désactivé → écrit pas en prod)
- **Accès staging voulu** : local uniquement (localhost)
- **Données staging** : copie ponctuelle depuis `sync.json` existant

---

## Ce qui est créé

| Élément | Prod | Staging |
|---|---|---|
| Supabase project | `mwjnryfudxfcwqbwlafe` | nouveau projet à créer |
| Fichier env | `.env.local` | `.env.staging` |
| Script de démarrage | `npm run dev` | `npm run dev:staging` |
| Edge Functions | déployées sur prod | déployées sur staging |
| ANTHROPIC_API_KEY | secret sur prod | secret sur staging (même clé) |
| Sync activé | oui | oui (`DISABLE_SYNC=false`) |
| Données | réelles | copiées depuis `sync.json` |

---

## Architecture du setup

```
.env.local          → Supabase prod   (npm run dev)
.env.staging        → Supabase staging (npm run dev:staging)

supabase/.temp/linked-project.json → projet actif pour les commandes CLI
  (basculer avec : supabase link --project-ref <ref>)

scripts/seed-staging.js → lit sync.json, insère dans Supabase staging
```

---

## Étapes d'implémentation

### 1. Créer le projet Supabase staging
- Via console Supabase : nouveau projet "Claude Coach Staging"
- Récupérer : `STAGING_PROJECT_REF`, `STAGING_SUPABASE_URL`, `STAGING_ANON_KEY`

### 2. Dumper le schéma prod et l'appliquer au staging
```bash
# Lié à prod (ref: mwjnryfudxfcwqbwlafe)
supabase db dump --linked --schema public > supabase/prod-schema.sql

# Basculer sur staging
supabase link --project-ref <STAGING_PROJECT_REF>

# Appliquer le schéma
supabase db push  # ou via dashboard SQL editor
```

### 3. Créer `.env.staging`
```
# Supabase staging
NEXT_PUBLIC_SUPABASE_URL=https://<staging-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<staging-anon-key>

# Strava — mêmes credentials que prod (pas de duplication nécessaire)
NEXT_PUBLIC_STRAVA_CLIENT_ID=<same as prod>
NEXT_PUBLIC_STRAVA_CLIENT_SECRET=<same as prod>
NEXT_PUBLIC_STRAVA_REDIRECT_URI=http://localhost:3000/strava/callback

# Pas de base path en local
NEXT_PUBLIC_BASE_PATH=

# Sync activé sur staging (c'est le but)
NEXT_PUBLIC_DISABLE_SYNC=false

# Indicateur d'environnement (affiché dans l'app)
NEXT_PUBLIC_ENV=staging
```

Ajouter aussi dans `.env.local` :
```
NEXT_PUBLIC_ENV=local
```
(prod : variable absente → badge masqué)

### 3b. Badge environnement dans le layout
Dans `app/layout.tsx`, un badge fixe en haut à droite, visible uniquement si `NEXT_PUBLIC_ENV` est défini :
- `local` → badge gris `LOCAL`
- `staging` → badge orange `STG2`
- absent (prod) → rien

Position : `fixed top-3 right-3 z-50`, petit pill `text-[10px] font-mono px-2 py-0.5 rounded-full`.

### 4. Ajouter `dotenv-cli` et le script `dev:staging`
```bash
npm install --save-dev dotenv-cli
```

`package.json` :
```json
"scripts": {
  "dev": "next dev",
  "dev:staging": "dotenv -e .env.staging -- next dev",
  ...
}
```

### 5. Créer `scripts/seed-staging.js`
Script Node.js qui :
1. Lit `sync.json`
2. Lit `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` depuis `.env.staging`
3. Insère dans les tables staging : `sessions`, `coach_plans`, `cancelled_days`, `rescheduled_days`
4. Upsert (idempotent — relançable sans doublon)

```bash
npm run seed:staging   # lance scripts/seed-staging.js avec les vars de .env.staging
```

### 6. Déployer les Edge Functions sur staging
```bash
# Basculer le lien CLI sur staging
supabase link --project-ref <STAGING_PROJECT_REF>

# Déployer les deux fonctions
supabase functions deploy chat-coach --no-verify-jwt
supabase functions deploy analyze-session --no-verify-jwt

# Configurer le secret Anthropic
supabase secrets set ANTHROPIC_API_KEY=<même clé que prod>

# Rebrancher sur prod (pour ne pas oublier)
supabase link --project-ref mwjnryfudxfcwqbwlafe
```

### 7. Mettre à jour `.gitignore`
Ajouter `.env.staging` (contient des secrets, ne doit pas être commité).

---

## Règle d'utilisation des environnements

| Ce qu'on teste | Environnement |
|---|---|
| UI, composants, layout | `npm run dev` (local dev) — rapide, pas de déploiement |
| Coach : chat, analyze-session, prompts, mémoire | `npm run dev:staging` (stg2) — **obligatoire** |

En local dev, `SYNC_DISABLED=true` coupe entièrement les Edge Functions (`analyze-session` et `chat-coach` retournent immédiatement). Le coach est inactif — c'est intentionnel pour protéger la prod.

Toute la refonte coach se développe et se teste sur stg2. Déployer la Edge Function modifiée sur staging avant de tester.

---

## Workflow quotidien

```bash
# Démarrer en mode staging
npm run dev:staging      # → localhost:3000, Supabase staging

# Démarrer en mode prod (inchangé)
npm run dev              # → localhost:3000, Supabase prod (sync désactivé via .env.local)

# Re-seeder staging (si besoin de repartir propre)
npm run seed:staging

# Déployer une Edge Function modifiée sur staging
supabase link --project-ref <STAGING_REF>
supabase functions deploy chat-coach --no-verify-jwt
supabase link --project-ref mwjnryfudxfcwqbwlafe   # rebrancher sur prod
```

---

## Simulation run sur staging

La fitness peut être simulée directement dans l'app (créer et valider une séance). Le run ne peut pas : impossible de faire un vrai run pour tester.

**Ce qui existe déjà :** le `/dev` charge des runs fictifs dans localStorage via `seedLocalStorage()`. Suffisant pour tester l'affichage.

**Ce qui manque :** un moyen de simuler la *complétion* d'un run pour déclencher le flow complet `analyze-session` → mise à jour des plans → réponse coach. À ajouter dans `/dev` : un bouton "Simuler run terminé" qui crée une session run réaliste (distance, FC, pace, durée) datée d'aujourd'hui et déclenche `analyze-session` exactement comme si l'utilisateur venait de rentrer d'un run.

Ce bouton n'est actif que sur staging (à conditionner sur `NEXT_PUBLIC_DISABLE_SYNC=false` ou une variable `NEXT_PUBLIC_ENV=staging`).

---

## Ce qui ne change pas
- `.env.local` et `npm run dev` — inchangés, prod toujours protégée
- Déploiement GitHub Pages — inchangé
- Structure de code — aucune modification applicative

---

## Prérequis avant de commencer
- [ ] Créer le projet Supabase staging via la console web
- [ ] Avoir les 3 valeurs : `PROJECT_REF`, `SUPABASE_URL`, `ANON_KEY`
