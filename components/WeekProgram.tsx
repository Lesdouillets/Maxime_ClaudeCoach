import Link from "next/link";
import { SessionTag } from "./SessionTag";
import type { SessionType } from "./SessionTag";
import type { DaySlot } from "@/lib/weekProgram";
import type { CSSProperties } from "react";
import { JETBRAINS_MONO_LABEL } from "@/lib/typography";

const DAY_LETTER_TODAY: CSSProperties = { ...JETBRAINS_MONO_LABEL, color: "var(--color-text)" };
const DAY_LETTER_MUTED: CSSProperties = { ...JETBRAINS_MONO_LABEL, color: "var(--color-muted)" };

export interface WeekProgramProps {
  days: DaySlot[];
  weekLabel: string;
  onDayClick: (date: string, type: SessionType) => void;
}

export function WeekProgram({ days, weekLabel, onDayClick }: WeekProgramProps) {
  return (
    <div className="w-full">
      {/* Header — masqué depuis la home (weekLabel="") ; le lien vers /plan est géré par le parent dans ce cas */}
      {weekLabel ? (
        <div className="flex items-center justify-between mb-3">
          <span style={JETBRAINS_MONO_LABEL}>{weekLabel}</span>
          <Link href="/plan">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M9 18L15 12L9 6" stroke="var(--color-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      ) : null}

      {/* 7 jours */}
      <div className="flex justify-between">
        {days.map((day) => (
          <div key={day.date} className="flex flex-col items-center gap-1.5">
            <SessionTag
              type={day.type}
              status={day.status}
              size="md"
              onClick={day.type !== "rest" ? () => onDayClick(day.date, day.type) : undefined}
            />
            <span style={day.isToday ? DAY_LETTER_TODAY : DAY_LETTER_MUTED}>
              {day.letter}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
