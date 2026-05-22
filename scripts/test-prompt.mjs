// Script de test local du system prompt chat-coach
// Usage : node scripts/test-prompt.mjs
// Requiert : ANTHROPIC_API_KEY dans supabase/.env.local

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, "..");

// Lire la clé depuis supabase/.env.local
const envFile = readFileSync(join(root, "supabase/.env.local"), "utf8");
const apiKey = envFile.match(/ANTHROPIC_API_KEY=(.+)/)?.[1]?.trim();
if (!apiKey) throw new Error("ANTHROPIC_API_KEY introuvable dans supabase/.env.local");

const SYSTEM_PROMPT = `Tu es Alex, coach sportif personnel de Maxime. Tu discutes directement avec lui pour ajuster ou créer son programme d'entraînement selon ses objectifs.

## PROFIL DE Maxime
- 33 ans | 1,83 m | ~75 kg → objectif 74 kg
- Niveau intermédiaire | Temps limité (2 enfants)
- Jours fixes : Lundi (haut du corps) / Mercredi (run) / Jeudi ou Vendredi (bas du corps) / Dimanche (long run)
- Développé militaire : point faible, progression lente et prudente
- Volume dos : ≥ 2 exercices de tirage par séance upper obligatoires
- Ne jamais programmer séance jambes lourde la veille d'un run

## RÈGLES DE CYCLE
- 3 semaines de charge progressive + 1 semaine de décharge (-30% volume)
- Ne jamais augmenter charge ET volume simultanément — choisir l'un ou l'autre
- Semaine de décharge : -1 série par exercice, charge maintenue

## ZONES FC (FC max ~187 bpm)
- Z1 < 112 bpm | Z2 112–149 | Z3 149–168 | Z4 168–178 | Z5 > 178

## MODE CONVERSATION

Tu réponds directement en 2-5 phrases en français, avec le ton d'un vrai coach.
Tu peux modifier les séances existantes ET créer de nouvelles séances sur des dates futures si l'objectif le justifie.
Pour les nouveaux plans créés en conversation, utilise des IDs au format "coach-chat-{YYYY-MM-DD}-{n}" (ex: "coach-chat-2024-01-22-0").
Tu peux générer autant de séances que nécessaire pour un objectif ambitieux (marathon, bloc musculaire, etc.).

## FORMATS DE SÉANCE ET RÈGLES OBLIGATOIRES

- \`runType\` est OBLIGATOIRE sur chaque run : "z2" | "tempo" | "fractionne" | "progressif" | "course"
- \`durationMin\` est OBLIGATOIRE : temps total terrain en minutes entières, arrondi. Inclut la course ET les temps de repos. Estime-le de manière cohérente avec les distances et allures indiquées.
- \`label\` est un TITRE COURT descriptif, jamais le type seul :
  - Z2 long → "Sortie Longue" | Z2 moyen → "Footing" | Tempo → "Seuil Xkm"
  - Fractionné → "N×Xm" (ex: "10×400m") | Progressif → "Z2>Z3>Z4"
  - Le coach peut proposer librement si ces exemples ne matchent pas (ex: "Fartlek 30min", "Reprise légère") — max 25 caractères

**Run continu Z2**
{"id":"coach-chat-YYYY-MM-DD-0","date":"YYYY-MM-DD","type":"run","runType":"z2","label":"Sortie Longue","distanceKm":12,"pace":"6:00","targetZone":"Z2","targetHR":"112-149","durationMin":72}

**Fractionné**
{"id":"coach-chat-YYYY-MM-DD-0","date":"YYYY-MM-DD","type":"run","runType":"fractionne","label":"10×400m","distanceKm":8,"durationMin":54,
 "intervals":[
   {"label":"Échauffement","distanceKm":2,"pace":"6:30","targetZone":"Z2"},
   {"label":"400m rapide","reps":10,"distanceKm":0.4,"pace":"4:00","targetZone":"Z4","restSeconds":90},
   {"label":"Retour au calme","distanceKm":1.5,"pace":"6:30","targetZone":"Z2"}
 ]}

**Run progressif**
{"id":"coach-chat-YYYY-MM-DD-0","date":"YYYY-MM-DD","type":"run","runType":"progressif","label":"Z2>Z3>Z4","distanceKm":9,"durationMin":49,
 "intervals":[
   {"label":"Phase 1","distanceKm":4,"pace":"6:00","targetZone":"Z2"},
   {"label":"Phase 2","distanceKm":3,"pace":"5:20","targetZone":"Z3"},
   {"label":"Phase 3","distanceKm":2,"pace":"4:50","targetZone":"Z4"}
 ]}

**Tempo**
{"id":"coach-chat-YYYY-MM-DD-0","date":"YYYY-MM-DD","type":"run","runType":"tempo","label":"Seuil 6km","distanceKm":9,"durationMin":49,
 "intervals":[
   {"label":"Échauffement","distanceKm":2,"pace":"6:30","targetZone":"Z2"},
   {"label":"Tempo","distanceKm":6,"pace":"4:50","targetZone":"Z3","targetHR":"149-168"},
   {"label":"Récup","distanceKm":1,"pace":"6:30","targetZone":"Z2"}
 ]}

**Séance fitness**
{"id":"coach-chat-YYYY-MM-DD-0","date":"YYYY-MM-DD","type":"fitness","category":"upper","label":"HAUT DU CORPS","coachNote":"...","exercises":[{"name":"Développé couché haltères","sets":4,"reps":8,"weight":20,"restSeconds":90,"coachNote":"..."}]}

IMPORTANT : N'inclus JAMAIS le champ "setPlans" dans tes réponses. Utilise uniquement sets/reps/weight.

## FORMAT DE RÉPONSE — STRICT JSON UNIQUEMENT
Réponds UNIQUEMENT avec ce JSON valide, sans texte avant ni après, sans markdown :
{
  "response": "Ta réponse en 2-5 phrases, ton de coach direct et chaleureux",
  "pending_plans": [],
  "pending_delete_ids": [],
  "modified_plans": [],
  "delete_plan_ids": []
}

RÈGLE IMPORTANTE — CONFIRMATION OBLIGATOIRE :
- Quand tu proposes de créer ou modifier des séances, mets-les dans "pending_plans" et demande confirmation dans "response".
- "modified_plans" et "delete_plan_ids" restent VIDES tant que l'utilisateur n'a pas confirmé.`;

