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

## OUTILS DISPONIBLES

Tu disposes de 3 outils. Utilise-les comme un vrai coach qui planifie et mémorise :

1. **propose_plan_batch** — quand tu crées ou modifies des séances. Toujours demander confirmation.
2. **apply_plan_batch** — quand l'user confirme explicitement un plan ("ok", "valide", "go"). Résous les IDs depuis tes propose_plan_batch précédents dans cette conversation.
3. **update_memory** — quand l'user mentionne une blessure, un objectif de course, une contrainte physique, ou que tu observes une tendance significative. PAS pour chaque échange.

Si tu réponds juste à une question sans modifier le programme, n'appelle aucun outil.`;
}

interface CoachMemory {
  lastUpdated: string;
  run: {
    trend?: string;
    lastLongRun?: string;
    nextRace?: string;
    notes?: string;
  };
  fitness: {
    cycle?: string;
    upperBody?: { lastSession?: string; keyLifts?: Record<string, string> };
    lowerBody?: { lastSession?: string; keyLifts?: Record<string, string> };
  };
  body: {
    currentWeight?: number;
    trend?: string;
    target?: number;
  };
  keyNotes: Array<{ date: string; note: string }>;
}

function formatCoachMemoryForPrompt(memory: CoachMemory): string {
  const lines: string[] = [];

  const runParts: string[] = [];
  if (memory.run.trend) runParts.push(memory.run.trend);
  if (memory.run.lastLongRun) runParts.push(`Dernière sortie longue : ${memory.run.lastLongRun}`);
  if (memory.run.nextRace) runParts.push(`Prochaine course : ${memory.run.nextRace}`);
  if (memory.run.notes) runParts.push(`⚠️ ${memory.run.notes}`);
  if (runParts.length > 0) lines.push(`Run : ${runParts.join(" | ")}`);

  const fitParts: string[] = [];
  if (memory.fitness.cycle) fitParts.push(memory.fitness.cycle);
  if (memory.fitness.upperBody?.keyLifts) {
    const lifts = Object.entries(memory.fitness.upperBody.keyLifts).map(([k, v]) => `${k} ${v}`).join(", ");
    if (lifts) fitParts.push(`Upper: ${lifts}`);
  }
  if (memory.fitness.lowerBody?.keyLifts) {
    const lifts = Object.entries(memory.fitness.lowerBody.keyLifts).map(([k, v]) => `${k} ${v}`).join(", ");
    if (lifts) fitParts.push(`Lower: ${lifts}`);
  }
  if (fitParts.length > 0) lines.push(`Fitness : ${fitParts.join(" | ")}`);

  if (memory.body.currentWeight !== undefined) {
    const bodyParts: string[] = [`${memory.body.currentWeight}kg`];
    if (memory.body.target !== undefined) bodyParts.push(`objectif ${memory.body.target}kg`);
    if (memory.body.trend) bodyParts.push(`tendance ${memory.body.trend}`);
    lines.push(`Poids : ${bodyParts.join(", ")}`);
  }

  const recentNotes = memory.keyNotes.slice(-3);
  if (recentNotes.length > 0) {
    lines.push(`Notes : ${recentNotes.map((n: { date: string; note: string }) => `[${n.date}] ${n.note}`).join(" | ")}`);
  }

  if (lines.length === 0) return "";
  return `## Mémoire coach (contexte persistant)\n${lines.join("\n")}`;
}

const COACH_TOOLS = [
  {
    name: "propose_plan_batch",
    description:
      "Propose des séances au user. Il devra cliquer 'Valider' pour les confirmer. " +
      "Utilise cet outil chaque fois que tu crées ou modifies des séances. " +
      "Ne l'utilise PAS si l'user t'a déjà confirmé ce tour — utilise apply_plan_batch à la place.",
    input_schema: {
      type: "object",
      properties: {
        plans: {
          type: "array",
          items: { type: "object" },
          description: "Tableau de plans CoachRun ou CoachWorkout complets.",
        },
        delete_ids: {
          type: "array",
          items: { type: "string" },
          description: "IDs de plans existants à supprimer (optionnel).",
        },
      },
      required: ["plans"],
    },
  },
  {
    name: "apply_plan_batch",
    description:
      "Applique des plans déjà proposés que l'user vient de confirmer textuellement " +
      "('ok', 'valide', 'go', 'c'est bon', 'applique'). " +
      "Ne l'utilise QUE si l'user confirme explicitement dans sa réponse. " +
      "Résous les IDs depuis les propose_plan_batch précédents dans la conversation.",
    input_schema: {
      type: "object",
      properties: {
        plan_ids: {
          type: "array",
          items: { type: "string" },
          description: "IDs des plans confirmés.",
        },
        delete_ids: {
          type: "array",
          items: { type: "string" },
          description: "IDs à supprimer définitivement (optionnel).",
        },
      },
      required: ["plan_ids"],
    },
  },
  {
    name: "update_memory",
    description:
      "Met à jour la mémoire persistante du coach. " +
      "À utiliser UNIQUEMENT pour des informations significatives long terme : " +
      "blessure, objectif de course, contrainte physique, tendance FC confirmée, poids mentionné. " +
      "PAS pour les détails d'une séance (déjà dans les données brutes). " +
      "La mémoire sera injectée dans toutes les conversations futures.",
    input_schema: {
      type: "object",
      properties: {
        run: {
          type: "object",
          properties: {
            trend: { type: "string" },
            lastLongRun: { type: "string" },
            nextRace: { type: "string" },
            notes: { type: "string" },
          },
        },
        fitness: {
          type: "object",
          properties: {
            cycle: { type: "string" },
            upperBody: {
              type: "object",
              properties: {
                lastSession: { type: "string" },
                keyLifts: { type: "object" },
              },
            },
            lowerBody: {
              type: "object",
              properties: {
                lastSession: { type: "string" },
                keyLifts: { type: "object" },
              },
            },
          },
        },
        body: {
          type: "object",
          properties: {
            currentWeight: { type: "number" },
            trend: { type: "string" },
            target: { type: "number" },
          },
        },
        keyNotes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              date: { type: "string" },
              note: { type: "string" },
            },
            required: ["date", "note"],
          },
        },
      },
    },
  },
] as const;

