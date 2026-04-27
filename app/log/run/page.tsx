"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import Badge from "@/components/Badge";
import CoachFeedbackCard from "@/components/CoachFeedbackCard";
import { addSession, generateId } from "@/lib/storage";
import { autoSyncPush } from "@/lib/sync";
import { analyzeSession, type CoachAnalysisResult } from "@/lib/coachAnalyzer";
import { getTodayPlan, formatPace } from "@/lib/plan";
import type { PlannedDay, RunSession } from "@/lib/types";

export default function LogRun() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [todayPlan, setTodayPlan] = useState<PlannedDay | null>(null);

  // Form state
  const [distanceKm, setDistanceKm] = useState("");
  const [minutes, setMinutes] = useState("");
  const [seconds, setSeconds] = useState("00");
  const [avgHr, setAvgHr] = useState("");
  const [elevGain, setElevGain] = useState("");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sessionDate, setSessionDate] = useState<string | null>(null); // null = today
  const [coachState, setCoachState] = useState<"analyzing" | "done">("analyzing");
  const [coachResult, setCoachResult] = useState<CoachAnalysisResult | null>(null);
  const [savedSession, setSavedSession] = useState<RunSession | null>(null);

  useEffect(() => {
    setMounted(true);
    const params = new URLSearchParams(window.location.search);
    const d = params.get("date");
    if (d) setSessionDate(d);
    const plan = getTodayPlan();
    if (plan?.type === "run") setTodayPlan(plan);
  }, []);

  const computedPace = useCallback(() => {
    const dist = parseFloat(distanceKm);
    const min = parseInt(minutes) || 0;
    const sec = parseInt(seconds) || 0;
    const totalSec = min * 60 + sec;
    if (!dist || !totalSec) return null;
    return totalSec / dist;
  }, [distanceKm, minutes, seconds]);

  const pace = computedPace();
  const paceStr = pace
    ? `${Math.floor(pace / 60)}:${String(Math.round(pace % 60)).padStart(2, "0")}/km`
    : null;

  // Compare with target
  const targetPace = todayPlan?.targetPaceSecPerKm;
  const paceVsTarget =
    pace && targetPace ? pace - targetPace : null; // negative = faster

  const handleSave = useCallback(async () => {
    const dist = parseFloat(distanceKm);
    if (!dist) return;

    const min = parseInt(minutes) || 0;
    const sec = parseInt(seconds) || 0;
    const durationSeconds = min * 60 + sec;

    setSaving(true);
    const session: RunSession = {
      id: generateId(),
      type: "run",
      date: sessionDate ? new Date(sessionDate + "T12:00:00").toISOString() : new Date().toISOString(),
      distanceKm: dist,
      durationSeconds,
      avgPaceSecPerKm: pace ?? 0,
      avgHeartRate: avgHr ? parseFloat(avgHr) : undefined,
      elevationGainM: elevGain ? parseFloat(elevGain) : undefined,
      comment,
      targetDistanceKm: todayPlan?.targetDistanceKm,
      targetPaceSecPerKm: todayPlan?.targetPaceSecPerKm,
      targetZone: todayPlan?.targetZone,
    };
    addSession(session);
    setSavedSession(session);
    autoSyncPush();
    setSaving(false);
    setSaved(true);
    setCoachState("analyzing");

    analyzeSession(session).then((result) => {
      setCoachResult(result);
      setCoachState("done");
    });
  }, [distanceKm, minutes, seconds, avgHr, elevGain, comment, pace, todayPlan]);

  const handleRetry = useCallback(() => {
    if (!savedSession) return;
    setCoachState("analyzing");
    analyzeSession(savedSession).then((result) => {
      setCoachResult(result);
      setCoachState("done");
    });
  }, [savedSession]);

  if (!mounted) return null;

  return (
    <div className="max-w-md mx-auto animate-fade-in">
      <PageHeader
        title="LOG RUN"
        subtitle={sessionDate
          ? new Date(sessionDate + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })
          : "Logger"}
        accent="neon"
      />

      <div className="px-5 space-y-5">

        {/* Today's objective */}
        {todayPlan && (
          <div
            className="rounded-2xl p-4"
            style={{
              background: "rgba(57,255,20,0.04)",
              border: "1px solid rgba(57,255,20,0.2)",
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Badge label="Objectif du jour" variant="neon" size="sm" />
              {todayPlan.targetZone && (
                <Badge label={todayPlan.targetZone} variant="surface" size="sm" />
              )}
            </div>
            <p className="text-sm text-gray-300 mb-3">{todayPlan.targetDescription}</p>
            <div className="flex gap-5">
              {todayPlan.targetDistanceKm && (
                <div>
                  <span className="font-display text-3xl" style={{ color: "#39ff14" }}>
                    {todayPlan.targetDistanceKm}
                  </span>
                  <span className="text-xs text-muted ml-1">km</span>
                </div>
              )}
              {todayPlan.targetPaceSecPerKm && (
                <div>
                  <span className="font-display text-3xl" style={{ color: "#39ff14" }}>
                    {formatPace(todayPlan.targetPaceSecPerKm)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Live pace display */}
        {paceStr && (
          <div
            className="rounded-2xl p-4 flex items-center justify-between animate-slide-up"
            style={{
              background: "#111",
              border: `1px solid ${paceVsTarget !== null ? (paceVsTarget < 0 ? "rgba(57,255,20,0.4)" : "rgba(255,107,0,0.4)") : "#222"}`,
            }}
          >
            <div>
              <p className="text-xs text-muted uppercase tracking-wide mb-1">Allure calculée</p>
              <span className="font-display text-4xl" style={{ color: "#39ff14" }}>
                {paceStr}
              </span>
            </div>
            {paceVsTarget !== null && (
              <div className="text-right">
                <p className="text-xs text-muted uppercase tracking-wide mb-1">vs objectif</p>
                <span
                  className="font-display text-2xl"
                  style={{ color: paceVsTarget < 0 ? "#39ff14" : "#ff6b00" }}
                >
                  {paceVsTarget < 0 ? "−" : "+"}
                  {Math.abs(Math.round(paceVsTarget))}s/km
                </span>
              </div>
            )}
          </div>
        )}

        {/* Main inputs */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ border: "1px solid #1a1a1a" }}
        >
          {/* Distance */}
          <div
            className="p-4 flex items-center gap-4"
            style={{ background: "#111" }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(57,255,20,0.1)" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M3 12h18M3 6l6 6-6 6" stroke="#39ff14" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="flex-1">
              <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                Distance
              </label>
              <div className="flex items-end gap-2">
                <input
                  type="number"
                  value={distanceKm}
                  onChange={(e) => setDistanceKm(e.target.value)}
                  placeholder="0.0"
                  className="bg-transparent border-none p-0 font-display text-4xl w-28 focus:outline-none"
                  style={{ color: "white" }}
                  min="0"
                  step="0.1"
                />
                <span className="text-base text-muted pb-1.5">km</span>
              </div>
            </div>
            {todayPlan?.targetDistanceKm && distanceKm && (
              <div
                className="text-right px-3 py-2 rounded-xl"
                style={{
                  background: parseFloat(distanceKm) >= (todayPlan.targetDistanceKm ?? 0)
                    ? "rgba(57,255,20,0.08)"
                    : "rgba(255,107,0,0.08)",
                }}
              >
                <p className="text-[10px] text-muted">objectif</p>
                <p className="font-display text-lg" style={{ color: "#888" }}>
                  {todayPlan.targetDistanceKm} km
                </p>
              </div>
            )}
          </div>

          <div style={{ borderTop: "1px solid #1a1a1a" }} />

          {/* Duration */}
          <div
            className="p-4 flex items-center gap-4"
            style={{ background: "#111" }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(57,255,20,0.1)" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="#39ff14" strokeWidth="1.8"/>
                <path d="M12 7V12L15 15" stroke="#39ff14" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="flex-1">
              <label className="text-xs text-muted uppercase tracking-wide block mb-1">
                Durée
              </label>
              <div className="flex items-end gap-2">
                <div className="flex items-end gap-1">
                  <input
                    type="number"
                    value={minutes}
                    onChange={(e) => setMinutes(e.target.value)}
                    placeholder="00"
                    className="bg-transparent border-none p-0 font-display text-4xl w-16 text-center focus:outline-none"
                    style={{ color: "white" }}
                    min="0"
                  />
                  <span className="text-base text-muted pb-1.5">min</span>
                </div>
                <div className="flex items-end gap-1">
                  <input
                    type="number"
                    value={seconds}
                    onChange={(e) => setSeconds(e.target.value.padStart(2, "0").slice(-2))}
                    placeholder="00"
                    className="bg-transparent border-none p-0 font-display text-4xl w-16 text-center focus:outline-none"
                    style={{ color: "white" }}
                    min="0"
                    max="59"
                  />
                  <span className="text-base text-muted pb-1.5">sec</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Secondary stats */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ border: "1px solid #1a1a1a" }}
        >
          <div className="grid grid-cols-2 divide-x" style={{ borderColor: "#1a1a1a" }}>
            <div className="p-4" style={{ background: "#111" }}>
              <label className="text-xs text-muted uppercase tracking-wide block mb-2">
                FC moyenne
              </label>
              <div className="flex items-end gap-1">
                <input
                  type="number"
                  value={avgHr}
                  onChange={(e) => setAvgHr(e.target.value)}
                  placeholder="—"
                  className="bg-transparent border-none p-0 font-display text-3xl w-20 focus:outline-none"
                  style={{ color: "white" }}
                  min="0"
                />
                <span className="text-xs text-muted pb-1">bpm</span>
              </div>
            </div>
            <div className="p-4" style={{ background: "#111", borderLeft: "1px solid #1a1a1a" }}>
              <label className="text-xs text-muted uppercase tracking-wide block mb-2">
                Dénivelé +
              </label>
              <div className="flex items-end gap-1">
                <input
                  type="number"
                  value={elevGain}
                  onChange={(e) => setElevGain(e.target.value)}
                  placeholder="—"
                  className="bg-transparent border-none p-0 font-display text-3xl w-20 focus:outline-none"
                  style={{ color: "white" }}
                  min="0"
                />
                <span className="text-xs text-muted pb-1">m</span>
              </div>
            </div>
          </div>
        </div>

        {/* Comparison vs target */}
        {todayPlan && distanceKm && paceStr && (
          <div
            className="rounded-2xl p-4"
            style={{ background: "#111", border: "1px solid #222" }}
          >
            <h3 className="text-xs text-muted uppercase tracking-wide mb-3">
              Comparaison objectif
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <CompareRow
                label="Distance"
                target={todayPlan.targetDistanceKm ? `${todayPlan.targetDistanceKm} km` : "—"}
                actual={distanceKm ? `${parseFloat(distanceKm).toFixed(1)} km` : "—"}
                positive={parseFloat(distanceKm) >= (todayPlan.targetDistanceKm ?? 0)}
              />
              {todayPlan.targetPaceSecPerKm && pace && (
                <CompareRow
                  label="Allure"
                  target={formatPace(todayPlan.targetPaceSecPerKm)}
                  actual={paceStr.replace("/km", "")}
                  positive={pace <= todayPlan.targetPaceSecPerKm}
                  note="plus rapide = mieux"
                />
              )}
            </div>
          </div>
        )}

        {/* Comment */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ border: "1px solid #1a1a1a" }}
        >
          <div className="px-4 pt-3 pb-1" style={{ background: "#111" }}>
            <label className="text-xs text-muted uppercase tracking-wide">
              Ressenti & notes
            </label>
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Comment c'était ? Jambes lourdes, météo, motivation, récup..."
            className="w-full px-4 pb-4 pt-2 text-sm resize-none focus:outline-none"
            style={{
              background: "#111",
              color: "#ccc",
              minHeight: "90px",
              border: "none",
            }}
            rows={3}
          />
        </div>

        {/* Save */}
        {saved ? (
          <>
            <CoachFeedbackCard state={coachState} result={coachResult} onRetry={handleRetry} />
            <button
              onClick={() => router.push("/")}
              className="w-full py-4 rounded-2xl font-bold text-base tracking-wide press-effect"
              style={{
                background: "rgba(57,255,20,0.1)",
                color: "#39ff14",
                border: "1px solid rgba(57,255,20,0.4)",
              }}
            >
              CONTINUER →
            </button>
          </>
        ) : (
          <button
            onClick={handleSave}
            disabled={saving || !distanceKm}
            className="w-full py-4 rounded-2xl font-bold text-base tracking-wide press-effect disabled:opacity-40"
            style={{
              background: "linear-gradient(135deg, #39ff14, #1a7a09)",
              color: "#0a0a0a",
            }}
          >
            {saving ? "Sauvegarde..." : "TERMINER LE RUN"}
          </button>
        )}

        <div className="h-4" />
      </div>
    </div>
  );
}

function CompareRow({
  label,
  target,
  actual,
  positive,
  note,
}: {
  label: string;
  target: string;
  actual: string;
  positive: boolean;
  note?: string;
}) {
  return (
    <div
      className="rounded-xl p-3"
      style={{
        background: positive ? "rgba(57,255,20,0.05)" : "rgba(255,107,0,0.05)",
        border: `1px solid ${positive ? "rgba(57,255,20,0.15)" : "rgba(255,107,0,0.15)"}`,
      }}
    >
      <p className="text-[10px] text-muted uppercase tracking-wide mb-1">{label}</p>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs text-muted">Objectif</p>
          <p className="font-bold text-sm">{target}</p>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M5 12H19M13 6L19 12L13 18" stroke="#333" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        <div className="text-right">
          <p className="text-xs text-muted">Réalisé</p>
          <p
            className="font-bold text-sm"
            style={{ color: positive ? "#39ff14" : "#ff6b00" }}
          >
            {actual}
          </p>
        </div>
      </div>
    </div>
  );
}
