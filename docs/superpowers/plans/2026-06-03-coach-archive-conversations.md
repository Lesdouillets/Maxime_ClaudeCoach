# Coach — Archivage des conversations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer la suppression définitive par un archivage, et donner au coach un outil pour consulter les conversations passées quand l'utilisateur y fait référence.

**Architecture:** Nouvelle table Supabase `chat_archives` (une ligne par conversation archivée). L'archivage INSERT dans cette table puis vide la conversation active. Le coach dispose d'un tool `fetch_previous_conversations` dans l'Edge Function — il le déclenche lui-même uniquement quand le contexte le justifie, l'Edge Function requête alors Supabase directement.

**Tech Stack:** Next.js 14, TypeScript, Supabase (PostgreSQL + Edge Functions Deno), Anthropic API

**Spec:** `docs/superpowers/specs/2026-06-03-coach-archive-conversations-design.md`

---

## Fichiers touchés

| Fichier | Action |
|---|---|
| `lib/coachChat.ts` | Modifier — ajouter `archiveChatHistory()`, passer `userId`/`profileId` dans `sendMessage()` |
| `app/coach/page.tsx` | Modifier — remplacer trash par archive, fix safe area, état d'erreur |
| `supabase/functions/chat-coach/index.ts` | Modifier — import Supabase, nouveau tool + handler, `compactArchives`, system prompt |

---

## Task 1 : Créer la table `chat_archives` en Supabase

**Files:**
- Aucun fichier local — migration appliquée directement sur le projet Supabase lié

- [ ] **Step 1 : Appliquer la migration via l'outil Supabase MCP**

Exécuter ce SQL sur le projet Supabase lié :

```sql
CREATE TABLE chat_archives (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid        REFERENCES auth.users NOT NULL,
  profile_id  text        NOT NULL,
  messages    jsonb       NOT NULL,
  archived_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE chat_archives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_owns_archives" ON chat_archives
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

- [ ] **Step 2 : Vérifier que la table existe**

Via Supabase MCP `list_tables` ou dans le dashboard Supabase → Table Editor : confirmer que `chat_archives` apparaît avec les 4 colonnes `id`, `user_id`, `profile_id`, `messages`, `archived_at`.

---

## Task 2 : `lib/coachChat.ts` — archiveChatHistory + userId dans sendMessage

**Files:**
- Modify: `lib/coachChat.ts`

- [ ] **Step 1 : Ajouter `archiveChatHistory()` après `clearChatHistory()`**

Dans `lib/coachChat.ts`, remplacer le bloc `clearChatHistory` (ligne ~107-110) par :

```typescript
/** Clear all chat history (locally + Supabase) */
export async function clearChatHistory(): Promise<void> {
  await saveChatHistory([]);
}

/** Archive current conversation then clear it. Throws on Supabase error (no silent loss). */
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

  await saveChatHistory([]);
}
```

- [ ] **Step 2 : Passer `userId` et `profileId` dans `sendMessage()`**

Dans `sendMessage()` (ligne ~134), récupérer l'utilisateur en début de fonction et l'ajouter au body de l'invocation Edge Function :

Ajouter juste après la ligne `const profile = getActiveProfile();` :

```typescript
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id ?? null;
  const profileId = getActiveProfileId() ?? null;
```

Puis dans le body de `supabase.functions.invoke("chat-coach", { body: { ... } })`, ajouter les deux champs :

```typescript
        userId,
        profileId,
```

Le body complet après modification ressemble à :

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
        userId,
        profileId,
        ...(attachments?.imageBase64 && {
          imageBase64: attachments.imageBase64,
          imageMimeType: attachments.imageMimeType,
        }),
      },
    });
```

- [ ] **Step 3 : Vérifier que le build TypeScript ne lève pas d'erreur**

```bash
cd /Users/famillemillet/Projects/Maxime_ClaudeCoach && npm run build 2>&1 | tail -20
```

Attendu : `✓ Compiled successfully` (ou `Export successful`), pas d'erreur TypeScript.

- [ ] **Step 4 : Commit**

```bash
git add lib/coachChat.ts
git commit -m "Ajout archiveChatHistory et passage userId/profileId au coach"
```

