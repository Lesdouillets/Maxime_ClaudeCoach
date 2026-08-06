// Edge Function — échange et rafraîchit les jetons Strava côté serveur.
//
// Strava ne supporte pas PKCE : l'échange d'un code contre des jetons, comme
// leur rafraîchissement, réclament le client_secret. Embarqué dans un client,
// ce secret est extractible — du bundle JS d'un site statique comme du binaire
// d'une app mobile. Il vit donc ici, dans les secrets du projet Supabase, et
// aucun client n'en a jamais connaissance.
//
// Déployer : supabase functions deploy strava-auth
// Secrets requis :
//   supabase secrets set STRAVA_CLIENT_ID=... STRAVA_CLIENT_SECRET=...

import { createClient } from "npm:@supabase/supabase-js@2";

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

/// Vérifie que l'appelant est bien un utilisateur connecté.
///
/// Sans ce contrôle, la fonction serait un oracle ouvert : n'importe qui
/// pourrait lui faire rafraîchir un jeton, et donc se servir du secret qu'on
/// cherche précisément à protéger.
async function requireUser(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;

  const client = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
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
  const userId = await requireUser(req);
  if (!userId) return json({ error: "Authentification requise" }, 401);

  if (!Deno.env.get("STRAVA_CLIENT_ID") || !Deno.env.get("STRAVA_CLIENT_SECRET")) {
    return json({ error: "Identifiants Strava non configurés sur le projet" }, 500);
  }

  let body: { action?: string; code?: string; refresh_token?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Corps de requête illisible" }, 400);
  }

  // Chaque utilisateur autorise son propre compte Strava : la fonction ne
  // connaît que la demande qu'on lui passe, jamais un compte tiers.
  const params = (() => {
    if (body.action === "exchange" && body.code) {
      return { code: body.code, grant_type: "authorization_code" };
    }
    if (body.action === "refresh" && body.refresh_token) {
      return { refresh_token: body.refresh_token, grant_type: "refresh_token" };
    }
    return null;
  })();

  if (!params) {
    return json(
      { error: "action attendue : 'exchange' avec code, ou 'refresh' avec refresh_token" },
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
