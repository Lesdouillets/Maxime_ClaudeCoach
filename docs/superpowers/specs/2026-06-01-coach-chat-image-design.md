# Design — Image attachement dans CoachInputBar

**Date :** 2026-06-01
**Statut :** Approuvé

---

## Contexte

`CoachInputBar` possède un bouton "+" qui n'est pas branché. Le but est de permettre à l'utilisateur d'y attacher une image (photo de montre, screenshot Strava, parcours) qui sera transmise au coach en contenu multimodal lors de l'envoi du message. L'image (ou l'absence de texte) ne bloque pas l'envoi — les deux modes sont possibles : image seule, ou image + texte.

---

## Périmètre

1. **`components/coach/CoachInputBar.tsx`** — state `pendingImage`, file input branché, preview chip interne, prop `onSend` étendue
2. **`lib/coachChat.ts`** — `ChatMessage.imageBase64?`, `sendMessage` 2ème param `attachments?`, injection multimodale du dernier message
3. **`supabase/functions/chat-coach/index.ts`** — support multimodal conditionnel sur le dernier message utilisateur
4. **`components/coach/CoachMessageBubble.tsx`** — rendu thumbnail (Option A) dans la bulle utilisateur

---

## Architecture

### Flux de données

```
Utilisateur
  │
  ├─ Tape "+" → <input file hidden> → compressImage() → pendingImage (state CoachInputBar)
  │    └─ Preview chip apparaît dans la barre de saisie
  │
  └─ Tape "Envoyer" (ou Enter)
       │
       ├─ onSend(pendingImage) appelé par CoachInputBar
       │
       ├─ sendMessage(text, { imageBase64, imageMimeType }) dans coachChat.ts
       │    ├─ userMsg.imageBase64 = imageBase64 (stocké pour affichage)
       │    └─ body Supabase : { messages, imageBase64, imageMimeType, ... }
       │
       └─ chat-coach edge function
            └─ injecte le content block image dans le dernier message utilisateur
                 └─ Anthropic API : messages[-1].content = [text_block, image_block]
```

### Vie de l'image

- Stockée en React state dans `CoachInputBar` (`useState<CompressedImage | null>`)
- Persistée dans `ChatMessage.imageBase64` (localStorage) pour affichage dans l'historique
- Détruite du state après envoi réussi ou annulation (✕)
- Compression identique à RunSheet : 1024px max, JPEG 80%, ~50-150 Ko

**Note localStorage :** chaque image occupe ~200-400 Ko dans `cc_chat_history`. Au-delà de ~10 messages avec image, le risque de dépasser la limite de 5 Mo de localStorage augmente. Comportement actuel : pas de guard — l'image est simplement omise du `ChatMessage` si localStorage sature (la mutation échoue silencieusement via `_saveChatLocal`). Pas de protection additionnelle nécessaire pour l'instant.

---

## Fichiers modifiés

### `components/coach/CoachInputBar.tsx`

**Props ajoutées :**
```typescript
interface Props {
  // ... existants
  onSend: (image?: CompressedImage | null) => void;  // signature étendue (image en argument)
}
```

**State ajouté :**
```typescript
const [pendingImage, setPendingImage] = useState<CompressedImage | null>(null);
const pendingImagePreviewSrc = useMemo(
  () => pendingImage ? `data:image/jpeg;base64,${pendingImage.base64}` : null,
  [pendingImage]
);
```

**File input :**
```tsx
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
      // pas de feedback dans la barre de chat — l'image ne s'affiche simplement pas
    }
    e.target.value = "";
  }}
/>
```

**Bouton "+" :**
```tsx
<button onClick={() => fileInputRef.current?.click()}>
  <PlusIcon size={20} color="#ffffff" />
</button>
```

