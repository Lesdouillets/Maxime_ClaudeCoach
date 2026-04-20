// Edge Function — analyse une séance terminée et adapte le programme coach
// Déployer : supabase functions deploy analyze-session --no-verify-jwt
// Secret requis : supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function buildSystemPrompt(profileName: string): string {
  return `Tu es Alex, coach sportif de ${profileName}. Tu analyses les séances terminées et **mets à jour le programme à venir si les données le justifient**.

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

## TON RÔLE DE COACH

Tu es le coach — c'est toi qui décides. Tu peux modifier **tout** ce qui te semble pertinent dans les séances à venir :
- Les **charges ou l'allure** (augmenter, maintenir, baisser)
- Les **exercices eux-mêmes** : remplacer un exercice par un autre, en ajouter, en supprimer, varier les angles ou les machines si tu penses qu'un changement de stimulus sera bénéfique
- La **structure** : changer l'ordre, ajuster les séries/reps, modifier les temps de repos
- Les **charges et reps par série** via le champ "setPlans" : au sein d'un même exercice, tu peux proposer une progression pyramidale, des drop sets ou toute autre variation série par série (voir format plus bas)
- Ou **ne rien changer** si le programme est bien calibré et que la séance s'est déroulée comme prévu

La variété est un outil de coach à part entière — si un même exercice revient trop souvent, tu peux le remplacer ponctuellement pour éviter la monotonie ou cibler différemment un groupe musculaire. Mais sois cohérent avec les objectifs et le niveau de l'athlète.

Quelques repères à ta disposition (pas des règles automatiques) :
- Les commentaires de ressenti sont tes données les plus précieuses : lis-les comme un athlète te parlerait
- La position dans le cycle (semaine de charge vs décharge) influence tes choix
- Pour le run : allure, FC et ressenti sont à croiser ensemble
- Toujours garder ≥ 2 exercices de tirage par séance haut du corps
- Ne jamais supprimer les exercices fondamentaux (squat, deadlift, développé) sans raison explicite

## FORMATS DE SÉANCE RUN (pour modified_plans)

**1. Run continu (Z2, long run)**
{"id":"coach-run-xxx","date":"YYYY-MM-DD","type":"run","label":"RUN Z2 — Dimanche","distanceKm":12,"pace":"6:00","targetZone":"Z2","targetHR":"112-149"}

**2. Fractionné (intervals)**
{"id":"coach-run-xxx","date":"YYYY-MM-DD","type":"run","label":"FRACTIONNÉ 400m","distanceKm":8,"pace":"5:00",
 "intervals":[
   {"label":"Échauffement","distanceKm":2,"pace":"6:30","targetZone":"Z2"},
   {"label":"400m rapide","reps":8,"distanceKm":0.4,"pace":"4:00","targetZone":"Z4","restSeconds":90},
   {"label":"Retour au calme","distanceKm":1.5,"pace":"6:30","targetZone":"Z2"}
 ]}

**3. Run progressif (multi-allures)**
{"id":"coach-run-xxx","date":"YYYY-MM-DD","type":"run","label":"RUN PROGRESSIF","distanceKm":9,"pace":"5:30",
 "intervals":[
   {"label":"Phase 1","distanceKm":4,"pace":"6:00","targetZone":"Z2"},
   {"label":"Phase 2","distanceKm":3,"pace":"5:20","targetZone":"Z3"},
   {"label":"Phase 3","distanceKm":2,"pace":"4:50","targetZone":"Z4"}
 ]}

**4. Tempo (seuil)**
{"id":"coach-run-xxx","date":"YYYY-MM-DD","type":"run","label":"TEMPO","distanceKm":9,"pace":"5:10",
 "intervals":[
   {"label":"Échauffement","distanceKm":2,"pace":"6:30","targetZone":"Z2"},
   {"label":"Tempo","distanceKm":6,"pace":"4:50","targetZone":"Z3","targetHR":"149-168"},
   {"label":"Récup","distanceKm":1,"pace":"6:30","targetZone":"Z2"}
 ]}

## PROCESSUS
1. Lis la séance réalisée, les commentaires, et compare avec le plan prévu
2. Regarde le contexte des séances récentes pour sentir la tendance de forme
3. Pour chaque exercice ou paramètre, forme ton jugement de coach
4. Modifie les séances à venir si tu l'estimes utile — ou ne modifie rien si le programme est bien calibré
5. Explique en 2-3 phrases ton analyse et ta décision (y compris si tu ne changes rien et pourquoi)

## FORMAT DE RÉPONSE — STRICT JSON UNIQUEMENT
Réponds UNIQUEMENT avec ce JSON valide, sans texte avant ni après, sans markdown, sans commentaires :
{
  "analysis": "2-3 phrases : ce qui s'est passé + ce qui change dans le programme (ou confirmation que le programme reste inchangé)",
  "modified_plans": []
}

### Règles pour modified_plans — ÉCONOMIE DE TOKENS IMPÉRATIVE
- **Ne renvoie QUE les plans utiles** : séances modifiées OU nouvelles séances à créer. Ne renvoie jamais une séance identique à ce qui t'a été fourni.
- **Tableau vide [] si aucun ajustement ni création n'est justifié** — c'est la réponse la plus fréquente et la plus économique.
- **Pour modifier une séance existante** : conserve son ID exact tel qu'il t'a été fourni. Inclus le plan complet avec tous ses exercices.
- **Pour créer une nouvelle séance** (semaine sans programme) : génère un nouvel ID au format "coach-TIMESTAMP" ou "coach-run-TIMESTAMP". N'en crée que si c'est pertinent pour la progression.
- **JAMAIS deux plans pour la même date + catégorie** : si plusieurs plans coexistent dans le contexte à la même date (doublons hérités), choisis-en UN SEUL (le plus récent/pertinent) et renvoie sa version corrigée avec son ID. N'en crée pas un nouveau à côté — cela crée encore plus de doublons.
- **Ne mentionne pas "doublon supprimé" dans le label** — la déduplication est gérée côté client, contente-toi de renvoyer le plan canonique propre.

Format séance salle (fitness) :
{"id":"coach-xxx","date":"YYYY-MM-DD","type":"fitness","category":"upper","label":"HAUT DU CORPS — Semaine N","coachNote":"...","exercises":[{"name":"Développé couché haltères","sets":4,"reps":8,"weight":20,"restSeconds":90,"coachNote":"..."}]}

Pour proposer une variation série par série (pyramide, drop set, RPE progressif…), ajoute le champ "setPlans" à l'exercice. Dans ce cas, "sets"/"reps"/"weight" deviennent les valeurs indicatives mais c'est "setPlans" qui fait foi :
{"name":"Squat","weight":90,"reps":6,"sets":5,"setPlans":[{"weight":80,"reps":10},{"weight":90,"reps":8},{"weight":100,"reps":6},{"weight":100,"reps":6},{"weight":90,"reps":8}],"restSeconds":120,"coachNote":"Pyramide montante puis descendante"}

Format séance run :
{"id":"coach-run-xxx","date":"YYYY-MM-DD","type":"run","label":"RUN Z2 — Mercredi","coachNote":"...","distanceKm":8,"pace":"6:00","targetHR":"112-149","targetZone":"Z2"}`;
}

