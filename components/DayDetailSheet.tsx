"use client";

import { useEffect } from "react";
import type { WorkoutSession, PlannedDay } from "@/lib/types";
import type { CoachWorkout, CoachRun } from "@/lib/coachPlan";
import { formatPace, formatDuration } from "@/lib/plan";

interface Props {
  date: string; // "YYYY-MM-DD"
  session?: WorkoutSession;
  plan?: PlannedDay | null;
  coachWorkout?: CoachWorkout | null;
  coachRun?: CoachRun | null;
  onClose: () => void;
}

const StravaIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="#FF9F0A">
    <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066l-2.084 4.116zM11.648 13.828L8.966 8H6.58l5.069 10 5.069-10h-2.386z"/>
  </svg>
);

const CARD = { background: "#1C1C1E", border: "1px solid rgba(255,255,255,0.07)" };
const MUTED = { color: "rgba(235,235,245,0.4)" };

export default function DayDetailSheet({ date, session, plan, coachWorkout, coachRun, onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const dateObj = new Date(date + "T12:00:00");
  const dateLabel = dateObj.toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long",
  });

  const sessionTitle = session
    ? (session.type === "run" ? "Run" : session.category === "upper" ? "Haut du corps" : "Bas du corps")
    : plan ? plan.label : "Repos";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }} />

      {/* Sheet */}
      <div
        className="relative w-full max-h-[85vh] overflow-y-auto rounded-t-3xl animate-slide-up"
        style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderBottom: "none" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }} />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-2 pb-4">
          <div>
            <p className="text-xs font-medium tracking-wide" style={MUTED}>
              {dateLabel}
            </p>
            <h2 className="font-display text-3xl mt-0.5">{sessionTitle}</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center press-effect"
            style={{ background: "#2C2C2E", color: "rgba(235,235,245,0.5)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="px-5 pb-24 space-y-4">

          {/* Run session */}
          {session?.type === "run" && (
            <>
              {session.importedFromStrava && (
                <div className="flex items-center gap-1.5 text-xs" style={{ color: "#FF9F0A" }}>
                  <StravaIcon />
                  Importé depuis Strava
                </div>
              )}

              {/* Key metrics */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl p-4" style={CARD}>
                  <p className="text-xs mb-1" style={MUTED}>Distance</p>
                  <p className="font-display text-3xl" style={{ color: "#30D158" }}>
                    {session.distanceKm.toFixed(2)}
                    <span className="text-sm ml-1" style={MUTED}>km</span>
                  </p>
                </div>
                <div className="rounded-2xl p-4" style={CARD}>
                  <p className="text-xs mb-1" style={MUTED}>Allure</p>
                  <p className="font-display text-3xl" style={{ color: "#30D158" }}>
                    {session.avgPaceSecPerKm > 0 ? formatPace(session.avgPaceSecPerKm) : "--"}
                  </p>
                </div>
                {session.durationSeconds > 0 && (
                  <div className="rounded-2xl p-4" style={CARD}>
                    <p className="text-xs mb-1" style={MUTED}>Durée</p>
                    <p className="font-display text-2xl">
                      {formatDuration(session.durationSeconds)}
                    </p>
                  </div>
                )}
                {session.avgHeartRate && (
                  <div className="rounded-2xl p-4" style={CARD}>
                    <p className="text-xs mb-1" style={MUTED}>FC moyenne</p>
                    <p className="font-display text-2xl">
                      {session.avgHeartRate}
                      <span className="text-sm ml-1" style={MUTED}>bpm</span>
                    </p>
                  </div>
                )}
                {session.elevationGainM != null && session.elevationGainM > 0 && (
                  <div className="rounded-2xl p-4" style={CARD}>
                    <p className="text-xs mb-1" style={MUTED}>Dénivelé</p>
                    <p className="font-display text-2xl">
                      {Math.round(session.elevationGainM)}
                      <span className="text-sm ml-1" style={MUTED}>m</span>
                    </p>
                  </div>
                )}
              </div>

              {/* Coach run plan */}
              {coachRun && (
                <div className="rounded-2xl p-4" style={{ background: "rgba(10,132,255,0.04)", border: "1px solid rgba(10,132,255,0.15)" }}>
                  <p className="text-xs font-semibold tracking-wide mb-3" style={{ color: "#0A84FF" }}>
                    Plan du coach — {coachRun.label}
                  </p>
                  {coachRun.coachNote && (
                    <p className="text-xs italic mb-3" style={{ color: "rgba(235,235,245,0.5)" }}>"{coachRun.coachNote}"</p>
                  )}
                  {coachRun.intervals ? (
                    <div className="space-y-2">
                      {coachRun.intervals.map((seg, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <span className="font-medium">
                            {seg.label ?? (seg.reps ? `${seg.reps}×${seg.distanceKm < 1 ? `${seg.distanceKm * 1000}m` : `${seg.distanceKm}km`}` : `${seg.distanceKm}km`)}
                          </span>
                          <div className="text-right">
                            <span style={MUTED}>{seg.pace}/km</span>
                            {seg.targetHR && <span className="text-xs ml-2" style={MUTED}>♥ {seg.targetHR}</span>}
                            {seg.restSeconds && <span className="text-xs ml-2" style={MUTED}>récup {seg.restSeconds}s</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex gap-4 text-sm">
                      <div>
                        <span className="font-display text-2xl" style={{ color: "#30D158" }}>{coachRun.distanceKm}</span>
                        <span className="text-xs ml-1" style={MUTED}>km</span>
                      </div>
                      <div className="self-end mb-0.5" style={MUTED}>{coachRun.pace}/km</div>
                      {coachRun.targetHR && <div className="self-end mb-0.5 text-xs" style={MUTED}>♥ {coachRun.targetHR}</div>}
                      {coachRun.targetZone && (
                        <span className="self-center px-2 py-0.5 rounded-lg text-xs font-semibold"
                          style={{ background: "rgba(48,209,88,0.15)", color: "#30D158", border: "1px solid rgba(48,209,88,0.25)" }}>
                          {coachRun.targetZone}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Plan targets comparison */}
              {!coachRun && plan?.type === "run" && (plan.targetDistanceKm || plan.targetPaceSecPerKm) && (
                <div className="rounded-2xl p-4" style={{ background: "rgba(48,209,88,0.04)", border: "1px solid rgba(48,209,88,0.15)" }}>
                  <p className="text-xs font-semibold tracking-wide mb-2" style={{ color: "#30D158" }}>
                    Objectif
                  </p>
                  <div className="flex gap-4 text-sm" style={MUTED}>
                    {plan.targetDistanceKm && <span>{plan.targetDistanceKm} km</span>}
                    {plan.targetPaceSecPerKm && <span>{formatPace(plan.targetPaceSecPerKm)}</span>}
                    {plan.targetZone && <span>{plan.targetZone}</span>}
                  </div>
                </div>
              )}

              {session.comment ? (
                <div className="rounded-2xl p-4" style={CARD}>
                  <p className="text-xs mb-1" style={MUTED}>Ressenti</p>
                  <p className="text-sm italic" style={{ color: "rgba(235,235,245,0.7)" }}>"{session.comment}"</p>
                </div>
              ) : null}
            </>
          )}

          {/* Fitness session */}
          {session?.type === "fitness" && (
            <>
              {session.importedFromStrava && (
                <div className="flex items-center gap-1.5 text-xs" style={{ color: "#FF9F0A" }}>
                  <StravaIcon />
                  Importé depuis Strava
                </div>
              )}

              {/* Coach workout linked */}
              {coachWorkout && (
                <div className="rounded-2xl p-4" style={{ background: "rgba(255,159,10,0.04)", border: "1px solid rgba(255,159,10,0.15)" }}>
                  <p className="text-xs font-semibold tracking-wide mb-3" style={{ color: "#FF9F0A" }}>
                    Plan du coach — {coachWorkout.label}
                  </p>
                  {coachWorkout.coachNote && (
                    <p className="text-xs italic mb-3" style={{ color: "rgba(235,235,245,0.5)" }}>"{coachWorkout.coachNote}"</p>
                  )}
                  <div className="space-y-2">
                    {coachWorkout.exercises.map((ex, i) => (
                      <div key={i} className="space-y-0.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{ex.name}</span>
                          <span style={MUTED}>
                            {ex.sets}×{ex.reps}
                            {ex.weight > 0 ? ` · ${ex.weight}kg` : ""}
                          </span>
                        </div>
                        {ex.coachNote && (
                          <p className="text-xs italic" style={{ color: "rgba(235,235,245,0.4)" }}>↳ {ex.coachNote}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Manual exercises (if any logged) */}
              {session.exercises.length > 0 && (
                <div className="rounded-2xl p-4" style={CARD}>
                  <p className="text-xs tracking-wide mb-3" style={MUTED}>Exercices réalisés</p>
                  <div className="space-y-2">
                    {session.exercises.map((ex) => (
                      <div key={ex.id} className="space-y-0.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{ex.name}</span>
                          <span style={MUTED}>
                            {ex.sets}×{ex.reps}
                            {ex.weight > 0 ? ` · ${ex.weight}kg` : ""}
                          </span>
                        </div>
                        {ex.comment && (
                          <p className="text-xs italic" style={{ color: "rgba(235,235,245,0.4)" }}>↳ {ex.comment}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {session.exercises.length === 0 && !coachWorkout && (
                <div className="rounded-2xl p-4" style={CARD}>
                  <p className="text-sm" style={MUTED}>Activité enregistrée via Strava.</p>
                </div>
              )}

              {session.comment ? (
                <div className="rounded-2xl p-4" style={CARD}>
                  <p className="text-xs mb-1" style={MUTED}>Ressenti</p>
                  <p className="text-sm italic" style={{ color: "rgba(235,235,245,0.7)" }}>"{session.comment}"</p>
                </div>
              ) : null}
            </>
          )}

          {/* No session — show plan */}
          {!session && plan && (
            <div className="rounded-2xl p-4" style={CARD}>
              <p className="text-xs tracking-wide mb-2" style={MUTED}>Prévu</p>
              <p className="text-sm" style={MUTED}>{plan.targetDescription}</p>
              {plan.type === "run" && (
                <div className="flex gap-4 mt-3">
                  {plan.targetDistanceKm && (
                    <div>
                      <span className="font-display text-2xl" style={{ color: "#30D158" }}>{plan.targetDistanceKm}</span>
                      <span className="text-xs ml-1" style={MUTED}>km</span>
                    </div>
                  )}
                  {plan.targetPaceSecPerKm && (
                    <span className="font-display text-2xl" style={{ color: "#30D158" }}>
                      {formatPace(plan.targetPaceSecPerKm)}
                    </span>
                  )}
                  {plan.targetZone && (
                    <span className="px-2 py-0.5 rounded-lg text-xs font-semibold"
                      style={{ background: "rgba(48,209,88,0.15)", color: "#30D158", border: "1px solid rgba(48,209,88,0.25)" }}>
                      {plan.targetZone}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Rest day */}
          {!session && !plan && (
            <div className="flex items-center gap-3 rounded-2xl p-4" style={CARD}>
              <span className="text-2xl">😴</span>
              <p className="text-sm" style={MUTED}>Jour de repos — récupération active.</p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
