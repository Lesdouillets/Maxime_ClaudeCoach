import type { CSSProperties } from "react";
import type { CoachRun } from "@/lib/coachPlan";
import { formatPlanDate } from "@/lib/formatting";

interface Props {
  plan: CoachRun;
}

const DATE_STYLE: CSSProperties = {
  fontFamily: "var(--font-mono, monospace)",
  fontSize: 12,
  fontWeight: 500,
  letterSpacing: "0.1em",
  color: "var(--color-secondary)",
  flexShrink: 0,
};

const LABEL_STYLE: CSSProperties = {
  fontSize: 12,
  color: "var(--color-neon)",
  textTransform: "uppercase",
  textAlign: "right",
};

const METRICS_STYLE: CSSProperties = {
  fontFamily: "var(--font-mono, monospace)",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.1em",
  color: "#ffffff",
  textAlign: "right",
};


function formatDuration(min: number): string {
  if (min < 60) return `~${min}min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `~${h}h` : `~${h}h${String(m).padStart(2, "0")}min`;
}

function buildMetrics(plan: CoachRun): string {
  const parts: string[] = [`${plan.distanceKm}km`];

  const mainInterval = plan.intervals?.find((i) => (i.reps ?? 1) > 1);
  if (mainInterval) {
    // Fractionné : résumé de l'intervalle principal
    const distM = Math.round(mainInterval.distanceKm * 1000);
    parts.push(`${mainInterval.reps}×${distM}m`);
  }

  // Progressif : plage de zones (ex. Z2>Z4)
  if (plan.runType === "progressif" && plan.targetZone) {
    parts.push(plan.targetZone);
  }

  // Z2 : allure cible constante
  const isZ2 = plan.runType === "z2" || plan.targetZone === "Z2";
  if (isZ2 && plan.pace) {
    parts.push(`${plan.pace}/km`);
  }

  if (plan.durationMin) parts.push(formatDuration(plan.durationMin));

  return parts.join(" | ");
}

export default function CoachPlanRunRow({ plan }: Props) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <span style={DATE_STYLE}>{formatPlanDate(plan.date)}</span>
      <div className="flex flex-col items-end gap-0.5">
        <span className="font-mono font-bold tracking-widest" style={LABEL_STYLE}>
          {plan.label}
        </span>
        <span style={METRICS_STYLE}>{buildMetrics(plan)}</span>
      </div>
    </div>
  );
}