// Format the current session as compact text (read-only for Claude — no need for JSON structure)
function sessionToText(s: Record<string, unknown>): string {
  const date = String(s.date ?? "").slice(0, 10);
  const comment = s.comment ? ` | "${s.comment}"` : "";

  if (s.type === "run") {
    const dist = s.distanceKm ?? "?";
    const pace = s.avgPaceSecPerKm
      ? `${Math.floor(Number(s.avgPaceSecPerKm) / 60)}:${String(Number(s.avgPaceSecPerKm) % 60).padStart(2, "0")}/km`
      : "";
    const hr = s.avgHeartRate ? ` FC:${s.avgHeartRate}` : "";
    return `run ${date} | ${dist}km @${pace}${hr}${comment}`;
  }

  // fitness
  const cat = s.category ?? "";
  const exos = Array.isArray(s.exercises)
    ? (s.exercises as Record<string, unknown>[])
        .map((ex) => {
          const note = ex.comment ? ` ("${ex.comment}")` : "";
          // Show per-set detail when setLogs are available
          if (Array.isArray(ex.setLogs) && (ex.setLogs as Record<string, unknown>[]).length > 0) {
            const setDetails = (ex.setLogs as Record<string, unknown>[])
              .filter((s) => s.done)
              .map((s, i) => `S${i + 1}:${s.weight}kg×${s.reps}`)
              .join(" ");
            return `  ${ex.name}: ${setDetails}${note}`;
          }
          return `  ${ex.name}: ${ex.sets}×${ex.reps} @${ex.weight}kg${note}`;
        })
        .join("\n")
    : "";
  return `fitness/${cat} ${date}${comment}\n${exos}`;
}

