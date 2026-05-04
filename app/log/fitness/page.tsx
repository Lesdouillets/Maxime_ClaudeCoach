"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/contexts/SessionContext";

/**
 * Thin route: every fitness session — planned, in-progress, or archive — opens
 * in the global SessionSheet. This page just hands off to the context and
 * redirects home so the sheet is what the user sees.
 */
export default function LogFitness() {
  const router = useRouter();
  const session = useSession();
  const [noPlan, setNoPlan] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const d = params.get("date") ?? new Date().toISOString().slice(0, 10);
    const result = session.open(d, { originRoute: "/" });
    if (result === "no-plan") {
      setNoPlan(true);
      return;
    }
    router.replace("/");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!noPlan) return null;

  return (
    <div className="max-w-md mx-auto animate-fade-in pb-24">
      <div className="px-5 pt-12">
        <div className="rounded-2xl p-4" style={{ background: "#111", border: "1px solid #1a1a1a" }}>
          <p className="text-sm text-muted">Aucun plan coach pour cette date.</p>
          <button
            onClick={() => router.push("/")}
            className="mt-3 w-full py-2.5 rounded-xl text-sm press-effect"
            style={{ background: "transparent", border: "1px solid #1a1a1a", color: "#888" }}
          >
            Retour
          </button>
        </div>
      </div>
    </div>
  );
}
