"use client";

import Badge from "./Badge";
import { ArrowForwardIcon } from "./icons";
import { JETBRAINS_MONO_LABEL } from "@/lib/typography";

interface DayHeaderProps {
  dateLabel: string;
  titleLine: string;
  isDone: boolean;
  isCancelled: boolean;
  hasPlan: boolean;
  isToday: boolean;
  onBack: () => void;
}

export default function DayHeader({ dateLabel, titleLine, isDone, isCancelled, hasPlan, isToday, onBack }: DayHeaderProps) {
  return (
    <div className="px-5 pb-4" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 20px)" }}>
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs mb-5 press-effect text-muted">
        <ArrowForwardIcon size={14} color="currentColor" rotate={180} />
        Retour
      </button>

      <p className="mb-1" style={JETBRAINS_MONO_LABEL}>{dateLabel}</p>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-4xl leading-none">{titleLine}</h1>
        <div className="flex flex-col items-end gap-1">
          {isDone && <Badge label="FAIT ✓" variant="neon" size="sm" />}
          {isCancelled && <Badge label="ANNULÉ" variant="muted" size="sm" />}
          {!isDone && !isCancelled && hasPlan && isToday && (
            <Badge label="AUJOURD'HUI" variant="neon" size="sm" />
          )}
        </div>
      </div>
    </div>
  );
}
