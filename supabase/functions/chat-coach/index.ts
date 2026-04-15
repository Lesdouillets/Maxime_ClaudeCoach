// Edge Function — conversation directe avec le coach Alex
// Déployer : supabase functions deploy chat-coach
// Secret requis : supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") ?? "" });

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function buildSystemPrompt(profileName: string): string {
  return `Tu es Alex, coach sportif personnel de ${profileName}. Tu discutes directement avec lui pour ajuster ou créer son programme d'entraînement selon ses objectifs.

## PROFIL DE ${profileName}
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

## FORMATS DE SÉANCE (pour modified_plans)

**Run continu (Z2, long run)**
{"id":"coach-chat-YYYY-MM-DD-0","date":"YYYY-MM-DD","type":"run","label":"RUN Z2","distanceKm":12,"pace":"6:00","targetZone":"Z2","targetHR":"112-149"}

**Fractionné (intervals)**
{"id":"coach-chat-YYYY-MM-DD-0","date":"YYYY-MM-DD","type":"run","label":"FRACTIONNÉ 400m","distanceKm":8,"pace":"5:00",
 "intervals":[
   {"label":"Échauffement","distanceKm":2,"pace":"6:30","targetZone":"Z2"},
   {"label":"400m rapide","reps":8,"distanceKm":0.4,"pace":"4:00","targetZone":"Z4","restSeconds":90},
   {"label":"Retour au calme","distanceKm":1.5,"pace":"6:30","targetZone":"Z2"}
 ]}

**Run progressif (multi-allures)**
{"id":"coach-chat-YYYY-MM-DD-0","date":"YYYY-MM-DD","type":"run","label":"RUN PROGRESSIF","distanceKm":9,"pace":"5:30",
 "intervals":[
   {"label":"Phase 1","distanceKm":4,"pace":"6:00","targetZone":"Z2"},
   {"label":"Phase 2","distanceKm":3,"pace":"5:20","targetZone":"Z3"},
   {"label":"Phase 3","distanceKm":2,"pace":"4:50","targetZone":"Z4"}
 ]}

**Tempo (seuil)**
{"id":"coach-chat-YYYY-MM-DD-0","date":"YYYY-MM-DD","type":"run","label":"TEMPO","distanceKm":9,"pace":"5:10",
 "intervals":[
   {"label":"Échauffement","distanceKm":2,"pace":"6:30","targetZone":"Z2"},
   {"label":"Tempo","distanceKm":6,"pace":"4:50","targetZone":"Z3","targetHR":"149-168"},
   {"label":"Récup","distanceKm":1,"pace":"6:30","targetZone":"Z2"}
 ]}

**Séance fitness**
{"id":"coach-chat-YYYY-MM-DD-0","date":"YYYY-MM-DD","type":"fitness","category":"upper","label":"HAUT DU CORPS","coachNote":"...","exercises":[{"name":"Développé couché haltères","sets":4,"reps":8,"weight":20,"restSeconds":90,"coachNote":"..."}]}

## FORMAT DE RÉPONSE — STRICT JSON UNIQUEMENT
Réponds UNIQUEMENT avec ce JSON valide, sans texte avant ni après, sans markdown :
{
  "response": "Ta réponse en 2-5 phrases, ton de coach direct et chaleureux",
  "modified_plans": []
}

modified_plans : tableau de plans créés ou modifiés. Vide si aucun changement de programme.
Pour les plans existants modifiés : conserve leur ID d'origine. Pour les nouveaux : utilise "coach-chat-{date}-{n}".
Inclus toujours le plan COMPLET (tous les exercices), jamais un plan partiel.`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
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
    const {
      messages = [],
      coachPlans = [],
      recentSessions = [],
      profileName = "Maxime",
      previousAnalyses = [],
    } = body;

    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages required" }), { status: 400, headers: CORS });
    }

    // Build context as a system-level user message (prepended before conversation history)
    const today = new Date().toISOString().slice(0, 10);

    const contextParts: string[] = [`## Date du jour : ${today}`];

    if (previousAnalyses.length > 0) {
      contextParts.push(
        `\n## Tes analyses post-séance récentes\n${previousAnalyses.map((a: { date: string; analysis: string }) => `### ${a.date}\n${a.analysis}`).join("\n\n")}`
      );
    }

    if (recentSessions.length > 0) {
      contextParts.push(`\n## 5 dernières séances réalisées\n${recentSessions.join("\n")}`);
    }

    // Split plans: full JSON for next 7 days, compact for 8-21 days
    const cutoff = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const nearPlans = (coachPlans as Record<string, unknown>[]).filter((p) => (p.date as string) <= cutoff);
    const farPlans = (coachPlans as Record<string, unknown>[]).filter((p) => (p.date as string) > cutoff);

    if (nearPlans.length > 0) {
      contextParts.push(`\n## Programme à venir — J0-7 (JSON complet)\n${JSON.stringify(nearPlans, null, 2)}`);
    }
    if (farPlans.length > 0) {
      const compact = farPlans.map((p) => {
        if (p.type === "run") return `${p.date}: Run ${p.label} ${p.distanceKm}km`;
        return `${p.date}: ${p.category === "lower" ? "Lower" : "Upper"} (${(p.exercises as unknown[])?.length ?? 0} ex.)`;
      }).join(" | ");
      contextParts.push(`\n## Programme à venir — J8-21 (résumé)\n${compact}`);
    }

    // Only keep last 8 messages for API call (token control)
    const recentMessages = messages.slice(-8);

    // Prepend context as first user message if there's context
    const apiMessages = contextParts.length > 0
      ? [
          { role: "user", content: contextParts.join("\n") },
          { role: "assistant", content: "Compris, j'ai le contexte. Je suis prêt." },
          ...recentMessages,
        ]
      : recentMessages;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: buildSystemPrompt(profileName),
      messages: apiMessages,
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";

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
