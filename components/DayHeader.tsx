"use client";

import Badge from "./Badge";

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
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        Retour
      </button>

      <p className="text-xs font-semibold uppercase tracking-widest mb-1 text-muted">{dateLabel}</p>
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