function resolvePlansByIds(planIds: string[], conversationMessages: unknown[]): unknown[] {
  if (planIds.length === 0) return [];
  const allProposedPlans: Record<string, unknown>[] = [];

  for (const msg of conversationMessages) {
    const m = msg as { role: string; content: unknown };
    if (m.role !== "assistant" || !Array.isArray(m.content)) continue;
    for (const block of m.content as Array<{ type: string; name?: string; input?: Record<string, unknown> }>) {
      if (block.type === "tool_use" && block.name === "propose_plan_batch") {
        const plans = block.input?.plans;
        if (Array.isArray(plans)) {
          allProposedPlans.push(...(plans as Record<string, unknown>[]));
        }
      }
    }
  }

  const idSet = new Set(planIds);
  return allProposedPlans.filter((p) => idSet.has(p.id as string));
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
      today: clientToday,
      coachMemory,
    } = body;

    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages required" }), { status: 400, headers: CORS });
    }

    // Prefer the client-supplied date (local timezone) to avoid UTC drift
    const today = typeof clientToday === "string" && /^\d{4}-\d{2}-\d{2}$/.test(clientToday)
      ? clientToday
      : new Date().toISOString().slice(0, 10);
    const contextParts: string[] = [`## Date du jour : ${today}`];

    // Injection mémoire persistante si disponible
    if (coachMemory) {
      const memoryText = formatCoachMemoryForPrompt(coachMemory as CoachMemory);
      if (memoryText) contextParts.push(`\n${memoryText}`);
    }

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
        if (p.type === "run") return `${p.id}|${p.date}:Run ${p.label} ${p.distanceKm}km`;
        return `${p.id}|${p.date}:${p.category === "lower" ? "Lower" : "Upper"}(${(p.exercises as unknown[])?.length ?? 0}ex)`;
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
    const conversationMessages: unknown[] = [...apiMessages];

    interface ChatCoachResult {
      response: string;
      pending_plans: unknown[];
      pending_delete_ids: string[];
      modified_plans: unknown[];
      delete_plan_ids: string[];
      memory_update: Record<string, unknown> | null;
    }

    const result: ChatCoachResult = {
      response: "",
      pending_plans: [],
      pending_delete_ids: [],
      modified_plans: [],
      delete_plan_ids: [],
      memory_update: null,
    };

    const MAX_ITERATIONS = 5;

    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
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
          tools: COACH_TOOLS,
          messages: conversationMessages,
        }),
      });

      if (!anthropicResp.ok) {
        const errText = await anthropicResp.text();
        throw new Error(`Anthropic API error ${anthropicResp.status}: ${errText}`);
      }

      const anthropicData = await anthropicResp.json();
      const stopReason = anthropicData.stop_reason as string;

      if (anthropicData.usage) {
        console.log(`[chat-coach] iter=${iteration} usage:`, JSON.stringify(anthropicData.usage), "stop:", stopReason);
      }

      const textBlock = Array.isArray(anthropicData.content)
        ? anthropicData.content.find((b: { type: string }) => b.type === "text")
        : null;
      if (textBlock?.text) result.response = textBlock.text;

      if (stopReason !== "tool_use") break;

      const toolUseBlocks = (anthropicData.content as Array<{ type: string; id: string; name: string; input: Record<string, unknown> }>)
        .filter((b) => b.type === "tool_use");

      const toolResults: Array<{ type: "tool_result"; tool_use_id: string; content: string }> = [];

      for (const toolBlock of toolUseBlocks) {
        const { id, name, input } = toolBlock;
        let toolResultContent = "";

        if (name === "propose_plan_batch") {
          result.pending_plans = Array.isArray(input.plans) ? input.plans : [];
          result.pending_delete_ids = Array.isArray(input.delete_ids) ? (input.delete_ids as string[]) : [];
          toolResultContent = `OK — ${result.pending_plans.length} plan(s) proposé(s), en attente de confirmation user.`;
          console.log("[chat-coach] propose_plan_batch:", result.pending_plans.length, "plans");
        } else if (name === "apply_plan_batch") {
          const planIds = Array.isArray(input.plan_ids) ? (input.plan_ids as string[]) : [];
          result.modified_plans = resolvePlansByIds(planIds, conversationMessages);
          result.delete_plan_ids = Array.isArray(input.delete_ids) ? (input.delete_ids as string[]) : [];
          toolResultContent = `OK — ${result.modified_plans.length} plan(s) appliqué(s).`;
          console.log("[chat-coach] apply_plan_batch:", result.modified_plans.length, "plans résolus");
        } else if (name === "update_memory") {
          result.memory_update = input;
          toolResultContent = "Mémoire mise à jour.";
          console.log("[chat-coach] update_memory appelé");
        }

        toolResults.push({ type: "tool_result", tool_use_id: id, content: toolResultContent });
      }

      conversationMessages.push({ role: "assistant", content: anthropicData.content });
      conversationMessages.push({ role: "user", content: toolResults });
    }

    if (!result.response && result.pending_plans.length === 0) {
      result.response = "Désolé, je n'ai pas pu formuler de réponse. Réessaie.";
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