---

## Task 3 : `app/coach/page.tsx` — bouton archive + fix safe area + gestion erreur

**Files:**
- Modify: `app/coach/page.tsx`

- [ ] **Step 1 : Mettre à jour les imports**

Remplacer dans les imports :

```typescript
// Avant
import { TrashIcon } from "@/components/icons";
// ...
  clearChatHistory,
```

```typescript
// Après
import { ArchiveIcon } from "@/components/icons";
// ...
  archiveChatHistory,
```

Supprimer `clearChatHistory` de l'import `coachChat` si elle y figure.

- [ ] **Step 2 : Ajouter l'état d'erreur et renommer les états**

Dans les déclarations de state (après `const [clearing, setClearing] = useState(false)`), remplacer :

```typescript
  const [clearing, setClearing] = useState(false);
```

par :

```typescript
  const [archiving, setArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
```

- [ ] **Step 3 : Remplacer `handleClear` par `handleArchive`**

Remplacer la fonction `handleClear` :

```typescript
  // Avant
  const handleClear = async () => {
    if (clearing) return;
    setClearing(true);
    await clearChatHistory();
    setMessages([]);
    setClearing(false);
  };
```

par :

```typescript
  const handleArchive = async () => {
    if (archiving) return;
    setArchiving(true);
    setArchiveError(null);
    try {
      await archiveChatHistory();
      setMessages([]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur lors de l'archivage";
      setArchiveError(msg);
      // Efface le message d'erreur après 3 secondes
      setTimeout(() => setArchiveError(null), 3000);
    } finally {
      setArchiving(false);
    }
  };
```

- [ ] **Step 4 : Mettre à jour le bouton et corriger le safe area**

Remplacer le bloc JSX du bouton (autour de la ligne 129-135) :

```tsx
      {/* Bouton archive — visible uniquement quand il y a des messages */}
      {messages.length > 0 && (
        <div style={{
          position: "absolute",
          top: "calc(env(safe-area-inset-top, 0px) + 16px)",
          right: 20,
          zIndex: 10,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 4,
        }}>
          <button
            onClick={handleArchive}
            disabled={archiving}
            className="press-effect"
            style={{ padding: 8, opacity: archiving ? 0.4 : 1 }}
            aria-label="Archiver la conversation"
          >
            <ArchiveIcon size={18} color="var(--color-muted)" />
          </button>
          {archiveError && (
            <p style={{ fontSize: 11, color: "#ff6b6b", maxWidth: 160, textAlign: "right" }}>
              {archiveError}
            </p>
          )}
        </div>
      )}
```

- [ ] **Step 5 : Vérifier le build**

```bash
cd /Users/famillemillet/Projects/Maxime_ClaudeCoach && npm run build 2>&1 | tail -20
```

Attendu : build sans erreur TypeScript.

- [ ] **Step 6 : Test manuel**

Lancer le dev server : `npm run dev`
- Ouvrir `http://localhost:3001/coach`
- Envoyer un message au coach
- Vérifier que l'icône archive apparaît en haut à droite, correctement positionnée sous la status bar simulée
- Cliquer archive → la conversation se vide
- Vérifier dans Supabase Table Editor (`chat_archives`) qu'une ligne a été insérée avec les messages

- [ ] **Step 7 : Commit**

```bash
git add app/coach/page.tsx
git commit -m "Remplacement bouton trash par archive, fix safe area, gestion erreur"
```

---

## Task 4 : Edge Function `chat-coach` — tool fetch_previous_conversations

**Files:**
- Modify: `supabase/functions/chat-coach/index.ts`

- [ ] **Step 1 : Ajouter l'import Supabase en tête de fichier**

Ajouter en toute première ligne du fichier (avant le commentaire existant) :

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
```

- [ ] **Step 2 : Ajouter le client Supabase admin et la fonction `compactArchives`**

Juste après la ligne `const CORS = { ... };` (après la fermeture de l'objet CORS), ajouter :

```typescript
// Client admin — bypass RLS pour requêtes archives depuis l'Edge Function
const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

type ArchiveRow = { messages: Array<{ role: string; content: string; imageBase64?: string }>; archived_at: string };

