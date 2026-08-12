// Le profil de l'athlète, tel qu'il entre dans les prompts du coach.
//
// Vivait en dur, à l'identique, dans chat-coach et analyze-session : deux
// endroits à corriger pour un déménagement ou un kilo perdu, et rien pour
// signaler qu'ils avaient divergé.
//
// Les colonnes sont nullables et la table des pesées peut être vide : chaque
// champ absent retombe sur la valeur écrite en dur jusqu'ici, si bien qu'un
// profil vide produit exactement le prompt d'avant.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export interface AthleteProfile {
  ageYears?: number;
  heightCm?: number;
  weightKg?: number;
  targetWeightKg?: number;
}

/// Valeurs de repli — le prompt d'origine, mot pour mot.
const FALLBACK = {
  age: "33 ans",
  height: "1,83 m",
  weight: "~75 kg",
  target: "objectif 74 kg",
} as const;

/// Bornes plausibles d'une FC max humaine. La mémoire du coach est un JSON
/// qu'un modèle réécrit : une valeur aberrante déplacerait toutes les zones.
const MAX_HR_RANGE = { min: 150, max: 210 } as const;

const DEFAULT_ZONES = `## ZONES FC (FC max ~187 bpm)
- Z1 < 112 bpm | Z2 112–149 | Z3 149–168 | Z4 168–178 | Z5 > 178`;

