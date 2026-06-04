import CardIconHeader from "@/components/ui/CardIconHeader";
import type { CoachAnalysisResult } from "@/lib/coachAnalyzer";

interface Props {
  state: "analyzing" | "done";
  result: CoachAnalysisResult | null;
  onRetry?: () => void;
}

const PlusIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
    <path d="M12 5v14M5 12h14" stroke="var(--color-neon)" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

const PulseDots = () => (
  <span className="flex gap-1 items-center">
    {[0, 1, 2].map((i) => (
      <span
        key={i}
        className="w-1 h-1 rounded-full inline-block"
        style={{
          background: "var(--color-neon)",
          animation: `pulse-dot 1.2s ${i * 0.25}s ease-in-out infinite`,
        }}
      />
    ))}
    <style>{`
      @keyframes pulse-dot {
        0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
        40% { opacity: 1; transform: scale(1.2); }
      }
    `}</style>
  </span>
);

export default function CoachFeedbackCard({ state, result, onRetry }: Props) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: "var(--color-neon-bg)", border: "1px solid var(--color-neon-08)" }}
    >
      <div className="mb-2">
        <CardIconHeader
          icon={<PlusIcon />}
          label="ANALYSE DU COACH"
          trailing={state === "analyzing" ? <PulseDots /> : undefined}
        />
      </div>

      {state === "analyzing" ? (
        <p className="text-sm" style={{ color: "var(--color-dim)" }}>
          En cours, l&apos;analyse peut prendre plusieurs secondes
        </p>
      ) : result?.analysis ? (
        <p className="text-sm leading-relaxed" style={{ color: "var(--color-secondary)" }}>
          {result.analysis}
        </p>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm" style={{ color: "var(--color-dim)" }}>
            Analyse temporairement indisponible.
          </p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="flex-shrink-0 text-[11px] font-bold tracking-widest px-3 py-1.5 rounded-xl press-effect"
              style={{
                background: "rgba(205,255,0,0.08)",
                color: "var(--color-neon-text)",
                border: "1px solid rgba(205,255,0,0.25)",
              }}
            >
              RÉESSAYER
            </button>
          )}
        </div>
      )}
    </div>
  );
}
