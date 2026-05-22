"use client";

import type { CoachRun } from "@/lib/coachPlan";
import RunPlanClassic from "@/components/RunPlanClassic";
import RunPlanInterval from "@/components/RunPlanInterval";
import RunPlanProgressive from "@/components/RunPlanProgressive";
import { JETBRAINS_MONO_LABEL } from "@/lib/typography";

interface Props {
  coachRun: CoachRun;
}

export default function RunPlanSection({ coachRun }: Props) {
  const renderPlan = () => {
    if (coachRun.runType === "fractionne") return <RunPlanInterval coachRun={coachRun} />;
    if (coachRun.runType === "progressif" || coachRun.runType === "tempo") {
      return <RunPlanProgressive coachRun={coachRun} />;
    }
    return <RunPlanClassic coachRun={coachRun} />;
  };

  return (
    <div className="space-y-3">
      <p style={{ ...JETBRAINS_MONO_LABEL, color: "var(--color-muted)", fontSize: 11 }}>PLAN</p>
      {renderPlan()}
    </div>
  );
}
