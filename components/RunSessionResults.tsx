"use client";

import type { RunSession } from "@/lib/types";

interface Props {
  session: RunSession;
}

function paceStr(secPerKm: number): string {
  if (secPerKm <= 0) return "--";
  return `${Math.floor(secPerKm / 60)}:${String(Math.round(secPerKm % 60)).padStart(2, "0")}`;
}

export default function RunSessionResults({ session }: Props) {
  const laps = session.laps && session.laps.length > 1 ? session.laps : null;

  let hasElevation = false;
  let totalDist = 0, totalElapsed = 0, totalHRSum = 0, hrCount = 0, totalElevSum = 0;
  for (const l of laps ?? []) {
    totalDist += l.distance;
    totalElapsed += l.moving_time;
    if (l.average_heartrate) { totalHRSum += l.average_heartrate; hrCount++; }
    if (l.total_elevation_gain != null) { hasElevation = true; totalElevSum += l.total_elevation_gain; }
  }
  const avgSpeedTotal = totalElapsed > 0 ? totalDist / totalElapsed : 0;
  const totalPace = paceStr(avgSpeedTotal > 0 ? 1000 / avgSpeedTotal : 0);
  const avgHR = hrCount > 0 ? Math.round(totalHRSum / hrCount) : null;
  const totalElev = hasElevation ? totalElevSum : null;

  return (
    <div className="space-y-3">
      {laps && (
        <div className="rounded-2xl overflow-hidden" style={{ background: "#1a1a1a" }}>
          <p className="text-xs text-muted px-4 pt-3 pb-2">Fractions / Tours</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #2a2a2a" }}>
                  <th className="text-left px-4 py-2 font-medium text-muted">#</th>
                  <th className="text-right px-3 py-2 font-medium text-muted">Dist</th>
                  <th className="text-right px-3 py-2 font-medium text-muted">Allure</th>
                  <th className="text-right px-3 py-2 font-medium text-muted">FC</th>
                  {hasElevation && <th className="text-right px-4 py-2 font-medium text-muted">Déni ↑</th>}
                </tr>
              </thead>
              <tbody>
                {laps.map((lap) => {
                  const lapPace = paceStr(lap.average_speed > 0 ? 1000 / lap.average_speed : 0);
                  return (
                    <tr key={lap.lap_index} style={{ borderBottom: "1px solid #1e1e1e" }}>
                      <td className="px-4 py-2.5 font-medium" style={{ color: "#555" }}>{lap.lap_index}</td>
                      <td className="text-right px-3 py-2.5" style={{ color: "#ccc" }}>
                        {(lap.distance / 1000).toFixed(2)}<span style={{ color: "#666", marginLeft: 2 }}>km</span>
                      </td>
                      <td className="text-right px-3 py-2.5 font-display" style={{ color: "#CDFF00" }}>{lapPace}</td>
                      <td className="text-right px-3 py-2.5" style={{ color: lap.average_heartrate ? "#ccc" : "#333" }}>
                        {lap.average_heartrate ? Math.round(lap.average_heartrate) : "—"}
                      </td>
                      {hasElevation && (
                        <td className="text-right px-4 py-2.5" style={{ color: lap.total_elevation_gain != null ? "#aaa" : "#333" }}>
                          {lap.total_elevation_gain != null ? `${Math.round(lap.total_elevation_gain)}m` : "—"}
                        </td>
                      )}
                    </tr>
                  );
                })}
                <tr style={{ borderTop: "1px solid #2a2a2a" }}>
                  <td className="px-4 py-2.5 font-medium text-muted">Total</td>
                  <td className="text-right px-3 py-2.5" style={{ color: "#ccc" }}>
                    {(totalDist / 1000).toFixed(2)}<span style={{ color: "#666", marginLeft: 2 }}>km</span>
                  </td>
                  <td className="text-right px-3 py-2.5 font-display" style={{ color: "#CDFF00" }}>{totalPace}</td>
                  <td className="text-right px-3 py-2.5" style={{ color: avgHR ? "#ccc" : "#333" }}>
                    {avgHR ?? "—"}
                  </td>
                  {hasElevation && (
                    <td className="text-right px-4 py-2.5" style={{ color: totalElev ? "#aaa" : "#333" }}>
                      {totalElev != null ? `${Math.round(totalElev)}m` : "—"}
                    </td>
                  )}
                </tr>
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
