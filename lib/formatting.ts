export function formatMMSS(sec: number): string {
  const clamped = Math.max(0, sec);
  const m = Math.floor(clamped / 60);
  const s = clamped % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// Formate une date ISO (YYYY-MM-DD ou ISO complet) en "Lun. 02/06".
// Utilise new Date(y, m-1, d) pour éviter le décalage UTC en Europe.
export function formatPlanDate(isoString: string): string {
  const [year, month, day] = isoString.substring(0, 10).split("-").map(Number);
  const d = new Date(year, month - 1, day);
  const weekday = d.toLocaleDateString("fr-FR", { weekday: "short" });
  const capitalized = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return `${capitalized} ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}
