"use client";

import { useSession } from "@/contexts/SessionContext";

export default function FinishSessionModal() {
  const session = useSession();
  if (session.finishing.status !== "confirm") return null;

  const exercises = session.state?.exercises ?? [];
  const totalSets = exercises.reduce((n, ex) => n + (ex.setLogs?.length ?? 0), 0);
  const doneSets = exercises.reduce(
    (n, ex) => n + (ex.setLogs?.filter((s) => s.done).length ?? 0),
    0
  );
  const allDone = totalSets > 0 && doneSets === totalSets;

  return (
    <div
      role="dialog"
      aria-modal
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={session.cancelFinish}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="rounded-3xl w-full max-w-sm overflow-hidden"
        style={{
          background: "#141414",
          border: "1px solid #232323",
          boxShadow: "0 20px 60px rgba(0,0,0,0.7)",
        }}
      >
        <div className="px-6 pt-6 pb-4 text-center">
          <div
            className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center"
            style={{ background: "rgba(57,255,20,0.12)", border: "1px solid rgba(57,255,20,0.4)" }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M5 4v16M5 5h12l-2 4 2 4H5" stroke="#39ff14" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h3 className="font-display text-3xl leading-none mb-2">Finir la séance ?</h3>
          <p className="text-sm" style={{ color: "#888" }}>
            {allDone
              ? "Toutes les séries sont validées. On lance l'analyse du coach."
              : `Tu as validé ${doneSets} série${doneSets > 1 ? "s" : ""} sur ${totalSets}. Le coach n'analysera que ce qui est validé.`
            }
          </p>
        </div>

        <div className="px-4 pb-4 grid grid-cols-2 gap-2">
          <button
            onClick={session.cancelFinish}
            className="py-3 rounded-2xl font-bold text-sm press-effect"
            style={{ background: "#1c1c1c", color: "#cfd2d6", border: "1px solid #232323" }}
          >
            Annuler
          </button>
          <button
            onClick={() => session.confirmFinish()}
            className="py-3 rounded-2xl font-bold text-sm press-effect"
            style={{
              background: "linear-gradient(135deg, #39ff14, #1a7a09)",
              color: "#0a0a0a",
            }}
          >
            Finir & analyser
          </button>
        </div>
      </div>
    </div>
  );
}
