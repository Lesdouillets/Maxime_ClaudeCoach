// deno test supabase/functions/_shared/coachMemoryPrompt.test.ts
//
// Le bloc mémoire entre tel quel dans le prompt du coach. Le déplacer dans un
// module partagé ne doit pas en changer un caractère : ces tests comparent la
// nouvelle implémentation à une copie figée de l'ancienne.

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { formatCoachMemoryForPrompt } from "./coachMemoryPrompt.ts";
import { legacyCoachMemoryPrompt } from "./coachMemoryPrompt.legacy.ts";

/// Une mémoire réaliste, avec chaque branche du formateur remplie.
const fullMemory = {
  lastUpdated: "2026-08-10",
  run: {
    trend: "FC Z2 en baisse sur 6 sem (152→139bpm)",
    lastLongRun: "14km Z2 le 26/05",
    nextRace: "10km le 28 juin 2026",
    notes: "Genou droit sensible depuis mai",
  },
  fitness: {
    cycle: "Semaine 2/4 de charge",
    upperBody: {
      lastSession: "2026-08-04",
      keyLifts: { "Développé couché": "18kg×3×8 — stable", "Tirage": "60kg" },
    },
    lowerBody: { keyLifts: { "Squat": "80kg×4×6 — PR" } },
  },
  body: { currentWeight: 76, trend: "−0.2kg/semaine", target: 74 },
  keyNotes: [
    { date: "2026-05-02", note: "Objectif sub-50 sur 10km" },
    { date: "2026-06-11", note: "Reprise après repos" },
    { date: "2026-07-01", note: "Charge dos augmentée" },
    { date: "2026-08-01", note: "Sensation de fatigue" },
  ],
};

const noMeasuredWeight = {};

Deno.test("sans pesée en base, le bloc est identique à celui d'avant", () => {
  assertEquals(
    formatCoachMemoryForPrompt(fullMemory, noMeasuredWeight),
    legacyCoachMemoryPrompt(fullMemory),
  );
});

Deno.test("une mémoire vide reste vide, comme avant", () => {
  const empty = { run: {}, fitness: {}, body: {}, keyNotes: [] };

  assertEquals(formatCoachMemoryForPrompt(empty, noMeasuredWeight), "");
  assertEquals(legacyCoachMemoryPrompt(empty), "");
});

Deno.test("chaque section absente se comporte comme avant", () => {
  for (const partial of [
    { run: { trend: "FC stable" } },
    { fitness: { cycle: "Semaine 1/4" } },
    { body: { currentWeight: 76 } },
    { body: { currentWeight: 76, target: 74, trend: "−0.2kg/sem" } },
    { keyNotes: [{ date: "2026-08-01", note: "Test" }] },
  ]) {
    assertEquals(
      formatCoachMemoryForPrompt(partial, noMeasuredWeight),
      legacyCoachMemoryPrompt(partial),
      `divergence sur ${JSON.stringify(partial)}`,
    );
  }
});

Deno.test("un objectif connu n'est plus perdu faute de poids courant", () => {
  // L'ancienne version conditionnait toute la ligne à `currentWeight` : un
  // objectif seul disparaissait du prompt. Seul écart voulu.
  const targetOnly = { body: { target: 74 } };

  assertEquals(legacyCoachMemoryPrompt(targetOnly), "");
  assertEquals(
    formatCoachMemoryForPrompt(targetOnly, noMeasuredWeight),
    "## Mémoire coach (contexte persistant)\nPoids : objectif 74kg",
  );
});

Deno.test("un objectif déjà en base ne réapparaît pas dans la mémoire", () => {
  const rendered = formatCoachMemoryForPrompt(fullMemory, {
    weightKg: 75.8,
    targetWeightKg: 73.5,
  });

  assertEquals(rendered.includes("objectif"), false);
  assertEquals(rendered.includes("Poids : tendance −0.2kg/semaine"), true);
});

Deno.test("avec une pesée en base, seul le poids appris disparaît", () => {
  const withMeasured = formatCoachMemoryForPrompt(fullMemory, {
    weightKg: 75.8,
  });

  assertEquals(
    legacyCoachMemoryPrompt(fullMemory).replace("76kg, ", ""),
    withMeasured,
  );
  assertEquals(withMeasured.includes("Poids : objectif 74kg"), true);
});
