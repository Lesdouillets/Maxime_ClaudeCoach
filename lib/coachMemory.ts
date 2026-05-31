const MEMORY_KEY = "cc_coach_memory";
const MEMORY_UPDATED_AT_KEY = "cc_coach_memory_updated_at";

export interface CoachMemory {
  lastUpdated: string; // "YYYY-MM-DD"
  run: {
    trend?: string;        // ex: "FC Z2 en baisse sur 6 sem (152→139bpm)"
    lastLongRun?: string;  // ex: "14km Z2 le 26/05"
    nextRace?: string;     // ex: "10km le 28 juin 2026"
    notes?: string;        // ex: "Genou droit sensible depuis mai"
  };
  fitness: {
    cycle?: string; // ex: "Semaine 2/4 de charge"
    upperBody?: {
      lastSession?: string;
      keyLifts?: Record<string, string>; // ex: {"Développé couché": "18kg×3×8 — stable"}
    };
    lowerBody?: {
      lastSession?: string;
      keyLifts?: Record<string, string>;
    };
  };
  body: {
    currentWeight?: number; // kg
    trend?: string;         // ex: "−0.2kg/semaine"
    target?: number;        // kg
  };
  keyNotes: Array<{
    date: string; // "YYYY-MM-DD"
    note: string;
  }>;
}

const EMPTY_MEMORY: CoachMemory = {
  lastUpdated: "",
  run: {},
  fitness: {},
  body: {},
  keyNotes: [],
};

export function getCoachMemory(): CoachMemory {
  if (typeof window === "undefined") return { ...EMPTY_MEMORY };
  try {
    const raw = localStorage.getItem(MEMORY_KEY);
    if (!raw) return { ...EMPTY_MEMORY };
    return JSON.parse(raw) as CoachMemory;
  } catch {
    return { ...EMPTY_MEMORY };
  }
}

export function setCoachMemory(memory: CoachMemory): void {
  if (typeof window === "undefined") return;
  const now = new Date().toISOString().slice(0, 10);
  const withDate = { ...memory, lastUpdated: now };
  localStorage.setItem(MEMORY_KEY, JSON.stringify(withDate));
  localStorage.setItem(MEMORY_UPDATED_AT_KEY, new Date().toISOString());
}

// Merge partiel — les champs fournis écrasent les champs existants (shallow merge par sous-objet).
// keyNotes s'accumule (append). lastUpdated est mis à jour automatiquement.
export function mergeCoachMemory(
  update: Partial<Omit<CoachMemory, "lastUpdated">>
): void {
  const current = getCoachMemory();
  const merged: CoachMemory = {
    ...current,
    run: { ...current.run, ...update.run },
    fitness: {
      cycle: update.fitness?.cycle ?? current.fitness?.cycle,
      upperBody: update.fitness?.upperBody
        ? {
            lastSession:
              update.fitness.upperBody.lastSession ??
              current.fitness?.upperBody?.lastSession,
            keyLifts: {
              ...current.fitness?.upperBody?.keyLifts,
              ...update.fitness.upperBody.keyLifts,
            },
          }
        : current.fitness?.upperBody,
      lowerBody: update.fitness?.lowerBody
        ? {
            lastSession:
              update.fitness.lowerBody.lastSession ??
              current.fitness?.lowerBody?.lastSession,
            keyLifts: {
              ...current.fitness?.lowerBody?.keyLifts,
              ...update.fitness.lowerBody.keyLifts,
            },
          }
        : current.fitness?.lowerBody,
    },
    body: { ...current.body, ...update.body },
    keyNotes: [...current.keyNotes, ...(update.keyNotes ?? [])],
  };
  setCoachMemory(merged);
}

// Formatte la mémoire pour injection dans un system prompt — compact, quelques lignes.
// Retourne une chaîne vide si la mémoire est vide.
export function formatCoachMemoryForPrompt(memory: CoachMemory): string {
  const lines: string[] = [];

  const runParts: string[] = [];
  if (memory.run.trend) runParts.push(memory.run.trend);
  if (memory.run.lastLongRun)
    runParts.push(`Dernière sortie longue : ${memory.run.lastLongRun}`);
  if (memory.run.nextRace)
    runParts.push(`Prochaine course : ${memory.run.nextRace}`);
  if (memory.run.notes) runParts.push(`⚠️ ${memory.run.notes}`);
  if (runParts.length > 0) lines.push(`Run : ${runParts.join(" | ")}`);

  const fitParts: string[] = [];
  if (memory.fitness.cycle) fitParts.push(memory.fitness.cycle);
  if (memory.fitness.upperBody?.keyLifts) {
    const lifts = Object.entries(memory.fitness.upperBody.keyLifts)
      .map(([k, v]) => `${k} ${v}`)
      .join(", ");
    if (lifts) fitParts.push(`Upper: ${lifts}`);
  }
  if (memory.fitness.lowerBody?.keyLifts) {
    const lifts = Object.entries(memory.fitness.lowerBody.keyLifts)
      .map(([k, v]) => `${k} ${v}`)
      .join(", ");
    if (lifts) fitParts.push(`Lower: ${lifts}`);
  }
  if (fitParts.length > 0) lines.push(`Fitness : ${fitParts.join(" | ")}`);

  if (memory.body.currentWeight !== undefined) {
    const bodyParts: string[] = [`${memory.body.currentWeight}kg`];
    if (memory.body.target !== undefined)
      bodyParts.push(`objectif ${memory.body.target}kg`);
    if (memory.body.trend) bodyParts.push(`tendance ${memory.body.trend}`);
    lines.push(`Poids : ${bodyParts.join(", ")}`);
  }

  const recentNotes = memory.keyNotes.slice(-3);
  if (recentNotes.length > 0) {
    lines.push(
      `Notes : ${recentNotes.map((n) => `[${n.date}] ${n.note}`).join(" | ")}`
    );
  }

  if (lines.length === 0) return "";
  return `## Mémoire coach (contexte persistant)\n${lines.join("\n")}`;
}
