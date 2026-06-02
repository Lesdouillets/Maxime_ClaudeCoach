# Coach Chat — Gestion d'erreur & retry

**Date :** 2026-06-02  
**Scope :** Edge Function `chat-coach` + page `/coach` + `CoachMessageBubble`

---

## Contexte

L'API Anthropic renvoie parfois HTTP 529 (overloaded). Actuellement la fonction échoue directement et le client affiche un faux message assistant en erreur. L'expérience est dégradée : le message de l'utilisateur disparaît et rien ne permet de relancer facilement.

---

## Partie 1 — Retry automatique (Edge Function)

### Objectif
Absorber silencieusement les erreurs transitoires Anthropic avant d'exposer l'erreur au client.

### Comportement
Extraire l'appel `fetch` vers Anthropic dans un helper `callWithRetry()` dans `supabase/functions/chat-coach/index.ts`.

**Codes HTTP retryables :** `[429, 502, 503, 504, 529]`

**Backoff :**
- Tentative 1 : immédiate
- Tentative 2 (après erreur transitoire) : attente 1 000 ms
- Tentative 3 : attente 2 000 ms
- Après 3 échecs : throw → le catch global retourne HTTP 500

**Codes non retryables :** 400, 401, 403, 422, 500 — throw immédiat.

### Logging (Option A — console.error structuré)
À chaque retry raté **et** à l'échec final, émettre un `console.error` avec :
```json
{
  "event": "anthropic_retry" | "anthropic_failed",
  "attempt": 1 | 2 | 3,
  "code": 529,
  "duration_ms": 1250,
  "message_excerpt": "premiers 80 chars du dernier message user"
}
```
Visible dans les logs Supabase edge-function (rétention 24h, queryable via MCP).

---

## Partie 2 — UX erreur côté client

### Objectif
Remplacer le faux message assistant en erreur par un état d'erreur sur le message utilisateur lui-même, avec bouton retry.

### Type `ChatMessage` (`lib/coachChat.ts`)
Ajout du champ optionnel :
```ts
error?: boolean
```
Le message en erreur est ephémère : jamais persisté en localStorage, disparu au reload.

### État page (`app/coach/page.tsx`)
Nouveau state :
```ts
failedMessage: { text: string; image: CompressedImage | null } | null
```

**Sur erreur :**
- Ne pas appeler `getChatHistory()` (évite d'effacer le message optimiste)
- Marquer le message optimiste : `{ ...optimisticUser, error: true }`
- Stocker le texte + image dans `failedMessage`
- Supprimer l'ajout du faux message assistant

**`handleRetry` :**
- Retire le message marqué `error: true` de la liste
- Remet `failedMessage` à `null`
- Appelle `handleSend(failedMessage.text, failedMessage.image)` → même flow que l'envoi initial

### Rendu (`components/coach/CoachMessageBubble.tsx`)
Nouveaux props :
```ts
isError?: boolean
onRetry?: () => void
```

Quand `role === "user" && isError` :
- Bulle : `border: 1.5px solid var(--color-error-border)`
- Tag en dessous à droite : icône ↺ + texte "Erreur · Réessayer" en `var(--color-error)`, `font-size: 12px`
- Clic sur le tag → `onRetry()`

### Tokens DS utilisés
- `--color-error-border` (#C80514) — bordure de la bulle
- `--color-error` (#ff4d4d) — icône et texte du tag

---

## Fichiers modifiés

| Fichier | Changement |
|---|---|
| `supabase/functions/chat-coach/index.ts` | Helper `callWithRetry()` + logging structuré |
| `lib/coachChat.ts` | `error?: boolean` sur `ChatMessage` |
| `app/coach/page.tsx` | State `failedMessage` + `handleRetry` + suppression faux message assistant |
| `components/coach/CoachMessageBubble.tsx` | Props `isError` + `onRetry` + rendu bulle erreur |
