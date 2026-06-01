# Coach Chat Image Attachment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Brancher le "+" de `CoachInputBar` pour attacher une image envoyée au coach via l'API Anthropic multimodale, avec miniature affichée dans la bulle utilisateur.

**Architecture:** `CoachInputBar` gère son propre `pendingImage` state et passe l'image à `onSend(image?)`. `sendMessage` reçoit un deuxième param `attachments?` et stocke `imageBase64` dans `ChatMessage` pour l'affichage. L'edge function `chat-coach` injecte l'image en content block sur le dernier message utilisateur. Le `onKeyDown` est absorbé dans `CoachInputBar` (plus de prop).

**Tech Stack:** React (useState, useMemo, useRef, useCallback), Canvas API via `lib/imageCompressor.ts` existant, Supabase Edge Functions (Deno), Anthropic multimodal content blocks.

---

## File Map

| Fichier | Action | Rôle |
|---------|--------|------|
| `lib/coachChat.ts` | MODIFY | `ChatMessage.imageBase64?`, `ChatAttachments`, `sendMessage` 2ème param |
| `supabase/functions/chat-coach/index.ts` | MODIFY | Support multimodal conditionnel sur le dernier message |
| `components/coach/CoachMessageBubble.tsx` | MODIFY | Thumbnail dans la bulle utilisateur |
| `components/coach/CoachInputBar.tsx` | MODIFY | State `pendingImage`, file input, preview chip, Enter interne |
| `app/coach/page.tsx` | MODIFY | `handleSend` étendu, prop `onSend` mise à jour, `handleKeyDown` supprimé |

---

## Task 1 — `lib/coachChat.ts` : ChatMessage + sendMessage

**Files:**
- Modify: `lib/coachChat.ts`

- [ ] **Ajouter `imageBase64?` à `ChatMessage`** (après la ligne `content: string;`, vers la ligne 18) :

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

- [ ] **Ajouter l'interface `ChatAttachments`** juste avant `sendMessage` (vers la ligne 125) :

```typescript
export interface ChatAttachments {
  imageBase64: string;
  imageMimeType: string;
}
```

- [ ] **Étendre la signature de `sendMessage`** (ligne 127) :

Avant :
```typescript
export async function sendMessage(userText: string): Promise<ChatMessage | null> {
```

Après :
```typescript
export async function sendMessage(userText: string, attachments?: ChatAttachments): Promise<ChatMessage | null> {
```

- [ ] **Stocker `imageBase64` dans `userMsg`** (vers la ligne 137, dans le bloc de création de `userMsg`) :

Avant :
```typescript
  const userMsg: ChatMessage = {
    id: `chat-${Date.now()}-user`,
    role: "user",
    content: userText,
    timestamp: new Date().toISOString(),
  };
```

Après :
```typescript
  const userMsg: ChatMessage = {
    id: `chat-${Date.now()}-user`,
    role: "user",
    content: userText,
    ...(attachments?.imageBase64 && { imageBase64: attachments.imageBase64 }),
    timestamp: new Date().toISOString(),
  };
```

- [ ] **Passer les attachements au body Supabase** (vers la ligne 158, dans `supabase.functions.invoke`) :

Avant :
```typescript
    const { data, error } = await supabase.functions.invoke("chat-coach", {
      body: { messages: apiMessages, coachPlans, recentSessions, profileName, previousAnalyses, today, coachMemory },
    });
```

Après :
```typescript
    const { data, error } = await supabase.functions.invoke("chat-coach", {
      body: {
        messages: apiMessages,
        coachPlans,
        recentSessions,
        profileName,
        previousAnalyses,
        today,
        coachMemory,
        ...(attachments?.imageBase64 && {
          imageBase64: attachments.imageBase64,
          imageMimeType: attachments.imageMimeType,
        }),
      },
    });
```

- [ ] **Vérifier le lint**

```bash
cd /Users/famillemillet/Projects/Maxime_ClaudeCoach && npm run lint 2>&1 | head -20
```

Attendu : aucune erreur.

- [ ] **Committer**

```bash
cd /Users/famillemillet/Projects/Maxime_ClaudeCoach && git add lib/coachChat.ts && git commit -m "coachChat : ChatMessage.imageBase64, ChatAttachments, sendMessage attachments param"
```

---

## Task 2 — `supabase/functions/chat-coach/index.ts` : multimodal

**Files:**
- Modify: `supabase/functions/chat-coach/index.ts`

