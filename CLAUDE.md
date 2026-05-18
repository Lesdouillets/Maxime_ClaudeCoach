# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Dev server (localhost:3000)
npm run build    # Static export to ./out (used for GitHub Pages)
npm run lint     # ESLint

# Edge Functions (Deno, requires Supabase CLI)
supabase functions deploy chat-coach --no-verify-jwt
supabase functions deploy analyze-session --no-verify-jwt
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

No test suite exists.

## Architecture

**Mono-user personal coaching app** — fitness (upper/lower split) + running, with Claude as coach "Alex". Next.js 14 static export (GitHub Pages), Supabase backend, offline-first via localStorage.

### Data flow

localStorage is the **source of truth**. Supabase is a backup / multi-device sync. All reads come from localStorage; `autoSyncPush()` fires silently after every mutation to replicate to Supabase.

Exception: coach plans (`cc_coach_workouts`, `cc_coach_runs`) — Supabase is **authoritative** during a full sync; remote fully overwrites local.

### AI architecture (two Edge Functions)

Both call `claude-sonnet-4-6` via Anthropic API with prompt caching on the system prompt.

**`chat-coach`** — triggered by user message in `/coach`. Returns JSON with four arrays: `pending_plans` (await user confirmation), `pending_delete_ids`, `modified_plans` (applied immediately), `delete_plan_ids`. The Edge Function prepends a `user+assistant` context pair before the chat history to satisfy the Anthropic alternating-message requirement; after slicing to the last 6 messages, it drops any leading `assistant` message.

**`analyze-session`** — fire-and-forget after every session save. Returns `{ analysis, modified_plans }`. Plans applied immediately (no confirmation). Uses a phantom guard: rejects plans whose id is unknown but whose `date+category` slot is already occupied by a plan that wasn't sent to the function. Also deduplicates by slot (same `date+category`), keeping the last.

Key client files:
- `lib/coachChat.ts` — builds context, calls `chat-coach`, manages chat history + optimistic UI
- `lib/coachAnalyzer.ts` — triggers `analyze-session`, applies dedup/phantom guard, stores analysis under `cc_coach_analysis_{date}`
- `lib/coachPlan.ts` — `CoachWorkout`/`CoachRun` types, storage helpers, `parseCoachWorkoutJSON`
- `lib/storage.ts` — all other localStorage CRUD (sessions, strava tokens, cancelled/rescheduled days, in-progress fitness state)
- `lib/sync.ts` — `syncFull()` / `autoSyncPush()` with shared `isSyncing` mutex

### JSON output contract

Both Edge Functions return **strict JSON only** (no markdown, no wrapping text). Extraction uses a depth-counting `{...}` balanced-brace search — fragile if string values contain `{` or `}`. `coachNote` fields are stripped before sending to the API to save tokens. Plans further than J+3 are compacted to one line each.

### Storage key reference

| Key | Content |
|---|---|
| `cc_sessions` | `WorkoutSession[]` |
| `cc_coach_workouts` | `CoachWorkout[]` |
| `cc_coach_runs` | `CoachRun[]` |
| `cc_chat_history` | `ChatMessage[]` |
| `cc_coach_analysis_{date}` | `{ analysis, programChanged, modifiedCount }` |
| `cc_strava_tokens` | `StravaTokens` |
| `cc_cancelled_days` | `CancelledDay[]` |
| `cc_rescheduled_days` | `RescheduledDay[]` |
| `cc_in_progress_fitness_{date}` | `InProgressFitnessState` |

### Deployment

Static export (`output: "export"`) deployed to GitHub Pages via `.github/workflows/deploy.yml` on push to `main`. Edge Functions are deployed in the same workflow. `NEXT_PUBLIC_BASE_PATH=/Maxime_ClaudeCoach` is set at build time.

Local dev: copy `.env.local.example` → `.env.local` and fill in Supabase + Strava credentials. Leave `NEXT_PUBLIC_BASE_PATH` empty.

### Known fragilities to keep in mind

- Anthropic alternating messages: `messages.slice(-6)` must not start with `assistant` — the fix at line ~163 of `chat-coach/index.ts` drops the leading assistant if it does.
- Depth-counting JSON extraction breaks if a string value contains `{` or `}`.
- `analyze-session` is fire-and-forget — failures are silent (`console.error` only).
- Supabase's unique index on `coach_plans(user_id, profile_id, date, category)` means orphan remote rows must be deleted **before** upserting, not after (see `pushCoachPlans`).
- **`usePathname()` vs `window.location.pathname` in sheets** : `usePathname()` retourne le chemin **sans** le base path (`/plan`), `window.location.pathname` l'inclut en prod (`/Maxime_ClaudeCoach/plan`). Toute comparaison de route dans `RunSheet` / `SessionSheet` doit utiliser `usePathname()` — remplacer par `window.location.pathname` casse silencieusement la navigation en prod (le sheet ferme et la page Plan recharge en scrollant to today).
