"use client";

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
  const isActive = value.trim().length > 0 && !sending;

  return (
    <div
      style={{
        background: "rgba(10,10,10,0.95)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        padding: "12px 16px",
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 80px)",
      }}
    >
      {/* Pill container */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: "8px",
          borderRadius: "28px",
          background: "rgba(255,255,255,0.07)",
          border: "1px solid rgba(255,255,255,0.10)",
          padding: "10px 12px",
        }}
      >
        {/* Plus icon — decorative */}
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#555"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ flexShrink: 0 }}
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Écrire un message..."
          rows={1}
          className="flex-1 resize-none bg-transparent text-sm outline-none leading-relaxed"
          style={{
            color: "#ddd",
            caretColor: "#CDFF00",
            maxHeight: "120px",
          }}
        />

        {/* Send button */}
        <button
          onClick={onSend}
          disabled={!value.trim() || sending}
          style={{
            flexShrink: 0,
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: isActive ? "var(--color-orange-light, #ff9a3c)" : "rgba(255,255,255,0.05)",
            border: isActive ? "none" : "1px solid rgba(255,255,255,0.10)",
            cursor: isActive ? "pointer" : "not-allowed",
            transition: "all 0.2s",
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke={isActive ? "#ffffff" : "#555"}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
}
