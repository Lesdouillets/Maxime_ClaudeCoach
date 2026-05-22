# Spec — BottomNav multi-états

**Date :** 2026-05-16
**Composant :** `components/BottomNav.tsx`
**Projet :** Maxime_ClaudeCoach

---

## Contexte

Le composant `BottomNav` affiche actuellement une seule nav pill fixe avec 4 icônes.
Il doit évoluer pour s'adapter au contexte de chaque page : nav principale, séance en cours, action contextuelle fitness ou run.

---

## Objectif

Le composant `BottomNav` adapte son rendu visuel et ses actions selon une prop `state` passée par la page parente.
Il couvre 4 états distincts sans aucun hook ou context supplémentaire.

---

## Périmètre

**Dans le scope :**
- Refactoring du composant `BottomNav.tsx` uniquement
- Les 4 états décrits ci-dessous
- Transitions CSS entre états (fade + slide-up)
- Safe-area iPhone sur tous les états

**Hors scope :**
- Création de nouveaux hooks ou context React
- Logique métier côté pages (les pages passent déjà la prop)
- Intégration Strava réelle (le bouton ouvre uniquement un input file image)
- Tests automatisés

---

## Signature TypeScript du composant

```typescript
type BottomNavState =
  | "nav"     // nav classique pill 4 icônes
  | "hidden"  // invisible, safe-area respecté
  | "start"   // bouton "Commencer la séance >"
  | "strava"  // bouton (+) + bouton Sync Strava

interface BottomNavProps {
  state: BottomNavState;
  onStart?: () => void;    // callback déclenché par le bouton "Commencer la séance"
  onStrava?: () => void;   // callback déclenché par le bouton "Sync Strava"
  // L'input file galerie est géré en interne par le composant
}

export default function BottomNav(props: BottomNavProps): JSX.Element
```

**Note :** `onStart` et `onStrava` sont optionnels mais doivent être fournis quand l'état correspondant est actif. En leur absence, les boutons sont rendus mais sans effet (pas de crash).

---

## Critères d'acceptation par état

### État `"nav"` — nav classique

