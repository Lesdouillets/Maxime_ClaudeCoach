import type { CSSProperties } from "react";

// Base partagée Archivo 700 wdth=110 — si la valeur wdth change dans Figma, modifier ici uniquement
export const ARCHIVO_WIDE_BOLD: CSSProperties = {
  fontFamily: "'Archivo', sans-serif",
  fontWeight: 700,
  fontVariationSettings: '"wdth" 110',
};

// Label monospace 12px — titres de section, étiquettes
export const JETBRAINS_MONO_LABEL: CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
  fontWeight: 700,
  fontSize: 12,
  lineHeight: "12px",
  letterSpacing: "0.10em",
  textTransform: "uppercase",
  color: "var(--color-muted)",
};

// Label monospace 9px — légendes, unités de stats
export const JETBRAINS_MONO_TINY: CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
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
  color: "#fff",
};

// Unité associée à une valeur de stat (9px mono)
export const STAT_UNIT_STYLE: CSSProperties = {
  ...JETBRAINS_MONO_TINY,
  color: "#888",
  marginLeft: 2,
};
