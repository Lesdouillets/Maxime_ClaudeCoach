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

  return {
    ageYears: age(positive(row?.birth_year)),
    heightCm: positive(row?.height_cm),
    targetWeightKg: positive(row?.target_weight_kg),
    weightKg: positive(weight.data?.kg),
  };
}

/// Une mesure vaut d'être reprise si elle est un nombre strictement positif.
/// Un zéro n'est pas une taille, ni un poids : c'est une colonne jamais
/// remplie. Un seul prédicat pour les quatre champs, sinon `formatAthleteLine`
/// et `hasMeasuredWeight` finissent par ne pas être d'accord sur le zéro.
function positive(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

/// L'âge, à la date d'anniversaire près — la seule année suffit à un prompt et
/// évite de stocker une date complète.
function age(birthYear?: number): number | undefined {
  return birthYear === undefined
    ? undefined
    : new Date().getFullYear() - birthYear;
}

/// Bornes au-delà desquelles une valeur vient d'une faute de frappe et non
/// d'une mesure. Une frappe de trop dans les réglages (`9999`) donnerait au
/// coach un athlète de -7973 ans.
const PLAUSIBLE = {
  ageYears: { min: 10, max: 100 },
  heightCm: { min: 100, max: 250 },
} as const;

function plausible(
  value: number | undefined,
  range: { min: number; max: number },
): number | undefined {
  return value !== undefined && value >= range.min && value <= range.max
    ? value
    : undefined;
}

/// La ligne d'identité du bloc PROFIL.
export function formatAthleteLine(profile: AthleteProfile): string {
  const ageYears = plausible(profile.ageYears, PLAUSIBLE.ageYears);
  const heightCm = plausible(profile.heightCm, PLAUSIBLE.heightCm);

  const age = ageYears ? `${ageYears} ans` : FALLBACK.age;

  const height = heightCm
    ? `${(heightCm / 100).toFixed(2).replace(".", ",")} m`
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

  const parsed = Number(maxHr);
  const rounded = Math.round(parsed);

  if (
    !Number.isFinite(parsed) ||
    rounded < MAX_HR_RANGE.min ||
    rounded > MAX_HR_RANGE.max
  ) {
    // Sans trace, une valeur aberrante en mémoire est invisible : le coach ne
    // verrait que le bloc par défaut et pourrait la réécrire indéfiniment.
    console.warn(`[athleteProfile] FC max ignorée, hors bornes : ${maxHr}`);
    return undefined;
  }

  return rounded;
}

/// La FC max supposée tant que le coach n'a rien retenu — celle du bloc de
/// zones d'origine.
export const ASSUMED_MAX_HR = 187;

/// Le marqueur posé sur une séance dont la FC dépasse la FC max supposée.
///
/// Sans lui, la consigne ci-dessous ne pouvait jamais se déclencher : seule la
/// FC *moyenne* entrait dans le prompt, et une moyenne de course au-dessus de
/// 187 n'arrive pas. Le marqueur n'apparaît que dans ce cas précis, donc il ne
/// coûte rien le reste du temps.
export function maxHrAlert(observed: number, assumed: number): string {
  return ` ⚠FCmax observée ${Math.round(observed)} (supposée ${assumed})`;
}

/// La plus haute FC relevée sur les fractions d'une séance, si elle dépasse la
/// FC max supposée.
export function exceedingMaxHr(
  laps: unknown,
  assumed: number,
): number | undefined {
  if (!Array.isArray(laps)) return undefined;

  const peak = laps.reduce((highest: number, lap: unknown) => {
    const value = Number((lap as Record<string, unknown>)?.max_heartrate);
    return Number.isFinite(value) && value > highest ? value : highest;
  }, 0);

  return peak > assumed ? peak : undefined;
}

/// La consigne qui autorise le coach à corriger la FC max — et lui interdit de
/// la deviner.
export const MAX_HR_INSTRUCTION =
  "- body.maxHr : UNIQUEMENT si une séance porte le marqueur ⚠FCmax observée, " +
  "ou si l'utilisateur rapporte lui-même une FC plus haute que la FC max supposée. " +
  "Retiens alors la valeur observée, pas une estimation. " +
  "Une FC max ne se déduit ni de l'âge ni des progrès : l'entraînement baisse la FC de repos " +
  "et la FC à allure donnée, pas la FC max. Ne la baisse jamais de toi-même, et ne l'invente jamais.";
