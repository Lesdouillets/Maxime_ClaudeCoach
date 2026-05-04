"use client";

import { createContext, useCallback, useContext, useState } from "react";

export type RunSheetView = "hidden" | "expanded" | "minimized";

interface RunSheetState {
  date: string | null;
  originRoute: string;
}

export interface RunSheetContextValue {
  state: RunSheetState | null;
  view: RunSheetView;
  open: (date: string | null, opts?: { originRoute?: string }) => void;
  close: () => void;
  expand: () => void;
  minimize: () => void;
}

const RunSheetCtx = createContext<RunSheetContextValue | null>(null);

export function RunSheetProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<RunSheetState | null>(null);
  const [view, setView] = useState<RunSheetView>("hidden");

  const open = useCallback<RunSheetContextValue["open"]>((date, opts) => {
    const originRoute =
      opts?.originRoute ??
      (typeof window !== "undefined"
        ? window.location.pathname + window.location.search
        : "/");
    setState({ date, originRoute });
    setView("expanded");
  }, []);

  const close = useCallback(() => {
    setState(null);
    setView("hidden");
  }, []);

  const expand = useCallback(() => {
    setView((v) => (v === "hidden" ? v : "expanded"));
  }, []);

  const minimize = useCallback(() => {
    setView((v) => (v === "hidden" ? v : "minimized"));
  }, []);

  return (
    <RunSheetCtx.Provider value={{ state, view, open, close, expand, minimize }}>
      {children}
    </RunSheetCtx.Provider>
  );
}

export function useRunSheet(): RunSheetContextValue {
  const ctx = useContext(RunSheetCtx);
  if (!ctx) {
    throw new Error("useRunSheet must be used within a RunSheetProvider");
  }
  return ctx;
}