// Format recent sessions as compact single-line entries (context only — Claude never writes these)
function recentToText(sessions: unknown[]): string {
  return sessions.map((s) => {
    const r = s as Record<string, unknown>;
    const date = String(r.date ?? "").slice(0, 10);
    const comment = r.comment ? ` | "${r.comment}"` : "";

    if (r.type === "run") {
      const dist = r.distanceKm ?? "?";
      const pace = r.avgPaceSecPerKm
        ? `${Math.floor(Number(r.avgPaceSecPerKm) / 60)}:${String(Number(r.avgPaceSecPerKm) % 60).padStart(2, "0")}/km`
        : "";
      const hr = r.avgHeartRate ? ` FC:${r.avgHeartRate}` : "";
      return `${date} run: ${dist}km @${pace}${hr}${comment}`;
    }

    const cat = r.category ?? "";
    const exos = Array.isArray(r.exercises)
      ? (r.exercises as Record<string, unknown>[])
          .map((ex) => {
            const note = ex.comment ? ` ("${ex.comment}")` : "";
            return `${ex.name} ${ex.sets}×${ex.reps}@${ex.weight}kg${note}`;
          })
          .join(", ")
      : "";
    return `${date} fitness/${cat}${comment}: ${exos}`;
  }).join("\n");
}

