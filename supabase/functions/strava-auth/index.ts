// Edge Function — échange et rafraîchit les jetons Strava côté serveur.
//
// Strava ne supporte pas PKCE : l'échange d'un code contre des jetons, comme
// leur rafraîchissement, réclament le client_secret. Embarqué dans un client,
// ce secret est extractible — du bundle JS d'un site statique comme du binaire
// d'une app mobile. Il vit donc ici, dans les secrets du projet Supabase, et
// aucun client n'en a jamais connaissance.
//
// Deux projets à servir, chacun avec sa propre copie du secret. Sans
// `--project-ref`, le CLI vise le projet lié, ce qui n'est pas toujours celui
// qu'on croit :
//   supabase functions deploy strava-auth --project-ref <ref>
//   supabase secrets set STRAVA_CLIENT_ID=... STRAVA_CLIENT_SECRET=... --project-ref <ref>
//
// Une fonction déployée sans ses secrets répond 500 alors que le client, lui,
// se croit configuré : il ne connaît que l'identifiant public.

import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

/// Client agissant au nom de l'appelant, et son identifiant.
///
/// Le client porte le JWT reçu : toute lecture qu'il fera sera filtrée par les
/// politiques RLS au nom de cet utilisateur, et pas d'un autre.
type Caller = { id: string; client: SupabaseClient };

/// Vérifie que l'appelant est bien un utilisateur connecté.
///
/// Sans ce contrôle, la fonction serait un oracle ouvert : n'importe qui
/// pourrait lui faire rafraîchir un jeton, et donc se servir du secret qu'on
/// cherche précisément à protéger.
async function requireCaller(req: Request): Promise<Caller | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;

  const client = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, client };
}

/// Le jeton de rafraîchissement rangé pour ce profil, lu au nom de l'appelant.
///
/// C'est le cœur de la garantie : la fonction ne rafraîchit **jamais** un jeton
/// qu'on lui présente, seulement celui qu'elle va chercher elle-même. Sinon,
/// détenir le jeton d'autrui — fuite, sauvegarde, journal — suffirait à s'en
/// servir, puisque c'est précisément le secret qui manquait pour l'exploiter.
async function ownRefreshToken(
  caller: Caller,
  profileId: string,
): Promise<string | null> {
  const { data } = await caller.client
    .from("strava_tokens")
    .select("tokens")
    .eq("user_id", caller.id)
    .eq("profile_id", profileId)
    .maybeSingle();

  const token = (data?.tokens as Record<string, unknown> | undefined)
    ?.refresh_token;
  return typeof token === "string" ? token : null;
}

/// Relaie la demande à Strava en y ajoutant les identifiants de l'application.
async function callStrava(
  params: Record<string, string>,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const res = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: Deno.env.get("STRAVA_CLIENT_ID"),
      client_secret: Deno.env.get("STRAVA_CLIENT_SECRET"),
      ...params,
    }),
  });

  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  // L'authentification passe avant tout le reste : la clé anonyme suffit à
  // franchir la passerelle Supabase, donc c'est ici que se joue le contrôle.
  // Répondre quoi que ce soit d'autre en premier — même « mal configuré » —
  // renseignerait un appelant qui n'a rien à savoir.
  const caller = await requireCaller(req);
  if (!caller) return json({ error: "Authentification requise" }, 401);

  if (!Deno.env.get("STRAVA_CLIENT_ID") || !Deno.env.get("STRAVA_CLIENT_SECRET")) {
    return json({ error: "Identifiants Strava non configurés sur le projet" }, 500);
  }

  let body: { action?: string; code?: string; profile_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Corps de requête illisible" }, 400);
  }

  // L'échange n'a pas besoin de garde supplémentaire : un code d'autorisation
  // ne délivre que les jetons de celui qui vient de donner son consentement.
  let params: Record<string, string> | null = null;

  if (body.action === "exchange" && typeof body.code === "string") {
    params = { code: body.code, grant_type: "authorization_code" };
  } else if (body.action === "refresh" && typeof body.profile_id === "string") {
    const refreshToken = await ownRefreshToken(caller, body.profile_id);
    if (!refreshToken) {
      return json({ error: "Aucun compte Strava relié à ce profil" }, 404);
    }
    params = { refresh_token: refreshToken, grant_type: "refresh_token" };
  }

  if (!params) {
    return json(
      { error: "action attendue : 'exchange' avec code, ou 'refresh' avec profile_id" },
      400,
    );
  }

  try {
    const { ok, status, data } = await callStrava(params);
    if (!ok) {
      console.error("[strava-auth] refus de Strava", status, data);
      return json({ error: "Strava a refusé la demande", status }, 502);
    }
    return json(data);
  } catch (err) {
    console.error("[strava-auth] échec de l'appel", err);
    return json({ error: "Strava injoignable" }, 502);
  }
});
