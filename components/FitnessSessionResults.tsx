"use client";

import type { FitnessSession } from "@/lib/types";

interface Props {
  session: FitnessSession;
}

export default function FitnessSessionResults({ session }: Props) {
  return (
    <div className="rounded-2xl p-4" style={{ background: "#1a1a1a" }}>
      {session.exercises.length > 0 ? (
        <>
          <p className="text-[10px] font-bold tracking-widest mb-3" style={{ color: "#555" }}>EXERCICES</p>
          <div className="space-y-2">
            {session.exercises.map((ex) => (
              <div key={ex.id} className="text-sm">
                <div className="flex items-center justify-between">
                  <span>{ex.name}</span>
                  <span className="font-mono text-muted">{ex.sets}×{ex.reps}{ex.weight > 0 ? ` · ${ex.weight}kg` : ""}</span>
                </div>
                {ex.comment && (
                  <p className="text-[11px] italic mt-0.5" style={{ color: "#888" }}>↳ {ex.comment}</p>
                )}
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="text-sm text-muted">Activité enregistrée via Strava.</p>
      )}
      {session.comment && (
        <p className="text-xs italic mt-3" style={{ color: "#888" }}>"{session.comment}"</p>
      )}
    </div>
  );
}
