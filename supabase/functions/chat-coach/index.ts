// Edge Function — conversation directe avec le coach Alex
// Déployer : supabase functions deploy chat-coach --no-verify-jwt
// Secret requis : supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

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
  "pending_plans": [],
  "pending_delete_ids": [],
  "modified_plans": [],
  "delete_plan_ids": []
}

RÈGLE IMPORTANTE — CONFIRMATION OBLIGATOIRE :
- Quand tu proposes de créer ou modifier des séances, mets-les dans "pending_plans" et demande confirmation dans "response".
- Quand tu proposes de SUPPRIMER des séances, mets leurs IDs dans "pending_delete_ids" et demande confirmation.
- Tu peux combiner les deux : proposer des suppressions ET des créations/modifications en même temps.
- "modified_plans" et "delete_plan_ids" restent VIDES tant que l'utilisateur n'a pas confirmé explicitement (oui, ok, valide, c'est bon, go, applique).
- Si l'utilisateur confirme, déplace les plans dans "modified_plans" et les IDs dans "delete_plan_ids", vide les pending.
- Si tu réponds juste à une question sans modifier le programme, les quatre tableaux sont vides.
Pour les plans existants modifiés : conserve leur ID d'origine. Pour les nouveaux : utilise "coach-chat-{date}-{n}".
Inclus toujours le plan COMPLET (tous les exercices), jamais un plan partiel.`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
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

    const today = new Date().toISOString().slice(0, 10);
    const contextParts: string[] = [`## Date du jour : ${today}`];

    // Max 2 analyses, truncated to 400 chars each
    if (previousAnalyses.length > 0) {
      const trimmed = previousAnalyses
        .slice(0, 2)
        .map((a: { date: string; analysis: string }) => `${a.date}: ${a.analysis.slice(0, 400)}`);
      contextParts.push(`\n## Analyses récentes\n${trimmed.join("\n")}`);
    }

    if (recentSessions.length > 0) {
      contextParts.push(`\n## Séances récentes\n${recentSessions.join("\n")}`);
    }

    // Strip coachNote fields to save tokens, keep only what the coach needs
    function stripCoachNotes(plans: Record<string, unknown>[]): Record<string, unknown>[] {
      return plans.map((p) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { coachNote: _cn, ...rest } = p;
        if (Array.isArray(rest.exercises)) {
          rest.exercises = (rest.exercises as Record<string, unknown>[]).map((ex) => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { coachNote: _ecn, ...exRest } = ex;
            return exRest;
          });
        }
        return rest;
      });
    }

    // J0-3: full JSON (stripped), J4-21: compact text
    const nearCutoff = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const farCutoff = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const allPlans = coachPlans as Record<string, unknown>[];
    const nearPlans = allPlans.filter((p) => (p.date as string) <= nearCutoff);
    const farPlans = allPlans.filter((p) => (p.date as string) > nearCutoff && (p.date as string) <= farCutoff);

    if (nearPlans.length > 0) {
      contextParts.push(`\n## Programme J0-3\n${JSON.stringify(stripCoachNotes(nearPlans))}`);
    }
    if (farPlans.length > 0) {
      const compact = farPlans.map((p) => {
        if (p.type === "run") return `${p.date}:Run ${p.label} ${p.distanceKm}km`;
        return `${p.date}:${p.category === "lower" ? "Lower" : "Upper"}(${(p.exercises as unknown[])?.length ?? 0}ex)`;
      }).join(" | ");
      contextParts.push(`\n## Programme J4-21\n${compact}`);
    }

    // Only keep last 6 messages for API call
    let recentMessages = messages.slice(-6);

    // Context injection prepends a user+assistant pair before recentMessages.
    // If recentMessages starts with an assistant message, the API would receive
    // two consecutive assistant messages → 400 error. Drop the leading assistant.
    if (recentMessages.length > 0 && recentMessages[0].role === "assistant") {
      recentMessages = recentMessages.slice(1);
    }

    // Prepend context as first user message if there's context
    const apiMessages = contextParts.length > 0
      ? [
          { role: "user", content: contextParts.join("\n") },
          { role: "assistant", content: "Compris, j'ai le contexte. Je suis prêt." },
          ...recentMessages,
        ]
      : recentMessages;

    const systemPrompt = buildSystemPrompt(profileName);

    const anthropicResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": Deno.env.get("ANTHROPIC_API_KEY") ?? "",
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "prompt-caching-2024-07-31",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        system: [
          {
            type: "text",
            text: systemPrompt,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: apiMessages,
      }),
    });

    if (!anthropicResp.ok) {
      const errText = await anthropicResp.text();
      throw new Error(`Anthropic API error ${anthropicResp.status}: ${errText}`);
    }

    const anthropicData = await anthropicResp.json();

    // Guard against truncated responses
    if (anthropicData.stop_reason === "max_tokens") {
      throw new Error("Response truncated — plan too large. Try a shorter request.");
    }

    const text = anthropicData.content?.[0]?.type === "text" ? anthropicData.content[0].text : "";

    // Find the outermost JSON object (first { to its matching })
    const start = text.indexOf("{");
    if (start === -1) throw new Error("Response is not valid JSON");
    let depth = 0;
    let end = -1;
    for (let i = start; i < text.length; i++) {
      if (text[i] === "{") depth++;
      else if (text[i] === "}") { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end === -1) throw new Error("Unbalanced JSON in response");

    const result = JSON.parse(text.slice(start, end + 1));

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
