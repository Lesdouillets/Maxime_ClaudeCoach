import { memo } from "react";
import { JETBRAINS_MONO_TINY } from "@/lib/typography";

export const RACE_COLOR = "var(--color-race)";
// Ratio hauteur/largeur issu du viewBox original du designer (14 / 6.5)
const WING_ASPECT_RATIO = 14 / 6.5;

const WingBase = memo(function WingBase({ size = 8, flip = false }: { size?: number; flip?: boolean }) {
  const h = Math.round(size * WING_ASPECT_RATIO);
  return (
    <svg
      width={size}
      height={h}
      viewBox="0 0 6.5 14"
      fill="none"
      style={flip ? { transform: "scaleX(-1)" } : undefined}
    >
      <path
        d="M5.94415 0.4C6.42323 1.6 6.83133 3.4 6.10384 5.12727L6.10384 5.12728C6.01512 5.32728 5.9264 5.52728 5.8022 5.70909C6.0861 6.12728 6.61841 7.12727 6.26354 8.27272C6.13933 8.69091 5.89092 9.07272 5.55379 9.41818C5.74897 9.85454 5.94415 10.5636 5.64251 11.3455C5.3941 12.0182 4.86179 12.5636 4.04558 13.0182C3.22937 13.4727 2.12926 13.7592 2.12926 13.7592C2.12926 13.7592 1.80988 13.8546 1.18885 13.9818C1.13564 14 1.10016 14 1.06469 14H1.06465C0.780747 14 0.514592 13.8 0.461361 13.4909C0.40813 13.1454 0.621054 12.8182 0.958183 12.7455C3.61973 12.2182 4.31173 11.3636 4.48917 10.9091C4.59563 10.6545 4.57789 10.4182 4.56014 10.2C3.93912 10.5455 3.19388 10.8363 2.28896 11.0727C2.23573 11.0909 2.1825 11.0909 2.12926 11.0909C1.84537 11.0909 1.59695 10.9091 1.52598 10.6182C1.43726 10.2909 1.63244 9.94546 1.96957 9.85455C3.76168 9.38182 4.86179 8.70908 5.1102 7.8909C5.2344 7.47272 5.12794 7.05454 4.98599 6.74545C4.34722 7.36363 3.51327 7.8909 2.50188 8.2909C2.18249 8.41817 1.82762 8.25454 1.70342 7.92727C1.57921 7.59999 1.7389 7.23636 2.05829 7.10908C3.53101 6.52727 4.52466 5.69091 4.96825 4.61818C5.30538 3.85454 5.32312 3.03636 5.19892 2.29091C3.77942 4.21818 2.60833 4.92726 1.33681e-05 6.2909L0 5.12727C3.24709 3.43636 4.15204 2.49091 4.77307 0.436363C4.86179 0.181818 5.07471 0.0181818 5.34087 0C5.60702 0 5.83769 0.145454 5.94415 0.4Z"
        fill="currentColor"
      />
    </svg>
  );
});

export function WingRight({ size = 8 }: { size?: number }) {
  return <WingBase size={size} />;
}

export function WingLeft({ size = 8 }: { size?: number }) {
  return <WingBase size={size} flip />;
}

interface RaceBadgeProps {
  wingSize?: number;
  fontSize?: number;
}

export function RaceBadge({ wingSize = 8, fontSize = 9 }: RaceBadgeProps) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: RACE_COLOR }}>
      <WingLeft size={wingSize} />
      <span
        style={{
          ...JETBRAINS_MONO_TINY,
          fontSize,
          letterSpacing: "0.18em",
          color: RACE_COLOR,
          lineHeight: 1,
        }}
      >
        COURSE
      </span>
      <WingRight size={wingSize} />
    </span>
  );
}
