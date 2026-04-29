"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { Exercise, FitnessSession, FitnessCategory, SetLog } from "@/lib/types";
import type { CoachWorkout } from "@/lib/coachPlan";
import { getCoachWorkouts, deleteCoachWorkout } from "@/lib/coachPlan";
import {
  addSession,
  clearInProgressFitness,
  generateId,
  getInProgressFitness,
  getSessions,
  setInProgressFitness,
} from "@/lib/storage";
import { autoSyncPush } from "@/lib/sync";
import { analyzeSession, type CoachAnalysisResult } from "@/lib/coachAnalyzer";
import { useTimer } from "./TimerContext";

const META_KEY_PREFIX = "cc_session_meta_";
const ACTIVE_KEY = "cc_active_session_date";

export interface LiveExercise extends Exercise {
  restSeconds?: number;
  coachNote?: string;
}

interface SessionMeta {
  category: FitnessCategory;
  coachWorkoutId: string | null;
}

interface SessionState {
  date: string;
  category: FitnessCategory;
  coachWorkoutId: string | null;
  exercises: LiveExercise[];
  activeExIdx: number;
}

export type SessionView = "hidden" | "expanded" | "minimized";

export interface FinishingState {
  status: "idle" | "confirm" | "saving" | "analyzing" | "done" | "error";
  result?: CoachAnalysisResult | null;
  session?: FitnessSession | null;
}

export interface SessionContextValue {
  state: SessionState | null;
  view: SessionView;
  finishing: FinishingState;

  open: (date: string) => "ok" | "no-plan" | "already-done" | "another-active";
  expand: () => void;
  minimize: () => void;
  close: () => void;
  /**
   * Throws away every set/note the user has logged for the active session
   * without saving anything, and re-hydrates the sheet from the coach plan in
   * its fresh state. If the coach plan no longer exists, the sheet is closed.
   */
  abandon: () => void;
  retryAnalysis: () => Promise<void>;

  setActiveIdx: (idx: number) => void;
  updateSet: (exId: string, idx: number, patch: Partial<SetLog>) => void;
  validateSet: (exId: string, idx: number) => void;
  unvalidateSet: (exId: string, idx: number) => void;
  addSet: (exId: string) => void;
  removeExercise: (exId: string) => void;
  setNote: (exId: string, note: string) => void;
  setRest: (exId: string, restSec: number) => void;

  requestFinish: () => void;
  cancelFinish: () => void;
  confirmFinish: () => Promise<void>;
  resetFinishing: () => void;
}

const SessionCtx = createContext<SessionContextValue | null>(null);

function loadMeta(date: string): SessionMeta | null {
  try {
    const raw = localStorage.getItem(META_KEY_PREFIX + date);
    return raw ? (JSON.parse(raw) as SessionMeta) : null;
  } catch {
    return null;
  }
}

function saveMeta(date: string, meta: SessionMeta): void {
  try {
    localStorage.setItem(META_KEY_PREFIX + date, JSON.stringify(meta));
  } catch {}
}

function clearMeta(date: string): void {
  try {
    localStorage.removeItem(META_KEY_PREFIX + date);
  } catch {}
}

