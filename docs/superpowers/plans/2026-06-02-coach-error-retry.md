# Coach Chat — Gestion d'erreur & retry — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un retry automatique sur les erreurs transitoires Anthropic dans l'Edge Function, et remplacer le faux message d'erreur assistant par un état d'erreur sur le message de l'utilisateur avec bouton retry.

**Architecture:** Le retry est encapsulé dans un helper `callAnthropic()` dans l'Edge Function. Côté client, un state `failedMessage` dans `page.tsx` retient le texte + image à renvoyer ; `CoachMessageBubble` reçoit `isError` / `onRetry` pour l'affichage.

**Tech Stack:** Deno (Edge Function), React 18, TypeScript, CSS variables DS existantes (`--color-error`, `--color-error-border`)

---

## Fichiers touchés

| Fichier | Rôle |
|---|---|
| `supabase/functions/chat-coach/index.ts` | Helper `callAnthropic()` + remplacement du bloc fetch |
| `lib/coachChat.ts` | Ajout `error?: boolean` sur `ChatMessage` |
| `app/coach/page.tsx` | State `failedMessage`, `handleRetry`, flux conditionnel succès/erreur |
| `components/coach/CoachMessageBubble.tsx` | Props `isError` + `onRetry`, rendu bulle erreur |

---

## Task 1 — Helper `callAnthropic()` dans l'Edge Function

**Files:**
- Modify: `supabase/functions/chat-coach/index.ts`

- [ ] **Step 1 : Ajouter `.superpowers/` au .gitignore si absent**

Vérifier que `.gitignore` contient `.superpowers/`. Si non, ajouter en fin de fichier :
```
# Superpowers brainstorming sessions
.superpowers/
```

- [ ] **Step 2 : Ajouter le helper `callAnthropic()` avant `Deno.serve`**

Insérer la fonction suivante **entre** la fin de `stripCoachNotes()` (ligne ~311) et `Deno.serve(` (ligne ~313) :

```typescript
const RETRYABLE_CODES = new Set([429, 502, 503, 504, 529]);
const RETRY_DELAYS_MS = [1000, 2000];

async function callAnthropic(
  apiKey: string,
  body: Record<string, unknown>,
  messageExcerpt: string,
): Promise<Record<string, unknown>> {
  const startTime = Date.now();
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt - 1]));
    }
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "prompt-caching-2024-07-31",
      },
      body: JSON.stringify(body),
    });
    if (resp.ok) return resp.json() as Promise<Record<string, unknown>>;
    const errText = await resp.text();
    if (!RETRYABLE_CODES.has(resp.status)) {
      throw new Error(`Anthropic API error ${resp.status}: ${errText}`);
    }
    const isLast = attempt === 2;
    console.error(JSON.stringify({
      event: isLast ? "anthropic_failed" : "anthropic_retry",
      attempt: attempt + 1,
      code: resp.status,
      duration_ms: Date.now() - startTime,
      message_excerpt: messageExcerpt,
    }));
    if (isLast) throw new Error(`Anthropic API error ${resp.status}: ${errText}`);
  }
  throw new Error("callAnthropic: max retries exceeded");
}
```

- [ ] **Step 3 : Extraire le messageExcerpt avant la boucle d'itération**

Juste avant `const MAX_ITERATIONS = 5;` (ligne ~447), ajouter :

```typescript
const lastUserRaw = [...(messages as Array<{ role: string; content: unknown }>)]
  .reverse()
  .find((m) => m.role === "user");
const messageExcerpt = typeof lastUserRaw?.content === "string"
  ? lastUserRaw.content.slice(0, 80)
  : "";
```

- [ ] **Step 4 : Remplacer le bloc fetch + if + .json() dans la boucle**

Localiser le bloc suivant (lignes ~450-478) :

```typescript
const anthropicResp = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
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
```

Le remplacer par :

```typescript
const anthropicData = await callAnthropic(apiKey, {
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
}, messageExcerpt);
```

- [ ] **Step 5 : Vérifier le build TypeScript**

```bash
cd supabase/functions/chat-coach
deno check index.ts
```

Résultat attendu : aucune erreur TypeScript.

Si `deno` n'est pas disponible localement, passer au step suivant — le CI vérifie au deploy.

- [ ] **Step 6 : Commit**

```bash
git add supabase/functions/chat-coach/index.ts .gitignore
git commit -m "Edge Function chat-coach : retry automatique erreurs transitoires Anthropic (429/502/503/504/529)"
```

---

## Task 2 — Ajout de `error?` sur `ChatMessage`

**Files:**
- Modify: `lib/coachChat.ts`

- [ ] **Step 1 : Ajouter le champ `error?` à l'interface**

Localiser l'interface `ChatMessage` (ligne ~16) :

