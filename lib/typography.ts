import type { CSSProperties } from "react";

// Base partagée Archivo 700 wdth=110 — si la valeur wdth change dans Figma, modifier ici uniquement
export const ARCHIVO_WIDE_BOLD: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontWeight: 700,
  fontVariationSettings: '"wdth" 110',
};

// Nom d'exercice — Archivo Wide Bold 18px
export const EXERCISE_NAME_STYLE: CSSProperties = {
  ...ARCHIVO_WIDE_BOLD,
  fontSize: 18,
  lineHeight: "22px",
  color: "var(--color-text)",
};

// Base partagée JetBrains Mono 12px — LABEL et DATA en dérivent
const JETBRAINS_MONO_12: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontWeight: 700,
  fontSize: 12,
  lineHeight: "12px",
  letterSpacing: "0.10em",
  color: "var(--color-muted)",
};

// Label monospace 12px — titres de section, étiquettes (toujours uppercase)
export const JETBRAINS_MONO_LABEL: CSSProperties = { ...JETBRAINS_MONO_12, textTransform: "uppercase" };

// Données mono 12px — reps, poids, pace, métadonnées (pas d'uppercase)
export const JETBRAINS_MONO_DATA: CSSProperties = JETBRAINS_MONO_12;

// Label monospace 9px — légendes, unités de stats
export const JETBRAINS_MONO_TINY: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontWeight: 700,
  fontSize: 9,
  lineHeight: "12px",
  letterSpacing: "0.10em",
  textTransform: "uppercase",
  color: "var(--color-muted)",
};

// Valeur chiffrée dans une carte de stat (22px)
export const STAT_VALUE_STYLE: CSSProperties = {
  ...ARCHIVO_WIDE_BOLD,
  fontSize: 22,
  lineHeight: "22px",
  letterSpacing: 0,
  color: "var(--color-text)",
};

// Unité associée à une valeur de stat (9px mono)
export const STAT_UNIT_STYLE: CSSProperties = {
  ...JETBRAINS_MONO_TINY,
  color: "var(--color-secondary)",
  marginLeft: 2,
};
