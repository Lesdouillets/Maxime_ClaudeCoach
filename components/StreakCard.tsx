"use client";

import type { CSSProperties } from "react";
import { StreakBar } from "./StreakBar";
import Card from "./ui/Card";
import Label from "./ui/Label";
import { ARCHIVO_WIDE_BOLD } from "@/lib/typography";
import type { StreakResult } from "@/lib/streak";

interface StreakCardProps {
  streakResult: StreakResult;
}

const CARD_STYLE: CSSProperties = {
  padding: 12,
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const HEADER_ROW_STYLE: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  height: 52,
};

const ICON_WRAPPER_STYLE: CSSProperties = {
  width: 52,
  height: 52,
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
};

const LABEL_COLUMN_STYLE: CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const STREAK_VALUE_ROW_STYLE: CSSProperties = {
  lineHeight: "22px",
  display: "flex",
  alignItems: "baseline",
  gap: 4,
};

const STREAK_LABELS_ROW_STYLE: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  marginTop: -4,
};

export function StreakCard({ streakResult }: StreakCardProps) {
  const { streakCount } = streakResult;

  return (
    <Card variant="neon-bg" className="w-full" style={CARD_STYLE}>
      <div style={HEADER_ROW_STYLE}>
        <div style={ICON_WRAPPER_STYLE}>
          <svg width="52" height="52" viewBox="0 0 12 12" fill="none">
            <path d="M9.48204 4.81938L8.04702 2.10021C7.96724 1.94885 7.78408 1.89269 7.63748 1.97529C7.63315 1.97773 7.62844 1.98058 7.62451 1.98302L7.2523 2.21861L6.21895 1.09677C6.10379 0.971861 5.91277 0.967382 5.79211 1.08619C5.78857 1.08945 5.78542 1.09311 5.78189 1.09677L4.74894 2.21861L4.37595 1.98343C4.23366 1.89351 4.04776 1.9403 3.96129 2.08759C3.95893 2.09166 3.95618 2.09614 3.95421 2.10061L2.51919 4.81979C1.43161 6.80983 2.10808 9.3362 4.03078 10.4625C5.9535 11.5884 8.39349 10.8881 9.48148 8.89767C10.1728 7.63261 10.1728 6.08485 9.48148 4.82021L9.48204 4.81938ZM6.00085 10.3746C4.12482 10.3742 2.60458 8.79956 2.60498 6.85744C2.60498 6.25037 2.75708 5.65383 3.04597 5.12573L3.04833 5.12125L4.33242 2.68727L4.64253 2.88298C4.76358 2.95948 4.92001 2.93832 5.01788 2.83172L6.00087 1.76529L6.98347 2.83172C7.08134 2.93791 7.23776 2.95948 7.35883 2.88298L7.66893 2.68727L8.95302 5.12125L8.95538 5.12573C9.87981 6.81556 9.30559 8.96101 7.6733 9.91806C7.16353 10.2171 6.58725 10.3746 6.00085 10.3746ZM7.15243 6.79682C6.74406 6.65562 6.42334 6.32401 6.28695 5.90085C6.23428 5.73728 6.0633 5.64857 5.90491 5.7031C5.8149 5.73443 5.74415 5.80727 5.7139 5.90085C5.57672 6.3232 5.25639 6.65481 4.84842 6.79682C4.69042 6.85134 4.60473 7.02834 4.6574 7.19231C4.68767 7.28549 4.75802 7.35873 4.84842 7.39006C5.25679 7.53125 5.57751 7.86286 5.7139 8.28602C5.76656 8.44959 5.93754 8.5383 6.09593 8.48377C6.18594 8.45244 6.25669 8.3796 6.28695 8.28602C6.42412 7.86367 6.74445 7.53206 7.15243 7.39006C7.31043 7.33553 7.39611 7.15853 7.34344 6.99456C7.31357 6.90138 7.24282 6.82814 7.15243 6.79682ZM6.00085 4.43731C4.58394 4.43731 3.43508 5.62665 3.43508 7.09347C3.43508 8.5603 4.58354 9.74963 6.00085 9.74963C7.41776 9.74963 8.56662 8.5603 8.56662 7.09347C8.56465 5.62748 7.41695 4.43898 6.00085 4.43731ZM6.00085 9.12465C4.91719 9.12465 4.03879 8.21526 4.03879 7.09347C4.03879 5.97169 4.91724 5.06229 6.00085 5.06229C7.08451 5.06229 7.96291 5.97169 7.96291 7.09347C7.96134 8.21489 7.08367 9.1234 6.00085 9.12465Z" fill="var(--color-neon)" />
          </svg>
        </div>

        <div style={LABEL_COLUMN_STYLE}>
          <Label size="sm" color="muted">Série en cours</Label>
          <p style={STREAK_VALUE_ROW_STYLE}>
            <span style={{ ...ARCHIVO_WIDE_BOLD, fontSize: 28, lineHeight: "22px", color: "var(--color-neon-text)" }}>
              {streakCount}
            </span>
            <span style={{ ...ARCHIVO_WIDE_BOLD, fontSize: 14, lineHeight: "14px", color: "var(--color-neon-text)" }}>
              {streakCount <= 1 ? "semaine" : "semaines"}
            </span>
          </p>
        </div>
      </div>

      <StreakBar streakResult={streakResult} />
      <div style={STREAK_LABELS_ROW_STYLE}>
        <Label size="xs" color="dim">- 8 sem</Label>
        <Label size="xs" color="dim">Cette sem</Label>
      </div>
    </Card>
  );
}
