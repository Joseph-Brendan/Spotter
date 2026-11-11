export interface GymLocalTime {
  // Calendar day in the gym's timezone, as YYYY-MM-DD.
  dateKey: string;
  // Minutes since local midnight in the gym's timezone.
  minutes: number;
}

export function gymLocalTime(now: Date, timeZone: string): GymLocalTime {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value ?? "";

  return {
    dateKey: `${part("year")}-${part("month")}-${part("day")}`,
    minutes: Number(part("hour")) * 60 + Number(part("minute")),
  };
}

// The attendance date column is a plain date, so it is stored as UTC midnight
// of the gym's local calendar day.
export function dateKeyToDbDate(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

function parseClock(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());

  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours > 23 || minutes > 59) {
    return null;
  }

  return hours * 60 + minutes;
}

// Opening and closing times are HH:MM in the gym's timezone. A closing time
// earlier than the opening time means the gym closes after midnight. An
// unreadable time fails closed.
export function isWithinOpeningHours(
  openingTime: string,
  closingTime: string,
  minutes: number
): boolean {
  const open = parseClock(openingTime);
  const close = parseClock(closingTime);

  if (open === null || close === null || open === close) {
    return false;
  }

  if (open < close) {
    return minutes >= open && minutes < close;
  }

  return minutes >= open || minutes < close;
}
