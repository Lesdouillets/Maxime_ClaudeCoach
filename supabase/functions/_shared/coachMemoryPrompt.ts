// La mémoire persistante du coach, telle qu'elle entre dans les prompts.
//
// Vivait en double, à l'identique, dans chat-coach et analyze-session. Les deux
// copies ont divergé en robustesse — l'une gardait chaque sous-objet, l'autre
// déréférençait directement un objet venu du client — et le dernier changement
// a dû être appliqué deux fois à la main.
//
// Une fonction edge Deno ne peut pas importer depuis le client Next.js ; elle
// peut importer d'ici, comme le prouve `athleteProfile.ts`.

import type { AthleteProfile } from "./athleteProfile.ts";

/// Formate la mémoire pour un prompt système — quelques lignes, ou rien.
///
/// [athlete] sert à trancher sur le poids : celui du bloc PROFIL est une pesée
/// datée, celui de la mémoire est ce que le coach a cru comprendre d'une
/// conversation. Les donner tous les deux, c'est lui laisser deux chiffres
/// contradictoires à arbitrer.
export function formatCoachMemoryForPrompt(
  memory: Record<string, unknown>,
  athlete: AthleteProfile,
): string {
  const lines: string[] = [];

  const run = (memory.run ?? {}) as Record<string, unknown>;
  const runParts: string[] = [];
  if (run.trend) runParts.push(String(run.trend));
  if (run.lastLongRun) {
    runParts.push(`Dernière sortie longue : ${run.lastLongRun}`);
  }
  if (run.nextRace) runParts.push(`Prochaine course : ${run.nextRace}`);
  if (run.notes) runParts.push(`⚠️ ${run.notes}`);
  if (runParts.length > 0) lines.push(`Run : ${runParts.join(" | ")}`);

  const fitness = (memory.fitness ?? {}) as Record<string, unknown>;
  const fitParts: string[] = [];
  if (fitness.cycle) fitParts.push(String(fitness.cycle));
  for (const [group, label] of [["upperBody", "Upper"], ["lowerBody", "Lower"]]) {
    const body = (fitness[group] ?? {}) as Record<string, unknown>;
    if (!body.keyLifts) continue;

    const lifts = Object.entries(body.keyLifts as Record<string, string>)
      .map(([name, value]) => `${name} ${value}`)
      .join(", ");
    if (lifts) fitParts.push(`${label}: ${lifts}`);
  }
  if (fitParts.length > 0) lines.push(`Fitness : ${fitParts.join(" | ")}`);

  // Chaque valeur que la base porte déjà est retirée d'ici : le bloc PROFIL
  // affiche une pesée datée et un objectif saisi, celui-ci ne garde que ce que
  // le coach a déduit d'une conversation. Les donner deux fois, c'est lui
  // laisser deux chiffres à arbitrer.
  //
  // Écart assumé avec l'ancienne version : elle conditionnait toute la ligne à
  // la présence de `currentWeight`, si bien qu'un objectif connu disparaissait
  // parce qu'un champ sans rapport manquait.
  const body = (memory.body ?? {}) as Record<string, unknown>;
  const bodyParts: string[] = [];
  if (athlete.weightKg === undefined && body.currentWeight !== undefined) {
    bodyParts.push(`${body.currentWeight}kg`);
  }
  if (athlete.targetWeightKg === undefined && body.target !== undefined) {
    bodyParts.push(`objectif ${body.target}kg`);
  }
  if (body.trend) bodyParts.push(`tendance ${body.trend}`);
  if (bodyParts.length > 0) lines.push(`Poids : ${bodyParts.join(", ")}`);

  const keyNotes = Array.isArray(memory.keyNotes)
    ? memory.keyNotes as Array<{ date: string; note: string }>
    : [];
  const recentNotes = keyNotes.slice(-3);
  if (recentNotes.length > 0) {
    lines.push(
      `Notes : ${recentNotes.map((n) => `[${n.date}] ${n.note}`).join(" | ")}`,
    );
  }

  if (lines.length === 0) return "";
  return `## Mémoire coach (contexte persistant)\n${lines.join("\n")}`;
}
