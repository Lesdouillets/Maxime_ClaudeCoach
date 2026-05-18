export function originNeedsRedirect(origin: string): boolean {
  if (typeof window === "undefined") return false;
  const norm = (p: string) => p.replace(/\/+$/, "") || "/";
  const here = norm(window.location.pathname) + window.location.search;
  return norm(origin) !== here;
}