**Preview chip** (inséré entre le textarea et la ligne d'actions, conditionnel) :
```tsx
{pendingImage && (
  <div style={{
    display: "flex", alignItems: "center", gap: 8,
    padding: "6px 0 2px",
    borderTop: "1px solid rgba(255,255,255,0.06)",
  }}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img
      src={pendingImagePreviewSrc ?? ""}
      alt=""
      style={{ width: 40, height: 40, borderRadius: 6, objectFit: "cover", flexShrink: 0 }}
    />
    <span style={{ flex: 1, fontSize: 12, color: "rgba(255,255,255,0.5)",
      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
      {pendingImage.name}
    </span>
    <button
      onClick={() => { setPendingImage(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
      style={{
        width: 18, height: 18, borderRadius: "50%",
        background: "rgba(255,255,255,0.12)", border: "none",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 9, color: "#aaa", cursor: "pointer", flexShrink: 0,
      }}
      aria-label="Supprimer l'image"
    >✕</button>
  </div>
)}
```

**Envoi :** le bouton "Envoyer" et `onKeyDown` appellent `onSend(pendingImage)`. Après envoi, reset `setPendingImage(null)`.

**Envoi image-only :** pas de guard — si `value` est vide et `pendingImage` est présent, le message est envoyé quand même. Le texte transmis à `sendMessage` sera `""`.

### `lib/coachChat.ts`

**`ChatMessage` — champ ajouté :**
```typescript
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageBase64?: string;  // base64 JPEG, stocké pour affichage dans l'historique
  timestamp: string;
  card?: { ... }
}
```

**`sendMessage` — 2ème param :**
```typescript
export interface ChatAttachments {
  imageBase64: string;
  imageMimeType: string;
}

export async function sendMessage(
  userText: string,
  attachments?: ChatAttachments
): Promise<ChatMessage | null>
```

**Stockage dans le message :**
```typescript
const userMsg: ChatMessage = {
  id: `chat-${Date.now()}-user`,
  role: "user",
  content: userText,
  ...(attachments?.imageBase64 && { imageBase64: attachments.imageBase64 }),
  timestamp: new Date().toISOString(),
};
```

**Body Supabase — spread conditionnel :**
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

**`apiMessages` — texte pur pour l'historique :**
```typescript
const apiMessages = history.map((m) => ({
  role: m.role,
  content: m.content,  // toujours string — les images ne sont pas re-envoyées
}));
```

### `supabase/functions/chat-coach/index.ts`

**Body destructuring :**
```typescript
const { messages = [], ..., imageBase64, imageMimeType } = body;
```

**Validation MIME (identique à analyze-session) :**
```typescript
const ALLOWED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const imageBase64Str = typeof imageBase64 === "string" ? imageBase64 : null;
const mimeTypeStr = typeof imageMimeType === "string" ? imageMimeType : null;
if (imageBase64Str && mimeTypeStr && !ALLOWED_IMAGE_MIME_TYPES.includes(mimeTypeStr)) {
  return new Response(JSON.stringify({ error: `Type d'image non supporté: ${mimeTypeStr}` }), { status: 400, headers: CORS });
}
const resolvedMimeType = mimeTypeStr ?? "image/jpeg";
```

**Injection multimodale sur le dernier message utilisateur** (juste avant la construction de `conversationMessages`) :

```typescript
// Le dernier message de recentMessages est le message utilisateur courant.
// Si une image est attachée, on remplace son content string par un content block array.
if (imageBase64Str && recentMessages.length > 0) {
  const lastMsg = recentMessages[recentMessages.length - 1];
  if (lastMsg.role === "user") {
    recentMessages = [
      ...recentMessages.slice(0, -1),
      {
        role: "user",
        content: [
          { type: "text", text: lastMsg.content || "." },
          { type: "image", source: { type: "base64", media_type: resolvedMimeType, data: imageBase64Str } },
        ],
      },
    ];
  }
}
```

Note : si `lastMsg.content` est vide (image seule), on envoie `"."` comme texte minimal pour respecter le format Anthropic (un content array vide n'est pas accepté, et un text block vide non plus).

### `components/coach/CoachMessageBubble.tsx`

**Bulle utilisateur — ajout du rendu image (Option A) :**
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
              width: 160, height: 110,
              borderRadius: 14, borderBottomRightRadius: 4,
              objectFit: "cover",
            }}
          />
        )}
        {message.content && (
          <div style={{
            background: "var(--color-white-10)",
            borderRadius: 20, borderBottomRightRadius: 6,
            padding: "12px 16px",
          }}>
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

### `app/coach/page.tsx`

**Mise à jour de `handleSend` pour passer l'image :**
```typescript
const handleSend = useCallback((image?: CompressedImage | null) => {
  if ((!inputValue.trim() && !image) || sending) return;
  const attachments = image
    ? { imageBase64: image.base64, imageMimeType: image.mimeType }
    : undefined;
  // ... logique existante
  sendMessage(inputValue.trim(), attachments).then(...);
  setInputValue("");
}, [inputValue, sending]);
```

---

## Cas limites

| Cas | Comportement |
|-----|-------------|
| Image seule, pas de texte | Envoyé avec `content: ""` → Anthropic reçoit `text: "."` (minimal valide) ; la bulle affiche uniquement la miniature |
| Texte seul, pas d'image | Comportement inchangé |
| Compression échoue | `pendingImage` reste null, pas de chip — l'envoi part sans image silencieusement |
| localStorage plein | `_saveChatLocal` échoue, le message n'est pas persisté — comportement existant, non aggravé |
| Image dans l'historique chargé | `ChatMessage.imageBase64` est persisté → la miniature réapparaît après rechargement |
| Message historique envoyé à l'API | `apiMessages` mappe sur `m.content` (string) — les images ne sont jamais re-envoyées |

---

## Ce qui ne change pas

- Le bouton "Relancer" dans CoachFeedbackCard (analyse de session) — sans lien avec le chat
- `NoteModal` — non concerné
- `RunSheet` pièces jointes — indépendant
- Le prompt système de `chat-coach`
- Le parsing JSON de la réponse du coach
