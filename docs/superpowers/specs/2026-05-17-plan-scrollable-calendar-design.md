# Spec — Page Plan : calendrier scrollable mensuel

**Date :** 2026-05-17
**Fichier cible :** `app/plan/page.tsx`

---

## Contexte

La page Plan propose actuellement deux vues (hebdo / mensuel) commutables via un toggle. La vue hebdo est redondante avec le composant `WeekProgram` déjà présent sur la home. L'objectif est de supprimer cette redondance et de remplacer l'ensemble par une unique vue mensuelle scrollable verticalement, couvrant 7 mois glissants.

---

## Ce qui disparaît

- Le state `view` ("week" | "month") et sa persistance `sessionStorage`
- Le state `weekOffset` et sa persistance
- Le state `monthOffset` et sa persistance
- Le toggle "Hebdo / Mensuel"
- Les boutons prev / next / "Auj."
- Le composant `<PageHeader>` (pas de titre "PLAN" ni de subtitle mois courant)
- Toute la section JSX vue hebdo (~140 lignes)
- La légende couleurs en bas de page
- Les imports devenus inutiles : `getWeekDays`, `formatWeekLabel`, `formatMonthLabel`, `DAY_FULL_FR`

---

## Ce qui reste intact

- `getDayStatus(dateStr)` — logique métier complète, aucune modification
- `handleDayClick(e, href, target, dateStr)` — comportement de navigation inchangé
- Helpers de couleur : `planColor`, `planBorder`, `planBg`, `statusColor`
- Les 5 états de données : `sessions`, `cancelledDays`, `rescheduledDays`, `coachWorkouts`, `coachRuns`
- `syncFull()` au montage + `refresh()`
- `getMonthCells(monthOffset)` — utilisée par `MonthSection`

---

## Nouveaux éléments

### Fonction `getVisibleMonths()`

Retourne `[-3, -2, -1, 0, 1, 2, 3]` — les 7 offsets de mois à afficher.

### Composant local `MonthSection`

Défini dans le même fichier que `PlanPage`. Props :

```ts
interface MonthSectionProps {
  monthOffset: number;
  getDayStatus: (dateStr: string) => DayStatus;
  handleDayClick: (e, href, target, dateStr) => void;
  scrollRef?: React.RefObject<HTMLDivElement>;
}
```

Rend :
1. Header du mois
2. Headers de colonnes
3. Grille des cellules

### Ref pour scroll initial

`const todayMonthRef = useRef<HTMLDivElement>(null)` — passé uniquement à `MonthSection` dont l'offset est `0`.

Au montage, dans le `useEffect` existant (après `syncFull`) :

```ts
todayMonthRef.current?.scrollIntoView({ behavior: "instant", block: "start" });
```

---

## Rendu visuel

### Header de mois

```
"AVRIL 2026"
```

- Font : Archivo 700, `wdth 110`, 14px, letter-spacing 10%
- Couleur : `#555`
- Margin bottom : 8px
- Margin top inter-mois : `mt-12` (48px) sauf pour le premier mois

### Headers de colonnes (L M M J V S D)

- Répétés à chaque mois
- JetBrains Mono 700, 10px, letter-spacing 10%, couleur `#333`
- Grid 7 colonnes, texte centré

### Cellule de jour

Structure :
```
┌──────────────┐
│   [numéro]   │  ← coloré selon statusColor()
│     [•]      │  ← point si dotColor != null
└──────────────┘
```

**Couleurs du numéro** (inchangées) :
- `done` → `#CDFF00`
- `missed` → `#cc3333`
- `upcoming` → `planColor(planType)` (blue ou orange)
- `today-planned` → `planColor(planType)`
- `today-rest` / `rest` → `#555`

**Point sous le numéro** :
- `done` → `#CDFF00`
- `missed` → `rgba(180,0,0,0.55)`
- `upcoming` / `today-planned` → `planColor(planType)`
- Pas de point pour `rest` / `today-rest`

**Cellule "done" — fond subtil** :
```css
background: rgba(205, 255, 0, 0.07);
border-radius: 10px;
```

**Aujourd'hui** :
```css
border: 1px solid rgba(255, 255, 255, 0.85);
border-radius: 50%;         /* cercle parfait via aspect-square */
box-shadow: 0 0 0 1px transparent, 0 0 8px rgba(255, 255, 255, 0.15);
```

### Espacement & layout

- `gap-1` entre cellules (identique à l'existant)
- `mt-12` entre sections de mois
- `pb-24` en bas du scroll pour ne pas être masqué par la barre de navigation
- `px-4` sur le conteneur global (identique à l'existant)

---

## Structure finale de `PlanPage`

```tsx
export default function PlanPage() {
  // states de données (inchangés)
  // todayMonthRef
  // useEffect : refresh() + syncFull() + scrollIntoView

  return (
    <div className="max-w-md mx-auto animate-fade-in px-4 pb-24">
      {getVisibleMonths().map((offset) => (
        <MonthSection
          key={offset}
          monthOffset={offset}
          getDayStatus={getDayStatus}
          handleDayClick={handleDayClick}
          scrollRef={offset === 0 ? todayMonthRef : undefined}
        />
      ))}
    </div>
  );
}
```

---

## Hors périmètre

- Comportement clic sur un jour : inchangé (logique `handleDayClick` existante)
- Données : aucun changement de source ou de types
- Navigation bottom bar : inchangée
- Autres pages : inchangées
