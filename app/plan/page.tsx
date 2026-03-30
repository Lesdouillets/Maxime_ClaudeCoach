"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import Badge from "@/components/Badge";
import { WEEKLY_PLAN, getThisWeekDays, formatPace, getDayName } from "@/lib/plan";
import { getSessions } from "@/lib/storage";
import type { WorkoutSession } from "@/lib/types";

const DAY_FULL_FR = [
  "Dimanche",
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
];

export default function PlanPage() {
  const [mounted, setMounted] = useState(false);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const weekDays = getThisWeekDays();

  useEffect(() => {
    setMounted(true);
    setSessions(getSessions());
  }, []);

  if (!mounted) return null;

  return (
    <div className="max-w-md mx-auto animate-fade-in">
      <PageHeader title="PLAN HEBDO" subtitle="Cette semaine" accent="neon" />

      <div className="px-5 space-y-3">
        {weekDays.map((day) => {
          const dateStr = day.date.toISOString().slice(0, 10);
          const session = sessions.find((s) => s.date.slice(0, 10) === dateStr);
          const plan = day.plan;

          let status: "done" | "missed" | "upcoming" | "today-planned" | "rest";
          if (session) {
            status = "done";
          } else if (!plan) {
            status = "rest";
          } else if (day.isToday) {
            status = "today-planned";
          } else if (day.isPast) {
            status = "missed";
          } else {
            status = "upcoming";
          }

          const statusConfig = {
            done: { color: "#39ff14", label: "Fait ✓", border: "rgba(57,255,20,0.3)", bg: "rgba(57,255,20,0.04)" },
            missed: { color: "#ff6b00", label: "Manqué", border: "rgba(255,107,0,0.25)", bg: "rgba(255,107,0,0.03)" },
            upcoming: { color: "#555", label: "À venir", border: "#1a1a1a", bg: "#111" },
            "today-planned": { color: "#39ff14", label: "Aujourd'hui", border: "rgba(57,255,20,0.5)", bg: "rgba(57,255,20,0.04)" },
            rest: { color: "#333", label: "Repos", border: "#1a1a1a", bg: "#0d0d0d" },
          }[status];

          return (
            <div
              key={day.dow}
              className="rounded-2xl overflow-hidden card-hover"
              style={{
                border: `1px solid ${statusConfig.border}`,
                background: statusConfig.bg,
                boxShadow: day.isToday ? "0 0 20px rgba(57,255,20,0.06)" : "none",
              }}
            >
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-display text-xl ${day.isToday ? "text-neon-glow" : ""}`}
                      style={{ color: statusConfig.color }}
                    >
                      {DAY_FULL_FR[day.dow].toUpperCase()}
                    </span>
                    {day.isToday && (
                      <span
                        className="text-[9px] px-2 py-0.5 rounded-full font-bold tracking-widest"
                        style={{
                          background: "rgba(57,255,20,0.15)",
                          color: "#39ff14",
                          border: "1px solid rgba(57,255,20,0.3)",
                        }}
                      >
                        TODAY
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-medium" style={{ color: statusConfig.color }}>
                    {statusConfig.label}
                  </span>
                </div>

                {plan ? (
                  <>
                    <h3 className="font-bold text-base mb-1">{plan.label}</h3>
                    <p className="text-sm text-muted mb-3">{plan.targetDescription}</p>

                    {plan.type === "run" && (
                      <div className="flex gap-3 flex-wrap mb-3">
                        {plan.targetDistanceKm && (
                          <div className="flex items-end gap-1">
                            <span className="font-display text-2xl" style={{ color: "#39ff14" }}>
                              {plan.targetDistanceKm}
                            </span>
                            <span className="text-xs text-muted mb-0.5">km</span>
                          </div>
                        )}
                        {plan.targetPaceSecPerKm && (
                          <div className="flex items-end gap-1">
                            <span className="font-display text-2xl" style={{ color: "#39ff14" }}>
                              {formatPace(plan.targetPaceSecPerKm)}
                            </span>
                          </div>
                        )}
                        {plan.targetZone && (
                          <Badge label={plan.targetZone} variant="neon" />
                        )}
                      </div>
                    )}

                    {plan.type === "fitness" && plan.category && (
                      <div className="mb-3">
                        <Badge
                          label={plan.category === "upper" ? "Haut du corps" : "Bas du corps"}
                          variant="orange"
                        />
                      </div>
                    )}

                    {/* Show session summary if done */}
                    {session && status === "done" && (
                      <div
                        className="rounded-xl p-3 mb-3"
                        style={{ background: "rgba(57,255,20,0.05)", border: "1px solid rgba(57,255,20,0.1)" }}
                      >
                        {session.type === "run" ? (
                          <div className="flex gap-4 text-sm">
                            <span style={{ color: "#39ff14" }}>
                              <span className="font-display text-lg">{session.distanceKm.toFixed(1)}</span>
                              <span className="text-xs text-muted ml-1">km</span>
                            </span>
                            {session.avgPaceSecPerKm > 0 && (
                              <span className="text-muted">
                                {Math.floor(session.avgPaceSecPerKm / 60)}:{String(Math.round(session.avgPaceSecPerKm % 60)).padStart(2, "0")}/km
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm" style={{ color: "#ff6b00" }}>
                            {session.exercises.length} exercices complétés
                          </span>
                        )}
                      </div>
                    )}

                    {/* CTA if today and not done */}
                    {(status === "today-planned" || status === "upcoming") && (
                      <Link
                        href={plan.type === "fitness" ? "/log/fitness" : "/log/run"}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold press-effect"
                        style={{
                          background: day.isToday
                            ? "linear-gradient(135deg, #39ff14, #1a7a09)"
                            : "#1a1a1a",
                          color: day.isToday ? "#0a0a0a" : "#888",
                        }}
                      >
                        {day.isToday ? "Logger maintenant" : "Logger en avance"}
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                          <path d="M5 12H19M13 6L19 12L13 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </Link>
                    )}
                  </>
                ) : (
                  <p className="text-sm" style={{ color: "#2a2a2a" }}>
                    Récupération active
                  </p>
                )}
              </div>
            </div>
          );
        })}

        <div className="h-4" />
      </div>
    </div>
  );
}
