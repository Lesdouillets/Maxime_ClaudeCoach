# Run Attachments (note + image → coach) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Brancher le bouton "+" du RunSheet pour permettre d'attacher une image et/ou une note avant la synchro Strava, afficher des chips de feedback visuel (Option A), et transmettre ces pièces jointes au coach via `analyzeSession` — déclenché directement après chaque synchro.

**Architecture:** L'image est compressée côté client (canvas → JPEG 80% → base64) et stockée en React state éphémère. Elle est transmise à l'edge function `analyze-session` comme un bloc image multimodal dans `messages[0].content`. La note existante (déjà persistée via NoteModal) est passée en `chatContext`. L'analyse est déclenchée directement dans `handleStravaImport` et `handleStravaSync`, sans attendre le `useEffect` réactif.

**Tech Stack:** React (useState, useCallback), Canvas API, Supabase Edge Functions, Anthropic API multimodal content blocks, Next.js 14 static export.

---

## File Map

| Fichier | Action | Rôle |
|---------|--------|------|
| `lib/imageCompressor.ts` | CREATE | Compression canvas → base64 JPEG |
| `lib/coachAnalyzer.ts` | MODIFY | Nouveau type `SessionAttachments` + 3ème param `analyzeSession` |
| `supabase/functions/analyze-session/index.ts` | MODIFY | Support content array multimodal |
| `components/RunSheet.tsx` | MODIFY | State `pendingImage`, file input, chips, triggers directs |
| `app/dev/components/page.tsx` | MODIFY | Showcase "Strava CTA — pièces jointes" |

---

## Task 1 — `lib/imageCompressor.ts`

**Files:**
- Create: `lib/imageCompressor.ts`

- [ ] **Créer le fichier `lib/imageCompressor.ts`** avec le contenu suivant :

```typescript
export interface CompressedImage {
  base64: string;
  mimeType: "image/jpeg";
  name: string;
}

const MAX_DIMENSION = 1024;

export async function compressImage(file: File): Promise<CompressedImage> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width >= height) {
          height = Math.round((height * MAX_DIMENSION) / width);
          width = MAX_DIMENSION;
        } else {
          width = Math.round((width * MAX_DIMENSION) / height);
          height = MAX_DIMENSION;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas 2D context unavailable")); return; }
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error("Canvas toBlob failed")); return; }
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            const base64 = dataUrl.split(",")[1];
            resolve({ base64, mimeType: "image/jpeg", name: file.name });
          };
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        },
        "image/jpeg",
        0.8
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Image load failed"));
    };
    img.src = objectUrl;
  });
}
```

- [ ] **Vérifier la compilation TypeScript**

```bash
cd /Users/famillemillet/Projects/Maxime_ClaudeCoach && npm run lint 2>&1 | head -30
```

Attendu : aucune erreur sur `lib/imageCompressor.ts`.

- [ ] **Committer**

```bash
git add lib/imageCompressor.ts
git commit -m "Ajout utilitaire de compression image (canvas JPEG 80%, max 1024px)"
```

---

## Task 2 — Étendre `lib/coachAnalyzer.ts`

**Files:**
- Modify: `lib/coachAnalyzer.ts`

- [ ] **Ajouter l'interface `SessionAttachments`** juste avant la déclaration de `analyzeSession` (après la ligne `const analyzingInFlight = new Set<string>();`, vers la ligne 130) :

```typescript
export interface SessionAttachments {
  imageBase64?: string;
  mimeType?: string;
}
```

- [ ] **Modifier la signature de `analyzeSession`** (ligne 132) pour ajouter le 3ème paramètre :

Avant :
```typescript
export async function analyzeSession(session: WorkoutSession, chatContext?: string): Promise<CoachAnalysisResult | null> {
```

Après :
```typescript
export async function analyzeSession(session: WorkoutSession, chatContext?: string, attachments?: SessionAttachments): Promise<CoachAnalysisResult | null> {
```

- [ ] **Modifier l'appel `supabase.functions.invoke`** (ligne 150) pour transmettre les pièces jointes :

Avant :
```typescript
    const { data, error } = await supabase.functions.invoke("analyze-session", {
      body: { session, coachPlans: annotatedPlans, recentSessions, profileName, previousAnalyses, chatContext, coachMemory },
    });
```

