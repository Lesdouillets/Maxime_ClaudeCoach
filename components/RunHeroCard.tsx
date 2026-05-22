// components/RunHeroCard.tsx
"use client";

import type { CoachRun } from "@/lib/coachPlan";
import type { RunSession } from "@/lib/types";
import { getRunBadge } from "@/lib/coachPlan";
import { JETBRAINS_MONO_DATA } from "@/lib/typography";

interface Props {
  coachRun: CoachRun;
  doneSession?: RunSession | null;
}

function formatPaceSec(secPerKm: number): string {
  const min = Math.floor(secPerKm / 60);
  const sec = Math.round(secPerKm % 60);
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

function StatItem({ value, unit }: { value: string; unit: string }) {
  return (
    <div className="flex items-baseline gap-0.5">
      <span className="font-display text-3xl leading-none" style={{ color: "#fff" }}>{value}</span>
      <span style={{ ...JETBRAINS_MONO_DATA, color: "#888", fontSize: 9, marginLeft: 2 }}>
        {unit}
      </span>
    </div>
  );
}

function Divider() {
  return <span style={{ color: "#2a2a2a", fontSize: 22, lineHeight: 1 }}>|</span>;
}

export default function RunHeroCard({ coachRun, doneSession }: Props) {
  const done = !!doneSession;
  const badge = getRunBadge(coachRun);

  const distKm = done
    ? doneSession!.distanceKm.toFixed(1)
    : String(coachRun.distanceKm);

  const durationMin = done
    ? Math.round(doneSession!.durationSeconds / 60)
    : coachRun.durationMin ?? null;

  const pace = done
    ? (doneSession!.avgPaceSecPerKm > 0 ? formatPaceSec(doneSession!.avgPaceSecPerKm) : null)
    : coachRun.pace ?? null;

  const borderColor = done ? "var(--color-neon)" : "var(--color-blue)";

  return (
    <div
      className="relative rounded-2xl overflow-hidden"
      style={{ border: `1.5px solid ${borderColor}`, minHeight: 200 }}
    >
      {/* Fond placeholder photo */}
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(160deg, #1c1c1c 0%, #0d0d0d 100%)" }}
      />
      {/* Gradient pour lisibilité du texte */}
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.88) 45%, transparent 100%)" }}
      />

      {/* Contenu */}
      <div className="relative p-5 flex flex-col justify-end" style={{ minHeight: 200 }}>
        <h2
          className="font-display text-4xl leading-none mb-4"
          style={{ color: done ? "var(--color-neon)" : "#fff" }}
        >
          {coachRun.label}{done ? " ✓" : ""}
        </h2>

        {/* Rangée de stats */}
        <div className="flex items-center gap-3 flex-wrap">
          <StatItem value={distKm} unit="KM" />

          {durationMin != null && (
            <>
              <Divider />
              <StatItem value={String(durationMin)} unit="MIN" />
            </>
          )}

          {pace && (
            <>
              <Divider />
              <StatItem value={pace} unit="/KM" />
            </>
          )}

          {!done && badge && (
            <>
              <Divider />
              <span style={{ ...JETBRAINS_MONO_DATA, color: "var(--color-neon)", fontSize: 11, letterSpacing: "0.08em" }}>
                {badge.toUpperCase()}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
