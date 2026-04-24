"use client";

import type { FitnessSession } from "@/lib/types";

interface Props {
  session: FitnessSession;
}

export default function FitnessSessionResults({ session }: Props) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "#1C1C1E", border: "1px solid rgba(255,255,255,0.08)" }}>
      {session.exercises.length > 0 ? (
        <>
          <div className="px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: "rgba(235,235,245,0.3)" }}>
              Exercices
            </p>
          </div>
          <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
            {session.exercises.map((ex) => (
              <div key={ex.id} className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium" style={{ color: "rgba(235,235,245,0.85)" }}>{ex.name}</span>
                  <span className="text-sm font-mono" style={{ color: "rgba(235,235,245,0.4)" }}>
                    {ex.sets}×{ex.reps}{ex.weight > 0 ? ` · ${ex.weight}kg` : ""}
                  </span>
                </div>
                {ex.comment && (
                  <p className="text-xs italic mt-1" style={{ color: "rgba(235,235,245,0.3)" }}>{ex.comment}</p>
                )}
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="px-4 py-3">
          <p className="text-sm" style={{ color: "rgba(235,235,245,0.35)" }}>Activité enregistrée via Strava.</p>
        </div>
      )}
      {session.comment && (
        <div className="px-4 py-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-xs italic" style={{ color: "rgba(235,235,245,0.4)" }}>"{session.comment}"</p>
        </div>
      )}
    </div>
  );
}