Après :
```typescript
    const { data, error } = await supabase.functions.invoke("analyze-session", {
      body: {
        session,
        coachPlans: annotatedPlans,
        recentSessions,
        profileName,
        previousAnalyses,
        chatContext,
        coachMemory,
        imageBase64: attachments?.imageBase64,
        imageMimeType: attachments?.mimeType,
      },
    });
```

- [ ] **Vérifier la compilation**

```bash
npm run lint 2>&1 | head -30
```

Attendu : aucune erreur.

- [ ] **Committer**

```bash
git add lib/coachAnalyzer.ts
git commit -m "coachAnalyzer : ajout paramètre attachments (image base64) à analyzeSession"
```

---

## Task 3 — Multimodal dans `analyze-session` edge function

**Files:**
- Modify: `supabase/functions/analyze-session/index.ts`

- [ ] **Ajouter `imageBase64` et `imageMimeType` au body destructuring** (ligne 369) :

Avant :
```typescript
    const { session, coachPlans = [], recentSessions = [], profileName = "Maxime", previousAnalyses = [], chatContext, coachMemory } = body;
```

Après :
```typescript
    const { session, coachPlans = [], recentSessions = [], profileName = "Maxime", previousAnalyses = [], chatContext, coachMemory, imageBase64, imageMimeType } = body;
```

- [ ] **Remplacer la construction des messages** (ligne 400) pour supporter le contenu multimodal :

Avant :
```typescript
        messages: [{ role: "user", content: buildUserPrompt(session, coachPlans, recentSessions, previousAnalyses, chatContext, coachMemory) }],
```

Après :
```typescript
        messages: [
          {
            role: "user",
            content: imageBase64
              ? [
                  {
                    type: "text",
                    text: buildUserPrompt(session, coachPlans, recentSessions, previousAnalyses, chatContext, coachMemory),
                  },
                  {
                    type: "image",
                    source: {
                      type: "base64",
                      media_type: (imageMimeType ?? "image/jpeg") as string,
                      data: imageBase64 as string,
                    },
                  },
                ]
              : buildUserPrompt(session, coachPlans, recentSessions, previousAnalyses, chatContext, coachMemory),
          },
        ],
```

- [ ] **Vérifier que Deno ne rejette pas la syntaxe** (check de base) :

```bash
grep -n "imageBase64\|imageMimeType\|media_type" supabase/functions/analyze-session/index.ts
```

Attendu : les 3 lignes trouvées aux bons endroits (body destructuring + content array).

- [ ] **Committer**

```bash
git add supabase/functions/analyze-session/index.ts
git commit -m "analyze-session : support multimodal — image en content block si fournie"
```

---

## Task 4 — RunSheet : state, file input, chips

**Files:**
- Modify: `components/RunSheet.tsx`

- [ ] **Ajouter les imports** en tête de fichier (après les imports existants) :

```typescript
import { compressImage } from "@/lib/imageCompressor";
import type { CompressedImage } from "@/lib/imageCompressor";
```

- [ ] **Ajouter le state `pendingImage`** dans le composant (après la ligne `const [noteModalOpen, setNoteModalOpen] = useState(false);`, vers la ligne 77) :

```typescript
const [pendingImage, setPendingImage] = useState<CompressedImage | null>(null);
```

- [ ] **Reset `pendingImage` dans `handleClose`** (après `setNoteModalOpen(false);`, vers la ligne 215) :

```typescript
setPendingImage(null);
```

- [ ] **Reset `pendingImage` dans le `useEffect` de chargement des données** (au début du bloc, après `setOptionsMenuOpen(false)` et `setOptionsPanel(null)`, vers la ligne 96) :

```typescript
setPendingImage(null);
```

- [ ] **Ajouter `handleClearNote`** juste avant `handleRescheduleRun` (vers la ligne 219) :

```typescript
const handleClearNote = useCallback(() => {
  if (coachRun?.userNote) {
    const updated = { ...coachRun, userNote: "" };
    addCoachRun(updated);
    setCoachRun(updated);
    autoSyncPush().catch(() => {});
  } else if (doneSession?.comment) {
    const updated = { ...doneSession, comment: "" };
    updateSession(updated);
    setDoneSession(updated);
    autoSyncPush().catch(() => {});
  }
}, [coachRun, doneSession]);
```

- [ ] **Ajouter `noteValue`** parmi les variables dérivées (avant le `return`, après `const isExpanded` et `const backdropVisible`, vers la ligne 275) :

```typescript
const noteValue = coachRun?.userNote || doneSession?.comment || "";
```

