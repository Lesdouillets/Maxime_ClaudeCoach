"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "cc_timer";

interface TimerStore {
  key: string;
  endTime: number;
  totalSec: number;
}

interface TimerContextValue {
  timerKey: string | null;
  timerSec: number;
  timerTotalSec: number;
  startTimer: (key: string, seconds: number) => void;
  stopTimer: () => void;
}

const TimerContext = createContext<TimerContextValue>({
  timerKey: null,
  timerSec: 0,
  timerTotalSec: 0,
  startTimer: () => {},
  stopTimer: () => {},
});

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const [timerKey, setTimerKey] = useState<string | null>(null);
  const [timerSec, setTimerSec] = useState(0);
  const [timerTotalSec, setTimerTotalSec] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endTimeRef = useRef<number | null>(null);

  const clearTimer = () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    endTimeRef.current = null;
  };

  const tick = () => {
    if (endTimeRef.current === null) return;
    const remaining = Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000));
    setTimerSec(remaining);
    if (remaining <= 0) {
      clearTimer();
      setTimerKey(null);
      setTimerTotalSec(0);
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
    }
  };

  const startTimer = (key: string, seconds: number) => {
    clearTimer();
    const endTime = Date.now() + seconds * 1000;
    endTimeRef.current = endTime;
    setTimerKey(key);
    setTimerSec(seconds);
    setTimerTotalSec(seconds);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ key, endTime, totalSec: seconds } satisfies TimerStore)); } catch {}
    intervalRef.current = setInterval(tick, 500);
  };

  const stopTimer = () => {
    clearTimer();
    setTimerKey(null);
    setTimerSec(0);
    setTimerTotalSec(0);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<TimerStore>;
        const key = parsed.key;
        const endTime = parsed.endTime;
        const totalSec = parsed.totalSec ?? 0;
        if (key && endTime && endTime > Date.now()) {
          endTimeRef.current = endTime;
          setTimerKey(key);
          const remaining = Math.ceil((endTime - Date.now()) / 1000);
          setTimerSec(remaining);
          setTimerTotalSec(totalSec || remaining);
          intervalRef.current = setInterval(tick, 500);
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch {}
    return clearTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <TimerContext.Provider value={{ timerKey, timerSec, timerTotalSec, startTimer, stopTimer }}>
      {children}
    </TimerContext.Provider>
  );
}

export const useTimer = () => useContext(TimerContext);
