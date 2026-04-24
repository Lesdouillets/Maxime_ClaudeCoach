"use client";

interface Props {
  dateLabel: string;
  titleLine: string;
  isDone: boolean;
  isCancelled: boolean;
  hasPlan: boolean;
  isToday: boolean;
  onBack: () => void;
}

export default function DayHeader({ dateLabel, titleLine, isDone, isCancelled, hasPlan, isToday, onBack }: Props) {
  return (
    <div className="px-5 pb-4" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 20px)" }}>
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs mb-5 press-effect" style={{ color: "rgba(235,235,245,0.4)" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        Retour
      </button>

      <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "rgba(235,235,245,0.35)" }}>{dateLabel}</p>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-4xl leading-none tracking-tight">{titleLine}</h1>
        </div>
        <div className="flex flex-col items-end gap-1">
          {isDone && (
            <span className="text-[10px] px-2.5 py-0.5 rounded-full font-semibold tracking-wide"
              style={{ background: "rgba(48,209,88,0.15)", color: "#30D158", border: "1px solid rgba(48,209,88,0.3)" }}>
              FAIT ✓
            </span>
          )}
          {isCancelled && (
            <span className="text-[10px] px-2.5 py-0.5 rounded-full font-semibold"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(235,235,245,0.4)", border: "1px solid rgba(255,255,255,0.1)" }}>
              ANNULÉ
            </span>
          )}
          {!isDone && !isCancelled && hasPlan && isToday && (
            <span className="text-[10px] px-2.5 py-0.5 rounded-full font-semibold"
              style={{ background: "rgba(10,132,255,0.15)", color: "#0A84FF", border: "1px solid rgba(10,132,255,0.25)" }}>
              AUJOURD'HUI
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