- [ ] **Brancher le `onChange` sur l'input file** (remplacer la ligne `<input ref={fileInputRef} type="file" .../>`, vers la ligne 578) :

Avant :
```tsx
<input ref={fileInputRef} type="file" accept="image/*" className="hidden" />
```

Après :
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
      // silently ignore compression errors
    }
    e.target.value = "";
  }}
/>
```

- [ ] **Insérer les chips** dans la zone CTA, entre le `stravaSyncMsg` et le `<div className="flex gap-3">` (vers la ligne 540) :

```tsx
{(noteValue || pendingImage) && (
  <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
    {noteValue && (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 20,
          padding: "5px 8px 5px 10px",
          fontSize: 12,
          color: "#ddd",
        }}
      >
        <span>📝 &ldquo;{noteValue.length > 28 ? noteValue.slice(0, 28) + "…" : noteValue}&rdquo;</span>
        <button
          onClick={handleClearNote}
          style={{
            width: 16, height: 16,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.12)",
            border: "none",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 9, color: "#aaa",
            cursor: "pointer",
            flexShrink: 0,
          }}
          aria-label="Supprimer la note"
        >✕</button>
      </div>
    )}
    {pendingImage && (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 20,
          padding: "4px 8px 4px 4px",
          fontSize: 12,
          color: "#ddd",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`data:image/jpeg;base64,${pendingImage.base64}`}
          alt=""
          style={{ width: 22, height: 22, borderRadius: 4, objectFit: "cover", flexShrink: 0 }}
        />
        <span style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {pendingImage.name}
        </span>
        <button
          onClick={() => {
            setPendingImage(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
          }}
          style={{
            width: 16, height: 16,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.12)",
            border: "none",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 9, color: "#aaa",
            cursor: "pointer",
            flexShrink: 0,
          }}
          aria-label="Supprimer l'image"
        >✕</button>
      </div>
    )}
  </div>
)}
```

- [ ] **Vérifier la compilation**

```bash
npm run lint 2>&1 | head -40
```

Attendu : aucune erreur TypeScript.

- [ ] **Tester visuellement dans le dev server**

```bash
npm run dev
```

Ouvrir l'app → naviguer vers un jour avec un run planifié → ouvrir le RunSheet → taper "+" → "Ajouter une note" → entrer du texte → sauvegarder.

Vérifier : une chip "📝 …" apparaît au-dessus du CTA Strava. Taper ✕ → la chip disparaît.

Taper "+" → "Ajouter une image" → choisir une photo. Vérifier : une chip avec miniature apparaît. Taper ✕ → disparaît.

- [ ] **Committer**

```bash
git add components/RunSheet.tsx
git commit -m "RunSheet : state pendingImage, chips pièces jointes (Option A), file input branché"
```

---

## Task 5 — RunSheet : triggers directs `analyzeSession` après Strava

**Files:**
- Modify: `components/RunSheet.tsx`

- [ ] **Modifier `handleStravaImport`** — ajouter le déclenchement direct de l'analyse après le succès de l'import (après `setDoneSession(session as RunSession);` et avant `autoSyncPush().catch(() => {});`) :

Avant :
```typescript
    addSession(session);
    setDoneSession(session as RunSession);
    autoSyncPush().catch(() => {});
```

Après :
```typescript
    addSession(session);
    setDoneSession(session as RunSession);
    autoSyncPush().catch(() => {});
    const importNote = coachRun?.userNote ?? "";
    const importNoteCtx = importNote ? `Note de l'athlète : "${importNote}"` : undefined;
    const importAttachments = pendingImage
      ? { imageBase64: pendingImage.base64, mimeType: pendingImage.mimeType }
      : undefined;
    setAnalysisAttempted(true);
    setCoachState("analyzing");
    analyzeSession(session as RunSession, importNoteCtx, importAttachments)
      .then((result) => { setCoachResult(result); setCoachState("done"); });
    setPendingImage(null);
```

- [ ] **Modifier `handleStravaSync`** — ajouter le déclenchement direct de l'analyse après la mise à jour de la session (après `setDoneSession(updated);` et avant `autoSyncPush().catch(() => {});`) :

Avant :
```typescript
      const updated: RunSession = { ...doneSession, laps, stravaActivityId: activityId, importedFromStrava: true };
      updateSession(updated);
      setDoneSession(updated);
      autoSyncPush().catch(() => {});
      setStravaSyncMsg(`${laps.length} fractions synchronisées ✓`);
