"use client";

import { useEffect } from "react";
import type { WorkoutSession, PlannedDay } from "@/lib/types";
import type { CoachWorkout } from "@/lib/coachPlan";

interface Props {
  date: string; // "YYYY-MM-DD"
  session?: WorkoutSession;
  plan?: PlannedDay | null;
  coachWorkout?: CoachWorkout | null;
  onClose: () => void;
}

function formatPace(secPerKm: number) {
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${s.toString().padStart(2, "0")}/km`;
}

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h${m.toString().padStart(2, "0")}`;
  return `${m} min`;
}

const StravaIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="#ff6b00">
    <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066l-2.084 4.116zM11.648 13.828L8.966 8H6.58l5.069 10 5.069-10h-2.386z"/>
  </svg>
);

export default function DayDetailSheet({ date, session, plan, coachWorkout, onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const dateObj = new Date(date + "T12:00:00");
  const dateLabel = dateObj.toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long",
  });

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
        style={{ background: "#111", border: "1px solid #222", borderBottom: "none" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: "#333" }} />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-2 pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#555" }}>
              {dateLabel}
            </p>
            {session ? (
              <h2 className="font-display text-3xl mt-0.5">
                {session.type === "run" ? "RUN" : session.category === "upper" ? "HAUT DU CORPS" : "BAS DU CORPS"}
              </h2>
            ) : plan ? (
              <h2 className="font-display text-3xl mt-0.5">{plan.label}</h2>
            ) : (
              <h2 className="font-display text-3xl mt-0.5">REPOS</h2>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center press-effect"
            style={{ background: "#1a1a1a", color: "#555" }}
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
                <div className="flex items-center gap-1.5 text-xs" style={{ color: "#ff6b00" }}>
                  <StravaIcon />
                  Importé depuis Strava
                </div>
              )}

              {/* Key metrics */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl p-4" style={{ background: "#1a1a1a" }}>
                  <p className="text-xs text-muted mb-1">Distance</p>
                  <p className="font-display text-3xl" style={{ color: "#39ff14" }}>
                    {session.distanceKm.toFixed(2)}
                    <span className="text-sm text-muted ml-1">km</span>
                  </p>
                </div>
                <div className="rounded-2xl p-4" style={{ background: "#1a1a1a" }}>
                  <p className="text-xs text-muted mb-1">Allure</p>
                  <p className="font-display text-3xl" style={{ color: "#39ff14" }}>
                    {session.avgPaceSecPerKm > 0 ? formatPace(session.avgPaceSecPerKm) : "--"}
                  </p>
                </div>
                {session.durationSeconds > 0 && (
                  <div className="rounded-2xl p-4" style={{ background: "#1a1a1a" }}>
                    <p className="text-xs text-muted mb-1">Durée</p>
                    <p className="font-display text-2xl" style={{ color: "#fff" }}>
                      {formatDuration(session.durationSeconds)}
                    </p>
                  </div>
                )}
                {session.avgHeartRate && (
                  <div className="rounded-2xl p-4" style={{ background: "#1a1a1a" }}>
                    <p className="text-xs text-muted mb-1">FC moyenne</p>
                    <p className="font-display text-2xl" style={{ color: "#fff" }}>
                      {session.avgHeartRate}
                      <span className="text-sm text-muted ml-1">bpm</span>
                    </p>
                  </div>
                )}
                {session.elevationGainM != null && session.elevationGainM > 0 && (
                  <div className="rounded-2xl p-4" style={{ background: "#1a1a1a" }}>
                    <p className="text-xs text-muted mb-1">Dénivelé</p>
                    <p className="font-display text-2xl" style={{ color: "#fff" }}>
                      {Math.round(session.elevationGainM)}
                      <span className="text-sm text-muted ml-1">m</span>
                    </p>
                  </div>
                )}
              </div>

              {/* Plan targets comparison */}
              {plan?.type === "run" && (plan.targetDistanceKm || plan.targetPaceSecPerKm) && (
                <div className="rounded-2xl p-4" style={{ background: "rgba(57,255,20,0.04)", border: "1px solid rgba(57,255,20,0.1)" }}>
                  <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "#39ff14" }}>
                    Objectif
                  </p>
                  <div className="flex gap-4 text-sm text-muted">
                    {plan.targetDistanceKm && <span>{plan.targetDistanceKm} km</span>}
                    {plan.targetPaceSecPerKm && <span>{formatPace(plan.targetPaceSecPerKm)}</span>}
                    {plan.targetZone && <span>{plan.targetZone}</span>}
                  </div>
                </div>
              )}

              {session.comment ? (
                <div className="rounded-2xl p-4" style={{ background: "#1a1a1a" }}>
                  <p className="text-xs text-muted mb-1">Ressenti</p>
                  <p className="text-sm italic" style={{ color: "#aaa" }}>"{session.comment}"</p>
                </div>
              ) : null}
            </>
          )}

          {/* Fitness session */}
          {session?.type === "fitness" && (
            <>
              {session.importedFromStrava && (
                <div className="flex items-center gap-1.5 text-xs" style={{ color: "#ff6b00" }}>
                  <StravaIcon />
                  Importé depuis Strava
                </div>
              )}

              {/* Coach workout linked */}
              {coachWorkout && (
                <div className="rounded-2xl p-4" style={{ background: "rgba(57,255,20,0.04)", border: "1px solid rgba(57,255,20,0.1)" }}>
                  <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "#39ff14" }}>
                    Plan du coach — {coachWorkout.label}
                  </p>
                  {coachWorkout.coachNote && (
                    <p className="text-xs italic mb-3" style={{ color: "#888" }}>"{coachWorkout.coachNote}"</p>
                  )}
                  <div className="space-y-2">
                    {coachWorkout.exercises.map((ex, i) => (
                      <div key={i} className="space-y-0.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{ex.name}</span>
                          <span className="text-muted">
                            {ex.sets}×{ex.reps}
                            {ex.weight > 0 ? ` · ${ex.weight}kg` : ""}
                          </span>
                        </div>
                        {ex.coachNote && (
                          <p className="text-xs italic" style={{ color: "#666" }}>↳ {ex.coachNote}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Manual exercises (if any logged) */}
              {session.exercises.length > 0 && (
                <div className="rounded-2xl p-4" style={{ background: "#1a1a1a" }}>
                  <p className="text-xs text-muted uppercase tracking-wide mb-3">Exercices réalisés</p>
                  <div className="space-y-2">
                    {session.exercises.map((ex) => (
                      <div key={ex.id} className="space-y-0.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{ex.name}</span>
                          <span className="text-muted">
                            {ex.sets}×{ex.reps}
                            {ex.weight > 0 ? ` · ${ex.weight}kg` : ""}
                          </span>
                        </div>
                        {ex.comment && (
                          <p className="text-xs italic" style={{ color: "#666" }}>↳ {ex.comment}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {session.exercises.length === 0 && !coachWorkout && (
                <div className="rounded-2xl p-4" style={{ background: "#1a1a1a" }}>
                  <p className="text-sm text-muted">Activité enregistrée via Strava.</p>
                </div>
              )}

              {session.comment ? (
                <div className="rounded-2xl p-4" style={{ background: "#1a1a1a" }}>
                  <p className="text-xs text-muted mb-1">Ressenti</p>
                  <p className="text-sm italic" style={{ color: "#aaa" }}>"{session.comment}"</p>
                </div>
              ) : null}
            </>
          )}

          {/* No session — show plan */}
          {!session && plan && (
            <div className="rounded-2xl p-4" style={{ background: "#1a1a1a" }}>
              <p className="text-xs text-muted uppercase tracking-wide mb-2">Prévu</p>
              <p className="text-sm text-muted">{plan.targetDescription}</p>
              {plan.type === "run" && (
                <div className="flex gap-4 mt-3">
                  {plan.targetDistanceKm && (
                    <div>
                      <span className="font-display text-2xl" style={{ color: "#39ff14" }}>{plan.targetDistanceKm}</span>
                      <span className="text-xs text-muted ml-1">km</span>
                    </div>
                  )}
                  {plan.targetPaceSecPerKm && (
                    <span className="font-display text-2xl" style={{ color: "#39ff14" }}>
                      {formatPace(plan.targetPaceSecPerKm)}
                    </span>
                  )}
                  {plan.targetZone && (
                    <span className="px-2 py-0.5 rounded-lg text-xs font-bold"
                      style={{ background: "rgba(57,255,20,0.15)", color: "#39ff14" }}>
                      {plan.targetZone}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Rest day */}
          {!session && !plan && (
            <div className="flex items-center gap-3 rounded-2xl p-4" style={{ background: "#1a1a1a" }}>
              <span className="text-2xl">😴</span>
              <p className="text-sm text-muted">Jour de repos — récupération active.</p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
