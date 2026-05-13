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
        <div className="rounded-2xl p-4" style={{ background: "#1a1a1a" }}>
          <p className="text-xs text-muted mb-1">Distance</p>
          <p className="font-display text-3xl" style={{ color: "#39ff14" }}>
            {session.distanceKm.toFixed(2)}<span className="text-sm text-muted ml-1">km</span>
          </p>
        </div>
        <div className="rounded-2xl p-4" style={{ background: "#1a1a1a" }}>
          <p className="text-xs text-muted mb-1">Allure</p>
          <p className="font-display text-3xl" style={{ color: "#39ff14" }}>
            {session.avgPaceSecPerKm > 0 ? formatPace(session.avgPaceSecPerKm) : "--"}
          </p>
        </div>
        {session.durationSeconds > 0 && (
          <div className="rounded-2xl p-4" style={{ background: "#1a1a1a" }}>
            <p className="text-xs text-muted mb-1">Durée</p>
            <p className="font-display text-2xl">{formatDuration(session.durationSeconds)}</p>
          </div>
        )}
        {session.avgHeartRate && (
          <div className="rounded-2xl p-4" style={{ background: "#1a1a1a" }}>
            <p className="text-xs text-muted mb-1">FC moyenne</p>
            <p className="font-display text-2xl">{session.avgHeartRate}<span className="text-sm text-muted ml-1">bpm</span></p>
          </div>
        )}
        {session.elevationGainM != null && session.elevationGainM > 0 && (
          <div className="rounded-2xl p-4" style={{ background: "#1a1a1a" }}>
            <p className="text-xs text-muted mb-1">Dénivelé</p>
            <p className="font-display text-2xl">{Math.round(session.elevationGainM)}<span className="text-sm text-muted ml-1">m</span></p>
          </div>
        )}
      </div>
      {session.laps && session.laps.length > 1 && (
        <div className="rounded-2xl overflow-hidden" style={{ background: "#1a1a1a" }}>
          <p className="text-xs text-muted px-4 pt-3 pb-2">Fractions / Tours</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #2a2a2a" }}>
                  <th className="text-left px-4 py-2 font-medium text-muted">#</th>
                  <th className="text-right px-3 py-2 font-medium text-muted">Dist</th>
                  <th className="text-right px-3 py-2 font-medium text-muted">Allure</th>
                  <th className="text-right px-4 py-2 font-medium text-muted">FC</th>
                </tr>
              </thead>
              <tbody>
                {session.laps.map((lap) => {
                  const secPerKm = lap.average_speed > 0 ? 1000 / lap.average_speed : 0;
                  const lapPace = secPerKm > 0
                    ? `${Math.floor(secPerKm / 60)}:${String(Math.round(secPerKm % 60)).padStart(2, "0")}`
                    : "--";
                  return (
                    <tr key={lap.lap_index} style={{ borderBottom: "1px solid #1e1e1e" }}>
                      <td className="px-4 py-2.5 font-medium" style={{ color: "#555" }}>{lap.lap_index}</td>
                      <td className="text-right px-3 py-2.5" style={{ color: "#ccc" }}>
                        {(lap.distance / 1000).toFixed(2)}<span style={{ color: "#666", marginLeft: 2 }}>km</span>
                      </td>
                      <td className="text-right px-3 py-2.5 font-display" style={{ color: "#39ff14" }}>{lapPace}</td>
                      <td className="text-right px-4 py-2.5" style={{ color: lap.average_heartrate ? "#ccc" : "#333" }}>
                        {lap.average_heartrate ? Math.round(lap.average_heartrate) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {session.comment && (
        <div className="rounded-2xl p-4" style={{ background: "#1a1a1a" }}>
          <p className="text-xs text-muted mb-1">Ressenti</p>
          <p className="text-sm italic" style={{ color: "#aaa" }}>"{session.comment}"</p>
        </div>
      )}
    </div>
  );
}
