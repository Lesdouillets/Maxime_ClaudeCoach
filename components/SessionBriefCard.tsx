import CardIconHeader from "@/components/ui/CardIconHeader";

interface Props {
  brief: string | null | undefined;
}

const PlusIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
    <path d="M12 5v14M5 12h14" stroke="var(--color-neon)" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

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
      <div className="mb-2">
        <CardIconHeader icon={<PlusIcon />} label="LE MOT DU COACH" />
      </div>
      <p className="text-sm leading-relaxed" style={{ color: "var(--color-secondary)" }}>
        {brief}
      </p>
    </div>
  );
}
