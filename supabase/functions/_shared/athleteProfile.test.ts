// deno test supabase/functions/_shared/athleteProfile.test.ts

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  exceedingMaxHr,
  formatAthleteLine,
  formatHeartRateZones,
  loadAthleteProfile,
  validateMaxHr,
} from "./athleteProfile.ts";

/// Un client Supabase de façade : chaque méthode de la chaîne se renvoie
/// elle-même, et la promesse finale rend ce qu'on lui a donné pour la table.
function fakeClient(
  byTable: Record<string, { data?: unknown; error?: { message: string } }>,
) {
  return {
    from(table: string) {
      const result = byTable[table] ?? { data: null };
      const chain: Record<string, unknown> = {};
      for (const method of ["select", "eq", "order", "limit"]) {
        chain[method] = () => chain;
      }
      chain.maybeSingle = () => Promise.resolve(result);
      return chain;
    },
  };
}

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

Deno.test("une taille ou un âge hors de portée humaine retombe sur le repli", () => {
  // Une frappe de trop dans les réglages, pas une mesure.
  assertEquals(
    formatAthleteLine({ ageYears: -7973, heightCm: 18300 }),
    "- 33 ans | 1,83 m | ~75 kg → objectif 74 kg",
  );
});

Deno.test("une taille ronde garde ses deux décimales", () => {
  assertEquals(
    formatAthleteLine({ heightCm: 180 }),
    "- 33 ans | 1,80 m | ~75 kg → objectif 74 kg",
  );
});

Deno.test("sans identifiants, aucune requête n'est faite", async () => {
  let called = false;
  const client = {
    from() {
      called = true;
      throw new Error("ne devrait pas être appelé");
    },
  };

  assertEquals(await loadAthleteProfile(client, undefined, "p1"), {});
  assertEquals(await loadAthleteProfile(client, "u1", undefined), {});
  assertEquals(called, false);
});

Deno.test("une lecture en échec rend un profil vide, pas des valeurs fausses", async () => {
  const client = fakeClient({
    profiles: { error: { message: "column does not exist" } },
    weight_entries: { error: { message: "permission denied" } },
  });

  const profile = await loadAthleteProfile(client, "u1", "p1");

  assertEquals(profile, {
    ageYears: undefined,
    heightCm: undefined,
    targetWeightKg: undefined,
    weightKg: undefined,
  });
  // Et le prompt reste celui d'avant plutôt qu'un mélange.
  assertEquals(
    formatAthleteLine(profile),
    "- 33 ans | 1,83 m | ~75 kg → objectif 74 kg",
  );
});

Deno.test("les colonnes nulles et les zéros ne comptent pas pour des mesures", async () => {
  const client = fakeClient({
    profiles: { data: { birth_year: null, height_cm: 0, target_weight_kg: 0 } },
    weight_entries: { data: { kg: 0 } },
  });

  const profile = await loadAthleteProfile(client, "u1", "p1");

  assertEquals(profile.heightCm, undefined);
  assertEquals(profile.targetWeightKg, undefined);
  // Zéro ne doit pas passer pour une pesée : sinon le poids appris en
  // conversation serait masqué au profit d'un « 0 kg ».
  assertEquals(profile.weightKg, undefined);
});

Deno.test("un profil rempli en base ressort tel quel", async () => {
  const client = fakeClient({
    profiles: {
      data: { birth_year: 1992, height_cm: 183, target_weight_kg: "73.5" },
    },
    weight_entries: { data: { kg: "75.8" } },
  });

  const profile = await loadAthleteProfile(client, "u1", "p1");

  assertEquals(profile.heightCm, 183);
  assertEquals(profile.targetWeightKg, 73.5);
  assertEquals(profile.weightKg, 75.8);
  assertEquals(profile.ageYears, new Date().getFullYear() - 1992);
});

Deno.test("le marqueur FC max n'apparaît qu'au-dessus de la valeur supposée", () => {
  const laps = [{ max_heartrate: 174 }, { max_heartrate: 168 }];

  assertEquals(exceedingMaxHr(laps, 187), undefined);
  assertEquals(exceedingMaxHr([...laps, { max_heartrate: 191 }], 187), 191);
});

Deno.test("des fractions absentes ou sans FC ne déclenchent rien", () => {
  assertEquals(exceedingMaxHr(undefined, 187), undefined);
  assertEquals(exceedingMaxHr([], 187), undefined);
  assertEquals(exceedingMaxHr([{ distance: 1000 }], 187), undefined);
});
