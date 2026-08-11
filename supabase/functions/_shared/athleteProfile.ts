// Le profil de l'athlète, tel qu'il entre dans les prompts du coach.
//
// Vivait en dur, à l'identique, dans chat-coach et analyze-session : deux
// endroits à corriger pour un déménagement ou un kilo perdu, et rien pour
// signaler qu'ils avaient divergé.
//
// Les colonnes sont nullables et la table des pesées peut être vide : chaque
// champ absent retombe sur la valeur écrite en dur jusqu'ici, si bien qu'un
// profil vide produit exactement le prompt d'avant.

// Les deux fonctions importent supabase-js par des spécificateurs différents
// (`npm:` d'un côté, `https://esm.sh/` de l'autre) : leurs types `SupabaseClient`
// ne sont pas les mêmes pour le compilateur. On ne demande donc que ce dont on
// se sert — un point d'entrée `from` — plutôt que de figer l'un des deux.
// deno-lint-ignore no-explicit-any
type QueryClient = { from: (table: string) => any };

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
  supabase: QueryClient,
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

  const row = profile.data;
  const birthYear = row?.birth_year as number | null | undefined;

  return {
    ageYears: birthYear ? new Date().getFullYear() - birthYear : undefined,
    heightCm: (row?.height_cm as number | null) ?? undefined,
    targetWeightKg: numberOrUndefined(row?.target_weight_kg),
    weightKg: numberOrUndefined(weight.data?.kg),
  };
}

function numberOrUndefined(value: unknown): number | undefined {
  const parsed = Number(value);
  return value === null || value === undefined || Number.isNaN(parsed)
    ? undefined
    : parsed;
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
  const parsed = Number(maxHr);
  if (!Number.isFinite(parsed)) return undefined;

  const rounded = Math.round(parsed);
  return rounded >= MAX_HR_RANGE.min && rounded <= MAX_HR_RANGE.max
    ? rounded
    : undefined;
}

/// La consigne qui autorise le coach à corriger la FC max — et lui interdit de
/// la deviner.
export const MAX_HR_INSTRUCTION =
  "- body.maxHr : UNIQUEMENT si une activité montre une FC supérieure à la FC max supposée. " +
  "Une FC max ne se déduit ni de l'âge ni des progrès : l'entraînement baisse la FC de repos et " +
  "la FC à allure donnée, pas la FC max. Ne la baisse jamais de toi-même.";
