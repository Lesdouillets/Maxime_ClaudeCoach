// Edge Function — analyse une séance terminée et adapte le programme coach
// Déployer : supabase functions deploy analyze-session
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
- Ou **ne rien changer** si le programme est bien calibré et que la séance s'est déroulée comme prévu

La variété est un outil de coach à part entière — si un même exercice revient trop souvent, tu peux le remplacer ponctuellement pour éviter la monotonie ou cibler différemment un groupe musculaire. Mais sois cohérent avec les objectifs et le niveau de l'athlète.

Quelques repères à ta disposition (pas des règles automatiques) :
- Les commentaires de ressenti sont tes données les plus précieuses : lis-les comme un athlète te parlerait
- La position dans le cycle (semaine de charge vs décharge) influence tes choix
- Pour le run : allure, FC et ressenti sont à croiser ensemble
- Toujours garder ≥ 2 exercices de tirage par séance haut du corps
- Ne jamais supprimer les exercices fondamentaux (squat, deadlift, développé) sans raison explicite

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

### Règles pour modified_plans
- Inclus le plan COMPLET avec TOUS ses exercices (pas seulement les exercices modifiés)
- Conserve l'ID du plan existant tel qu'il t'a été fourni en contexte
- Tableau vide uniquement si vraiment aucun ajustement n'est justifié

Format séance salle (fitness) :
{"id":"coach-xxx","date":"YYYY-MM-DD","type":"fitness","category":"upper","label":"HAUT DU CORPS — Semaine N","coachNote":"...","exercises":[{"name":"Développé couché haltères","sets":4,"reps":8,"weight":20,"restSeconds":90,"coachNote":"..."}]}

Format séance run :
{"id":"coach-run-xxx","date":"YYYY-MM-DD","type":"run","label":"RUN Z2 — Mercredi","coachNote":"...","distanceKm":8,"pace":"6:00","targetHR":"112-149","targetZone":"Z2"}`;
}

function buildUserPrompt(
  session: unknown,
  coachPlans: unknown[],
  recentSessions: unknown[],
  previousAnalyses: Array<{ date: string; analysis: string }> = [],
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

  const futurePlans = coachPlans.filter((p: unknown) => {
    const plan = p as Record<string, string>;
    return plan.date > sessionDate;
  });

  const historySection = previousAnalyses.length > 0
    ? `\n## Tes analyses précédentes (mémoire coach)\n${previousAnalyses.map((a) => `### ${a.date}\n${a.analysis}`).join("\n\n")}\n`
    : "";

  return `${historySection}## Séance réalisée (${sessionDate})
${JSON.stringify(session, null, 2)}

## Plan coach prévu pour cette séance
${todayPlan ? JSON.stringify(todayPlan, null, 2) : "Aucun plan coach défini pour cette séance"}

## 5 dernières séances (contexte de progression)
${JSON.stringify(recentSessions, null, 2)}

## Programme à venir (${futurePlans.length} séances) — à adapter si nécessaire
${futurePlans.length > 0 ? JSON.stringify(futurePlans, null, 2) : "Aucune séance programmée à venir"}

Analyse la séance et forme ton jugement de coach. Modifie les séances à venir si tu l'estimes pertinent, ou laisse le programme tel quel si tu penses qu'il est bien calibré. Retourne le JSON.`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    // Verify request comes from our app via the anon key header
    // (sent automatically by the Supabase JS client on every functions.invoke call)
    const requestApiKey = req.headers.get("apikey");
    const expectedAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    if (!requestApiKey || requestApiKey !== expectedAnonKey) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS });
    }

    const body = await req.json();
    const { session, coachPlans = [], recentSessions = [], profileName = "Maxime", previousAnalyses = [] } = body;

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
        max_tokens: 2048,
        system: buildSystemPrompt(profileName),
        messages: [{ role: "user", content: buildUserPrompt(session, coachPlans, recentSessions, previousAnalyses) }],
      }),
    });

    if (!anthropicRes.ok) {
      const errBody = await anthropicRes.text();
      console.error("[analyze-session] Anthropic API error:", anthropicRes.status, errBody);
      throw new Error(`Anthropic API error ${anthropicRes.status}: ${errBody}`);
    }

    const anthropicData = await anthropicRes.json();
    const text = anthropicData.content?.[0]?.type === "text" ? (anthropicData.content[0].text as string) : "";

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
