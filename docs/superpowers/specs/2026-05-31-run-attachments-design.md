# Design — Pièces jointes RunSheet (note + image → coach)

**Date :** 2026-05-31
**Statut :** Approuvé

---

## Contexte

Le RunSheet affiche un CTA Strava en bas de l'écran dans deux cas :
- Run planifié non encore loggué (`coachRun && !doneSession`)
- Session existante pas encore synchronisée depuis Strava (`needsStravaSync`)

À côté du CTA Strava se trouve un bouton "+" qui ouvre un menu contextuel "Ajouter une image" / "Ajouter une note". Ces deux actions sont actuellement non-branchées : le `<input file>` n'a pas de `onChange`, et la note est sauvegardée via `NoteModal` mais n'est jamais transmise à `analyzeSession`.

Ce design branche les deux, ajoute un retour visuel (chips), et déclenche `analyzeSession` directement après la synchro Strava.

---

## Périmètre

1. **Utilitaire de compression image** — `lib/imageCompressor.ts`
2. **RunSheet** — state, wiring input file, chips, trigger analyse direct
3. **coachAnalyzer.ts** — nouveau paramètre `attachments`
4. **Edge function `analyze-session`** — support multimodal (image en content block)
5. **`/dev/components`** — showcase du CTA + chips dans l'onglet Running

---

## Architecture

### Flux de données

```
Utilisateur
  │
  ├─ Ajoute une image → compressImage() → pendingImage (React state)
  ├─ Ajoute une note → NoteModal → coachRun.userNote / doneSession.comment (localStorage)
  │
  └─ Tape "Sync Strava"
       │
       ├─ handleStravaImport / handleStravaSync (existants)
       │    └─ analyzeSession(session, noteContext, { imageBase64, mimeType })
       │         └─ supabase.functions.invoke("analyze-session", { body: { ..., imageBase64, imageMimeType } })
       │              └─ Anthropic API — messages[0].content = [text block + image block]
       │
       └─ pendingImage reset → null
```

### Vie de l'image

- Stockée uniquement en React state (`useState`) dans RunSheet
- Jamais persistée en localStorage
- Détruite à : fermeture du sheet, changement de date, fin de l'analyse
- Taille max après compression : ~100 Ko (1024px, JPEG 80%)
- Coût estimé : ~$0.005 par synchro avec image → négligeable

---

## Fichiers modifiés / créés

### `lib/imageCompressor.ts` (nouveau)

```typescript
export interface CompressedImage {
  base64: string;
  mimeType: "image/jpeg";
  name: string;
}

export async function compressImage(file: File): Promise<CompressedImage>
```

- Canvas en mémoire, resize max 1024px côté long
- `toBlob("image/jpeg", 0.8)` → `FileReader.readAsDataURL` → strip du préfixe `data:image/jpeg;base64,`
- Retourne `{ base64, mimeType: "image/jpeg", name: file.name }`

### `lib/coachAnalyzer.ts` (modifié)

Nouveau 3ème paramètre optionnel :

```typescript
export interface SessionAttachments {
  imageBase64?: string;
  mimeType?: string;
}

export async function analyzeSession(
  session: WorkoutSession,
  chatContext?: string,
  attachments?: SessionAttachments
): Promise<CoachAnalysisResult | null>
```

Le body Supabase inclut deux nouveaux champs optionnels :
```typescript
body: { ..., imageBase64: attachments?.imageBase64, imageMimeType: attachments?.mimeType }
```

### `components/RunSheet.tsx` (modifié)

**State ajouté :**
```typescript
const [pendingImage, setPendingImage] = useState<CompressedImage | null>(null);
```

**Reset :** dans `handleClose` et dans le `useEffect` qui charge les données de la date (reset quand `sheet.state` change).

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
    const compressed = await compressImage(file);
    setPendingImage(compressed);
    e.target.value = "";
  }}
