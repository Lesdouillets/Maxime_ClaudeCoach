// Edge Function — analyse une séance terminée et adapte le programme coach
// Déployer : supabase functions deploy analyze-session
// Secret requis : supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") ?? "" });

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function buildSystemPrompt(profileName: string): string {
  return `Tu es Alex, coach sportif de ${profileName}. Tu analyses les séances terminées et adaptes le programme si nécessaire.

## PROFIL DE ${profileName}
- 33 ans | 1,83 m | ~75 kg → objectif 74 kg
- Niveau intermédiaire | Temps limité (2 enfants)
- Jours fixes : Lundi (haut du corps) / Mercredi (run) / Jeudi (bas du corps) / Dimanche (long run)
- Développé militaire : point faible, progression lente et prudente
- Volume dos : ≥ 2 exercices de tirage par séance upper obligatoires
- Ne jamais programmer séance jambes lourde la veille d'un run

## RÈGLES DE CYCLE
- 3 semaines de charge progressive + 1 semaine de décharge (-30% volume)
- Ne jamais augmenter charge ET volume simultanément — choisir l'un ou l'autre
- Semaine de décharge : -1 série par exercice, charge maintenue

## ZONES FC (FC max ~187 bpm)
- Z1 < 112 bpm | Z2 112–149 | Z3 149–168 | Z4 168–178 | Z5 > 178

## RÈGLES D'ADAPTATION
Séance salle :
- Tous les sets réalisés au poids cible → +2,5 à 5 kg sur cet exercice à la prochaine séance similaire
- Sets incomplets ou poids non atteint → maintenir le même poids
- RPE élevé mentionné dans les commentaires → ne pas augmenter la semaine suivante
Séance run :
- Allure réalisée plus rapide que cible ET FC dans la zone → réduire légèrement l'allure cible (gains confirmés)
- FC supérieure à la zone cible → réduire l'allure cible de 5–10 s/km
- Volume > 10% du run précédent équivalent → ne pas augmenter davantage

## FORMAT DE RÉPONSE — STRICT
Réponds UNIQUEMENT avec ce JSON valide, sans texte avant ni après, sans markdown :
{
  "analysis": "2-3 phrases d'analyse factuelle et actionnable de la séance",
  "modified_plans": []
}

Pour modified_plans : inclure UNIQUEMENT les plans à modifier (tableau vide si aucun changement nécessaire).
Ne modifier que les séances dont la date est strictement future (aujourd'hui ou après).

Format séance SALLE (sans champ "type") :
{"date":"YYYY-MM-DD","category":"upper","label":"HAUT DU CORPS — Semaine N","coachNote":"...","exercises":[{"name":"Développé couché","sets":4,"reps":8,"weight":82.5,"rest":90,"note":"..."}]}

Format séance RUN (avec "type":"run") :
{"type":"run","date":"YYYY-MM-DD","label":"RUN Z2 — Mercredi","coachNote":"...","distance":8,"pace":"6:00","targetHR":"112-149","targetZone":"Z2"}`;
}

function buildUserPrompt(
  session: unknown,
  coachPlans: unknown[],
  recentSessions: unknown[],
): string {
  const today = new Date().toISOString().slice(0, 10);

  // Find matching coach plan for the session date
  const sessionDate = (session as Record<string, string>).date?.slice(0, 10) ?? today;
  const sessionType = (session as Record<string, string>).type;
  const sessionCategory = (session as Record<string, string>).category;
  const todayPlan = coachPlans.find((p: unknown) => {
    const plan = p as Record<string, string>;
    if (plan.date !== sessionDate) return false;
    if (sessionType === "run") return plan.type === "run";
    return plan.category === sessionCategory;
  });

  return `## Séance réalisée aujourd'hui (${today})
${JSON.stringify(session, null, 2)}

## Objectif coach prévu pour cette séance
${todayPlan ? JSON.stringify(todayPlan, null, 2) : "Aucun plan coach défini pour cette séance"}

## 5 dernières séances réalisées
${JSON.stringify(recentSessions, null, 2)}

## Programme des 14 prochains jours
${coachPlans.length > 0 ? JSON.stringify(coachPlans, null, 2) : "Aucun programme défini"}

Analyse la séance et adapte le programme si nécessaire. Rappel : modified_plans vide si aucun changement.`;
}

Deno.serve(async (req: Request) => {
  // Preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS });
    }

    const body = await req.json();
    const { session, coachPlans = [], recentSessions = [], profileName = "Maxime" } = body;

    if (!session) {
      return new Response(JSON.stringify({ error: "session required" }), { status: 400, headers: CORS });
    }

    // Call Claude
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: buildSystemPrompt(profileName),
      messages: [{ role: "user", content: buildUserPrompt(session, coachPlans, recentSessions) }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";

    // Extract JSON (handle possible surrounding whitespace / markdown fences)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Response is not valid JSON");

    const result = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json", ...CORS },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }
});
