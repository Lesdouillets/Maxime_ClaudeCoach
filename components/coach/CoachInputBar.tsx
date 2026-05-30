"use client";

import { PlusIcon } from "@/components/icons/PlusIcon";
import { ArrowUpIcon } from "@/components/icons/ArrowUpIcon";

interface Props {
  value: string;
  sending: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  onChange: (value: string) => void;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

export default function CoachInputBar({
  value,
  sending,
  textareaRef,
  onChange,
  onSend,
  onKeyDown,
}: Props) {
  return (
    <div
      style={{
        padding: "8px 16px",
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 80px)",
      }}
    >
      {/* Cadre externe — fond noir + bordure → ring visible entre bordure et contenu */}
      <div
        style={{
          borderRadius: "24px",
          border: "1px solid var(--color-white-25)",
          padding: "8px",
          background: "var(--color-background)",
          overflow: "hidden",
        }}
      >
        {/* Zone de saisie — radius 16, fond #1D1F21, layout colonne */}
        <div
          style={{
            borderRadius: "16px",
            background: "var(--color-surface-2)",
            padding: "12px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            overflow: "hidden",
          }}
        >
          {/* Textarea — padding 0 pour aligner le placeholder avec le bouton + */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Écrire un message..."
            rows={1}
            className="placeholder:text-white/30"
            style={{
              width: "100%",
              background: "transparent",
              border: "none",
              outline: "none",
              resize: "none",
              padding: 0,
              margin: 0,
              color: "#ffffff",
              caretColor: "var(--color-neon)",
              maxHeight: "120px",
              fontSize: "16px",
              lineHeight: "1.4",
              fontFamily: "inherit",
            }}
          />

          {/* Ligne d'actions : + à gauche, envoyer à droite */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <button
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <PlusIcon size={20} color="#ffffff" />
            </button>

            {/* Bouton envoyer — ArrowUpIcon, 32×32, toujours orange #D07900, radius 20 */}
            <button
              onClick={onSend}
              disabled={sending}
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "var(--color-orange)",
                border: "none",
                cursor: "pointer",
                flexShrink: 0,
                boxSizing: "border-box",
                opacity: sending ? 0.5 : 1,
              }}
            >
              <ArrowUpIcon size={14} color="#ffffff" />
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
