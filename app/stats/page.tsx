"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import Badge from "@/components/Badge";
import { getSessions, getWeightHistory, addWeightEntry } from "@/lib/storage";
import type { WorkoutSession, RunSession, FitnessSession } from "@/lib/types";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  LineChart,
  Line,
} from "recharts";

export default function StatsPage() {
  const [mounted, setMounted] = useState(false);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [weightHistory, setWeightHistory] = useState<{ date: string; kg: number }[]>([]);
  const [newWeight, setNewWeight] = useState("");
  const [tab, setTab] = useState<"overview" | "runs" | "fitness" | "weight">("overview");

  useEffect(() => {
    setMounted(true);
    setSessions(getSessions());
    setWeightHistory(getWeightHistory());
  }, []);

  const handleAddWeight = () => {
    const kg = parseFloat(newWeight);
    if (!kg) return;
    addWeightEntry({ date: new Date().toISOString(), kg });
    setWeightHistory(getWeightHistory());
    setNewWeight("");
  };

  if (!mounted) return null;

  const runs = sessions.filter((s): s is RunSession => s.type === "run");
  const fitness = sessions.filter((s): s is FitnessSession => s.type === "fitness");

  // Weekly run data (last 8 weeks)
  const weeklyRunData = getWeeklyRunData(runs);

  // Key fitness lifts history
  const benchData = getExerciseData(fitness, "Développé couché");
  const squatData = getExerciseData(fitness, "Squat barre");

  // Stats summary
  const totalRunKm = runs.reduce((a, s) => a + s.distanceKm, 0);
  const avgPace = runs.length
    ? runs.reduce((a, s) => a + s.avgPaceSecPerKm, 0) / runs.length
    : 0;
  const totalSessions = sessions.length;
  const last30Days = sessions.filter(
    (s) => new Date(s.date) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  ).length;

  return (
    <div className="max-w-md mx-auto animate-fade-in">
      <PageHeader title="STATS" subtitle="Mes progrès" accent="neon" />

      <div className="px-5 space-y-5">

        {/* Summary row */}
        <div className="grid grid-cols-2 gap-3">
          <BigStat value={`${totalRunKm.toFixed(0)}`} unit="km" label="Total run" accent="#39ff14" />
          <BigStat value={`${totalSessions}`} unit="" label="Séances totales" accent="#ff6b00" />
          <BigStat
            value={avgPace ? `${Math.floor(avgPace / 60)}:${String(Math.round(avgPace % 60)).padStart(2, "0")}` : "—"}
            unit="/km"
            label="Allure moyenne"
            accent="#39ff14"
          />
          <BigStat value={`${last30Days}`} unit="" label="Séances (30j)" accent="#ff6b00" />
        </div>

        {/* Tab selector */}
        <div
          className="flex rounded-2xl p-1 gap-1"
          style={{ background: "#111", border: "1px solid #1a1a1a" }}
        >
          {(["overview", "runs", "fitness", "weight"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 py-2 rounded-xl text-xs font-bold tracking-wide press-effect capitalize"
              style={{
                background: tab === t ? "#1a1a1a" : "transparent",
                color: tab === t ? "#39ff14" : "#555",
                border: tab === t ? "1px solid rgba(57,255,20,0.2)" : "1px solid transparent",
              }}
            >
              {t === "overview" ? "Vue" : t === "runs" ? "Run" : t === "fitness" ? "Salle" : "Poids"}
            </button>
          ))}
        </div>

        {/* Overview tab */}
        {tab === "overview" && (
          <div className="space-y-5 animate-fade-in">
            <ChartCard title="KM RUN PAR SEMAINE">
              {weeklyRunData.length > 0 ? (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={weeklyRunData} barSize={20}>
                    <CartesianGrid stroke="#1a1a1a" vertical={false} />
                    <XAxis dataKey="week" tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
                    <Tooltip
                      contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 8 }}
                      labelStyle={{ color: "#888", fontSize: 11 }}
                      itemStyle={{ color: "#39ff14" }}
                      formatter={(v: number) => [`${v.toFixed(1)} km`, ""]}
                    />
                    <Bar dataKey="km" fill="#39ff14" opacity={0.85} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart />
              )}
            </ChartCard>

            <SessionHistoryList sessions={sessions.slice(0, 10)} />
          </div>
        )}

        {/* Runs tab */}
        {tab === "runs" && (
          <div className="space-y-5 animate-fade-in">
            <ChartCard title="ALLURE MOYENNE (s/km)">
              {runs.length > 1 ? (
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={runs.slice(-20).reverse().map((s, i) => ({
                    n: i + 1,
                    pace: s.avgPaceSecPerKm,
                    label: new Date(s.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }),
                  }))}>
                    <defs>
                      <linearGradient id="paceGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#39ff14" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#39ff14" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#1a1a1a" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: "#555", fontSize: 9 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false} width={28}
                      tickFormatter={(v) => `${Math.floor(v/60)}:${String(v%60).padStart(2,"0")}`}
                      reversed
                    />
                    <Tooltip
                      contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 8 }}
                      labelStyle={{ color: "#888", fontSize: 11 }}
                      itemStyle={{ color: "#39ff14" }}
                      formatter={(v: number) => [`${Math.floor(v/60)}:${String(Math.round(v%60)).padStart(2,"0")}/km`, "Allure"]}
                    />
                    <Area type="monotone" dataKey="pace" stroke="#39ff14" fill="url(#paceGrad)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart />
              )}
            </ChartCard>

            <div className="space-y-3">
              {runs.map((s) => (
                <RunHistoryRow key={s.id} session={s} />
              ))}
            </div>
          </div>
        )}

        {/* Fitness tab */}
        {tab === "fitness" && (
          <div className="space-y-5 animate-fade-in">
            {benchData.length > 1 && (
              <ChartCard title="DÉVELOPPÉ COUCHÉ (kg max)">
                <LiftChart data={benchData} color="#ff6b00" />
              </ChartCard>
            )}
            {squatData.length > 1 && (
              <ChartCard title="SQUAT (kg max)">
                <LiftChart data={squatData} color="#ff6b00" />
              </ChartCard>
            )}
            <div className="space-y-3">
              {fitness.map((s) => (
                <FitnessHistoryRow key={s.id} session={s} />
              ))}
            </div>
          </div>
        )}

        {/* Weight tab */}
        {tab === "weight" && (
          <div className="space-y-5 animate-fade-in">
            <div
              className="rounded-2xl p-4 flex gap-3"
              style={{ background: "#111", border: "1px solid #1a1a1a" }}
            >
              <div className="flex-1">
                <label className="text-xs text-muted uppercase tracking-wide block mb-2">
                  Poids aujourd'hui
                </label>
                <div className="flex items-end gap-2">
                  <input
                    type="number"
                    value={newWeight}
                    onChange={(e) => setNewWeight(e.target.value)}
                    placeholder="75.5"
                    className="bg-transparent border-none p-0 font-display text-4xl w-24 focus:outline-none"
                    style={{ color: "white" }}
                    step="0.1"
                  />
                  <span className="text-base text-muted pb-1.5">kg</span>
                </div>
              </div>
              <button
                onClick={handleAddWeight}
                disabled={!newWeight}
                className="self-end px-4 py-2.5 rounded-xl text-sm font-bold press-effect disabled:opacity-40"
                style={{
                  background: "linear-gradient(135deg, #39ff14, #1a7a09)",
                  color: "#0a0a0a",
                }}
              >
                Ajouter
              </button>
            </div>

            {weightHistory.length > 1 && (
              <ChartCard title="ÉVOLUTION POIDS (kg)">
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={weightHistory.slice(0, 30).reverse().map((e) => ({
                    date: new Date(e.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }),
                    kg: e.kg,
                  }))}>
                    <defs>
                      <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#39ff14" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#39ff14" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#1a1a1a" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: "#555", fontSize: 9 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false} width={30}
                      domain={["auto", "auto"]}
                    />
                    <Tooltip
                      contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 8 }}
                      labelStyle={{ color: "#888", fontSize: 11 }}
                      formatter={(v: number) => [`${v} kg`, "Poids"]}
                    />
                    <Area type="monotone" dataKey="kg" stroke="#39ff14" fill="url(#weightGrad)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>
            )}

            <div className="space-y-2">
              {weightHistory.slice(0, 15).map((entry, i) => (
                <div
                  key={i}
                  className="flex justify-between items-center py-3 px-4 rounded-xl"
                  style={{ background: "#111", border: "1px solid #1a1a1a" }}
                >
                  <span className="text-sm text-muted">
                    {new Date(entry.date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}
                  </span>
                  <span className="font-display text-2xl" style={{ color: "#39ff14" }}>
                    {entry.kg}
                    <span className="text-sm text-muted ml-1">kg</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="h-4" />
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function BigStat({ value, unit, label, accent }: { value: string; unit: string; label: string; accent: string }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: "#111", border: "1px solid #1a1a1a" }}>
      <div className="flex items-end gap-1 mb-1">
        <span className="font-display text-4xl leading-none" style={{ color: accent }}>{value}</span>
        {unit && <span className="text-sm pb-1" style={{ color: accent, opacity: 0.6 }}>{unit}</span>}
      </div>
      <p className="text-xs text-muted uppercase tracking-wide">{label}</p>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: "#111", border: "1px solid #1a1a1a" }}>
      <p className="text-xs text-muted uppercase tracking-widest mb-3">{title}</p>
      {children}
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="h-32 flex items-center justify-center">
      <p className="text-sm text-muted">Pas encore de données</p>
    </div>
  );
}

