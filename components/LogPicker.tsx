"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getTodayPlan } from "@/lib/plan";

interface LogPickerProps {
  onClose: () => void;
}

export default function LogPicker({ onClose }: LogPickerProps) {
  const router = useRouter();
  const todayPlan = getTodayPlan();

  // Close on backdrop click or Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const go = (href: string) => {
    onClose();
    router.push(href);
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
        style={{ border: "1px solid rgba(255,255,255,0.1)" }}
      >
        {/* Run */}
        <button
          onClick={() => go("/log/run")}
          className="w-full flex items-center gap-4 p-5 press-effect"
          style={{
            background: todayPlan?.type === "run" ? "rgba(48,209,88,0.06)" : "#1C1C1E",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(48,209,88,0.12)" }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M13 4a1 1 0 1 0 2 0 1 1 0 0 0-2 0M5.5 16.5l2.5-3.5 3 2.5 3.5-5L17 14M3 20h18"
                stroke="#30D158" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="flex-1 text-left">
            <p className="font-semibold text-base">Run</p>
            <p className="text-xs" style={{ color: "rgba(235,235,245,0.4)" }}>Distance, allure, FC</p>
          </div>
          {todayPlan?.type === "run" && (
            <span
              className="text-[10px] font-semibold px-2 py-1 rounded-full"
              style={{ background: "rgba(48,209,88,0.15)", color: "#30D158", border: "1px solid rgba(48,209,88,0.3)" }}
            >
              Aujourd'hui
            </span>
          )}
        </button>

        {/* Renfo */}
        <button
          onClick={() => go("/log/fitness")}
          className="w-full flex items-center gap-4 p-5 press-effect"
          style={{ background: todayPlan?.type === "fitness" ? "rgba(255,159,10,0.05)" : "#1C1C1E" }}
        >
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(255,159,10,0.12)" }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M6.5 6.5h11M6.5 17.5h11M3 10h18M3 14h18"
                stroke="#FF9F0A" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="flex-1 text-left">
            <p className="font-semibold text-base">Renfo</p>
            <p className="text-xs" style={{ color: "rgba(235,235,245,0.4)" }}>Exercices, séries, poids</p>
          </div>
          {todayPlan?.type === "fitness" && (
            <span
              className="text-[10px] font-semibold px-2 py-1 rounded-full"
              style={{ background: "rgba(255,159,10,0.15)", color: "#FF9F0A", border: "1px solid rgba(255,159,10,0.3)" }}
            >
              Aujourd'hui
            </span>
          )}
        </button>
      </div>
    </>
  );
}
