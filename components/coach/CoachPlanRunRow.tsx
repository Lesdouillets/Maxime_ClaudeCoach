import type { CSSProperties } from "react";
import type { CoachRun } from "@/lib/coachPlan";

interface Props {
  plan: CoachRun;
}

const DATE_STYLE: CSSProperties = {
  fontFamily: "var(--font-mono, monospace)",
  fontSize: 12,
  color: "var(--color-secondary)",
  flexShrink: 0,
};

const LABEL_STYLE: CSSProperties = {
  fontSize: 12,
  color: "var(--color-neon)",
  textTransform: "uppercase",
};

const METRICS_STYLE: CSSProperties = {
  fontFamily: "var(--font-mono, monospace)",
  fontSize: 12,
  color: "var(--color-secondary)",
  flexShrink: 0,
};

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function buildMetrics(plan: CoachRun): string {
  const parts: string[] = [`${plan.distanceKm} km`];
  if (plan.pace) parts.push(plan.pace);
  if (plan.durationMin) parts.push(`${plan.durationMin}min`);
  if (plan.targetZone) parts.push(plan.targetZone);
  return parts.join(" · ");
}

export default function CoachPlanRunRow({ plan }: Props) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span style={DATE_STYLE}>{formatDate(plan.date)}</span>
      <span className="font-mono font-bold tracking-widest" style={LABEL_STYLE}>{plan.label}</span>
      <span style={METRICS_STYLE}>{buildMetrics(plan)}</span>
    </div>
  );
}
