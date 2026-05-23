"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { seedLocalStorage, clearSeedData } from "@/lib/seedData";

export default function DevPage() {
  const router = useRouter();

  const handleSeed = () => {
    seedLocalStorage();
    router.push("/");
  };

  const handleClear = () => {
    clearSeedData();
    router.push("/");
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-6 p-8"
      style={{ background: "#0d0d0d" }}
    >
      <h1 className="font-display text-3xl" style={{ color: "#CDFF00" }}>
        DEV TOOLS
      </h1>
      <p className="text-xs text-center" style={{ color: "#444" }}>
        Données de test pour le développement local.
      </p>

      <div className="w-full max-w-xs space-y-3 mt-4">
        <button
          onClick={handleSeed}
          className="w-full py-4 rounded-2xl font-bold text-sm press-effect"
          style={{ background: "#CDFF00", color: "#000" }}
        >
          Charger données de test
        </button>

        <button
          onClick={handleClear}
          className="w-full py-4 rounded-2xl font-bold text-sm press-effect"
          style={{
            background: "#1a1a1a",
            color: "#ff4444",
            border: "1px solid rgba(255,68,68,0.2)",
          }}
        >
          Vider les données
        </button>
      </div>

      <div className="mt-8 text-xs text-center space-y-1" style={{ color: "#333" }}>
        <p>Scénario chargé :</p>
        <p>• 13 semaines (7 passées + courante + 5 futures)</p>
        <p>• Run : rotation 5 types (z2 / fractionné / progressif / tempo / course)</p>
        <p>• Fitness : upper lun / lower mer — même alternance chaque semaine</p>
        <p>• Séances w=1→5 complétées → streak 5 semaines</p>
        <p>• Semaine courante : jours passés faits, reste à venir</p>
      </div>

      <Link
        href="/dev/components"
        className="w-full max-w-xs py-4 rounded-2xl font-bold text-sm press-effect text-center block mt-2"
        style={{ background: "#1a1a1a", color: "#CDFF00", border: "1px solid rgba(205,255,0,0.15)" }}
      >
        Voir les composants →
      </Link>
    </div>
  );
}