function exerciseFromCoach(ce: CoachWorkout["exercises"][number]): LiveExercise {
  const setLogs: SetLog[] = ce.setPlans && ce.setPlans.length > 0
    ? ce.setPlans.map((sp) => ({ weight: sp.weight, reps: sp.reps, done: false }))
    : Array.from({ length: ce.sets }, () => ({ weight: ce.weight, reps: ce.reps, done: false }));
  return {
    id: generateId(),
    name: ce.name,
    sets: setLogs.length,
    reps: ce.reps,
    weight: ce.weight,
    comment: "",
    setLogs,
    restSeconds: ce.restSeconds,
    coachNote: ce.coachNote,
  };
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SessionState | null>(null);
  const stateRef = useRef<SessionState | null>(null);
  const [view, setView] = useState<SessionView>("hidden");
  const [finishing, setFinishing] = useState<FinishingState>({ status: "idle" });
  const { startTimer, stopTimer } = useTimer();

  // Keep a ref in sync with the latest state for callbacks that need to read it
  // without triggering re-creation via deps.
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // On mount, restore any in-progress session that was minimized when the user reloaded.
  useEffect(() => {
    let activeDate: string | null = null;
    try { activeDate = localStorage.getItem(ACTIVE_KEY); } catch {}
    if (!activeDate) return;
    const meta = loadMeta(activeDate);
    const inProgress = getInProgressFitness(activeDate);
    if (!meta || !inProgress) {
      try { localStorage.removeItem(ACTIVE_KEY); } catch {}
      return;
    }
    setState({
      date: activeDate,
      category: meta.category,
      coachWorkoutId: meta.coachWorkoutId,
      exercises: inProgress.exercises as LiveExercise[],
      activeExIdx: inProgress.activeExIdx,
    });
    setView("minimized");
  }, []);

  // Persist live state on every change
  useEffect(() => {
    if (!state) return;
    setInProgressFitness(state.date, {
      exercises: state.exercises,
      activeExIdx: state.activeExIdx,
    });
    saveMeta(state.date, {
      category: state.category,
      coachWorkoutId: state.coachWorkoutId,
    });
    try { localStorage.setItem(ACTIVE_KEY, state.date); } catch {}
  }, [state]);

  const open = useCallback<SessionContextValue["open"]>((date) => {
    // If a session is already in flight, expand it. If it's for a different date,
    // refuse — the user must finish or close the existing one before starting a new one.
    const current = stateRef.current;
    if (current) {
      if (current.date === date) {
        setView("expanded");
        return "ok";
      }
      setView("expanded");
      return "another-active";
    }

    // If a session for this date already exists in storage, refuse: it's an archive view.
    const existing = getSessions().some(
      (s) => s.type === "fitness" && s.date.slice(0, 10) === date
    );
    if (existing) return "already-done";

    const plan = getCoachWorkouts().find((w) => w.date === date) ?? null;
    if (!plan) return "no-plan";

    // Resume in-progress if present, else hydrate from coach plan
    const inProgress = getInProgressFitness(date);

    const exercises: LiveExercise[] = inProgress && inProgress.exercises.length > 0
      ? (inProgress.exercises as LiveExercise[])
      : plan.exercises.map(exerciseFromCoach);

    setState({
      date,
      category: plan.category,
      coachWorkoutId: plan.id,
      exercises,
      activeExIdx: inProgress?.activeExIdx ?? 0,
    });
    setView("expanded");
    setFinishing({ status: "idle" });
    return "ok";
  }, []);

  const expand = useCallback(() => {
    setView((v) => (v === "hidden" ? v : "expanded"));
  }, []);

  const minimize = useCallback(() => {
    setView((v) => (v === "hidden" ? v : "minimized"));
  }, []);

  const close = useCallback(() => {
    if (state) {
      clearInProgressFitness(state.date);
      clearMeta(state.date);
    }
    try { localStorage.removeItem(ACTIVE_KEY); } catch {}
    setState(null);
    setView("hidden");
    setFinishing({ status: "idle" });
  }, [state]);

  const abandon = useCallback(() => {
    const current = stateRef.current;
    if (!current) return;
    // Wipe live state so nothing gets saved or analysed
    clearInProgressFitness(current.date);
    clearMeta(current.date);
    try { localStorage.removeItem(ACTIVE_KEY); } catch {}
    setFinishing({ status: "idle" });

    // Re-hydrate from the coach plan if it still exists, so the sheet shows
    // the original exercises with all sets unvalidated.
    const plan = getCoachWorkouts().find((w) => w.date === current.date) ?? null;
    if (!plan) {
      setState(null);
      setView("hidden");
      return;
    }
    setState({
      date: current.date,
      category: plan.category,
      coachWorkoutId: plan.id,
      exercises: plan.exercises.map(exerciseFromCoach),
      activeExIdx: 0,
    });
  }, []);

  const setActiveIdx = useCallback((idx: number) => {
    setState((prev) => prev ? { ...prev, activeExIdx: idx } : prev);
  }, []);

  const updateSet = useCallback<SessionContextValue["updateSet"]>((exId, idx, patch) => {
    setState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        exercises: prev.exercises.map((ex) => {
          if (ex.id !== exId || !ex.setLogs) return ex;
          return {
            ...ex,
            setLogs: ex.setLogs.map((s, i) => i === idx ? { ...s, ...patch } : s),
          };
        }),
      };
    });
  }, []);

  const validateSet = useCallback<SessionContextValue["validateSet"]>((exId, idx) => {
    setState((prev) => {
      if (!prev) return prev;
      const exIdx = prev.exercises.findIndex((e) => e.id === exId);
      if (exIdx < 0) return prev;
      const next: SessionState = {
        ...prev,
        exercises: prev.exercises.map((ex) => {
          if (ex.id !== exId || !ex.setLogs) return ex;
          return {
            ...ex,
            setLogs: ex.setLogs.map((s, i) => i === idx ? { ...s, done: true } : s),
          };
        }),
      };
      const ex = next.exercises[exIdx];
      const allDone = ex.setLogs?.every((s) => s.done) ?? false;
      if (allDone && exIdx === prev.activeExIdx) {
        const nextIdx = next.exercises.findIndex(
          (e, i) => i > exIdx && (!e.setLogs || e.setLogs.some((s) => !s.done))
        );
        if (nextIdx >= 0) next.activeExIdx = nextIdx;
      }
      return next;
    });

    const ex = stateRef.current?.exercises.find((e) => e.id === exId);
    const rest = ex?.restSeconds ?? 90;
    startTimer(`${exId}-set-${idx}`, rest);
  }, [startTimer]);

  const unvalidateSet = useCallback<SessionContextValue["unvalidateSet"]>((exId, idx) => {
    setState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        exercises: prev.exercises.map((ex) => {
          if (ex.id !== exId || !ex.setLogs) return ex;
          return {
            ...ex,
            setLogs: ex.setLogs.map((s, i) => i === idx ? { ...s, done: false } : s),
          };
        }),
      };
    });
  }, []);

  const addSet = useCallback<SessionContextValue["addSet"]>((exId) => {
    setState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        exercises: prev.exercises.map((ex) => {
          if (ex.id !== exId) return ex;
          const last = ex.setLogs?.[ex.setLogs.length - 1];
          const newLog: SetLog = last
            ? { weight: last.weight, reps: last.reps, done: false }
            : { weight: ex.weight, reps: ex.reps, done: false };
          const setLogs = [...(ex.setLogs ?? []), newLog];
          return { ...ex, sets: setLogs.length, setLogs };
        }),
      };
    });
  }, []);

  const removeExercise = useCallback<SessionContextValue["removeExercise"]>((exId) => {
    setState((prev) => {
      if (!prev) return prev;
      const idx = prev.exercises.findIndex((e) => e.id === exId);
      const exercises = prev.exercises.filter((e) => e.id !== exId);
      let activeExIdx = prev.activeExIdx;
      if (idx >= 0 && idx <= prev.activeExIdx) {
        activeExIdx = Math.max(0, prev.activeExIdx - (idx === prev.activeExIdx ? 0 : 1));
      }
      if (activeExIdx >= exercises.length) activeExIdx = Math.max(0, exercises.length - 1);
      return { ...prev, exercises, activeExIdx };
    });
  }, []);

  const setNote = useCallback<SessionContextValue["setNote"]>((exId, note) => {
    setState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        exercises: prev.exercises.map((ex) =>
          ex.id === exId ? { ...ex, comment: note } : ex
        ),
      };
    });
  }, []);

  const setRest = useCallback<SessionContextValue["setRest"]>((exId, restSec) => {
    setState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        exercises: prev.exercises.map((ex) =>
          ex.id === exId ? { ...ex, restSeconds: Math.max(0, restSec) } : ex
        ),
      };
    });
  }, []);

  const requestFinish = useCallback(() => {
    setFinishing({ status: "confirm" });
  }, []);

  const cancelFinish = useCallback(() => {
    setFinishing((f) => f.status === "confirm" ? { status: "idle" } : f);
  }, []);

  const resetFinishing = useCallback(() => {
    setFinishing({ status: "idle" });
  }, []);

  const confirmFinish = useCallback(async () => {
    if (!state) return;
    setFinishing({ status: "saving" });

    const finalExercises: Exercise[] = state.exercises.map((ex) => {
      if (!ex.setLogs?.length) return ex;
      const done = ex.setLogs.filter((s) => s.done);
      if (done.length === 0) return ex;
      const avgWeight = done.reduce((sum, s) => sum + s.weight, 0) / done.length;
      const avgReps = done.reduce((sum, s) => sum + s.reps, 0) / done.length;
      return {
        ...ex,
        sets: done.length,
        reps: Math.round(avgReps),
        weight: Math.round(avgWeight * 2) / 2,
      };
    });

    const session: FitnessSession = {
      id: generateId(),
      type: "fitness",
      date: new Date(state.date + "T12:00:00").toISOString(),
      category: state.category,
      comment: "",
      exercises: finalExercises,
      coachWorkoutId: state.coachWorkoutId ?? undefined,
    };
    addSession(session);
    autoSyncPush();
    stopTimer();

    // Clear in-progress storage; keep session state alive so the UI shows "analyzing"
    clearInProgressFitness(state.date);
    clearMeta(state.date);
    try { localStorage.removeItem(ACTIVE_KEY); } catch {}

    // Snapshot the coach plan BEFORE analysis: if the analyzer rewrites the same id
    // in-place (addCoachWorkout dedup-by-id replaces it), we must NOT delete it
    // afterwards, otherwise the just-applied modification is lost.
    const planSnapshot = state.coachWorkoutId
      ? JSON.stringify(getCoachWorkouts().find((w) => w.id === state.coachWorkoutId) ?? null)
      : null;

    setFinishing({ status: "analyzing", session, result: null });

    try {
      const result = await analyzeSession(session);
      if (state.coachWorkoutId) {
        const currentPlan = getCoachWorkouts().find((w) => w.id === state.coachWorkoutId);
        const currentJson = currentPlan ? JSON.stringify(currentPlan) : null;
        // Only delete if the plan still exists AND is byte-identical to what we sent
        // — i.e. the coach didn't rewrite it.
        if (currentJson !== null && currentJson === planSnapshot) {
          deleteCoachWorkout(state.coachWorkoutId);
        }
      }
      // analyzeSession returns null on failure (it never throws), so a null result
      // is the error path, not a successful one.
      if (result === null) {
        setFinishing({ status: "error", session, result: null });
      } else {
        setFinishing({ status: "done", session, result });
      }
    } catch {
      setFinishing({ status: "error", session, result: null });
    }
  }, [state, stopTimer]);

  const retryAnalysis = useCallback(async () => {
    const saved = finishing.session;
    if (!saved) return;
    setFinishing({ status: "analyzing", session: saved, result: null });
    try {
      const result = await analyzeSession(saved);
      if (result === null) {
        setFinishing({ status: "error", session: saved, result: null });
      } else {
        setFinishing({ status: "done", session: saved, result });
      }
    } catch {
      setFinishing({ status: "error", session: saved, result: null });
    }
  }, [finishing.session]);

  return (
    <SessionCtx.Provider
      value={{
        state,
        view,
        finishing,
        open,
        expand,
        minimize,
        close,
        abandon,
        setActiveIdx,
        updateSet,
        validateSet,
        unvalidateSet,
        addSet,
        removeExercise,
        setNote,
        setRest,
        requestFinish,
        cancelFinish,
        confirmFinish,
        resetFinishing,
        retryAnalysis,
      }}
    >
      {children}
    </SessionCtx.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionCtx);
  if (!ctx) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return ctx;
}
