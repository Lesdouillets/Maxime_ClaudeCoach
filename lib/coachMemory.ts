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
    maxHr?: number;         // bpm — écrit par le coach seul, jamais par l'utilisateur
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
  const withDate = { ...memory, lastUpdated: now, keyNotes: memory.keyNotes.slice(-50) };
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
    keyNotes: [...current.keyNotes, ...(Array.isArray(update.keyNotes) ? update.keyNotes : [])],
  };
  setCoachMemory(merged);
}
