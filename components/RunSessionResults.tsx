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
        <div className="rounded-2xl overflow-hidden" style={{ background: "var(--color-surface-2)" }}>
          <p className="text-xs text-muted px-4 pt-3 pb-2">Fractions / Tours</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-surface-3)" }}>
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
                    <tr key={lap.lap_index} style={{ borderBottom: "1px solid var(--color-surface-2)" }}>
                      <td className="px-4 py-2.5 font-medium" style={{ color: "var(--color-muted)" }}>{lap.lap_index}</td>
                      <td className="text-right px-3 py-2.5" style={{ color: "var(--color-white-85)" }}>
                        {(lap.distance / 1000).toFixed(2)}<span style={{ color: "var(--color-secondary)", marginLeft: 2 }}>km</span>
                      </td>
                      <td className="text-right px-3 py-2.5 font-display" style={{ color: "var(--color-neon-text)" }}>{lapPace}</td>
                      <td className="text-right px-3 py-2.5" style={{ color: lap.average_heartrate ? "var(--color-white-85)" : "var(--color-subtle)" }}>
                        {lap.average_heartrate ? Math.round(lap.average_heartrate) : "—"}
                      </td>
                      {hasElevation && (
                        <td className="text-right px-4 py-2.5" style={{ color: lap.total_elevation_gain != null ? "var(--color-white-65)" : "var(--color-subtle)" }}>
                          {lap.total_elevation_gain != null ? `${Math.round(lap.total_elevation_gain)}m` : "—"}
                        </td>
                      )}
                    </tr>
                  );
                })}
                <tr style={{ borderTop: "1px solid var(--color-surface-3)" }}>
                  <td className="px-4 py-2.5 font-medium text-muted">Total</td>
                  <td className="text-right px-3 py-2.5" style={{ color: "var(--color-white-85)" }}>
                    {(totalDist / 1000).toFixed(2)}<span style={{ color: "var(--color-secondary)", marginLeft: 2 }}>km</span>
                  </td>
                  <td className="text-right px-3 py-2.5 font-display" style={{ color: "var(--color-neon-text)" }}>{totalPace}</td>
                  <td className="text-right px-3 py-2.5" style={{ color: avgHR ? "var(--color-white-85)" : "var(--color-subtle)" }}>
                    {avgHR ?? "—"}
                  </td>
                  {hasElevation && (
                    <td className="text-right px-4 py-2.5" style={{ color: totalElev ? "var(--color-white-65)" : "var(--color-subtle)" }}>
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
        <div className="rounded-2xl p-4" style={{ background: "var(--color-surface-2)" }}>
          <p className="text-xs text-muted mb-1">Ressenti</p>
          <p className="text-sm italic" style={{ color: "var(--color-white-65)" }}>&quot;{session.comment}&quot;</p>
        </div>
      )}
    </div>
  );
}