/>
```

**Chips (Option A — approuvée) :**

Affichées entre le message `stravaSyncMsg` et la `btn-row`, quand le CTA est visible et qu'il y a quelque chose à afficher :

```tsx
{/* Chip note */}
{noteValue && (
  <div className="chip">
    📝 "{noteValue.slice(0, 30)}{noteValue.length > 30 ? "…" : ""}"
    <button onClick={handleClearNote}>✕</button>
  </div>
)}
{/* Chip image */}
{pendingImage && (
  <div className="chip">
    <img src={`data:image/jpeg;base64,${pendingImage.base64}`} ... />
    {pendingImage.name}
    <button onClick={() => { setPendingImage(null); fileInputRef.current && (fileInputRef.current.value = ""); }}>✕</button>
  </div>
)}
```

`noteValue` = `coachRun?.userNote || doneSession?.comment || ""`

`handleClearNote` :
- Si `coachRun` : `addCoachRun({ ...coachRun, userNote: "" })` + `setCoachRun(updated)`
- Si `doneSession` : `updateSession({ ...doneSession, comment: "" })` + `setDoneSession(updated)`

**Trigger direct de l'analyse :**

Dans `handleStravaImport`, après `addSession(session)` et `setDoneSession(session)` :
```typescript
const noteCtx = coachRun?.userNote ? `Note de l'athlète : "${coachRun.userNote}"` : undefined;
setAnalysisAttempted(true);
setCoachState("analyzing");
analyzeSession(
  session as RunSession,
  noteCtx,
  pendingImage ? { imageBase64: pendingImage.base64, mimeType: pendingImage.mimeType } : undefined
).then((result) => { setCoachResult(result); setCoachState("done"); });
setPendingImage(null);
```

Idem dans `handleStravaSync`, après `updateSession(updated)` et `setDoneSession(updated)`.

**Le `useEffect` réactif existant** (analyse pour `importedFromStrava && !storedAnalysis`) est conservé — il couvre les sessions importées avant cette feature. Le guard `analyzingInFlight` dans `coachAnalyzer.ts` empêche les doublons.

### `supabase/functions/analyze-session/index.ts` (modifié)

**Body destructuring :**
```typescript
const { ..., imageBase64, imageMimeType } = body;
```

**Messages array — multimodal conditionnel :**
```typescript
const userContent = imageBase64
  ? [
      { type: "text", text: buildUserPrompt(session, coachPlans, recentSessions, previousAnalyses, chatContext, coachMemory) },
      { type: "image", source: { type: "base64", media_type: imageMimeType ?? "image/jpeg", data: imageBase64 } },
    ]
  : buildUserPrompt(session, coachPlans, recentSessions, previousAnalyses, chatContext, coachMemory);

messages: [{ role: "user", content: userContent }]
```

Aucun changement au prompt système, au parsing JSON, ni aux autres comportements.

### `app/dev/components/page.tsx` (modifié)

Dans l'onglet "running", nouveau `ComponentBlock` :

**Titre :** "Strava CTA — pièces jointes"
**Description :** "3 états : note seule, image seule, note + image"

3 blocs statiques non-interactifs qui montrent les chips + boutons en rendu réel.

---

## Cas limites

| Cas | Comportement |
|-----|-------------|
| Utilisateur ferme le sheet sans syncer | `pendingImage` est perdu (éphémère par design). La note est déjà persistée. |
| Synchro Strava échoue | `pendingImage` n'est PAS reset (le `finally` ne le clear pas) — l'utilisateur peut retenter avec l'image intacte. |
| Double appel analyzeSession (useEffect + handler direct) | Bloqué par `analyzingInFlight` Set dans `coachAnalyzer.ts`. |
| Image > 5 Mo après compression | Impossible : la compression 1024px/JPEG 80% produit ~50–150 Ko. |
| Note vide (chaîne "") | Chip non affichée. `handleClearNote` ne fait rien si la note est déjà vide. |

---

## Ce qui ne change pas

- Le prompt système de l'edge function
- Le parsing de la réponse JSON du coach
- La logique `modified_plans` / `memory_update`
- Le comportement du `NoteModal` (inchangé)
- Le comportement du bouton "RELANCER L'ANALYSE COACH" (ne passe pas l'image — éphémère)