- En tant qu'utilisateur sur une page principale (Home, Plan, Stats, Coach), quand je regarde la bottom bar, alors je vois la pill noire avec les 4 icônes, l'icône de la page active est en neon (#CBFF00 env.), les autres sont en muted.
- En tant qu'utilisateur, quand je navigue vers une autre page principale, alors la pill reste visible avec la bonne icône active, et l'animation `nav-activate` se joue sur l'icône nouvellement active.
- Ce comportement est **identique à l'existant**. Aucun changement fonctionnel ni visuel sur cet état.

### État `"hidden"` — invisible

- En tant qu'utilisateur avec une séance en cours ou après validation d'une séance, quand je regarde la zone de nav, alors aucun élément n'est visible.
- Le safe-area-inset-bottom est toujours respecté (pas de chevauchement avec le home indicator iPhone).
- Aucune surface cliquable ne subsiste (pointer-events none sur l'ensemble du composant).

### État `"start"` — Commencer la séance

- En tant qu'utilisateur sur la page d'une séance fitness non démarrée, quand je regarde la bottom bar, alors je vois un bouton pleine largeur, fond jaune fluo (#CBFF00), coins très arrondis (border-radius 9999px), texte noir "Commencer la séance >" en semi-bold.
- Quand je tape sur ce bouton, alors le callback `onStart` est appelé.
- Le bouton respecte le safe-area-inset-bottom.
- Le style backdrop blur / fond sombre est conservé comme conteneur.

### État `"strava"` — Sync Strava

- En tant qu'utilisateur sur la page d'une séance run non synchronisée, quand je regarde la bottom bar, alors je vois deux éléments côte à côte :
  - À gauche : un bouton carré `(+)`, fond sombre, bordure fine blanche/grise, coins arrondis.
  - À droite : un bouton pleine largeur, fond orange Strava (#FC4C02), icône éclair SVG + texte "Sync Strava" en blanc.
- Quand je tape sur le bouton `(+)`, alors un `<input type="file" accept="image/*">` est déclenché (ouvre la galerie photo native).
- Quand je tape sur "Sync Strava", alors le callback `onStrava` est appelé.
- Les deux boutons respectent le safe-area-inset-bottom.

---

## Cas limites à traiter

| Situation | Comportement attendu |
|-----------|---------------------|
| Changement d'état pendant l'animation de transition | L'animation en cours est annulée, la nouvelle transition démarre immédiatement |
| Prop `state` change de `"hidden"` à `"nav"` | Slide-up + fade-in — le composant réapparaît proprement |
| Prop `onStart` absente alors que `state="start"` | Le bouton est rendu, le tap ne fait rien (pas de crash) |
| Prop `onStrava` absente alors que `state="strava"` | Même comportement — bouton rendu, tap silencieux |
| iPhone avec home indicator (safe-area > 0) | Tous les états ajoutent `env(safe-area-inset-bottom, 0px)` au bottom |
| Rotation de l'écran | La largeur s'adapte, le pill de l'état `"nav"` reste centré |

---

## EPICs et User Stories

---

### EPIC 1 — Refactoring de la signature du composant

**Objectif :** passer le composant de zero-props à une prop `state` explicite, sans casser l'état `"nav"` existant.

---

```
US-01 : Typer et accepter la prop `state`
En tant que page parente
Je veux passer une prop `state: BottomNavState` au composant BottomNav
Afin de contrôler l'état affiché sans logique interne au composant

Critères d'acceptation :
- [ ] Le type `BottomNavState` est exporté depuis le fichier
- [ ] Le composant accepte `state`, `onStart?`, `onStrava?` en props
- [ ] Quand `state="nav"`, le rendu est identique à l'existant (test visuel)
- [ ] Aucun hook ou context n'est ajouté

Complexité estimée : Faible
Priorité : Must have
```

---

### EPIC 2 — Implémentation des états visuels

**Objectif :** rendre chaque état correctement, indépendamment les uns des autres.

---

```
US-02 : État "hidden"
En tant que composant
Je veux ne rien afficher quand state="hidden"
Afin de laisser le contenu de la page prendre tout l'espace

Critères d'acceptation :
- [ ] Aucun élément visible
- [ ] pointer-events none sur tout le composant
- [ ] safe-area-inset-bottom respecté (padding invisible)
- [ ] Pas de layout shift sur le contenu de la page

Complexité estimée : Faible
Priorité : Must have
```

```
US-03 : État "start"
En tant qu'utilisateur sur une page de séance fitness non démarrée
Je veux voir un bouton "Commencer la séance >" pleine largeur
Afin de démarrer la séance en un tap

Critères d'acceptation :
- [ ] Fond jaune fluo (#CBFF00), texte noir, coins arrondis (9999px)
- [ ] Pleine largeur avec marges latérales cohérentes (16px de chaque côté)
- [ ] Tap déclenche onStart() si fourni
- [ ] safe-area-inset-bottom respecté
- [ ] backdrop blur sur le conteneur (cohérent avec l'état "nav")

Complexité estimée : Faible
Priorité : Must have
```

```
US-04 : État "strava"
En tant qu'utilisateur sur une page de séance run non synchronisée
Je veux voir le bouton (+) et le bouton Sync Strava côte à côte
Afin d'importer une photo ou de lancer la synchronisation

Critères d'acceptation :
- [ ] Bouton (+) : fond sombre, bordure fine, carré, coins arrondis
- [ ] Bouton Strava : fond #FC4C02, icône éclair SVG, texte "Sync Strava" blanc
- [ ] Tap sur (+) déclenche un input[type=file][accept="image/*"] géré en interne
- [ ] Tap sur Strava déclenche onStrava() si fourni
- [ ] Les deux boutons sont côte à côte, le bouton Strava prend le flex restant
- [ ] safe-area-inset-bottom respecté

Complexité estimée : Moyenne
Priorité : Must have
```

---

### EPIC 3 — Transitions entre états

**Objectif :** les changements d'état sont fluides, sans flash ni layout shift.

---

```
US-05 : Transition fade + slide-up entre états
En tant qu'utilisateur
Je veux que le changement d'état de la nav soit animé
Afin que l'interface ne "saute" pas

Critères d'acceptation :
- [ ] Chaque changement d'état déclenche un fade-out puis fade-in (ou cross-fade)
- [ ] Un slide-up léger accompagne l'apparition (translateY de 8px à 0)
- [ ] Si la prop `state` change pendant une animation, l'animation en cours est annulée
- [ ] L'animation n'est pas jouée au premier rendu (pas de flash au chargement)
- [ ] Durée cible : 200ms ease-out

Complexité estimée : Moyenne
Priorité : Should have
```

---

### EPIC 4 — Mise à jour des pages appelantes

**Objectif :** chaque page passe la bonne prop `state` au composant.

---

```
US-06 : Pages principales passent state="nav"
En tant que page Home / Plan / Stats / Coach
Je veux passer state="nav" à BottomNav
Afin d'afficher la nav classique

Critères d'acceptation :
- [ ] Les 4 pages passent explicitement state="nav"
- [ ] Le comportement visuel est identique à avant le refactoring

Complexité estimée : Faible
Priorité : Must have
```

```
US-07 : Page séance fitness passe le bon état
En tant que page de séance fitness
Je veux passer state="start" si la séance n'est pas démarrée, state="hidden" si elle est en cours ou terminée
Afin que la nav reflète le contexte

Critères d'acceptation :
- [ ] La page lit l'état depuis localStorage (clé cc_in_progress_fitness_{date} et cc_sessions)
- [ ] Avant démarrage : state="start" avec onStart fourni
- [ ] Pendant / après : state="hidden"
- [ ] Pas de nouveau hook — la logique est inline dans le composant de page

Complexité estimée : Moyenne
Priorité : Must have
```

```
US-08 : Page séance run passe le bon état
En tant que page de séance run
Je veux passer state="strava" si non synchronisée, state="hidden" si synchronisée ou en cours
Afin que la nav propose l'action contextuelle

Critères d'acceptation :
- [ ] La page détermine si la séance est synchronisée (via cc_sessions ou cc_strava_tokens)
- [ ] Non synchronisée : state="strava" avec onStrava fourni
- [ ] Synchronisée ou en cours : state="hidden"
- [ ] Pas de nouveau hook

Complexité estimée : Moyenne
Priorité : Must have
```

---

## Ordre de développement suggéré

```
Étape 1 — Fondations (bloquant pour tout le reste)
  US-01 : Typer la prop state, garder state="nav" identique
  US-06 : Passer state="nav" sur les 4 pages principales

Étape 2 — États visuels (peuvent être faits en parallèle)
  US-02 : État "hidden"
  US-03 : État "start"
  US-04 : État "strava"

Étape 3 — Branchement pages (dépend de l'étape 2)
  US-07 : Page séance fitness
  US-08 : Page séance run

Étape 4 — Polish (indépendant, peut être différé)
  US-05 : Transitions entre états
```

**Principe :** US-01 est le seul vrai bloquant. Une fois la signature en place et l'état `"nav"` validé visuellement, tout le reste peut avancer en parallèle ou être livré de façon incrémentale.

---

## Backlog — hors scope de cette PR

```
US-09 : Vision Coach — analyser un screenshot via l'API vision [BACKLOG]
En tant qu'utilisateur sur une séance run
Je veux pouvoir importer un screenshot Strava ou autre
Afin que le Coach analyse les données visuelles et enrichisse son retour

Contexte technique :
- Le bouton (+) dans l'état "strava" ouvre déjà la galerie (stub frontend OK)
- L'edge function analyze-session ne supporte pas encore les images
- Claude Sonnet 4.6 supporte la vision — il faut ajouter un champ imageBase64
  à l'interface de l'edge function et adapter le prompt

Critères d'acceptation (backlog) :
- [ ] L'image sélectionnée est encodée en base64 côté client
- [ ] analyzeSession() accepte un paramètre image optionnel
- [ ] L'edge function analyze-session reçoit et traite l'image via vision API
- [ ] Le Coach retourne une analyse enrichie par les données visuelles
- [ ] En l'absence d'image, le comportement actuel est inchangé

Complexité estimée : Élevée (backend + prompt engineering)
Priorité : Backlog — ne pas implémenter dans cette PR
```

---

## Ce qui ne change pas

- Le rendu visuel de l'état `"nav"` est **pixel-perfect identique** à l'existant
- Les variables CSS (`--color-neon`, `--color-muted`, `--color-neon-10`, `--color-bg-blur`) sont réutilisées sans modification
- L'animation `nav-activate` existante est conservée telle quelle
- Le z-index `z-nav` est conservé
- `usePathname` reste utilisé pour l'état actif des icônes dans l'état `"nav"`
