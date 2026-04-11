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

## RÈGLES D'ADAPTATION — APPLIQUE LES SYSTÉMATIQUEMENT

### Séance fitness — pour CHAQUE exercice, décide :
- ✅ Tous les sets réalisés au poids prévu, commentaires neutres ou positifs → **augmente le poids** sur cet exercice dans la prochaine séance du même type (+2,5 kg petits muscles / +5 kg grands muscles)
- ⚠️ Poids réduit en cours de séance, sets incomplets, ou mention RPE très élevé / essoufflement excessif → **maintiens le même poids** sur les 2 prochaines séances similaires
- ❌ Abandon ou douleur mentionnée → **réduis le poids de 5%** sur les 2 prochaines séances

### Séance run — décide :
- Allure réalisée plus rapide que cible ET FC dans la zone cible → **réduis l'allure cible de 5 s/km** sur le prochain run similaire (gain confirmé)
- FC supérieure à la zone cible → **augmente l'allure cible (ralentir) de 5–10 s/km**
- Distance supérieure de +10% au plan → **ne pas augmenter** la semaine suivante

## PROCESSUS
1. Lis la séance réalisée et le plan prévu pour cette séance
2. Pour chaque exercice/paramètre, applique les règles ci-dessus
3. Regarde les prochaines séances du même type dans le programme fourni
4. Si des charges/allures doivent changer → inclus ces séances dans modified_plans
5. Explique en 2-3 phrases ce que tu observes et ce que tu modifies (ou pourquoi tu ne modifies rien)

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

  // Separate upcoming plans from today's plan for clarity
  const futurePlans = coachPlans.filter((p: unknown) => {
    const plan = p as Record<string, string>;
    return plan.date > sessionDate;
  });

  return `## Séance réalisée (${sessionDate})
${JSON.stringify(session, null, 2)}

## Plan coach prévu pour cette séance
${todayPlan ? JSON.stringify(todayPlan, null, 2) : "Aucun plan coach défini pour cette séance"}

## 5 dernières séances (contexte de progression)
${JSON.stringify(recentSessions, null, 2)}

## Programme à venir (${futurePlans.length} séances) — à adapter si nécessaire
${futurePlans.length > 0 ? JSON.stringify(futurePlans, null, 2) : "Aucune séance programmée à venir"}

Applique les règles d'adaptation. Pour chaque exercice de la séance, vérifie si la charge doit changer dans les prochaines séances du même type. Retourne le JSON.`;
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
    const { session, coachPlans = [], recentSessions = [], profileName = "Maxime" } = body;

    if (!session) {
      return new Response(JSON.stringify({ error: "session required" }), { status: 400, headers: CORS });
    }

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: buildSystemPrompt(profileName),
      messages: [{ role: "user", content: buildUserPrompt(session, coachPlans, recentSessions) }],
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
