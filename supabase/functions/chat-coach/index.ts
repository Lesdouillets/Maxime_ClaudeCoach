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
- Quand tu proposes de SUPPRIMER des séances, mets leurs IDs dans "pending_delete_ids" et demande confirmation.
- Tu peux combiner les deux : proposer des suppressions ET des créations/modifications en même temps.
- "modified_plans" et "delete_plan_ids" restent VIDES tant que l'utilisateur n'a pas confirmé explicitement (oui, ok, valide, c'est bon, go, applique).
- Si l'utilisateur confirme, déplace les plans dans "modified_plans" et les IDs dans "delete_plan_ids", vide les pending.
- Si tu réponds juste à une question sans modifier le programme, les quatre tableaux sont vides.
Pour les plans existants modifiés : conserve leur ID d'origine. Pour les nouveaux : utilise "coach-chat-{date}-{n}".
Inclus toujours le plan COMPLET (tous les exercices), jamais un plan partiel.

CONTINUITÉ ENTRE LES TOURS :
- Tes messages assistant précédents peuvent contenir des blocs `[pending_plans=...]` et `[pending_delete_ids=...]`. Ce sont les propositions que TU as faites au tour précédent.
- Quand l'utilisateur confirme, tu DOIS reprendre EXACTEMENT le contenu de `[pending_plans=...]` du dernier tour et le placer tel quel dans "modified_plans" (mêmes IDs, mêmes exercices, mêmes valeurs). Ne ré-invente rien.
- De même pour `[pending_delete_ids=...]` → "delete_plan_ids".
- Si tu confirmes une application sans rien mettre dans "modified_plans"/"delete_plan_ids", aucune séance ne sera modifiée — c'est une erreur grave.`;
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

    // Last 3 analyses, truncated to 600 chars each
    if (previousAnalyses.length > 0) {
      const trimmed = previousAnalyses
        .slice(0, 3)
        .map((a: { date: string; analysis: string }) => `${a.date}: ${a.analysis.slice(0, 600)}`);
      contextParts.push(`\n## Analyses récentes\n${trimmed.join("\n")}`);
    }

    if (recentSessions.length > 0) {
      contextParts.push(`\n## Séances récentes\n${recentSessions.join("\n")}`);
    }

    // Strip coachNote + setPlans to reduce tokens and avoid coach echoing setPlans back.
    // The client auto-migrates setPlans from sets/reps/weight so we never need them in responses.
    function stripCoachNotes(plans: Record<string, unknown>[]): Record<string, unknown>[] {
      return plans.map((p) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { coachNote: _cn, ...rest } = p;
        if (Array.isArray(rest.exercises)) {
          rest.exercises = (rest.exercises as Record<string, unknown>[]).map((ex) => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { coachNote: _ecn, setPlans: _sp, ...exRest } = ex;
            return exRest;
          });
        }
        return rest;
      });
    }

    // J0-3: full JSON (stripped). J4+: compact text — all remaining future plans,
    // no far cutoff so the coach can reason about the whole program.
    const nearCutoff = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const allPlans = coachPlans as Record<string, unknown>[];
    const nearPlans = allPlans.filter((p) => (p.date as string) <= nearCutoff);
    const farPlans = allPlans.filter((p) => (p.date as string) > nearCutoff);

    if (nearPlans.length > 0) {
      contextParts.push(`\n## Programme J0-3\n${JSON.stringify(stripCoachNotes(nearPlans))}`);
    }
    if (farPlans.length > 0) {
      const compact = farPlans.map((p) => {
        if (p.type === "run") return `${p.date}:Run ${p.label} ${p.distanceKm}km`;
        return `${p.date}:${p.category === "lower" ? "Lower" : "Upper"}(${(p.exercises as unknown[])?.length ?? 0}ex)`;
      }).join(" | ");
      contextParts.push(`\n## Programme J4+\n${compact}`);
    }

    // Only keep last 16 messages for API call (8 exchanges — enough to follow conversation thread)
    let recentMessages = messages.slice(-16);

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

    // Prefill the assistant response with "{" to force JSON output.
    // The model continues from this character, so we prepend it back when parsing.
    const messagesForApi = [...apiMessages, { role: "assistant", content: "{" }];

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
        max_tokens: 32000,
        system: [
          {
            type: "text",
            text: systemPrompt,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: messagesForApi,
      }),
    });

    if (!anthropicResp.ok) {
      const errText = await anthropicResp.text();
      throw new Error(`Anthropic API error ${anthropicResp.status}: ${errText}`);
    }

    const anthropicData = await anthropicResp.json();
    const stopReason = anthropicData.stop_reason as string | undefined;
    const truncated = stopReason === "max_tokens";

    // Find the first text block (skip thinking blocks or tool_use)
    const textBlock = Array.isArray(anthropicData.content)
      ? anthropicData.content.find((b: { type?: string }) => b?.type === "text")
      : null;
    // Prepend the prefill character — the API response does not include it
    const rawText: string = textBlock?.text ?? "";
    const text = "{" + rawText;

    if (anthropicData.usage) {
      console.log("[chat-coach] usage:", JSON.stringify(anthropicData.usage), "stop:", stopReason, "textLen:", text.length);
    }

    const truncSuffix = "\n\n⚠️ Réponse tronquée — demande plus courte stp.";
    const emptyShape = { pending_plans: [], pending_delete_ids: [], modified_plans: [], delete_plan_ids: [] };

    // Try to extract outermost JSON object. Use lastIndexOf for robustness against
    // accolades embedded in string values, then fall back to depth-counting if parse fails.
    const start = text.indexOf("{");
    const lastEnd = text.lastIndexOf("}");

    let result: Record<string, unknown> | null = null;
    if (start !== -1 && lastEnd > start) {
      const candidate = text.slice(start, lastEnd + 1);
      try {
        result = JSON.parse(candidate);
      } catch {
        // Depth-counting fallback (naive but works when JSON is followed by garbage text)
        let depth = 0;
        let end = -1;
        for (let i = start; i < text.length; i++) {
          if (text[i] === "{") depth++;
          else if (text[i] === "}") { depth--; if (depth === 0) { end = i; break; } }
        }
        if (end !== -1) {
          try { result = JSON.parse(text.slice(start, end + 1)); } catch { /* fall through */ }
        }
      }
    }

    if (!result) {
      console.warn("[chat-coach] no JSON parsed, falling back to raw text. Preview:", text.slice(0, 200));
      // Try to salvage the response field from truncated JSON via regex
      const responseMatch = text.match(/"response"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      const salvaged = responseMatch ? responseMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"') : "";
      // Fall back to raw model output (without the prepended "{") so the user still sees the coach's message
      const fallbackMsg = salvaged || rawText.trim() || "Désolé, je n'ai pas pu formuler de réponse. Réessaie.";
      result = { response: fallbackMsg + (truncated ? truncSuffix : ""), ...emptyShape };
    } else if (truncated) {
      // Parsed OK but hit max_tokens — plans may be incomplete, drop them
      console.warn("[chat-coach] stop_reason=max_tokens, dropping plans");
      result = { response: String(result.response ?? "") + truncSuffix, ...emptyShape };
    }

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