```typescript
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageBase64?: string;
  timestamp: string; // ISO
  modifiedCount?: number;
  deletedCount?: number;
  card?: {
    plans: CoachPlan[];
    deleteIds: string[];
    status: "pending" | "validated";
  };
}
```

Ajouter le champ `error?` après `timestamp` :

```typescript
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageBase64?: string;
  timestamp: string; // ISO
  error?: boolean;
  modifiedCount?: number;
  deletedCount?: number;
  card?: {
    plans: CoachPlan[];
    deleteIds: string[];
    status: "pending" | "validated";
  };
}
```

- [ ] **Step 2 : Build pour vérifier qu'aucun type n'est cassé**

```bash
npm run build 2>&1 | tail -10
```

Résultat attendu : `✓ SW cache →` en fin de sortie, aucune erreur TypeScript.

- [ ] **Step 3 : Commit**

```bash
git add lib/coachChat.ts
git commit -m "ChatMessage : ajout champ error? pour état d'erreur éphémère"
```

---

## Task 3 — State `failedMessage` + `handleRetry` dans `page.tsx`

**Files:**
- Modify: `app/coach/page.tsx`

- [ ] **Step 1 : Ajouter l'import `CompressedImage` si absent**

Vérifier que la ligne suivante est présente en haut du fichier :
```typescript
import type { CompressedImage } from "@/lib/imageCompressor";
```
Elle est déjà présente à la ligne ~13 — rien à faire.

- [ ] **Step 2 : Ajouter le state `failedMessage`**

Après la ligne `const [adaptMsg, setAdaptMsg] = useState<string | null>(null);` (ligne ~26), ajouter :

```typescript
const [failedMessage, setFailedMessage] = useState<{ text: string; image: CompressedImage | null } | null>(null);
```

- [ ] **Step 3 : Modifier `handleSend` — flux conditionnel succès/erreur**

Remplacer le bloc `handleSend` existant (lignes ~57-96) :

```typescript
const handleSend = useCallback(async (text: string, image?: CompressedImage | null) => {
  const trimmed = text.trim();
  if (!trimmed && !image) return;
  if (sending) return;
  setInput("");
  setAdaptMsg(null);
  setSending(true);

  const attachments: ChatAttachments | undefined = image
    ? { imageBase64: image.base64, imageMimeType: image.mimeType }
    : undefined;

  // Message user affiché immédiatement avant la réponse du coach
  const optimisticUser: ChatMessage = {
    id: `optimistic-${Date.now()}`,
    role: "user",
    content: trimmed,
    ...(image && { imageBase64: image.base64 }),
    timestamp: new Date().toISOString(),
  };
  setMessages((prev) => [...prev, optimisticUser]);

  const result = await sendMessage(trimmed, attachments);
  // Remplace l'optimistic par l'historique persisté
  setMessages(getChatHistory());

  if (!result) {
    // Affiche l'erreur comme message assistant
    setMessages((prev) => [
      ...prev.filter((m) => m.id !== optimisticUser.id),
      {
        id: `err-${Date.now()}`,
        role: "assistant",
        content: "Désolé, une erreur est survenue. Réessaie dans un instant.",
        timestamp: new Date().toISOString(),
      },
    ]);
  }
  setSending(false);
}, [sending]);
```

Par :

```typescript
const handleSend = useCallback(async (text: string, image?: CompressedImage | null) => {
  const trimmed = text.trim();
  if (!trimmed && !image) return;
  if (sending) return;
  setInput("");
  setAdaptMsg(null);
  setSending(true);
  setFailedMessage(null);

  const attachments: ChatAttachments | undefined = image
    ? { imageBase64: image.base64, imageMimeType: image.mimeType }
    : undefined;

  // Message user affiché immédiatement avant la réponse du coach
  const optimisticUser: ChatMessage = {
    id: `optimistic-${Date.now()}`,
    role: "user",
    content: trimmed,
    ...(image && { imageBase64: image.base64 }),
    timestamp: new Date().toISOString(),
  };
  setMessages((prev) => [...prev, optimisticUser]);

  const result = await sendMessage(trimmed, attachments);

  if (result) {
    setMessages(getChatHistory());
  } else {
    setMessages((prev) =>
      prev.map((m) => (m.id === optimisticUser.id ? { ...m, error: true } : m))
    );
    setFailedMessage({ text: trimmed, image: image ?? null });
  }
  setSending(false);
}, [sending]);
```

- [ ] **Step 4 : Ajouter `handleRetry`**

Après le bloc `handleSend` (après la ligne `}, [sending]);`), ajouter :

```typescript
const handleRetry = useCallback(async () => {
  if (!failedMessage || sending) return;
  const { text, image } = failedMessage;
  setMessages((prev) => prev.filter((m) => !m.error));
  setFailedMessage(null);
  await handleSend(text, image);
}, [failedMessage, sending, handleSend]);
```

- [ ] **Step 5 : Passer `isError` et `onRetry` à `CoachMessageBubble`**

