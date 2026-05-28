const DAY_NAMES_FR = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const DAY_NAMES_FULL = [
  "Dimanche",
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
];

export function getDayName(dow: number, full = false): string {
  return full ? DAY_NAMES_FULL[dow] : DAY_NAMES_FR[dow];
}

/** Retourne le rythme formaté avec unité incluse, ex: "4:30/km" */
export function formatPace(secPerKm: number): string {
  const min = Math.floor(secPerKm / 60);
  const sec = Math.round(secPerKm % 60);
  return `${min}:${sec.toString().padStart(2, "0")}/km`;
}

export function toLocalDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export type WeekDay = {
  date: Date;
  dow: number;
  label: string;
  isToday: boolean;
  isPast: boolean;
};

export function getWeekDays(weekOffset = 0): WeekDay[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startOfWeek = new Date(today);
  const dow = today.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  startOfWeek.setDate(today.getDate() + diff + weekOffset * 7);

  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + i);
    const d = date.getDay();
    return {
      date,
      dow: d,
      label: DAY_NAMES_FR[d],
      isToday: date.getTime() === today.getTime(),
      isPast: date < today,
    };
  });
}

export function getThisWeekDays(): WeekDay[] {
  return getWeekDays(0);
}
