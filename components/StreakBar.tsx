import type { StreakResult, WeekStatus } from "@/lib/streak";

interface StreakBarProps {
  streakResult: StreakResult;
}

const STATUS_FR: Record<WeekStatus, string> = {
  validated: "Semaine validée",
  partial:   "En cours",
  empty:     "Séances manquées",
  future:    "À venir",
};

function barColor(status: WeekStatus, isCurrent: boolean): string {
  if (isCurrent) return "var(--color-neon)";
  if (status === "validated") return "var(--color-neon-dim)";
  return "var(--color-muted)";
}

function barHeight(status: WeekStatus, isCurrent: boolean): number {
  if (isCurrent || status === "validated" || status === "partial") return 8;
  return 1; // empty / future → trait fin
}

function formatWeekLabel(start: string, end: string): string {
  const fmt = (d: string) =>
    new Date(d + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  return `${fmt(start)} – ${fmt(end)}`;
}

export function StreakBar({ streakResult }: StreakBarProps) {
  const { weeks } = streakResult;

  return (
    <div className="w-full space-y-2">
      {/* Barre */}
      <div className="flex gap-1 w-full items-end">
        {weeks.map((week) => (
          <div
            key={week.weekStart}
            title={`${formatWeekLabel(week.weekStart, week.weekEnd)} — ${STATUS_FR[week.status]}`}
            style={{
              flex: 1,
              height: barHeight(week.status, week.isCurrent),
              borderRadius: 4,
              background: barColor(week.status, week.isCurrent),
            }}
          />
        ))}
      </div>

    </div>
  );
}
