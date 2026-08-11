// deno test supabase/functions/_shared/athleteProfile.test.ts

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  formatAthleteLine,
  formatHeartRateZones,
  validateMaxHr,
} from "./athleteProfile.ts";

Deno.test("un profil vide rend la ligne d'origine, mot pour mot", () => {
  assertEquals(
    formatAthleteLine({}),
    "- 33 ans | 1,83 m | ~75 kg → objectif 74 kg",
  );
});

Deno.test("un profil rempli remplace chaque valeur, virgule décimale comprise", () => {
  assertEquals(
    formatAthleteLine({
      ageYears: 34,
      heightCm: 183,
      weightKg: 76.2,
      targetWeightKg: 74,
    }),
    "- 34 ans | 1,83 m | 76,2 kg → objectif 74 kg",
  );
});

Deno.test("une pesée datée perd le tilde de l'approximation", () => {
  assertEquals(formatAthleteLine({ weightKg: 75 }).includes("~"), false);
  assertEquals(formatAthleteLine({}).includes("~75 kg"), true);
});

Deno.test("chaque champ retombe seul sur sa valeur d'origine", () => {
  assertEquals(
    formatAthleteLine({ weightKg: 76 }),
    "- 33 ans | 1,83 m | 76 kg → objectif 74 kg",
  );
});

Deno.test("sans FC max retenue, le bloc des zones est celui d'origine", () => {
  assertEquals(
    formatHeartRateZones(undefined),
    "## ZONES FC (FC max ~187 bpm)\n" +
      "- Z1 < 112 bpm | Z2 112–149 | Z3 149–168 | Z4 168–178 | Z5 > 178",
  );
});

Deno.test("une FC max retenue recalcule les cinq zones", () => {
  assertEquals(
    formatHeartRateZones(190),
    "## ZONES FC (FC max 190 bpm)\n" +
      "- Z1 < 114 bpm | Z2 114–152 | Z3 152–171 | Z4 171–181 | Z5 > 181",
  );
});

Deno.test("une FC max aberrante est ignorée, pas appliquée", () => {
  // Le coach écrit la mémoire : une valeur folle déplacerait toutes les zones.
  assertEquals(validateMaxHr(250), undefined);
  assertEquals(validateMaxHr(40), undefined);
  assertEquals(validateMaxHr("beaucoup"), undefined);
  assertEquals(validateMaxHr(null), undefined);
  assertEquals(formatHeartRateZones(250).includes("~187"), true);
});

Deno.test("les bornes plausibles sont acceptées", () => {
  assertEquals(validateMaxHr(150), 150);
  assertEquals(validateMaxHr(210), 210);
  assertEquals(validateMaxHr(191.4), 191);
});
