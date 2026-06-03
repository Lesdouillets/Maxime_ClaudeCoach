# Spec — Archivage des conversations coach + accès contexte passé

**Date :** 2026-06-03
**Statut :** Validé, prêt pour implémentation

---

## Problème

Le bouton "supprimer" efface définitivement la conversation (localStorage + Supabase).
Le coach n'a aucun accès aux échanges passés, même si l'utilisateur y fait référence.

---

## Solution

1. Remplacer le bouton trash par un bouton **archive** — quitte la conversation sans la détruire.
2. Donner au coach un outil `fetch_previous_conversations` qu'il appelle **lui-même** quand l'utilisateur fait référence à une conversation passée.

---

## Base de données

Nouvelle table Supabase :

```sql
CREATE TABLE chat_archives (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid        REFERENCES auth.users NOT NULL,
  profile_id  text        NOT NULL,
  messages    jsonb       NOT NULL,
  archived_at timestamptz DEFAULT now() NOT NULL
);

-- RLS : chaque utilisateur ne voit que ses propres archives
ALTER TABLE chat_archives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_owns_archives" ON chat_archives
  FOR ALL USING (auth.uid() = user_id);
```

Pas de localStorage mirror pour les archives — elles sont uniquement consommées par l'Edge Function via Supabase, jamais lues côté client.

---

## Changements client

### `lib/coachChat.ts`

Nouvelle fonction `archiveChatHistory()` :

```typescript
export async function archiveChatHistory(): Promise<void> {
  const messages = getChatHistory();
  if (messages.length === 0) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("non authentifié");
  const profileId = getActiveProfileId();
  if (!profileId) throw new Error("profil manquant");

  const { error } = await supabase.from("chat_archives").insert({
    user_id: user.id,
    profile_id: profileId,
    messages,
  });
  if (error) throw new Error(error.message);

  // Vider la conv active seulement si l'archive a réussi
  await saveChatHistory([]);
}
```

`clearChatHistory()` reste en place (utilisée en interne), seul le point d'entrée UI change.

### `app/coach/page.tsx`

- Remplacer `TrashIcon` par `ArchiveIcon`
- Remplacer `clearChatHistory` par `archiveChatHistory`
- Renommer `handleClear` → `handleArchive`, `clearing` → `archiving`
- **Fix safe area** : le bouton archive utilise `env(safe-area-inset-top)` pour ne pas se retrouver derrière la status bar du device :

```tsx
// Avant (buggé)
style={{ position: "absolute", top: 16, right: 20 }}

// Après
style={{ position: "absolute", top: "calc(env(safe-area-inset-top, 0px) + 16px)", right: 20 }}
```

- Gestion d'erreur visible si l'archivage échoue (état `archiveError: string | null`) — pas d'effacement silencieux.

---

## Changements Edge Function (`chat-coach/index.ts`)

### 1. Nouveau paramètre dans le body

```typescript
const { messages, ..., userId, profileId } = await req.json();
```

`userId` et `profileId` sont passés par le client (même pattern que `profileName`, `coachMemory`, etc.).

### 2. Client Supabase admin dans l'Edge Function

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);
```

### 3. Nouveau tool dans la liste

```typescript
{
  name: "fetch_previous_conversations",
  description: "Récupère les conversations archivées quand l'utilisateur fait référence à une discussion passée ('dans une précédente conversation', 'tu m'avais dit', 'on avait parlé de', etc.). Ne pas appeler dans les cas ordinaires.",
  input_schema: { type: "object", properties: {}, required: [] }
}
```

### 4. Handler du tool dans la boucle agentique

```typescript
if (name === "fetch_previous_conversations") {
  const { data, error } = await supabaseAdmin
    .from("chat_archives")
    .select("messages, archived_at")
    .eq("user_id", userId)
    .eq("profile_id", profileId)
    .order("archived_at", { ascending: false })
    .limit(3);

  if (error || !data || data.length === 0) {
    toolResult = "Aucune conversation archivée.";
  } else {
    toolResult = compactArchives(data);
  }
}
```

### 5. Fonction `compactArchives`

Pour chaque archive : 2 premiers messages (contexte du sujet) + 4 derniers messages (fin de la conversation), images exclues, texte tronqué à 1500 chars par conversation.

```typescript
function compactArchives(archives: { messages: unknown[]; archived_at: string }[]): string {
  return archives.map((archive, i) => {
    const msgs = (archive.messages as Array<{ role: string; content: string; imageBase64?: string }>)
      .filter((m) => !m.imageBase64); // exclure les images
    const head = msgs.slice(0, 2);
    const tail = msgs.slice(-4);
    const combined = [...head, ...(msgs.length > 6 ? [{ role: "system", content: "..." }] : []), ...tail];
    const text = combined
      .map((m) => `${m.role === "user" ? "Utilisateur" : "Coach"}: ${m.content}`)
      .join("\n")
      .slice(0, 1500);
    const date = new Date(archive.archived_at).toLocaleDateString("fr-FR");
    return `--- Conversation archivée le ${date} ---\n${text}`;
  }).join("\n\n");
}
```

### 6. Instruction dans le system prompt

Ajout d'une ligne dans `buildSystemPrompt()` :

> "Tu as accès à l'outil `fetch_previous_conversations`. Utilise-le uniquement si l'utilisateur fait explicitement référence à une conversation passée."

---

## Flux complets

### Archivage
```
User clique "Archiver"
  → INSERT chat_archives (Supabase)
  → Erreur → afficher erreur, NE PAS vider la conv
  → Succès → saveChatHistory([]) → UI vide
```

### Message ordinaire
```
User envoie un message
  → Edge Function (inchangé)
  → 0 token archive
  → Claude répond directement
```

### Référence à une conversation passée
```
User : "dans une précédente conversation tu m'avais dit..."
  → Edge Function
  → Claude appelle fetch_previous_conversations
  → Edge Function → Supabase chat_archives (3 dernières, compactées)
  → Retour ~1100 tokens max à Claude
  → Claude répond avec contexte
  → Latence additionnelle : ~1-2s (1 round-trip Anthropic)
```

---

## Cas limites

| Situation | Comportement |
|---|---|
| Aucune archive en base | Tool retourne "Aucune conversation archivée." — Claude l'indique à l'utilisateur |
| Archive pendant offline | INSERT échoue → erreur affichée, conv conservée intacte |
| Conv vide (0 messages) | Bouton archive masqué (même logique que le bouton trash actuel) |
| Faux positif du tool | Archives retournées, ~1100 tokens + ~1-2s latence — rare, acceptable |

---

## Ce qui ne change pas

- `clearChatHistory()` — conservée pour usage interne
- Sync Supabase de la conversation active — inchangée
- Tous les autres tools (`propose_plan_batch`, `apply_plan_batch`, `update_memory`) — inchangés
- localStorage pour la conversation active — inchangé