- [ ] **Ajouter `imageBase64` et `imageMimeType` au body destructuring** (vers la ligne 322, dans le bloc `const { messages = [], ... } = body;`) :

Avant :
```typescript
    const {
      messages = [],
      coachPlans = [],
      recentSessions = [],
      profileName = "Maxime",
      previousAnalyses = [],
      today: clientToday,
      coachMemory,
    } = body;
```

Après :
```typescript
    const {
      messages = [],
      coachPlans = [],
      recentSessions = [],
      profileName = "Maxime",
      previousAnalyses = [],
      today: clientToday,
      coachMemory,
      imageBase64,
      imageMimeType,
    } = body;
```

- [ ] **Ajouter la validation MIME + narrowing** (juste après le bloc destructuring, avant `if (!messages || messages.length === 0)`) :

```typescript
    // Validation type MIME image (même logique que analyze-session)
    const ALLOWED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    const imageBase64Str = typeof imageBase64 === "string" ? imageBase64 : null;
    const mimeTypeStr = typeof imageMimeType === "string" ? imageMimeType : null;
    if (imageBase64Str && mimeTypeStr && !ALLOWED_IMAGE_MIME_TYPES.includes(mimeTypeStr)) {
      return new Response(JSON.stringify({ error: `Type d'image non supporté: ${mimeTypeStr}` }), { status: 400, headers: CORS });
    }
    const resolvedMimeType = mimeTypeStr ?? "image/jpeg";
```

- [ ] **Injecter le content block image dans le dernier message utilisateur** (vers la ligne 381, juste après `let recentMessages = messages.slice(-16);` et après le guard `if (recentMessages[0].role === "assistant")`) :

Le bloc complet à insérer après la ligne `recentMessages = recentMessages.slice(1)` (fin du guard) :

```typescript
    // Si une image est attachée, remplacer le contenu du dernier message utilisateur
    // par un content block multimodal [text, image]. Texte "." si le message est vide.
    if (imageBase64Str && recentMessages.length > 0) {
      const lastMsg = recentMessages[recentMessages.length - 1] as { role: string; content: unknown };
      if (lastMsg.role === "user") {
        const textContent = typeof lastMsg.content === "string" && lastMsg.content.trim()
          ? lastMsg.content
          : ".";
        recentMessages = [
          ...recentMessages.slice(0, -1),
          {
            role: "user",
            content: [
              { type: "text", text: textContent },
              { type: "image", source: { type: "base64", media_type: resolvedMimeType, data: imageBase64Str } },
            ],
          },
        ];
      }
    }
```

- [ ] **Vérifier que les lignes clés sont en place**

```bash
grep -n "imageBase64Str\|resolvedMimeType\|content block\|mimeTypeStr" /Users/famillemillet/Projects/Maxime_ClaudeCoach/supabase/functions/chat-coach/index.ts
```

Attendu : 4-5 lignes trouvées aux bons endroits.

- [ ] **Committer**

```bash
cd /Users/famillemillet/Projects/Maxime_ClaudeCoach && git add supabase/functions/chat-coach/index.ts && git commit -m "chat-coach : support multimodal — image injectée dans le dernier message utilisateur"
```

---

## Task 3 — `components/coach/CoachMessageBubble.tsx` : thumbnail

**Files:**
- Modify: `components/coach/CoachMessageBubble.tsx`

- [ ] **Remplacer le rendu de la bulle utilisateur** (le bloc `if (message.role === "user") { return (...) }`, vers la ligne 26) :

Avant :
```tsx
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div
          style={{
            background: "var(--color-white-10)",
            borderRadius: 20,
            borderBottomRightRadius: 6,
            maxWidth: "80%",
            padding: "12px 16px",
          }}
        >
          <p style={{ color: "#ddd", fontSize: 15, whiteSpace: "pre-wrap", margin: 0 }}>
            {message.content}
          </p>
        </div>
      </div>
    );
  }
```

Après :
```tsx
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end", maxWidth: "80%" }}>
          {message.imageBase64 && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`data:image/jpeg;base64,${message.imageBase64}`}
              alt=""
              style={{
                width: 160,
                height: 110,
                borderRadius: 14,
                borderBottomRightRadius: 4,
                objectFit: "cover",
              }}
            />
          )}
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
        </div>
      </div>
    );
  }
