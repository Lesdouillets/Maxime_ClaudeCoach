"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { exchangeCodeForTokens } from "@/lib/strava";
import { saveStravaTokens } from "@/lib/storage";
import { Suspense } from "react";

function StravaCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error === "access_denied") {
      setStatus("error");
      setErrorMessage("Accès refusé. Tu as annulé la connexion Strava.");
      return;
    }

    if (!code) {
      setStatus("error");
      setErrorMessage("Code d'autorisation manquant.");
      return;
    }

    exchangeCodeForTokens(code)
      .then((tokens) => {
        saveStravaTokens(tokens);
        setStatus("success");
        setTimeout(() => router.push("/"), 2000);
      })
      .catch((err) => {
        setStatus("error");
        setErrorMessage(
          err instanceof Error ? err.message : "Erreur lors de la connexion Strava."
        );
      });
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      {status === "loading" && (
        <div className="space-y-4">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
            style={{
              background: "rgba(252,76,2,0.15)",
              border: "2px solid rgba(252,76,2,0.3)",
              animation: "pulse-neon 1.5s ease-in-out infinite",
            }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="#ff6b00">
              <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066l-2.084 4.116zM11.648 13.828L8.966 8H6.58l5.069 10 5.069-10h-2.386z"/>
            </svg>
          </div>
          <h2 className="font-display text-3xl">CONNEXION EN COURS</h2>
          <p className="text-muted text-sm">Échange du token Strava...</p>
        </div>
      )}

      {status === "success" && (
        <div className="space-y-4 animate-slide-up">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
            style={{
              background: "rgba(57,255,20,0.15)",
              border: "2px solid rgba(57,255,20,0.4)",
              boxShadow: "0 0 30px rgba(57,255,20,0.2)",
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M5 13L9 17L19 7" stroke="#39ff14" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h2 className="font-display text-3xl text-neon-glow" style={{ color: "#39ff14" }}>
            STRAVA CONNECTÉ
          </h2>
          <p className="text-muted text-sm">
            Tes activités seront synchronisées automatiquement.
          </p>
          <p className="text-xs text-muted">Redirection vers le dashboard...</p>
        </div>
      )}

      {status === "error" && (
        <div className="space-y-4 animate-slide-up">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
            style={{
              background: "rgba(255,107,0,0.15)",
              border: "2px solid rgba(255,107,0,0.4)",
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M12 9V13M12 17H12.01M21 12C21 16.971 16.971 21 12 21C7.029 21 3 16.971 3 12C3 7.029 7.029 3 12 3C16.971 3 21 7.029 21 12Z"
                stroke="#ff6b00" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <h2 className="font-display text-3xl" style={{ color: "#ff6b00" }}>
            ERREUR
          </h2>
          <p className="text-sm text-gray-400 max-w-xs">{errorMessage}</p>
          <p className="text-xs text-muted mt-2 max-w-xs">
            Note: Si tu utilises l'app en static (GitHub Pages), l'échange de token Strava
            nécessite que NEXT_PUBLIC_STRAVA_CLIENT_SECRET soit défini, ou un proxy backend.
          </p>
          <button
            onClick={() => router.push("/")}
            className="mt-4 px-6 py-3 rounded-xl font-bold text-sm press-effect"
            style={{
              background: "#ff6b00",
              color: "white",
            }}
          >
            Retour au dashboard
          </button>
        </div>
      )}
    </div>
  );
}

export default function StravaCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-muted">Chargement...</p>
        </div>
      }
    >
      <StravaCallbackInner />
    </Suspense>
  );
}
