// Pure calendar-day math over ISO strings (YYYY-MM-DD), no time-of-day and no
// timezone: v1 fixes a single local TZ, so a "day" is whatever the ISO string
// says. Internally uses Date.UTC only as an integer calendar, never local time.

export type ISODate = string; // YYYY-MM-DD

export function toUTC(d: ISODate): number {
  const [y, m, day] = d.split("-").map(Number);
  return Date.UTC(y, m - 1, day);
}

export function fromUTC(ms: number): ISODate {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(d: ISODate, days: number): ISODate {
  return fromUTC(toUTC(d) + days * 86_400_000);
}

// b - a in whole days (positive when b is after a).
export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((toUTC(b) - toUTC(a)) / 86_400_000);
}

export function lastDayOfMonth(year: number, month: number): number {
  // month is 1-12; day 0 of the next month = last day of this one.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function isoDate(year: number, month: number, day: number): ISODate {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parts(d: ISODate): { year: number; month: number; day: number } {
  const [year, month, day] = d.split("-").map(Number);
  return { year, month, day };
}