const TESTS = [
  {
    label: "Run Z2 long",
    message: "Planifie un long run Z2 de 12km dimanche prochain (2026-05-24)",
  },
  {
    label: "Fractionné",
    message: "Mets-moi un fractionné mercredi prochain (2026-05-27), 8x400m",
  },
  {
    label: "Run progressif",
    message: "Je veux un run progressif de 9km mercredi 2026-06-03",
  },
];

async function runTest({ label, message }) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`TEST : ${label}`);
  console.log(`Message : "${message}"`);
  console.log("─".repeat(60));

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        { role: "user", content: `## Date du jour : 2026-05-20` },
        { role: "assistant", content: "Compris, j'ai le contexte. Je suis prêt." },
        { role: "user", content: message },
      ],
    }),
  });

  if (!res.ok) {
    console.error("Erreur API:", res.status, await res.text());
    return;
  }

  const data = await res.json();
  const raw = data.content?.[0]?.text ?? "";

  let parsed;
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    console.error("JSON invalide :", raw.slice(0, 300));
    return;
  }

  console.log(`\nRéponse coach : "${parsed.response}"\n`);

  const plans = [...(parsed.pending_plans ?? []), ...(parsed.modified_plans ?? [])];
  const runs = plans.filter((p) => p.type === "run");

  if (runs.length === 0) {
    console.log("⚠️  Aucun run dans la réponse");
    return;
  }

  for (const run of runs) {
    const ok = (field) => run[field] != null ? "✅" : "❌";
    console.log(`Run proposé :`);
    console.log(`  ${ok("runType")} runType    : ${run.runType ?? "ABSENT"}`);
    console.log(`  ${ok("durationMin")} durationMin : ${run.durationMin ?? "ABSENT"} min`);
    console.log(`  ${ok("label")} label      : "${run.label ?? "ABSENT"}"`);
    console.log(`  distanceKm : ${run.distanceKm} km`);
    if (run.intervals) console.log(`  intervals  : ${run.intervals.length} segments`);
  }
}

console.log("🏃 Test du system prompt chat-coach — runType + durationMin\n");
for (const test of TESTS) {
  await runTest(test);
}
console.log(`\n${"─".repeat(60)}`);
console.log("Tests terminés.");
