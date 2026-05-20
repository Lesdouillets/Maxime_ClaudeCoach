interface Props {
  brief: string | null | undefined;
}

export default function SessionBriefCard({ brief }: Props) {
  if (!brief) return null;

  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: "var(--color-neon-bg)",
        border: "1px solid var(--color-neon-08)",
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <div
          className="flex items-center justify-center rounded-full flex-shrink-0"
          style={{
            width: 28,
            height: 28,
            background: "rgba(205,255,0,0.12)",
            border: "1px solid rgba(205,255,0,0.25)",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12h14" stroke="#CDFF00" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </div>
        <span
          className="text-[11px] font-bold tracking-widest"
          style={{ color: "#CDFF00" }}
        >
          LE MOT DU COACH
        </span>
      </div>
      <p className="text-sm leading-relaxed" style={{ color: "#888" }}>
        {brief}
      </p>
    </div>
  );
}