```

- [ ] **Vérifier le lint**

```bash
cd /Users/famillemillet/Projects/Maxime_ClaudeCoach && npm run lint 2>&1 | head -20
```

Attendu : aucune erreur.

- [ ] **Committer**

```bash
cd /Users/famillemillet/Projects/Maxime_ClaudeCoach && git add components/coach/CoachMessageBubble.tsx && git commit -m "CoachMessageBubble : thumbnail image dans la bulle utilisateur (Option A)"
```

---

## Task 4 — `components/coach/CoachInputBar.tsx` : state, file input, preview, Enter

**Files:**
- Modify: `components/coach/CoachInputBar.tsx`

- [ ] **Remplacer le fichier entier** par ce contenu :

```typescript
"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { PlusIcon } from "@/components/icons/PlusIcon";
import { ArrowUpIcon } from "@/components/icons/ArrowUpIcon";
import { compressImage, type CompressedImage } from "@/lib/imageCompressor";

interface Props {
  value: string;
  sending: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  onChange: (value: string) => void;
  onSend: (image?: CompressedImage | null) => void;
}

export default function CoachInputBar({
  value,
  sending,
  textareaRef,
  onChange,
  onSend,
}: Props) {
  const [pendingImage, setPendingImage] = useState<CompressedImage | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pendingImagePreviewSrc = useMemo(
    () => (pendingImage ? `data:image/jpeg;base64,${pendingImage.base64}` : null),
    [pendingImage]
  );

  const handleSend = useCallback(() => {
    if ((!value.trim() && !pendingImage) || sending) return;
    const image = pendingImage;
    setPendingImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onSend(image);
  }, [value, pendingImage, sending, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={{ padding: "8px 16px 16px" }}>
      {/* Cadre externe */}
      <div
        style={{
          borderRadius: "24px",
          border: "1px solid var(--color-white-25)",
          padding: "8px",
          background: "var(--color-background)",
        }}
      >
        {/* Zone de saisie */}
        <div
          style={{
            borderRadius: "16px",
            background: "var(--color-surface-2)",
            padding: "12px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Écrire un message..."
            rows={1}
            className="placeholder:text-white/30"
            style={{
              width: "100%",
              background: "transparent",
              border: "none",
              outline: "none",
              boxShadow: "none",
              borderRadius: 0,
              resize: "none",
              padding: 0,
              margin: 0,
              color: "#ffffff",
              caretColor: "#ffffff",
              maxHeight: "120px",
              fontSize: "16px",
              lineHeight: "1.4",
              fontFamily: "inherit",
            }}
          />

          {/* Preview de l'image jointe */}
          {pendingImage && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                paddingTop: 6,
                borderTop: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={pendingImagePreviewSrc ?? ""}
                alt=""
                style={{ width: 40, height: 40, borderRadius: 6, objectFit: "cover", flexShrink: 0 }}
              />
              <span
                style={{
                  flex: 1,
                  fontSize: 12,
                  color: "rgba(255,255,255,0.5)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {pendingImage.name}
              </span>
              <button
                onClick={() => {
                  setPendingImage(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.12)",
                  border: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 9,
                  color: "#aaa",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
                aria-label="Supprimer l'image"
              >
                ✕
              </button>
            </div>
          )}

          {/* Ligne d'actions */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              aria-label="Ajouter une image"
            >
              <PlusIcon size={20} color="#ffffff" />
            </button>

            <button
              onClick={handleSend}
              disabled={sending || (!value.trim() && !pendingImage)}
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "var(--color-orange)",
                border: "none",
                cursor: "pointer",
                flexShrink: 0,
                boxSizing: "border-box",
                opacity: (sending || (!value.trim() && !pendingImage)) ? 0.5 : 1,
              }}
            >
              <ArrowUpIcon size={14} color="#ffffff" />
            </button>
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          try {
            const compressed = await compressImage(file);
            setPendingImage(compressed);
          } catch {
            // pas de feedback — l'image ne s'affiche simplement pas
          }
          e.target.value = "";
        }}
      />
    </div>
  );
}
```

- [ ] **Vérifier le lint**

```bash
cd /Users/famillemillet/Projects/Maxime_ClaudeCoach && npm run lint 2>&1 | head -20
```

Attendu : aucune erreur.

- [ ] **Committer**

```bash
cd /Users/famillemillet/Projects/Maxime_ClaudeCoach && git add components/coach/CoachInputBar.tsx && git commit -m "CoachInputBar : pendingImage state, file input, preview chip, Enter géré en interne"
```

---

## Task 5 — `app/coach/page.tsx` : handleSend + props CoachInputBar

**Files:**
- Modify: `app/coach/page.tsx`

- [ ] **Ajouter l'import `CompressedImage`** (en tête de fichier, après les imports existants) :

Chercher la ligne qui importe depuis `@/lib/coachChat` :
```typescript
import {
  sendMessage,
  ...
} from "@/lib/coachChat";
```

Ajouter après cette ligne :
```typescript
import type { CompressedImage } from "@/lib/imageCompressor";
import type { ChatAttachments } from "@/lib/coachChat";
```

- [ ] **Mettre à jour `handleSend`** (vers la ligne 55) :

Avant :
```typescript
  const handleSend = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setInput("");
    setAdaptMsg(null);
    setSending(true);

    // Message user affiché immédiatement avant la réponse du coach
    const optimisticUser: ChatMessage = {
      id: `optimistic-${Date.now()}`,
      role: "user",
      content: trimmed,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticUser]);

    const result = await sendMessage(trimmed);
```

Après :
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
```

- [ ] **Supprimer `handleKeyDown`** dans `app/coach/page.tsx` (vers la ligne 112-117) — le Enter est maintenant géré dans `CoachInputBar` :

Supprimer ce bloc entier :
```typescript
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(input);
    }
  };
```

- [ ] **Mettre à jour les props de `CoachInputBar`** (vers la ligne 226) :

Avant :
```tsx
        <CoachInputBar
          value={input}
          sending={sending}
          textareaRef={textareaRef}
          onChange={(v) => { setInput(v); adjustTextarea(); }}
          onSend={() => handleSend(input)}
          onKeyDown={handleKeyDown}
        />
```

Après :
```tsx
        <CoachInputBar
          value={input}
          sending={sending}
          textareaRef={textareaRef}
          onChange={(v) => { setInput(v); adjustTextarea(); }}
          onSend={(image) => handleSend(input, image)}
        />
```

- [ ] **Vérifier le lint**

```bash
cd /Users/famillemillet/Projects/Maxime_ClaudeCoach && npm run lint 2>&1 | head -20
```

Attendu : aucune erreur.

- [ ] **Vérifier visuellement**

```bash
cd /Users/famillemillet/Projects/Maxime_ClaudeCoach && npm run dev
```

Ouvrir `/coach` → taper "+" → sélectionner une photo → vérifier que le preview chip apparaît sous le textarea. Envoyer → vérifier que la miniature s'affiche dans la bulle utilisateur du fil. Tester aussi : image seule (sans texte), texte seul (sans image), les deux ensemble.

- [ ] **Committer**

```bash
cd /Users/famillemillet/Projects/Maxime_ClaudeCoach && git add app/coach/page.tsx && git commit -m "coach/page : handleSend étendu image, CoachInputBar props mis à jour (onKeyDown supprimé)"
```

---

## Self-Review

**Couverture spec :**
- ✅ `CoachInputBar` state + file input + preview chip → Task 4
- ✅ `onSend(image?)` — signature étendue → Task 4 + 5
- ✅ `ChatMessage.imageBase64?` → Task 1
- ✅ `ChatAttachments` + `sendMessage` 2ème param → Task 1
- ✅ Body Supabase spread conditionnel → Task 1
- ✅ `chat-coach` multimodal injection → Task 2
- ✅ MIME validation identique à `analyze-session` → Task 2
- ✅ Thumbnail dans `CoachMessageBubble` (Option A) → Task 3
- ✅ Image seule possible (guard `!trimmed && !image`) → Task 5
- ✅ Message vide → `"."` envoyé à Anthropic → Task 2
- ✅ `pendingImage` reset avant `onSend` (pas dans `.then()` — l'InputBar est reset côté UI) → Task 4
- ✅ `handleKeyDown` supprimé du parent → Task 5

**Types cohérents :**
- `CompressedImage` (lib/imageCompressor.ts) : `{ base64, mimeType, name }` — utilisé dans Task 4 (state), Task 5 (`image.base64`, `image.mimeType`)
- `ChatAttachments` défini Task 1 : `{ imageBase64, imageMimeType }` — utilisé Task 5 ✅
- `sendMessage(text, attachments?)` — défini Task 1, appelé Task 5 ✅
- `onSend: (image?: CompressedImage | null) => void` — défini Task 4, câblé Task 5 ✅
