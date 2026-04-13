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
              <div key={ex.id} className="flex items-center justify-between text-sm">
                <span>{ex.name}</span>
                <span className="font-mono text-muted">{ex.sets}×{ex.reps}{ex.weight > 0 ? ` · ${ex.weight}kg` : ""}</span>
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