Localiser le bloc de rendu des messages (ligne ~177) :

```tsx
{messages.map((msg) => (
  <CoachMessageBubble
    key={msg.id}
    message={msg}
    applying={applying === msg.id}
    onApply={() => handleApply(msg.id)}
    onAdapt={handleAdapt}
  />
))}
```

Remplacer par :

```tsx
{messages.map((msg) => (
  <CoachMessageBubble
    key={msg.id}
    message={msg}
    applying={applying === msg.id}
    onApply={() => handleApply(msg.id)}
    onAdapt={handleAdapt}
    isError={msg.error === true}
    onRetry={msg.error ? handleRetry : undefined}
  />
))}
```

- [ ] **Step 6 : Build**

```bash
npm run build 2>&1 | tail -10
```

Résultat attendu : `✓ SW cache →`, aucune erreur.

- [ ] **Step 7 : Commit**

```bash
git add app/coach/page.tsx
git commit -m "Coach page : état d'erreur sur message utilisateur + bouton retry"
```

---

## Task 4 — Rendu bulle erreur dans `CoachMessageBubble`

**Files:**
- Modify: `components/coach/CoachMessageBubble.tsx`

- [ ] **Step 1 : Ajouter `isError` et `onRetry` à l'interface Props**

Localiser l'interface Props (ligne ~9) :

```typescript
interface Props {
  message: ChatMessage;
  applying: boolean;
  onApply: () => void;
  onAdapt: () => void;
}
```

Remplacer par :

```typescript
interface Props {
  message: ChatMessage;
  applying: boolean;
  onApply: () => void;
  onAdapt: () => void;
  isError?: boolean;
  onRetry?: () => void;
}
```

- [ ] **Step 2 : Déstructurer les nouveaux props**

Localiser la ligne de déstructuration (ligne ~16) :

```typescript
export default function CoachMessageBubble({ message, applying, onApply, onAdapt }: Props) {
```

Remplacer par :

```typescript
export default function CoachMessageBubble({ message, applying, onApply, onAdapt, isError, onRetry }: Props) {
```

- [ ] **Step 3 : Modifier le rendu du message user**

Localiser le bloc `if (message.role === "user")` (lignes ~25-91). Modifier la div de la bulle texte et ajouter le tag erreur.

Remplacer :

```tsx
{message.content && (
  <div
    style={{
      background: "var(--color-white-10)",
      borderRadius: 20,
      borderBottomRightRadius: 6,
      padding: "12px 16px",
    }}
  >
    <p style={{ color: "#ddd", fontSize: 15, whiteSpace: "pre-wrap", margin: 0 }}>
      {message.content}
    </p>
  </div>
)}
```

Par :

```tsx
{message.content && (
  <div
    style={{
      background: "var(--color-white-10)",
      borderRadius: 20,
      borderBottomRightRadius: 6,
      padding: "12px 16px",
      ...(isError && { border: "1.5px solid var(--color-error-border)" }),
    }}
  >
    <p style={{ color: "#ddd", fontSize: 15, whiteSpace: "pre-wrap", margin: 0 }}>
      {message.content}
    </p>
  </div>
)}
{isError && onRetry && (
  <button
    onClick={onRetry}
    style={{
      display: "flex",
      alignItems: "center",
      gap: 5,
      color: "var(--color-error)",
      fontSize: 12,
      background: "none",
      border: "none",
      cursor: "pointer",
      padding: 0,
    }}
  >
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M1 4v6h6"/>
      <path d="M23 20v-6h-6"/>
      <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15"/>
    </svg>
    Erreur · Réessayer
  </button>
)}
```

- [ ] **Step 4 : Build**

```bash
npm run build 2>&1 | tail -10
```

Résultat attendu : `✓ SW cache →`, aucune erreur.

- [ ] **Step 5 : Commit**

```bash
git add components/coach/CoachMessageBubble.tsx
git commit -m "CoachMessageBubble : bulle rouge + tag Réessayer sur message en erreur"
```

---

## Task 5 — Deploy staging

- [ ] **Step 1 : Push branche staging**

```bash
git push origin staging
```

Le CI GitHub Actions déploie l'app Next.js et les Edge Functions automatiquement.

- [ ] **Step 2 : Vérifier le deploy Edge Function dans les logs CI**

Dans GitHub Actions → workflow le plus récent → étape `Deploy Edge Functions` : vérifier que `chat-coach` est déployé sans erreur.

- [ ] **Step 3 : Test fonctionnel sur staging**

1. Ouvrir staging dans le navigateur
2. Envoyer un message au coach
3. Pour simuler une erreur : couper temporairement le réseau (DevTools → Network → Offline) juste après l'envoi — la bulle doit apparaître avec le contour rouge et le tag "Erreur · Réessayer"
4. Remettre le réseau, cliquer "Réessayer" — le message doit repartir et recevoir une réponse normale
