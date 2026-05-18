// Utilise le pathname de usePathname() (sans base path) pour comparer avec l'origin
// — window.location.pathname inclut le base path en prod (/Maxime_ClaudeCoach/plan)
//   ce qui ferait une fausse inégalité et un router.push() inutile
export function originNeedsRedirect(origin: string, currentPathname: string): boolean {
  const norm = (p: string) => p.replace(/\/+$/, "") || "/";
  const search = typeof window !== "undefined" ? window.location.search : "";
  const here = norm(currentPathname) + search;
  return norm(origin) !== here;
}
