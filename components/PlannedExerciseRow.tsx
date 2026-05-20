import { ARCHIVO_WIDE_BOLD } from "@/lib/typography";

interface Props {
  name: string;
  sets: number;
  reps: number;
  weight: number;
}

function PlannedPills({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className="inline-block rounded-full"
          style={{ width: 18, height: 4, background: "#2a2a2a" }}
        />
      ))}
    </div>
  );
}

export default function PlannedExerciseRow({ name, sets, reps, weight }: Props) {
  return (
    <div
      className="rounded-2xl px-4 py-3"
      style={{ background: "#141414", border: "1px solid #1d1d1d" }}
    >
      <p
        className="text-base mb-2"
        style={{ ...ARCHIVO_WIDE_BOLD, fontSize: 17, lineHeight: "22px", color: "#fff" }}
      >
        {name}
      </p>
      <div className="flex items-center gap-2">
        <PlannedPills count={sets} />
        <span className="text-xs" style={{ color: "#555" }}>
          · {reps} reps{weight > 0 ? ` · ${weight} kg` : ""}
        </span>
      </div>
    </div>
  );
}