```

Après :
```typescript
      const updated: RunSession = { ...doneSession, laps, stravaActivityId: activityId, importedFromStrava: true };
      updateSession(updated);
      setDoneSession(updated);
      autoSyncPush().catch(() => {});
      setStravaSyncMsg(`${laps.length} fractions synchronisées ✓`);
      const syncNote = coachRun?.userNote ?? updated.comment ?? "";
      const syncNoteCtx = syncNote ? `Note de l'athlète : "${syncNote}"` : undefined;
      const syncAttachments = pendingImage
        ? { imageBase64: pendingImage.base64, mimeType: pendingImage.mimeType }
        : undefined;
      setAnalysisAttempted(true);
      setCoachState("analyzing");
      analyzeSession(updated, syncNoteCtx, syncAttachments)
        .then((result) => { setCoachResult(result); setCoachState("done"); });
      setPendingImage(null);
```

- [ ] **Modifier `handleMockStravaSync`** (utilisé en dev) — même pattern après `setDoneSession(updated);` :

Avant :
```typescript
  const handleMockStravaSync = () => {
    if (!doneSession || stravaSyncing) return;
    const updated: RunSession = { ...doneSession, laps: DEV_MOCK_LAPS, importedFromStrava: true };
    updateSession(updated);
    setDoneSession(updated);
    setStravaSyncMsg(`${DEV_MOCK_LAPS.length} fractions simulées ✓`);
    setTimeout(() => setStravaSyncMsg(""), 3000);
  };
```

Après :
```typescript
  const handleMockStravaSync = () => {
    if (!doneSession || stravaSyncing) return;
    const updated: RunSession = { ...doneSession, laps: DEV_MOCK_LAPS, importedFromStrava: true };
    updateSession(updated);
    setDoneSession(updated);
    setStravaSyncMsg(`${DEV_MOCK_LAPS.length} fractions simulées ✓`);
    setTimeout(() => setStravaSyncMsg(""), 3000);
    const mockNote = coachRun?.userNote ?? updated.comment ?? "";
    const mockNoteCtx = mockNote ? `Note de l'athlète : "${mockNote}"` : undefined;
    const mockAttachments = pendingImage
      ? { imageBase64: pendingImage.base64, mimeType: pendingImage.mimeType }
      : undefined;
    setAnalysisAttempted(true);
    setCoachState("analyzing");
    analyzeSession(updated, mockNoteCtx, mockAttachments)
      .then((result) => { setCoachResult(result); setCoachState("done"); });
    setPendingImage(null);
  };