function LiftChart({ data, color }: { data: { date: string; max: number }[]; color: string }) {
  return (
    <ResponsiveContainer width="100%" height={140}>
      <LineChart data={data}>
        <CartesianGrid stroke="#1a1a1a" vertical={false} />
        <XAxis dataKey="date" tick={{ fill: "#555", fontSize: 9 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
        <Tooltip
          contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 8 }}
          formatter={(v: number) => [`${v} kg`, "Max"]}
        />
        <Line type="monotone" dataKey="max" stroke={color} strokeWidth={2} dot={{ r: 3, fill: color }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function RunHistoryRow({ session }: { session: RunSession }) {
  return (
    <div
      className="rounded-2xl p-4 flex items-center gap-4"
      style={{ background: "#111", border: "1px solid #1a1a1a" }}
    >
      <div>
        <p className="text-xs text-muted mb-1">
          {new Date(session.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
        </p>
        <div className="flex gap-3 items-end">
          <span className="font-display text-2xl" style={{ color: "#39ff14" }}>
            {session.distanceKm.toFixed(1)}
            <span className="text-xs text-muted ml-0.5">km</span>
          </span>
          {session.avgPaceSecPerKm > 0 && (
            <span className="text-sm text-muted pb-0.5">
              {Math.floor(session.avgPaceSecPerKm / 60)}:{String(Math.round(session.avgPaceSecPerKm % 60)).padStart(2, "0")}/km
            </span>
          )}
          {session.avgHeartRate && (
            <span className="text-sm text-muted pb-0.5">♥ {Math.round(session.avgHeartRate)} bpm</span>
          )}
        </div>
      </div>
      {session.importedFromStrava && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="#ff6b00" className="ml-auto flex-shrink-0">
          <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066l-2.084 4.116zM11.648 13.828L8.966 8H6.58l5.069 10 5.069-10h-2.386z"/>
        </svg>
      )}
    </div>
  );
}

function FitnessHistoryRow({ session }: { session: FitnessSession }) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: "#111", border: "1px solid #1a1a1a" }}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-muted">
          {new Date(session.date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}
        </p>
        <Badge
          label={session.category === "upper" ? "Haut" : "Bas"}
          variant="orange"
          size="sm"
        />
      </div>
      <div className="space-y-1.5">
        {session.exercises.slice(0, 4).map((ex) => (
          <div key={ex.id} className="flex justify-between text-sm">
            <span className="text-gray-300 truncate mr-2">{ex.name}</span>
            <span className="text-muted flex-shrink-0">
              {ex.sets}×{ex.reps} {ex.weight > 0 ? `@ ${ex.weight}kg` : ""}
            </span>
          </div>
        ))}
        {session.exercises.length > 4 && (
          <p className="text-xs text-muted">+{session.exercises.length - 4} exercices</p>
        )}
      </div>
    </div>
  );
}

function SessionHistoryList({ sessions }: { sessions: WorkoutSession[] }) {
  if (sessions.length === 0) {
    return (
      <div
        className="rounded-2xl p-6 text-center"
        style={{ background: "#111", border: "1px dashed #222" }}
      >
        <p className="text-muted text-sm">Aucune séance pour l'instant</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sessions.map((s) =>
        s.type === "run" ? (
          <RunHistoryRow key={s.id} session={s} />
        ) : (
          <FitnessHistoryRow key={s.id} session={s} />
        )
      )}
    </div>
  );
}

// ─── Data helpers ──────────────────────────────────────────────────────────────

function getWeeklyRunData(runs: RunSession[]) {
  const map = new Map<string, number>();
  runs.forEach((s) => {
    const d = new Date(s.date);
    const monday = new Date(d);
    const diff = d.getDay() === 0 ? -6 : 1 - d.getDay();
    monday.setDate(d.getDate() + diff);
    const key = monday.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
    map.set(key, (map.get(key) ?? 0) + s.distanceKm);
  });

  return Array.from(map.entries())
    .slice(-8)
    .map(([week, km]) => ({ week, km }));
}

function getExerciseData(sessions: FitnessSession[], exerciseName: string) {
  return sessions
    .map((s) => {
      const ex = s.exercises.find(
        (e) => e.name.toLowerCase() === exerciseName.toLowerCase()
      );
      if (!ex) return null;
      return {
        date: new Date(s.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }),
        max: ex.weight,
      };
    })
    .filter(Boolean)
    .reverse() as { date: string; max: number }[];
}
