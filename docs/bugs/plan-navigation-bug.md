# Bug : navigation impossible après visite de /plan (prod only)

## Symptôme exact
Après avoir navigué vers `/plan` via la BottomNav, cliquer sur n'importe quel autre onglet (Home, Stats, Coach) ne fait rien visuellement. La page reste sur `/plan`.

- Confirmé sur : iOS PWA, Chrome desktop
- Ne reproduit PAS en local (localhost:3000)
- Se produit depuis n'importe quelle page → plan → autre page

---

## Pistes ÉLIMINÉES ❌

| # | Hypothèse | Comment éliminée |
|---|-----------|------------------|
| 1 | Cache Service Worker | `stamp-sw.js` invalide le cache à chaque déploiement (hash git unique). |
| 2 | Bug dans le code de la page `/plan` | Réécriture complète from scratch → bug toujours présent |
| 3 | `window.scrollTo` vs `scrollIntoView` | Changement testé, pas d'effet |
| 4 | Route `/` posant problème à Next.js | Renommage en `/home` → bug toujours présent |
| 5 | **Piste A** — Erreur JS silencieuse | **Testé en prod** : aucune erreur console |
| 6 | **Piste D** — `originNeedsRedirect` redirige vers /plan | Lu le code : redirect seulement dans `handleClose()` (appelé manuellement), pas dans un `useEffect`. Pas de redirect automatique. |
| 7 | **Piste E** — RSC payload 404 | **Testé en prod** : rien dans Network. Les `.txt` RSC existent bien pour `/home` et `/plan` dans `out/`. Probablement préfetchés au hover. |
| 8 | **Piste F** — href basePath incorrect | `href` dans le HTML généré est correct : `/home/`, `/plan/`, etc. (sans basePath dans le HTML SSR — c'est normal, Next.js gère en client-side). |
| 9 | **Piste C** — Sheets bloqués en minimized | RunSheet et SessionSheet retournent `null` quand `state === null`. Quand `minimized` : backdrop a `pointer-events:none`, sheet est à `translateY(100%)` (hors écran). `SessionMiniBanner` a `z-40` (sous `z-nav=50`). |

---

## ✅ RÉSOLU — commit `de12fbe`

**Fix** : `prefetch={false}` sur tous les `<Link>` de la BottomNav.

**Cause racine** : Next.js `<Link>` déclenche `router.prefetch()` au hover. En mode static export + basePath, ce prefetch provoquait un scroll de la page /plan vers le haut. Sur mobile/PWA, le tap combine hover+clic simultanément — le scroll perturbait la cible du toucher et la navigation échouait.

---

## Symptôme précisé (après test DevTools)

- **Pas de changement d'URL** : cliquer Home depuis /plan ne change pas l'URL
- **Pas d'erreur JS**
- **Pas de requête réseau** (probablement car Link préfetch au hover → navigation depuis cache mémoire)
- **La page scrolle vers le haut de /plan** → comportement identique à un `router.push("/plan")` (navigation vers la même page → scroll to top, pas de URL change)

> **Hypothèse centrale** : le clic sur la BottomNav depuis /plan navigue vers `/plan` (la page courante) au lieu de la destination. Cela expliquerait les 3 symptômes d'un coup.

---

## Pistes À TESTER ⏳ (par ordre de priorité)

### Piste B — Élément invisible bloquant/détournant les clics
**Hypothèse** : un élément recouvre la BottomNav et capture les clics, ou la zone de clic "Home" est en réalité celle de "Plan".
**Test** : DevTools > Inspect → pointer picker → cliquer sur l'icône Home → voir quel élément est sélectionné. Si c'est un bouton du calendrier : le calendrier dépasse sous la nav.
**Statut** : ⏳ pas encore fait côté user

---

### Piste G — Reproduire en local avec basePath
**Hypothèse** : si le bug se reproduit en local avec `NEXT_PUBLIC_BASE_PATH=/Maxime_ClaudeCoach`, c'est un bug React/Next.js qu'on peut déboguer directement.
**Test** : `NEXT_PUBLIC_BASE_PATH=/Maxime_ClaudeCoach npm run dev` → naviguer vers `localhost:3000/Maxime_ClaudeCoach/plan` → tester la nav.
**Statut** : ⏳ pas encore fait

---

### Piste H — SW avec scope `/Maxime_ClaudeCoach/` intercepte la navigation et répond avec /plan
**Hypothèse** : quand Next.js navigue vers `/home`, il fait une vraie navigation (mode `navigate`). Le SW intercepte. Le fetch de `/Maxime_ClaudeCoach/home/` échoue (race condition au déploiement, CDN pas propagé). Le SW fait `caches.match(request)` et retourne `/plan/` depuis le cache (mauvaise correspondance de cache).
**Test** : DevTools > Application > Service Workers > voir si le SW est actif et ses logs.  
Puis DevTools > Network → **tout décocher sauf "Doc"** → cliquer Home → voir si une requête Document apparaît.
**Statut** : ⏳ pas encore fait

---

### Piste I — Next.js Link scroll-to-top est déclenché sans navigation réelle
**Hypothèse** : le Link navigue techniquement vers `/plan` (la page courante) au lieu de `/home`. Ce qui causerait : pas de URL change + scroll to top (Next.js Link scroll par défaut).
**Test** : inspecter en prod le `href` réel des `<a>` dans la BottomNav (DevTools > Elements > chercher le nav en bas) → est-ce que toutes les icônes ont un href différent ?
**Statut** : ⏳ pas encore fait

---

## Prochaine action recommandée

**Option 1 (rapide, user)** : DevTools > Network → cocher "Doc/Document" uniquement (pas Fetch/XHR) → cliquer Home depuis /plan → est-ce qu'une requête Document apparaît (plein rechargement) ?

**Option 2 (plus profonde)** : lancer en local avec basePath pour voir si reproductible :
```bash
NEXT_PUBLIC_BASE_PATH=/Maxime_ClaudeCoach npm run dev
```
Puis ouvrir `http://localhost:3000/Maxime_ClaudeCoach/plan`.
