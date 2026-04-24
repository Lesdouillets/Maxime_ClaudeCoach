"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import Badge from "@/components/Badge";
import { getSessions, getWeightHistory, addWeightEntry } from "@/lib/storage";
import { autoSyncPush } from "@/lib/sync";
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
} from "recharts";

export default function StatsPage() {
  const [mounted, setMounted] = useState(false);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [weightHistory, setWeightHistory] = useState<{ date: string; kg: number }[]>([]);
  const [newWeight, setNewWeight] = useState("");
  const [tab, setTab] = useState<"runs" | "fitness" | "weight">("runs");

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
    autoSyncPush();
  };

  if (!mounted) return null;

  const runs = sessions.filter((s): s is RunSession => s.type === "run");
  const fitness = sessions.filter((s): s is FitnessSession => s.type === "fitness");

  const weeklyRunData = getWeeklyRunData(runs);
  const lastWeights = getLastWeightsPerExercise(fitness);

  const totalRunKm = runs.reduce((a, s) => a + s.distanceKm, 0);
  const avgPace = runs.length
    ? runs.reduce((a, s) => a + s.avgPaceSecPerKm, 0) / runs.length
    : 0;
  const totalSessions = sessions.length;
  const last30Days = sessions.filter(
    (s) => new Date(s.date) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  ).length;

  // Pace chart data: last 20 runs in chronological order
  const paceChartData = [...runs]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-20)
    .map((s) => ({
      pace: s.avgPaceSecPerKm,
      label: new Date(s.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }),
    }));

  return (
    <div className="max-w-md mx-auto animate-fade-in">
      <PageHeader title="Stats" subtitle="Mes progrès" accent="primary" />

      <div className="px-5 space-y-5">

        {/* Summary row */}
        <div className="grid grid-cols-2 gap-3">
          <BigStat value={`${totalRunKm.toFixed(0)}`} unit="km" label="Total run" accent="#30D158" />
          <BigStat value={`${totalSessions}`} unit="" label="Séances totales" accent="#FF9F0A" />
          <BigStat
            value={avgPace ? `${Math.floor(avgPace / 60)}:${String(Math.round(avgPace % 60)).padStart(2, "0")}` : "—"}
            unit="/km"
            label="Allure moyenne"
            accent="#0A84FF"
          />
          <BigStat value={`${last30Days}`} unit="" label="Séances (30j)" accent="#FF9F0A" />
        </div>

        {/* Tab selector */}
        <div
          className="flex rounded-2xl p-1 gap-1"
          style={{ background: "#1C1C1E", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          {(["runs", "fitness", "weight"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 py-2 rounded-xl text-xs font-semibold tracking-wide press-effect capitalize"
              style={{
                background: tab === t ? "#2C2C2E" : "transparent",
                color: tab === t ? "#0A84FF" : "rgba(235,235,245,0.35)",
                border: tab === t ? "1px solid rgba(10,132,255,0.2)" : "1px solid transparent",
              }}
            >
              {t === "runs" ? "Run" : t === "fitness" ? "Salle" : "Poids"}
            </button>
          ))}
        </div>

        {/* Runs tab */}
        {tab === "runs" && (
          <div className="space-y-5 animate-fade-in">
            <ChartCard title="KM PAR SEMAINE">
              {weeklyRunData.length > 0 ? (
                <ResponsiveContainer width="100%" height={150}>
                  <BarChart data={weeklyRunData} barSize={20}>
                    <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="week" tick={{ fill: "rgba(235,235,245,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "rgba(235,235,245,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
                    <Tooltip
                      contentStyle={{ background: "#2C2C2E", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10 }}
                      labelStyle={{ color: "rgba(235,235,245,0.5)", fontSize: 11 }}
                      itemStyle={{ color: "#30D158" }}
                      formatter={(v: number) => [`${v.toFixed(1)} km`, ""]}
                    />
                    <Bar dataKey="km" fill="#30D158" opacity={0.85} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart />
              )}
            </ChartCard>

            <ChartCard title="ÉVOLUTION DE L'ALLURE">
              {paceChartData.length > 1 ? (
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={paceChartData}>
                    <defs>
                      <linearGradient id="paceGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#30D158" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#30D158" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: "rgba(235,235,245,0.3)", fontSize: 9 }} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fill: "rgba(235,235,245,0.3)", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      width={36}
                      reversed
                      domain={[
                        (dataMin: number) => Math.floor(dataMin * 0.97),
                        (dataMax: number) => Math.ceil(dataMax * 1.03),
                      ]}
                      tickFormatter={(v) => `${Math.floor(v / 60)}:${String(v % 60).padStart(2, "0")}`}
                    />
                    <Tooltip
                      contentStyle={{ background: "#2C2C2E", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10 }}
                      labelStyle={{ color: "rgba(235,235,245,0.5)", fontSize: 11 }}
                      itemStyle={{ color: "#30D158" }}
                      formatter={(v: number) => [
                        `${Math.floor(v / 60)}:${String(Math.round(v % 60)).padStart(2, "0")}/km`,
                        "Allure",
                      ]}
                    />
                    <Area type="monotone" dataKey="pace" stroke="#30D158" fill="url(#paceGrad)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart />
              )}
            </ChartCard>
          </div>
        )}

        {/* Fitness tab */}
        {tab === "fitness" && (
          <div className="space-y-4 animate-fade-in">
            {lastWeights.upper.length > 0 && (
              <ExerciseWeightCard title="HAUT DU CORPS" exercises={lastWeights.upper} />
            )}
            {lastWeights.lower.length > 0 && (
              <ExerciseWeightCard title="BAS DU CORPS" exercises={lastWeights.lower} />
            )}
            {lastWeights.upper.length === 0 && lastWeights.lower.length === 0 && (
              <div className="rounded-2xl p-6 text-center" style={{ background: "#1C1C1E", border: "1px dashed rgba(255,255,255,0.08)" }}>
                <p className="text-sm" style={{ color: "rgba(235,235,245,0.3)" }}>Aucune séance de salle</p>
              </div>
            )}
          </div>
        )}

        {/* Weight tab */}
        {tab === "weight" && (
          <div className="space-y-5 animate-fade-in">
            <div
              className="rounded-2xl p-4 flex gap-3"
              style={{ background: "#1C1C1E", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <div className="flex-1">
                <label className="text-xs uppercase tracking-wide block mb-2" style={{ color: "rgba(235,235,245,0.35)" }}>
                  Poids aujourd'hui
                </label>
                <div className="flex items-end gap-2">
                  <input
                    type="number"
                    value={newWeight}
                    onChange={(e) => setNewWeight(e.target.value)}
                    placeholder="75.5"
                    className="bg-transparent border-none p-0 font-display text-4xl w-24 focus:outline-none"
                    style={{ color: "white", boxShadow: "none" }}
                    step="0.1"
                  />
                  <span className="text-base pb-1.5" style={{ color: "rgba(235,235,245,0.4)" }}>kg</span>
                </div>
              </div>
              <button
                onClick={handleAddWeight}
                disabled={!newWeight}
                className="self-end px-4 py-2.5 rounded-xl text-sm font-semibold press-effect disabled:opacity-40"
                style={{
                  background: "#30D158",
                  color: "#000",
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
                        <stop offset="5%" stopColor="#0A84FF" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#0A84FF" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: "rgba(235,235,245,0.3)", fontSize: 9 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "rgba(235,235,245,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} width={30}
                      domain={["auto", "auto"]}
                    />
                    <Tooltip
                      contentStyle={{ background: "#2C2C2E", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10 }}
                      labelStyle={{ color: "rgba(235,235,245,0.5)", fontSize: 11 }}
                      formatter={(v: number) => [`${v} kg`, "Poids"]}
                    />
                    <Area type="monotone" dataKey="kg" stroke="#0A84FF" fill="url(#weightGrad)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>
            )}

            <div className="space-y-2">
              {weightHistory.slice(0, 15).map((entry, i) => (
                <div
                  key={i}
                  className="flex justify-between items-center py-3 px-4 rounded-xl"
                  style={{ background: "#1C1C1E", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <span className="text-sm" style={{ color: "rgba(235,235,245,0.4)" }}>
                    {new Date(entry.date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}
                  </span>
                  <span className="font-display text-2xl" style={{ color: "#0A84FF" }}>
                    {entry.kg}
                    <span className="text-sm ml-1" style={{ color: "rgba(235,235,245,0.35)" }}>kg</span>
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
    <div className="rounded-2xl p-4" style={{ background: "#1C1C1E", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 2px 8px rgba(0,0,0,0.3)" }}>
      <div className="flex items-end gap-1 mb-1">
        <span className="font-display text-4xl leading-none" style={{ color: accent }}>{value}</span>
        {unit && <span className="text-sm pb-1" style={{ color: accent, opacity: 0.6 }}>{unit}</span>}
      </div>
      <p className="text-xs uppercase tracking-wide" style={{ color: "rgba(235,235,245,0.35)" }}>{label}</p>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: "#1C1C1E", border: "1px solid rgba(255,255,255,0.08)" }}>
      <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "rgba(235,235,245,0.3)" }}>{title}</p>
      {children}
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="h-32 flex items-center justify-center">
      <p className="text-sm" style={{ color: "rgba(235,235,245,0.3)" }}>Pas encore de données</p>
    </div>
  );
}

function ExerciseWeightCard({
  title,
  exercises,
}: {
  title: string;
  exercises: { name: string; weight: number; sets: number; reps: number }[];
}) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "#1C1C1E", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="px-4 pt-3 pb-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <p className="text-xs uppercase tracking-widest" style={{ color: "rgba(235,235,245,0.3)" }}>{title}</p>
      </div>
      {exercises.map((ex, i) => (
        <div key={ex.name}>
          {i > 0 && <div className="mx-4 h-px" style={{ background: "rgba(255,255,255,0.04)" }} />}
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm font-medium" style={{ color: "rgba(235,235,245,0.85)" }}>{ex.name}</span>
            <div className="flex items-baseline gap-2">
              <span className="text-xs" style={{ color: "rgba(235,235,245,0.25)" }}>
                {ex.sets}×{ex.reps}
              </span>
              <span className="font-display text-lg leading-none" style={{ color: "#FF9F0A" }}>
                {ex.weight > 0 ? (
                  <>{ex.weight}<span className="text-xs ml-0.5" style={{ color: "#FF9F0A", opacity: 0.6 }}>kg</span></>
                ) : (
                  <span className="text-sm" style={{ color: "rgba(235,235,245,0.25)" }}>PC</span>
                )}
              </span>
            </div>
          </div>
        </div>
      ))}
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
    .map(([week, km]) => ({ week, km: Math.round(km * 10) / 10 }));
}

function getLastWeightsPerExercise(sessions: FitnessSession[]) {
  const upper = new Map<string, { weight: number; sets: number; reps: number }>();
  const lower = new Map<string, { weight: number; sets: number; reps: number }>();

  const sorted = [...sessions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  for (const s of sorted) {
    const map = s.category === "upper" ? upper : lower;
    for (const ex of s.exercises) {
      if (!map.has(ex.name)) {
        map.set(ex.name, { weight: ex.weight, sets: ex.sets, reps: ex.reps });
      }
    }
  }

  return {
    upper: Array.from(upper.entries()).map(([name, v]) => ({ name, ...v })),
    lower: Array.from(lower.entries()).map(([name, v]) => ({ name, ...v })),
  };
}
