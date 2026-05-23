"use client";

import type { CoachRun, CoachRunInterval } from "@/lib/coachPlan";
import { JETBRAINS_MONO_DATA } from "@/lib/typography";
import { segDuration, segDistLabel } from "@/lib/runPlanUtils";
import RunSegmentCard from "@/components/RunSegmentCard";
import RunPlanClassic from "@/components/RunPlanClassic";

interface Props {
  coachRun: CoachRun;
}

function TempoCard({ seg }: { seg: CoachRunInterval }) {
  const parts = [
    segDistLabel(seg),
    seg.pace ? `${seg.pace}/km` : null,
    seg.targetHR ? `${seg.targetHR} FC` : null,
  ].filter(Boolean).join(" · ");

  return (
    <div
      className="rounded-2xl px-4 py-4"
      style={{
        background: "var(--color-neon-04)",
        border: "1px solid var(--color-neon-15)",
      }}
    >
      <div className="flex items-baseline justify-between">
        <p className="font-display leading-none" style={{ fontSize: 16, color: "var(--color-neon)" }}>
          {seg.label ?? "Tempo"}
        </p>
        <span className="font-display leading-none" style={{ fontSize: 16, color: "var(--color-neon)" }}>
          {segDuration(seg)}
        </span>
      </div>
      <p className="mt-2" style={{ ...JETBRAINS_MONO_DATA, color: "var(--color-secondary)", fontSize: 11 }}>
        {parts}
      </p>
    </div>
  );
}

export default function RunPlanTempo({ coachRun }: Props) {
  if (!coachRun.intervals?.length) return <RunPlanClassic coachRun={coachRun} />;

  const isWarmup = (s: CoachRunInterval) => s.label === "Échauffement";
  const isCooldown = (s: CoachRunInterval) => s.label === "Retour au calme" || s.label === "Récup";

  const warmup = coachRun.intervals.find(isWarmup);
  const cooldown = coachRun.intervals.find(isCooldown);
  const tempoSegments = coachRun.intervals.filter((s) => !isWarmup(s) && !isCooldown(s));

  return (
    <div className="space-y-2">
      {warmup && <RunSegmentCard seg={warmup} />}
      {tempoSegments.map((seg, i) => <TempoCard key={i} seg={seg} />)}
      {cooldown && <RunSegmentCard seg={cooldown} />}
    </div>
  );
}