/// Le profil corps et la dernière pesée, lus côté serveur.
///
/// Les deux apps appellent les mêmes fonctions : lire ici plutôt que de faire
/// remonter cinq champs par le corps de la requête évite qu'un client envoie
/// une valeur périmée, et laisse le web en profiter sans être modifié.
export async function loadAthleteProfile(
  supabase: SupabaseClient,
  userId?: string,
  profileId?: string,
): Promise<AthleteProfile> {
  if (!userId || !profileId) return {};

  const [profile, weight] = await Promise.all([
    supabase
      .from("profiles")
      .select("birth_year, height_cm, target_weight_kg")
      .eq("id", profileId)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("weight_entries")
      .select("kg")
      .eq("user_id", userId)
      .eq("profile_id", profileId)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // Le repli étant le prompt d'origine, une lecture en échec est autrement
  // indiscernable d'un profil vide : le coach repartirait sur « 33 ans,
  // ~75 kg » sans que rien ne le signale. C'est le seul endroit où échouer en
  // silence produit un conseil faux plutôt qu'un écran vide.
  if (profile.error) {
    console.error("[athleteProfile] lecture de profiles:", profile.error.message);
  }
  if (weight.error) {
    console.error("[athleteProfile] lecture de weight_entries:", weight.error.message);
  }

  const row = profile.data;
  const birthYear = inRange(row?.birth_year, 1900, new Date().getFullYear());

  // Les bornes sont posées ici, une fois. Valider en deux endroits laissait un
  // `AthleteProfile` dont l'interface ne garantissait rien : `heightCm` pouvait
  // valoir 18300 et seul le formatage s'en apercevait.
  return {
    ageYears: birthYear === undefined
      ? undefined
      : new Date().getFullYear() - birthYear,
    heightCm: inRange(row?.height_cm, 100, 250),
    targetWeightKg: inRange(row?.target_weight_kg, 20, 300),
    weightKg: inRange(weight.data?.kg, 20, 300),
  };
}

/// Un nombre s'il tient dans l'intervalle, sinon rien.
///
/// Sert de garde unique à tout ce qui vient de la base ou de la mémoire du
/// coach : hors bornes, c'est une faute de frappe ou une hallucination, pas une
/// mesure. Le repli est toujours la valeur écrite en dur dans le prompt.
function inRange(value: unknown, min: number, max: number): number | undefined {
  const parsed = Number(value);
  return value !== null && value !== undefined && Number.isFinite(parsed) &&
      parsed >= min && parsed <= max
    ? parsed
    : undefined;
}

/// La ligne d'identité du bloc PROFIL.
export function formatAthleteLine(profile: AthleteProfile): string {
  const age = profile.ageYears ? `${profile.ageYears} ans` : FALLBACK.age;

  const height = profile.heightCm
    ? `${(profile.heightCm / 100).toFixed(2).replace(".", ",")} m`
    : FALLBACK.height;

  // Le tilde disait l'approximation d'une valeur devinée. Une pesée datée n'en
  // est pas une.
  const weight = profile.weightKg
    ? `${formatKg(profile.weightKg)} kg`
    : FALLBACK.weight;

  const target = profile.targetWeightKg
    ? `objectif ${formatKg(profile.targetWeightKg)} kg`
    : FALLBACK.target;

  return `- ${age} | ${height} | ${weight} → ${target}`;
}

function formatKg(kg: number): string {
  return (Number.isInteger(kg) ? String(kg) : kg.toFixed(1)).replace(".", ",");
}

/// Le bloc ZONES FC, calculé depuis la FC max que le coach a retenue.
///
/// Les bornes historiques (112 / 149 / 168 / 178 sur 187) sont à 60, 80, 90 et
/// 95 % de la FC max, à un battement près. Tant que le coach n'a rien écrit, on
/// rend le bloc d'origine tel quel plutôt qu'un recalcul qui déplacerait une
/// borne d'un bpm sans raison.
export function formatHeartRateZones(maxHr?: number): string {
  const validated = validateMaxHr(maxHr);
  if (validated === undefined) return DEFAULT_ZONES;

  const z = (ratio: number) => Math.round(validated * ratio);

  return `## ZONES FC (FC max ${validated} bpm)
- Z1 < ${z(0.6)} bpm | Z2 ${z(0.6)}–${z(0.8)} | Z3 ${z(0.8)}–${z(0.9)} | Z4 ${z(0.9)}–${z(0.95)} | Z5 > ${z(0.95)}`;
}

export function validateMaxHr(maxHr?: unknown): number | undefined {
  if (maxHr === undefined || maxHr === null) return undefined;

  const validated = inRange(
    Math.round(Number(maxHr)),
    MAX_HR_RANGE.min,
    MAX_HR_RANGE.max,
  );

  if (validated === undefined) {
    // Sans trace, une valeur aberrante en mémoire est invisible : le coach ne
    // verrait que le bloc par défaut et pourrait la réécrire indéfiniment.
    console.warn(`[athleteProfile] FC max ignorée, hors bornes : ${maxHr}`);
  }
  return validated;
}

/// La FC max supposée tant que le coach n'a rien retenu — celle du bloc de
/// zones d'origine.
export const ASSUMED_MAX_HR = 187;

/// Le marqueur posé sur une séance dont une fraction dépasse la FC max
/// supposée, chaîne vide sinon.
///
/// Sans lui, la consigne ci-dessous ne pouvait jamais se déclencher : seule la
/// FC *moyenne* entrait dans le prompt, et une moyenne de course au-dessus de
/// 187 n'arrive pas. Le marqueur n'apparaît que dans ce cas précis, il ne coûte
/// donc rien le reste du temps.
export function maxHrMarker(laps: unknown, assumed: number): string {
  if (!Array.isArray(laps)) return "";

  const peak = laps.reduce((highest: number, lap: unknown) => {
    const value = Number((lap as Record<string, unknown>)?.max_heartrate);
    return Number.isFinite(value) && value > highest ? value : highest;
  }, 0);

  return peak > assumed
    ? ` ⚠FCmax observée ${Math.round(peak)} (supposée ${assumed})`
    : "";
}

/// La consigne qui autorise le coach à corriger la FC max — et lui interdit de
/// la deviner.
export const MAX_HR_INSTRUCTION =
  "- body.maxHr : seulement sur preuve — une séance marquée ⚠FCmax observée, ou une FC que " +
  "l'utilisateur rapporte au-dessus de la valeur supposée. Retiens la valeur observée telle " +
  "quelle. Une FC max ne se déduit ni de l'âge ni de la forme : l'entraînement baisse la FC de " +
  "repos, pas la FC max.";
