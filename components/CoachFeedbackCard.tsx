"use client";

import type { CoachAnalysisResult } from "@/lib/coachAnalyzer";

interface Props {
  state: "analyzing" | "done";
  result: CoachAnalysisResult | null;
}

export default function CoachFeedbackCard({ state, result }: Props) {
  return (
    <div
      className="rounded-2xl p-4 animate-fade-in"
      style={{ background: "#0a130a", border: "1px solid rgba(57,255,20,0.2)" }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="#39ff14" strokeWidth="1.5"/>
          <path d="M12 8v4l3 3" stroke="#39ff14" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <span className="text-[11px] font-bold tracking-widest" style={{ color: "#39ff14" }}>
          ALEX — COACH
        </span>
        {state === "done" && result && result.modifiedCount > 0 && (
          <span
            className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: "rgba(57,255,20,0.1)", color: "#39ff14", border: "1px solid rgba(57,255,20,0.25)" }}
          >
            {result.modifiedCount} séance{result.modifiedCount > 1 ? "s" : ""} adaptée{result.modifiedCount > 1 ? "s" : ""} ✓
          </span>
        )}
      </div>

      {/* Body */}
      {state === "analyzing" ? (
        <div className="flex items-center gap-2 pt-1">
          <span className="text-sm" style={{ color: "#444" }}>Analyse en cours</span>
          <span className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-1 h-1 rounded-full inline-block"
                style={{
                  background: "#39ff14",
                  animation: `pulse-dot 1.2s ${i * 0.25}s ease-in-out infinite`,
                }}
              />
            ))}
          </span>
        </div>
      ) : result?.analysis ? (
        <p className="text-sm leading-relaxed" style={{ color: "#888" }}>
          {result.analysis}
        </p>
      ) : (
        <p className="text-sm" style={{ color: "#444" }}>
          Analyse temporairement indisponible.
        </p>
      )}

      <style>{`
        @keyframes pulse-dot {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}
