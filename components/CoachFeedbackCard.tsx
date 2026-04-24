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
      style={{
        background: "rgba(10,30,60,0.7)",
        border: "1px solid rgba(10,132,255,0.2)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="#0A84FF" strokeWidth="1.5"/>
          <path d="M12 8v4l3 3" stroke="#0A84FF" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <span className="text-[11px] font-bold tracking-widest" style={{ color: "#0A84FF" }}>
          ALEX — COACH
        </span>
        {state === "done" && result && result.modifiedCount > 0 && (
          <span
            className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: "rgba(10,132,255,0.15)", color: "#0A84FF", border: "1px solid rgba(10,132,255,0.25)" }}
          >
            {result.modifiedCount} séance{result.modifiedCount > 1 ? "s" : ""} adaptée{result.modifiedCount > 1 ? "s" : ""} ✓
          </span>
        )}
      </div>

      {/* Body */}
      {state === "analyzing" ? (
        <div className="flex items-center gap-2 pt-1">
          <span className="text-sm" style={{ color: "rgba(235,235,245,0.35)" }}>Analyse en cours</span>
          <span className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-1.5 h-1.5 rounded-full inline-block"
                style={{
                  background: "#0A84FF",
                  animation: `pulse-dot 1.2s ${i * 0.25}s ease-in-out infinite`,
                }}
              />
            ))}
          </span>
        </div>
      ) : result?.analysis ? (
        <p className="text-sm leading-relaxed" style={{ color: "rgba(235,235,245,0.6)" }}>
          {result.analysis}
        </p>
      ) : (
        <p className="text-sm" style={{ color: "rgba(235,235,245,0.25)" }}>
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
