"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRunSheet } from "@/contexts/RunSheetContext";

interface LogPickerProps {
  onClose: () => void;
}

export default function LogPicker({ onClose }: LogPickerProps) {
  const router = useRouter();
  const runSheet = useRunSheet();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const openRun = () => {
    onClose();
    runSheet.open(null);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="fixed bottom-20 left-0 right-0 z-50 mx-4 rounded-2xl overflow-hidden animate-slide-up"
        style={{ border: "1px solid #222" }}
      >
        {/* Run */}
        <button
          onClick={openRun}
          className="w-full flex items-center gap-4 p-5 press-effect"
          style={{ background: "#111", borderBottom: "1px solid #1a1a1a" }}
        >
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(205,255,0,0.12)" }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M13 4a1 1 0 1 0 2 0 1 1 0 0 0-2 0M5.5 16.5l2.5-3.5 3 2.5 3.5-5L17 14M3 20h18"
                stroke="#CDFF00" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="flex-1 text-left">
            <p className="font-bold text-base">Run</p>
            <p className="text-xs text-muted">Distance, allure, FC</p>
          </div>
        </button>

        {/* Renfo */}
        <button
          onClick={() => { router.push("/log/fitness"); onClose(); }}
          className="w-full flex items-center gap-4 p-5 press-effect"
          style={{ background: "#111" }}
        >
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(208,121,0,0.12)" }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M6.5 6.5h11M6.5 17.5h11M3 10h18M3 14h18"
                stroke="#D07900" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="flex-1 text-left">
            <p className="font-bold text-base">Renfo</p>
            <p className="text-xs text-muted">Exercices, séries, poids</p>
          </div>
        </button>
      </div>
    </>
  );
}
