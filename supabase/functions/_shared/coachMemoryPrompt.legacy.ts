// Copie figée de formatCoachMemoryForPrompt tel qu'il était avant le partage
// du module (dépôt à `main`, 2026-08-11). Sert de témoin de non-régression :
// le prompt du coach ne doit pas changer d'un caractère.

export function legacyCoachMemoryPrompt(memory: Record<string, unknown>): string {
  const lines: string[] = [];

  const run = (memory.run ?? {}) as Record<string, unknown>;
  const runParts: string[] = [];
  if (run.trend) runParts.push(String(run.trend));
  if (run.lastLongRun) runParts.push(`Dernière sortie longue : ${run.lastLongRun}`);
  if (run.nextRace) runParts.push(`Prochaine course : ${run.nextRace}`);
  if (run.notes) runParts.push(`⚠️ ${run.notes}`);
  if (runParts.length > 0) lines.push(`Run : ${runParts.join(" | ")}`);

  const fitness = (memory.fitness ?? {}) as Record<string, unknown>;
  const fitParts: string[] = [];
  if (fitness.cycle) fitParts.push(String(fitness.cycle));
  const upperBody = (fitness.upperBody ?? {}) as Record<string, unknown>;
  if (upperBody.keyLifts) {
    const lifts = Object.entries(upperBody.keyLifts as Record<string, string>)
      .map(([k, v]) => `${k} ${v}`)
      .join(", ");
    if (lifts) fitParts.push(`Upper: ${lifts}`);
  }
  const lowerBody = (fitness.lowerBody ?? {}) as Record<string, unknown>;
  if (lowerBody.keyLifts) {
    const lifts = Object.entries(lowerBody.keyLifts as Record<string, string>)
      .map(([k, v]) => `${k} ${v}`)
      .join(", ");
    if (lifts) fitParts.push(`Lower: ${lifts}`);
  }
  if (fitParts.length > 0) lines.push(`Fitness : ${fitParts.join(" | ")}`);

  const body = (memory.body ?? {}) as Record<string, unknown>;
  if (body.currentWeight !== undefined) {
    const bodyParts: string[] = [`${body.currentWeight}kg`];
    if (body.target !== undefined) bodyParts.push(`objectif ${body.target}kg`);
    if (body.trend) bodyParts.push(`tendance ${body.trend}`);
    lines.push(`Poids : ${bodyParts.join(", ")}`);
  }

  const keyNotes = Array.isArray(memory.keyNotes) ? memory.keyNotes as Array<{ date: string; note: string }> : [];
  const recentNotes = keyNotes.slice(-3);
  if (recentNotes.length > 0) {
    lines.push(`Notes : ${recentNotes.map((n) => `[${n.date}] ${n.note}`).join(" | ")}`);
  }

  if (lines.length === 0) return "";
  return `## Mémoire coach (contexte persistant)\n${lines.join("\n")}`;
}
