"use client";

import { useMemo, useState } from "react";
import { useSession, type LiveExercise } from "@/contexts/SessionContext";
import { ARCHIVO_WIDE_BOLD, EXERCISE_NAME_STYLE, JETBRAINS_MONO_LABEL } from "@/lib/typography";
import { NoteIcon, CheckIcon } from "@/components/icons";

interface Props {
  exercise: LiveExercise;
  onOpenNote: () => void;
}

const COL_HEADER_STYLE = { ...JETBRAINS_MONO_LABEL, fontSize: 10, color: "var(--color-dim)" };
const NUM_STYLE = { ...ARCHIVO_WIDE_BOLD, fontSize: 22, lineHeight: 1 };

export default function ActiveExerciseCard({ exercise, onOpenNote }: Props) {
  const session = useSession();
  const activeSetIdx = useMemo(
    () => (exercise.setLogs ?? []).findIndex((s) => !s.done),
    [exercise.setLogs],
  );

  // Draft local pour les inputs : clear on focus, revert si vide au blur
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const startEdit = (key: string) =>
    setDrafts((d) => ({ ...d, [key]: "" }));

  const updateDraft = (key: string, val: string) =>
    setDrafts((d) => ({ ...d, [key]: val }));

  const commitEdit = (
    key: string,
    onSave: (v: number) => void,
    isFloat = false,
  ) => {
    const raw = drafts[key];
    if (raw !== undefined) {
      const parsed = isFloat ? parseFloat(raw) : parseInt(raw, 10);
      if (raw !== "" && !isNaN(parsed)) onSave(parsed);
      setDrafts((d) => { const next = { ...d }; delete next[key]; return next; });
    }
  };

  const getVal = (key: string, sessionVal: number): string => {
    if (key in drafts) return drafts[key];
    return sessionVal === 0 ? "" : String(sessionVal);
  };

  return (
    <div
      className="relative rounded-2xl overflow-visible"
      style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-surface-3)" }}
    >
      <div className="flex items-start justify-between px-4 pt-4 pb-3">
        <div className="flex-1 min-w-0 pr-2">
          <p style={{ ...JETBRAINS_MONO_LABEL, fontSize: 11, lineHeight: "13px", color: "var(--color-neon-text)" }}>
            Exercice en cours
          </p>
          <p style={{ ...EXERCISE_NAME_STYLE, fontSize: 22, lineHeight: "26px", marginTop: 0 }}>
            {exercise.name}
          </p>
        </div>
        <button
          onClick={onOpenNote}
          className="w-9 h-9 rounded-full flex items-center justify-center press-effect flex-shrink-0 mt-0.5"
          aria-label="Note"
        >
          <NoteIcon size={16} color="var(--color-muted)" />
        </button>
      </div>

      {exercise.coachNote && (
        <p className="px-4 pb-2 text-xs italic" style={{ color: "var(--color-muted)" }}>
          ↳ {exercise.coachNote}
        </p>
      )}

      {exercise.comment && exercise.comment.trim() !== "" && (
        <button onClick={onOpenNote} className="w-full text-left px-4 pb-2 press-effect">
          <p className="text-xs italic" style={{ color: "var(--color-white-65)" }}>✎ {exercise.comment}</p>
        </button>
      )}

      <div className="pb-3" style={{ borderTop: "1px solid var(--color-surface-2)" }}>
        <div
          className="flex items-center"
          style={{ gap: 8, paddingTop: 6, paddingBottom: 6, paddingLeft: 16, paddingRight: 12 }}
        >
          <span className="flex-1" style={COL_HEADER_STYLE}>SERIE</span>
          <span className="flex-1 text-center" style={COL_HEADER_STYLE}>REPS</span>
          <span className="flex-1 text-center" style={COL_HEADER_STYLE}>KG</span>
          <span className="flex justify-center" style={{ width: 40, flexShrink: 0 }}>
            <CheckIcon size={12} color="var(--color-dim)" />
          </span>
        </div>

        {(exercise.setLogs ?? []).map((set, idx) => {
          const isActiveRow = idx === activeSetIdx;
          const isDone = set.done;
          const repsKey = `${idx}-reps`;
          const weightKey = `${idx}-weight`;

          return (
            <div
              key={idx}
              className="flex items-center"
              style={{
                gap: 8,
                borderLeft: isActiveRow ? "3px solid var(--color-neon)" : "3px solid transparent",
                borderTop: "1px solid var(--color-surface-2)",
                paddingTop: 10,
                paddingBottom: 10,
                paddingLeft: 13,
                paddingRight: 12,
                background: isActiveRow ? "var(--color-neon-04)" : "transparent",
              }}
            >
              <div className="flex-1">
                <span style={{ ...ARCHIVO_WIDE_BOLD, fontSize: 18, lineHeight: 1, color: isDone ? "var(--color-text)" : isActiveRow ? "var(--color-neon-text)" : "var(--color-dim)" }}>
                  {String(idx + 1).padStart(2, "0")}
                </span>
              </div>

              <div className="flex-1">
                {isDone ? (
                  <div className="rounded-lg w-full" style={{ border: "1px solid transparent" }}>
                    <p className="text-center" style={{ ...NUM_STYLE, color: "var(--color-text)" }}>
                      {set.reps}
                    </p>
                  </div>
                ) : (
                  <div
                    className="rounded-lg w-full"
                    style={{ border: `1px solid ${isActiveRow ? "var(--color-neon)" : "var(--color-surface-3)"}` }}
                  >
                    <input
                      type="number"
                      value={getVal(repsKey, set.reps)}
                      onFocus={() => startEdit(repsKey)}
                      onChange={(e) => updateDraft(repsKey, e.target.value)}
                      onBlur={() => commitEdit(repsKey, (v) => session.updateSet(exercise.id, idx, { reps: v }))}
                      inputMode="numeric"
                      className="text-center font-display focus:outline-none w-full"
                      style={{ ...NUM_STYLE, padding: 0, color: isActiveRow ? "var(--color-neon-text)" : "var(--color-dim)", border: "none", background: "transparent", boxShadow: "none" }}
                      min={0}
                      step={1}
                    />
                  </div>
                )}
              </div>

              <div className="flex-1">
                {isDone ? (
                  <div className="rounded-lg w-full" style={{ border: "1px solid transparent" }}>
                    <p className="text-center" style={{ ...NUM_STYLE, color: "var(--color-text)" }}>
                      {set.weight > 0 ? set.weight : "—"}
                    </p>
                  </div>
                ) : (
                  <div
                    className="rounded-lg w-full"
                    style={{ border: `1px solid ${isActiveRow ? "var(--color-neon)" : "var(--color-surface-3)"}` }}
                  >
                    <input
                      type="number"
                      value={getVal(weightKey, set.weight)}
                      onFocus={() => startEdit(weightKey)}
                      onChange={(e) => updateDraft(weightKey, e.target.value)}
                      onBlur={() => commitEdit(weightKey, (v) => session.updateSet(exercise.id, idx, { weight: v }), true)}
                      inputMode="decimal"
                      className="text-center font-display focus:outline-none w-full"
                      style={{ ...NUM_STYLE, padding: 0, color: isActiveRow ? "var(--color-neon-text)" : "var(--color-dim)", border: "none", background: "transparent", boxShadow: "none" }}
                      min={0}
                      step={0.5}
                    />
                  </div>
                )}
              </div>

              {/* alignSelf stretch + aspect-square garantit un carré quelle que soit la hauteur de la ligne */}
              <div
                className="flex justify-center"
                style={{ width: 40, flexShrink: 0, alignSelf: "stretch" }}
              >
                {isDone ? (
                  <button
                    onClick={() => session.unvalidateSet(exercise.id, idx)}
                    className="aspect-square h-full rounded-lg flex items-center justify-center press-effect"
                    style={{ background: "var(--color-neon)", border: "1px solid var(--color-neon)" }}
                    aria-label="Annuler la validation"
                  >
                    <CheckIcon size={14} color="#000" />
                  </button>
                ) : (
                  <button
                    onClick={() => session.validateSet(exercise.id, idx)}
                    className="aspect-square h-full rounded-lg flex items-center justify-center press-effect"
                    style={{
                      border: `1px solid ${isActiveRow ? "var(--color-neon)" : "var(--color-surface-3)"}`,
                      background: "transparent",
                    }}
                    aria-label="Valider la série"
                  />
                )}
              </div>
            </div>
          );
        })}

        <button
          onClick={() => session.addSet(exercise.id)}
          className="mx-3 mt-2 w-[calc(100%-24px)] flex items-center justify-center gap-2 rounded-2xl py-3 press-effect"
          style={{ background: "transparent", border: "1px dashed var(--color-surface-3)", color: "var(--color-muted)" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <span style={{ ...JETBRAINS_MONO_LABEL, fontSize: 12, letterSpacing: "0.05em" }}>
            Ajouter une série
          </span>
        </button>
      </div>
    </div>
  );
}
