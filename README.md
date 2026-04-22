# Claude Coach

Application de coaching sportif personnel (musculation + running) avec un coach IA basé sur Claude. Next.js 14 côté client, Supabase côté backend, intégration Strava pour les sorties running.

L'app est **mono-utilisateur** (usage personnel, pas d'auth gate sur les Edge Functions) mais supporte plusieurs profils via `lib/profiles.ts`.

---

## Stack

- **Frontend** : Next.js 14 (App Router), React 18, TypeScript, Tailwind
- **Backend** : Supabase (Postgres + Edge Functions Deno)
- **IA** : Claude Sonnet 4.6 via l'API Anthropic, appelée depuis les Edge Functions (jamais depuis le client — la clé API reste serveur)
- **Intégrations** : Strava OAuth + API
- **Charts** : Recharts
- **Persistance** : localStorage (source primaire, offline-first) synchronisée vers Supabase

---

## Structure du projet

```
app/                      # Pages Next.js (App Router)
├── coach/                # Chat avec le coach Alex
├── day/                  # Vue du jour
├── plan/                 # Programme à venir
├── log/
│   ├── fitness/          # Saisie séance muscu
│   └── run/              # Saisie séance run
├── stats/                # Stats & graphiques
├── settings/             # Profils, Strava, sync
└── strava/callback/      # OAuth Strava

components/               # Composants React
lib/                      # Logique client (storage, sync, coach, strava)
supabase/functions/       # Edge Functions Deno
├── chat-coach/           # Conversation libre avec le coach
└── analyze-session/      # Analyse auto post-séance
```

---

## Modèle de données

Deux sources coexistent :

| Donnée | Type | Storage primaire | Sync Supabase |
|---|---|---|---|
| Profils | `Profile[]` | localStorage | `profiles` table |
| Séances réalisées | `WorkoutSession[]` | localStorage (`cc_sessions`) | `sessions` table |
| Plans coach (muscu) | `CoachWorkout[]` | localStorage (`cc_coach_workouts`) | `coach_plans` table |
| Plans coach (run) | `CoachRun[]` | localStorage (`cc_coach_runs`) | `coach_plans` table |
| Historique chat | `ChatMessage[]` | localStorage (`cc_chat_history`) | `chat_messages` table |
| Analyses coach | `CoachAnalysisResult` par date | localStorage (`cc_coach_analysis_{date}`) | stockées dans `sessions` |

Stratégie de sync : **last-write-wins par timestamp** (`updated_at`). Le push est déclenché automatiquement après chaque mutation via `autoSyncPush()` dans `lib/sync.ts`.

---

## Architecture IA

Toute la logique IA passe par **deux Edge Functions Supabase** distinctes. Les deux utilisent le même modèle (`claude-sonnet-4-6`) avec **prompt caching** sur le system prompt, mais répondent à deux usages différents :

```
┌──────────────┐      invoke       ┌──────────────────┐     fetch     ┌─────────────┐
│  Next.js app │ ────────────────► │   Edge Function  │ ─────────────► │  Anthropic  │
│  (client)    │                   │      (Deno)      │                │     API     │
└──────────────┘                   └──────────────────┘                └─────────────┘
                                     ▲            ▲
                                     │            │
                          chat-coach │            │ analyze-session
                                     │            │
                     user envoie msg │            │ user termine séance
```

### 1. `chat-coach` — Conversation libre (user-triggered)

**Déclencheur** : l'utilisateur tape un message dans `/coach`.

**Flow** :
1. `app/coach/page.tsx` appelle `sendMessage()` (lib/coachChat.ts)
2. `sendMessage()` construit le contexte (plans J0-21, 5 dernières séances, 3 dernières analyses)
3. `supabase.functions.invoke("chat-coach", { body })`
4. L'Edge Function construit le prompt final et appelle l'API Anthropic
5. Réponse renvoyée en **JSON strict** avec 4 tableaux : `pending_plans`, `pending_delete_ids`, `modified_plans`, `delete_plan_ids`
6. Les plans "pending" attendent confirmation utilisateur (bouton "Appliquer ✓"), les "modified/delete" sont appliqués immédiatement
7. `autoSyncPush()` propage les changements vers Supabase

**Fichiers** :
- `supabase/functions/chat-coach/index.ts` — l'Edge Function
- `lib/coachChat.ts` — client (historique + invoke)
- `app/coach/page.tsx` — UI

**System prompt (résumé)** : coach "Alex" personnalisé (profil, règles de cycle, zones FC), impose un format JSON strict, impose la logique pending/confirmed pour les confirmations.

