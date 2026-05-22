import ExerciseRowCard from "@/components/ExerciseRowCard";

interface Props {
  name: string;
  sets: number;
  reps: number;
  weight: number;
}

export default function PlannedExerciseRow({ name, sets, reps, weight }: Props) {
  return <ExerciseRowCard name={name} sets={sets} reps={reps} weight={weight} variant="planned" />;
}