```

- [ ] **Vérifier la compilation**

```bash
npm run lint 2>&1 | head -40
```

Attendu : aucune erreur.

- [ ] **Tester en mode dev (mock sync)**

```bash
npm run dev
```

S'assurer que `NEXT_PUBLIC_DISABLE_SYNC=true` dans `.env.local`.

Ouvrir le RunSheet pour un jour avec un run. Ajouter une note via "+". Taper "Simuler synchro (dev)". Vérifier : `CoachFeedbackCard` passe en état "analyzing" puis affiche le résultat (ou null en mode dev puisque `analyzeSession` retourne null quand `SYNC_DISABLED`).

- [ ] **Committer**

```bash
git add components/RunSheet.tsx
git commit -m "RunSheet : analyzeSession déclenché directement après synchro Strava (import + sync + mock)"
```

---

## Task 6 — Showcase `/dev/components`

**Files:**
- Modify: `app/dev/components/page.tsx`

- [ ] **Ajouter le `ComponentBlock` "Strava CTA — pièces jointes"** dans l'onglet `running`, juste après le `ComponentBlock` "Strava Sync CTA" existant (vers la ligne 726, après la fermeture du `</ComponentBlock>`) :

```tsx
{/* Strava CTA — pièces jointes */}
<ComponentBlock title="Strava CTA — pièces jointes" description="Chips au-dessus du CTA — 3 états : note seule, image seule, note + image">
  <div className="space-y-6">

    <div>
      <p className="text-xs mb-3" style={{ color: "#555" }}>Note seule</p>
      <div style={{ background: "var(--color-background)", borderRadius: 16, padding: "12px 16px" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" as const }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 20, padding: "5px 8px 5px 10px", fontSize: 12, color: "#ddd" }}>
            <span>📝 &ldquo;Jambes lourdes dès le km 8…&rdquo;</span>
            <div style={{ width: 16, height: 16, borderRadius: "50%", background: "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#aaa" }}>✕</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
          </div>
          <div className="flex-1 flex items-center justify-center gap-2.5" style={{ background: "#FC4C02", borderRadius: "12px", padding: "15px 20px", fontWeight: 600, fontSize: "15px", color: "white" }}>
            <StravaIcon size={20} />
            Sync Strava
          </div>
        </div>
      </div>
    </div>

    <div>
      <p className="text-xs mb-3" style={{ color: "#555" }}>Image seule</p>
      <div style={{ background: "var(--color-background)", borderRadius: 16, padding: "12px 16px" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" as const }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 20, padding: "4px 8px 4px 4px", fontSize: 12, color: "#ddd" }}>
            <div style={{ width: 22, height: 22, borderRadius: 4, background: "linear-gradient(135deg, #1e3a2f, #2a4a3f)", flexShrink: 0 }} />
            <span>photo_run.jpg</span>
            <div style={{ width: 16, height: 16, borderRadius: "50%", background: "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#aaa" }}>✕</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
          </div>
          <div className="flex-1 flex items-center justify-center gap-2.5" style={{ background: "#FC4C02", borderRadius: "12px", padding: "15px 20px", fontWeight: 600, fontSize: "15px", color: "white" }}>
            <StravaIcon size={20} />
            Sync Strava
          </div>
        </div>
      </div>
    </div>

    <div>
      <p className="text-xs mb-3" style={{ color: "#555" }}>Note + image</p>
      <div style={{ background: "var(--color-background)", borderRadius: 16, padding: "12px 16px" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" as const }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 20, padding: "4px 8px 4px 4px", fontSize: 12, color: "#ddd" }}>
            <div style={{ width: 22, height: 22, borderRadius: 4, background: "linear-gradient(135deg, #1e3a2f, #2a4a3f)", flexShrink: 0 }} />
            <span>photo_run.jpg</span>
            <div style={{ width: 16, height: 16, borderRadius: "50%", background: "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#aaa" }}>✕</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 20, padding: "5px 8px 5px 10px", fontSize: 12, color: "#ddd" }}>
            <span>📝 &ldquo;Jambes lourdes dès le km 8…&rdquo;</span>
            <div style={{ width: 16, height: 16, borderRadius: "50%", background: "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#aaa" }}>✕</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
          </div>
          <div className="flex-1 flex items-center justify-center gap-2.5" style={{ background: "#FC4C02", borderRadius: "12px", padding: "15px 20px", fontWeight: 600, fontSize: "15px", color: "white" }}>
            <StravaIcon size={20} />
            Sync Strava
          </div>
        </div>
      </div>
    </div>

  </div>
</ComponentBlock>
```

- [ ] **Vérifier la compilation**

```bash
npm run lint 2>&1 | head -40
```

Attendu : aucune erreur.

- [ ] **Vérifier visuellement**

```bash
npm run dev
```

Ouvrir `/dev/components` → onglet "Running" → scroller jusqu'à "Strava CTA — pièces jointes". Vérifier que les 3 états sont visibles et bien rendus.

- [ ] **Committer**

```bash
git add app/dev/components/page.tsx
git commit -m "dev/components : showcase 'Strava CTA — pièces jointes' (3 états)"
```

---

## Self-Review

**Couverture spec :**
- ✅ `lib/imageCompressor.ts` → Task 1
- ✅ `coachAnalyzer.ts` SessionAttachments + param → Task 2
- ✅ Edge function multimodal → Task 3
- ✅ RunSheet state + file input + chips → Task 4
- ✅ RunSheet analyse directe après Strava (import + sync + mock) → Task 5
- ✅ /dev/components showcase → Task 6
- ✅ Reset pendingImage dans handleClose + useEffect → Task 4
- ✅ handleClearNote (coachRun.userNote + doneSession.comment) → Task 4
- ✅ noteValue dérivé → Task 4
- ✅ Image éphémère (jamais persistée) → Task 4 + Task 5
- ✅ Synchro échouée = image conservée (setPendingImage appelé hors `catch`) → Task 5

**Types cohérents entre tasks :**
- `CompressedImage` défini Task 1, utilisé Task 4 (`useState<CompressedImage | null>`)
- `SessionAttachments` défini Task 2, utilisé Task 5 (`{ imageBase64, mimeType }`)
- `analyzeSession(session, noteCtx, attachments?)` — signature Task 2, appelée Task 5 ✅