function compactArchives(archives: ArchiveRow[]): string {
  const parts = archives.map((archive) => {
    const msgs = archive.messages.filter((m) => !m.imageBase64);
    if (msgs.length === 0) return null;

    const head = msgs.slice(0, 2);
    // tail commence après head pour éviter les doublons sur les courtes convs
    const tail = msgs.slice(Math.max(2, msgs.length - 4));
    const separator = msgs.length > 6 ? [{ role: "system", content: "..." }] : [];
    const combined = [...head, ...separator, ...tail];

    const text = combined
      .map((m) => m.role === "system" ? "..." : `${m.role === "user" ? "Utilisateur" : "Coach"}: ${m.content}`)
      .join("\n")
      .slice(0, 1500);

    const date = new Date(archive.archived_at).toLocaleDateString("fr-FR");
    return `--- Conversation archivée le ${date} ---\n${text}`;
  }).filter(Boolean);

  return parts.length > 0 ? parts.join("\n\n") : "Aucune conversation archivée.";
}
```

- [ ] **Step 3 : Mettre à jour le system prompt pour mentionner le nouvel outil**

Dans `buildSystemPrompt()`, remplacer la section `## OUTILS DISPONIBLES` :

```typescript
// Avant
## OUTILS DISPONIBLES

Tu disposes de 3 outils. Utilise-les comme un vrai coach qui planifie et mémorise :

1. **propose_plan_batch** — quand tu crées ou modifies des séances. Toujours demander confirmation.
2. **apply_plan_batch** — quand l'user confirme explicitement un plan ("ok", "valide", "go"). Résous les IDs depuis tes propose_plan_batch précédents dans cette conversation.
3. **update_memory** — quand l'user mentionne une blessure, un objectif de course, une contrainte physique, ou que tu observes une tendance significative. PAS pour chaque échange.

Si tu réponds juste à une question sans modifier le programme, n'appelle aucun outil.
```

```typescript
// Après
## OUTILS DISPONIBLES

Tu disposes de 4 outils. Utilise-les comme un vrai coach qui planifie et mémorise :

1. **propose_plan_batch** — quand tu crées ou modifies des séances. Toujours demander confirmation.
2. **apply_plan_batch** — quand l'user confirme explicitement un plan ("ok", "valide", "go"). Résous les IDs depuis tes propose_plan_batch précédents dans cette conversation.
3. **update_memory** — quand l'user mentionne une blessure, un objectif de course, une contrainte physique, ou que tu observes une tendance significative. PAS pour chaque échange.
4. **fetch_previous_conversations** — quand l'user fait référence à une conversation passée ("dans une précédente conversation", "tu m'avais dit", "on avait parlé de", "tu te souviens quand"...). N'utilise PAS cet outil dans les échanges ordinaires.

Si tu réponds juste à une question sans modifier le programme, n'appelle aucun outil.
```

- [ ] **Step 4 : Ajouter `fetch_previous_conversations` au tableau `COACH_TOOLS`**

Avant la ligne `] as const;` qui ferme le tableau `COACH_TOOLS` (ligne ~292), ajouter :

```typescript
  {
    name: "fetch_previous_conversations",
    description:
      "Récupère les conversations archivées. " +
      "À utiliser UNIQUEMENT si l'user fait référence à une discussion passée " +
      "('dans une précédente conversation', 'tu m'avais dit', 'on avait parlé de', 'tu te souviens quand', etc.). " +
      "Ne pas appeler dans les échanges ordinaires.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
```

- [ ] **Step 5 : Ajouter `userId` et `profileId` au destructuring du body**

Dans le bloc `const { messages = [], ... } = body;` (ligne ~401), ajouter les deux champs :

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
      userId,
      profileId,
    } = body;