**Stratégie de contexte** (tokens-frugal) :
- Plans J0-3 : JSON complet (sans `coachNote` pour économiser)
- Plans J4-21 : une ligne compacte par séance
- Séances récentes : ligne compacte via `compactSession()`
- Analyses précédentes : 2 dernières, tronquées à 400 chars
- Historique chat : **6 derniers messages seulement** (contexte conversationnel)

### 2. `analyze-session` — Analyse post-séance (auto)

**Déclencheur** : après chaque save d'une séance (fitness ou run). Appel asynchrone non-bloquant.

**Flow** :
1. L'utilisateur termine une séance → sauvegarde via `addSession()` dans `lib/storage.ts`
2. `analyzeSession()` (lib/coachAnalyzer.ts) est appelée en fire-and-forget
3. Garde contre appels concurrents via `analyzingInFlight` Set
4. Construit un contexte enrichi : annotation des plans avec delta de charge vs dernière perf (`+2kg`, `maintenu`, `1er essai`)
5. `supabase.functions.invoke("analyze-session", { body })`
6. L'Edge Function retourne `{ analysis: string, modified_plans: [...] }`
7. **Déduplication par slot (`date + category`)** + **phantom guard** : un plan avec un id inconnu au même slot qu'un plan existant est rejeté
8. Plans modifiés appliqués automatiquement (pas de confirmation — c'est le coach qui décide)
9. Analyse stockée dans `localStorage` sous `cc_coach_analysis_{date}`

**Fichiers** :
- `supabase/functions/analyze-session/index.ts` — l'Edge Function
- `lib/coachAnalyzer.ts` — client (trigger + application + dédup)

**System prompt (résumé)** : même profil coach, mais rôle différent — analyser la séance réalisée, comparer au plan prévu, ajuster les séances à venir si pertinent. Tolère un tableau `modified_plans` vide (souvent la bonne réponse).

**Différences clés avec `chat-coach`** :
| Point | `chat-coach` | `analyze-session` |
|---|---|---|
| Déclencheur | User action (chat) | Auto après séance |
| Messages format | `messages[]` multi-turn | Un seul `user` message |
| Contexte prepend | `user+assistant` pair injecté | Directement dans le user prompt |
| `max_tokens` | 8192 | 6000 |
| `anthropic-beta` header | `prompt-caching-2024-07-31` | absent (le param `cache_control` suffit) |
| Confirmation | Oui, logique pending | Non, appliqué direct |
| Gestion truncation | `throw Error` (dur) | Fallback gracieux (garde l'analyse, drop les plans) |

---

## Stratégie de prompting partagée

Les deux fonctions respectent les mêmes principes :

1. **JSON strict en sortie** — aucun markdown, aucun texte hors JSON. Extraction côté serveur avec recherche de `{ ... }` équilibré.
2. **Prompt caching** via `cache_control: { type: "ephemeral" }` sur le system prompt (réduit les coûts, le system prompt ne change pas entre appels).
3. **Token frugality** — les `coachNote` sont strippés avant envoi, les plans lointains sont compactés, les séances passées sont stringifiées en une ligne.
4. **Profil injecté dynamiquement** (`profileName`) dans le system prompt, récupéré depuis `getActiveProfile()`.
5. **Dédup par slot** (`date + category` pour fitness, `date + run` pour run) pour éviter les doublons quand le coach renvoie plusieurs plans pour le même créneau.

---

## Configuration & déploiement

### Variables d'environnement client (`.env.local`)
Voir `.env.local.example`. Nécessite : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, et les clés Strava si sync Strava.

### Secret Supabase (côté Edge Function)
```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

### Déployer les Edge Functions
```bash
supabase functions deploy chat-coach --no-verify-jwt
supabase functions deploy analyze-session --no-verify-jwt
```
Les deux sont déployées avec `--no-verify-jwt` parce que l'app est mono-utilisateur et que l'URL de la fonction n'est pas publique. **Si l'app devient multi-utilisateurs, activer verify_jwt + contrôle d'accès.**

---

## Points d'attention pour les futurs développements

### Sur `chat-coach`
- **Alternance user/assistant obligatoire** : l'API Anthropic exige que les messages alternent strictement. La fonction **prepend** un couple `user (contexte) + assistant (ack)` avant l'historique. Si `messages.slice(-N)` tombe sur un `assistant`, ça casse (400 Anthropic → 500 Edge). Fix en place ligne 163 : on drop le leading assistant après slicing.
- **Truncation `max_tokens=8192`** : si le coach génère un plan marathon complet en une réponse, on peut hit la limite → `throw` dur. À surveiller. Le handler de `analyze-session` est plus permissif.
- **Depth-counting JSON naïf** : l'extraction `{...}` compte les accolades sans gérer les strings. Si une valeur string contient `{` ou `}`, ça peut foirer. En pratique Claude est propre, mais c'est une fragilité.
- **Confirmation implicite** : le LLM décide seul si une phrase est une confirmation ("oui", "ok", "applique"…). Pas de parsing dur côté client, on fait confiance au système prompt.

### Sur `analyze-session`
- **Phantom guard** : si le coach invente un nouvel id à un slot déjà occupé par un plan qu'on n'a PAS envoyé (race avec du stale local), on drop. Voir `coachAnalyzer.ts` lignes 196-206.
- **Déduplication par slot** : le coach renvoie parfois deux plans pour la même date+catégorie (héritage de doublons). On garde le dernier (canonique), cf. `coachAnalyzer.ts` lignes 178-185.
- **Fire-and-forget** : l'appel ne bloque jamais l'UI. Si l'analyse échoue, l'utilisateur ne voit rien — surveillance via `console.error` uniquement.
- **Différence `max_tokens=6000`** : a été augmenté depuis 2500 parce qu'un plan complet + analyse dépassait. Si on ajoute des champs aux plans (ex: setPlans riches), monitorer le `stop_reason`.

### Sur le stockage
- **Le localStorage est la source de vérité**. Supabase n'est qu'un back-up / sync multi-device. Vider le cache navigateur = perdre des données non synchronisées.
- **Pas de realtime** : la sync est déclenchée manuellement ou via `autoSyncPush()` après une mutation. Pas de subscriptions Supabase.
- **Le chat a son propre sync** (`pushChatToSupabase` / `pullChatFromSupabase`) avec sa propre table, indépendant de `autoSyncPush`.

---

## Améliorations possibles

### IA / Coach
- **Streaming des réponses chat** : actuellement on attend le JSON complet. Un stream partiel (SSE via `stream: true` Anthropic) améliorerait l'UX sur les longues réponses.
- **Parsing JSON plus robuste** : remplacer le depth-counting par un parser qui respecte les strings (ou simplement tenter `JSON.parse` progressivement jusqu'au dernier `}` valide).
- **Tool use** (Anthropic tool_use API) au lieu de JSON-dans-le-texte : on garantit un output structuré sans fragilité d'extraction. Gros refactor mais plus safe.
- **Cache hit rate monitoring** : logger `usage.cache_read_input_tokens` / `cache_creation_input_tokens` pour vérifier que le prompt caching fonctionne.
- **Historique chat côté serveur** : aujourd'hui le client envoie tout l'historique à chaque appel. Un stockage par thread côté Supabase + pagination permettrait des conversations plus longues sans payer la totalité en input tokens.
- **Analyse batch** : une séance = un appel. Pour une semaine complète, on paie N fois le system prompt. Un mode "analyse hebdo" avec toutes les séances en un appel serait plus économique.

### Robustesse
- **Retry exponentiel** côté client sur les `supabase.functions.invoke` (actuellement fail au premier coup).
- **Feedback utilisateur sur `analyze-session`** : aujourd'hui silencieux — un toast "Coach a mis à jour ton programme" serait utile.
- **Metrics / observabilité** : pas de logging structuré, pas de tracking d'erreurs (Sentry ou équivalent). Utile avant passage multi-user.
- **Tests unitaires** : il n'y a pas de test. Les zones critiques à couvrir en priorité : `parseCoachWorkoutJSON`, dédup+phantom guard, alternance messages `chat-coach`.

### Architecture
- **Verify JWT + RLS Supabase** si l'app passe multi-user. Aujourd'hui `user_id + profile_id` sont envoyés par le client sans vérif backend.
- **Extraire `buildSystemPrompt`** dans un module partagé entre les deux Edge Functions (actuellement dupliqué avec des règles légèrement divergentes). Attention Deno — pas de npm direct, faut copier ou utiliser un import `https://`.
- **Schema TypeScript partagé** pour les plans coach — actuellement défini dans `lib/coachPlan.ts` (client) et redéclaré implicitement dans les Edge Functions via `Record<string, unknown>`. Un module partagé éviterait la drift.

---

## Fichiers de référence à lire pour toucher à l'IA

Ordre recommandé pour un dev qui arrive sur cette partie du code :

1. `supabase/functions/chat-coach/index.ts` — comprendre le pattern Edge Function + Anthropic
2. `supabase/functions/analyze-session/index.ts` — variante non-conversationnelle
3. `lib/coachChat.ts` — flow client complet (historique, optimistic UI, rollback)
4. `lib/coachAnalyzer.ts` — déclenchement auto + dédup + phantom guard
5. `lib/coachPlan.ts` — schéma des plans et `parseCoachWorkoutJSON`
6. `app/coach/page.tsx` — UI chat (pending plans, apply button)
