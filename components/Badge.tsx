interface BadgeProps {
  label: string;
  variant?: "neon" | "orange" | "muted" | "surface";
  size?: "sm" | "md";
}

const VARIANT_CLASSES = {
  neon:    "bg-neon/10 text-neon border border-neon/30",
  orange:  "bg-orange/10 text-orange border border-orange/30",
  muted:   "bg-surface-2 text-[#888] border border-surface-3",
  surface: "bg-surface-3 text-white border border-subtle",
};

const SIZE_CLASSES = {
  sm: "text-[10px] px-2 py-0.5",
  md: "text-xs px-3 py-1",
};

export default function Badge({ label, variant = "muted", size = "md" }: BadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full font-semibold tracking-wider uppercase ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]}`}>
      {label}
    </span>
  );
}