```

- [ ] **Step 6 : Ajouter le handler `fetch_previous_conversations` dans la boucle des tools**

Dans le bloc `for (const toolBlock of toolUseBlocks)`, après le `else if (name === "update_memory")` block (ligne ~587-591), ajouter :

```typescript
        } else if (name === "fetch_previous_conversations") {
          if (!userId || !profileId) {
            toolResultContent = "Aucune conversation archivée.";
          } else {
            const { data, error: archiveError } = await supabaseAdmin
              .from("chat_archives")
              .select("messages, archived_at")
              .eq("user_id", userId)
              .eq("profile_id", profileId)
              .order("archived_at", { ascending: false })
              .limit(3);

            if (archiveError || !data || data.length === 0) {
              toolResultContent = "Aucune conversation archivée.";
            } else {
              toolResultContent = compactArchives(data as ArchiveRow[]);
            }
          }
          console.log("[chat-coach] fetch_previous_conversations appelé");
```

Le bloc complet après modification :

```typescript
        if (name === "propose_plan_batch") {
          result.pending_plans = Array.isArray(input.plans) ? input.plans : [];
          result.pending_delete_ids = Array.isArray(input.delete_ids) ? (input.delete_ids as string[]) : [];
          toolResultContent = `OK — ${result.pending_plans.length} plan(s) proposé(s), en attente de confirmation user.`;
          console.log("[chat-coach] propose_plan_batch:", result.pending_plans.length, "plans");
        } else if (name === "apply_plan_batch") {
          const planIds = Array.isArray(input.plan_ids) ? (input.plan_ids as string[]) : [];
          result.modified_plans = resolvePlansByIds(planIds, conversationMessages, currentTurnProposedPlans);
          result.delete_plan_ids = Array.isArray(input.delete_ids) ? (input.delete_ids as string[]) : [];
          toolResultContent = `OK — ${result.modified_plans.length} plan(s) appliqué(s).`;
          console.log("[chat-coach] apply_plan_batch:", result.modified_plans.length, "plans résolus");
        } else if (name === "update_memory") {
          result.memory_update = input;
          toolResultContent = "Mémoire mise à jour.";
          console.log("[chat-coach] update_memory appelé");
        } else if (name === "fetch_previous_conversations") {
          if (!userId || !profileId) {
            toolResultContent = "Aucune conversation archivée.";
          } else {
            const { data, error: archiveError } = await supabaseAdmin
              .from("chat_archives")
              .select("messages, archived_at")
              .eq("user_id", userId)
              .eq("profile_id", profileId)
              .order("archived_at", { ascending: false })
              .limit(3);

            if (archiveError || !data || data.length === 0) {
              toolResultContent = "Aucune conversation archivée.";
            } else {
              toolResultContent = compactArchives(data as ArchiveRow[]);
            }
          }
          console.log("[chat-coach] fetch_previous_conversations appelé");
        }
```

- [ ] **Step 7 : Déployer l'Edge Function**

```bash
cd /Users/famillemillet/Projects/Maxime_ClaudeCoach && supabase functions deploy chat-coach --no-verify-jwt
```

Attendu : `Deployed Function chat-coach` sans erreur.

- [ ] **Step 8 : Test manuel — flux archive + référence passée**

1. Dans `/coach`, envoyer quelques messages (ex: "Je veux travailler mes tractions")
2. Cliquer sur l'icône archive → conv vidée, vérifier dans Supabase `chat_archives` qu'une ligne est présente
3. Envoyer un nouveau message dans la conv vide
4. Envoyer ensuite : "Dans notre précédente conversation, tu m'avais donné des conseils sur les tractions, tu t'en souviens ?"
5. Vérifier dans les logs Supabase Edge Function (Dashboard → Edge Functions → chat-coach → Logs) que `fetch_previous_conversations appelé` apparaît
6. Vérifier que la réponse du coach mentionne le contenu de la conversation archivée

- [ ] **Step 9 : Commit + push**

```bash
git add supabase/functions/chat-coach/index.ts
git commit -m "Edge Function : ajout tool fetch_previous_conversations + requête chat_archives"
```

---

## Récapitulatif des commits

| # | Commit | Fichiers |
|---|---|---|
| 1 | Migration Supabase (pas de fichier local) | — |
| 2 | `Ajout archiveChatHistory et passage userId/profileId au coach` | `lib/coachChat.ts` |
| 3 | `Remplacement bouton trash par archive, fix safe area, gestion erreur` | `app/coach/page.tsx` |
| 4 | `Edge Function : ajout tool fetch_previous_conversations + requête chat_archives` | `supabase/functions/chat-coach/index.ts` |
