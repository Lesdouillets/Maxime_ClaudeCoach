"use client";

import { formatPace, formatDuration } from "@/lib/plan";
import type { RunSession } from "@/lib/types";

interface Props {
  session: RunSession;
}

export default function RunSessionResults({ session }: Props) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl p-4" style={{ background: "#1C1C1E", border: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-xs mb-1" style={{ color: "rgba(235,235,245,0.4)" }}>Distance</p>
          <p className="font-display text-3xl" style={{ color: "#30D158" }}>
            {session.distanceKm.toFixed(2)}<span className="text-sm ml-1" style={{ color: "rgba(235,235,245,0.4)" }}>km</span>
          </p>
        </div>
        <div className="rounded-2xl p-4" style={{ background: "#1C1C1E", border: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-xs mb-1" style={{ color: "rgba(235,235,245,0.4)" }}>Allure</p>
          <p className="font-display text-3xl" style={{ color: "#30D158" }}>
            {session.avgPaceSecPerKm > 0 ? formatPace(session.avgPaceSecPerKm) : "--"}
          </p>
        </div>
        {session.durationSeconds > 0 && (
          <div className="rounded-2xl p-4" style={{ background: "#1C1C1E", border: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-xs mb-1" style={{ color: "rgba(235,235,245,0.4)" }}>Durée</p>
            <p className="font-display text-2xl">{formatDuration(session.durationSeconds)}</p>
          </div>
        )}
        {session.avgHeartRate && (
          <div className="rounded-2xl p-4" style={{ background: "#1C1C1E", border: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-xs mb-1" style={{ color: "rgba(235,235,245,0.4)" }}>FC moyenne</p>
            <p className="font-display text-2xl">{session.avgHeartRate}<span className="text-sm ml-1" style={{ color: "rgba(235,235,245,0.4)" }}>bpm</span></p>
          </div>
        )}
        {session.elevationGainM != null && session.elevationGainM > 0 && (
          <div className="rounded-2xl p-4" style={{ background: "#1C1C1E", border: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-xs mb-1" style={{ color: "rgba(235,235,245,0.4)" }}>Dénivelé</p>
            <p className="font-display text-2xl">{Math.round(session.elevationGainM)}<span className="text-sm ml-1" style={{ color: "rgba(235,235,245,0.4)" }}>m</span></p>
          </div>
        )}
      </div>
      {session.comment && (
        <div className="rounded-2xl p-4" style={{ background: "#1C1C1E", border: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-xs mb-1" style={{ color: "rgba(235,235,245,0.4)" }}>Ressenti</p>
          <p className="text-sm italic" style={{ color: "rgba(235,235,245,0.7)" }}>"{session.comment}"</p>
        </div>
      )}
    </div>
  );
}
