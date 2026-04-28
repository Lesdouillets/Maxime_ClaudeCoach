"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import CoachFeedbackCard from "@/components/CoachFeedbackCard";
import FitnessSessionResults from "@/components/FitnessSessionResults";
import { deleteSession, getSessions } from "@/lib/storage";
import { autoSyncPush } from "@/lib/sync";
import { analyzeSession, getStoredCoachAnalysis, type CoachAnalysisResult } from "@/lib/coachAnalyzer";
import type { FitnessSession } from "@/lib/types";
import { useSession } from "@/contexts/SessionContext";

/**
 * Thin route:
 *  - If a fitness session already exists for the date, render the archive view here.
 *  - If a coach plan exists with no session yet, hand off to the global session sheet
 *    via the SessionContext and redirect to "/" so the user sees the sheet.
 *  - Otherwise, show an "aucun plan" state with a back button.
 */
export default function LogFitness() {
  const router = useRouter();
  const session = useSession();
  const [mounted, setMounted] = useState(false);
  const [sessionDate, setSessionDate] = useState<string | null>(null);
  const [existingSession, setExistingSession] = useState<FitnessSession | null>(null);
  const [coachState, setCoachState] = useState<"analyzing" | "done">("done");
  const [coachResult, setCoachResult] = useState<CoachAnalysisResult | null>(null);
  const [handoff, setHandoff] = useState<"none" | "redirecting" | "no-plan">("none");

  useEffect(() => {
    setMounted(true);
    const params = new URLSearchParams(window.location.search);
    const d = params.get("date") ?? new Date().toISOString().slice(0, 10);
    setSessionDate(d);

    const existing = getSessions().find(
      (s): s is FitnessSession =>
        s.type === "fitness" && s.date.slice(0, 10) === d
    );
    if (existing) {
      setExistingSession(existing);
      setCoachState("done");
      setCoachResult(getStoredCoachAnalysis(d));
      return;
    }

    // No session yet → try to open the global session sheet via context.
    const result = session.open(d);
    if (result === "ok") {
      setHandoff("redirecting");
      router.replace("/");
    } else {
      setHandoff("no-plan");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRetry = useCallback(() => {
    if (!existingSession) return;
    setCoachState("analyzing");
    analyzeSession(existingSession).then((result) => {
      setCoachResult(result);
      setCoachState("done");
    });
  }, [existingSession]);

  const handleDelete = useCallback(() => {
    if (!existingSession) return;
    deleteSession(existingSession.id);
    autoSyncPush();
    router.push("/");
  }, [existingSession, router]);

  if (!mounted) return null;

  const dateLabel = sessionDate
    ? new Date(sessionDate + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })
    : "Aujourd'hui";

  // While we hand off to the global sheet, render nothing visible.
  if (handoff === "redirecting") return null;

  return (
    <div className="max-w-md mx-auto animate-fade-in pb-24">
      <PageHeader title="SÉANCE SALLE" subtitle={dateLabel} accent="orange" />

      <div className="px-5 space-y-4">
        {existingSession && (
          <>
            <CoachFeedbackCard state={coachState} result={coachResult} onRetry={handleRetry} />
            <FitnessSessionResults session={existingSession} />
            <button
              onClick={handleDelete}
              className="w-full py-2 rounded-xl text-xs press-effect"
              style={{ background: "transparent", border: "1px solid #111", color: "#2a2a2a" }}
            >
              Supprimer la séance
            </button>
          </>
        )}

        {!existingSession && handoff === "no-plan" && (
          <div className="rounded-2xl p-4" style={{ background: "#111", border: "1px solid #1a1a1a" }}>
            <p className="text-sm text-muted">Aucun plan coach pour cette date.</p>
            <button
              onClick={() => router.push("/")}
              className="mt-3 w-full py-2.5 rounded-xl text-sm press-effect"
              style={{ background: "transparent", border: "1px solid #1a1a1a", color: "#888" }}
            >
              Retour
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