function buildUserPrompt(
  session: unknown,
  coachPlans: unknown[],
  recentSessions: unknown[],
  previousAnalyses: Array<{ date: string; analysis: string }> = [],
  chatContext?: string,
): string {
  const today = new Date().toISOString().slice(0, 10);

  const sessionDate = (session as Record<string, string>).date?.slice(0, 10) ?? today;
  const sessionType = (session as Record<string, string>).type;
  const sessionCategory = (session as Record<string, string>).category;

  const todayPlan = coachPlans.find((p: unknown) => {
    const plan = p as Record<string, string>;
    if (plan.date !== sessionDate) return false;
    if (sessionType === "run") return plan.type === "run";
    return plan.category === sessionCategory;
  });

  // Split future plans into near (full JSON, modifiable) and far (compact summary only).
  // Rationale: the coach almost always adjusts only the next ~10 days; beyond that
  // it needs context but not every set/rep. This caps the prompt size even when the
  // user has 2+ months of pre-seeded plans.
  const NEAR_DAYS = 10;
  const nearCutoff = new Date(Date.parse(sessionDate) + NEAR_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const futurePlansSrc = coachPlans.filter(
    (p: unknown) => (p as Record<string, string>).date > sessionDate,
  );

  // Near: strip coachNote (plan + exercise) to save tokens but keep exercises/setPlans
  const nearFuturePlans = futurePlansSrc
    .filter((p: unknown) => (p as Record<string, string>).date <= nearCutoff)
    .map((p: unknown) => {
      // deno-lint-ignore no-unused-vars
      const { coachNote: _planNote, ...planCore } = p as Record<string, unknown>;
      if (!Array.isArray(planCore.exercises)) return planCore;
      return {
        ...planCore,
        exercises: (planCore.exercises as Record<string, unknown>[]).map(
          // deno-lint-ignore no-unused-vars
          ({ coachNote: _cn, ...ex }) => ex
        ),
      };
    });

  // Far: compact one-liner per plan (id + date + type + label). Coach can still
  // reference these ids if it truly needs to modify them (rare).
  const farFuturePlans = futurePlansSrc
    .filter((p: unknown) => (p as Record<string, string>).date > nearCutoff)
    .map((p: unknown) => {
      const plan = p as Record<string, unknown>;
      if (plan.type === "run") {
        return `${plan.id} ${plan.date} run "${plan.label}" ${plan.distanceKm ?? "?"}km@${plan.pace ?? "?"}`;
      }
      const exCount = Array.isArray(plan.exercises) ? plan.exercises.length : 0;
      return `${plan.id} ${plan.date} fitness/${plan.category} "${plan.label}" (${exCount}ex)`;
    });

  const historySection = previousAnalyses.length > 0
    ? `\n## Tes analyses précédentes (mémoire coach)\n${previousAnalyses.map((a) => `### ${a.date}\n${a.analysis}`).join("\n\n")}\n`
    : "";

  const chatContextSection = chatContext
    ? `\n## Objectif déclaré récemment (conversation coach)\n${chatContext}\n`
    : "";

  const nearSection = nearFuturePlans.length > 0
    ? `## Programme J0-${NEAR_DAYS} (${nearFuturePlans.length} séances — modifiables)\n${JSON.stringify(nearFuturePlans)}`
    : `## Programme J0-${NEAR_DAYS}\nAucune séance programmée`;

  const farSection = farFuturePlans.length > 0
    ? `\n\n## Programme J${NEAR_DAYS + 1}+ (${farFuturePlans.length} séances — contexte seulement, n'y touche qu'en cas de besoin manifeste)\n${farFuturePlans.join("\n")}`
    : "";

  return `${historySection}${chatContextSection}## Séance réalisée (${sessionDate})
${sessionToText(session as Record<string, unknown>)}

## Plan coach prévu pour cette séance
${todayPlan ? JSON.stringify(todayPlan) : "Aucun plan coach défini pour cette séance"}

## 5 dernières séances (contexte de progression)
${recentToText(recentSessions)}

${nearSection}${farSection}

Analyse la séance et forme ton jugement de coach. Modifie les séances à venir si tu l'estimes pertinent, ou laisse le programme tel quel si tu penses qu'il est bien calibré. Retourne le JSON.`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    // Personal app — no auth gate needed.
    // The ANTHROPIC_API_KEY is server-side only; the function URL is not public.

    const body = await req.json();
    const { session, coachPlans = [], recentSessions = [], profileName = "Maxime", previousAnalyses = [], chatContext } = body;

    if (!session) {
      return new Response(JSON.stringify({ error: "session required" }), { status: 400, headers: CORS });
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }), { status: 500, headers: CORS });
    }

    // Call Anthropic API directly via fetch to avoid SDK version issues
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        // 2500 was too tight: a full modified fitness plan (~500 tokens each)
        // plus the analysis easily breaches it, truncating the JSON. 6000 gives
        // headroom for 4-5 adjusted plans without losing the response.
        max_tokens: 6000,
        system: [
          {
            type: "text",
            text: buildSystemPrompt(profileName),
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [{ role: "user", content: buildUserPrompt(session, coachPlans, recentSessions, previousAnalyses, chatContext) }],
      }),
    });

    if (!anthropicRes.ok) {
      const errBody = await anthropicRes.text();
      console.error("[analyze-session] Anthropic API error:", anthropicRes.status, errBody);
      throw new Error(`Anthropic API error ${anthropicRes.status}: ${errBody}`);
    }

    const anthropicData = await anthropicRes.json();
    const text = anthropicData.content?.[0]?.type === "text" ? (anthropicData.content[0].text as string) : "";
    const stopReason = anthropicData.stop_reason as string | undefined;
    const truncated = stopReason === "max_tokens";

    // Log token usage for monitoring
    if (anthropicData.usage) {
      console.log("[analyze-session] usage:", JSON.stringify(anthropicData.usage), "stop:", stopReason);
    }

    // Extract the outermost JSON object from the response
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    const truncSuffix = "\n\n⚠️ La réponse du coach était trop longue et a été tronquée — les modifications du programme n'ont pas pu être appliquées. Relance l'analyse pour réessayer.";

    let result: Record<string, unknown>;
    if (start === -1 || end === -1) {
      // Nothing parseable at all — surface the raw text if we can
      result = { analysis: (text || "Analyse reçue mais JSON malformé.") + (truncated ? truncSuffix : ""), modified_plans: [] };
    } else {
      const jsonStr = text.slice(start, end + 1);
      try {
        result = JSON.parse(jsonStr);
        if (truncated) {
          // Parsed, but response hit max_tokens — plans may be incomplete, drop them
          console.warn("[analyze-session] stop_reason=max_tokens, dropping modified_plans");
          result = { analysis: String(result.analysis ?? "") + truncSuffix, modified_plans: [] };
        }
      } catch {
        console.error("[analyze-session] JSON parse failed, attempting text fallback");
        const analysisMatch = jsonStr.match(/"analysis"\s*:\s*"((?:[^"\\]|\\.)*)"/);
        const rawAnalysis = analysisMatch ? analysisMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"') : "";
        result = { analysis: (rawAnalysis || "Analyse reçue mais JSON malformé.") + truncSuffix, modified_plans: [] };
      }
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
