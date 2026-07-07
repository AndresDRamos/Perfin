import {
  ISODate,
  addDays,
  daysBetween,
  isoDate,
  lastDayOfMonth,
  parts,
} from "./dates";

// Mirror of the DB enum income_frequency (src/data/schema/income-schedule.ts).
// Distinct from the fixed-expense recurrence engine (domain/recurrence.ts):
// income schedules support sub-monthly frequencies (weekly/biweekly) and a
// non-day-of-month semimonthly rule, so they don't share a RecurrenceTemplate
// shape with fixed expenses.
export type IncomeFrequency = "weekly" | "biweekly" | "semimonthly" | "monthly";

export interface RecurrenceSpec {
  frequency: IncomeFrequency;
  // One known payday, immutable. Occurrences are derived from it in memory;
  // nothing occurs before it.
  anchorDate: ISODate;
}

// All paydays in [from, to] (inclusive), never before anchorDate.
// - weekly / biweekly: every 7 / 14 days from the anchor.
// - semimonthly (quincenal): the 15th AND the last day of each month — "15 y
//   30" is undefined in February; 15/end-of-month is the Mexican payroll
//   convention. The anchor only marks the start of validity.
// - monthly: the anchor's day-of-month, clamped to short months (31 → 30/28).
export function occurrencesBetween(
  spec: RecurrenceSpec,
  from: ISODate,
  to: ISODate
): ISODate[] {
  if (to < from) return [];
  const start = spec.anchorDate > from ? spec.anchorDate : from;
  if (start > to) return [];

  switch (spec.frequency) {
    case "weekly":
      return everyNDays(spec.anchorDate, 7, start, to);
    case "biweekly":
      return everyNDays(spec.anchorDate, 14, start, to);
    case "semimonthly":
      return semimonthly(start, to);
    case "monthly":
      return monthly(spec.anchorDate, start, to);
  }
}

function everyNDays(anchor: ISODate, n: number, start: ISODate, to: ISODate): ISODate[] {
  // First occurrence >= start that keeps the anchor's n-day parity.
  const offset = daysBetween(anchor, start);
  const steps = offset <= 0 ? 0 : Math.ceil(offset / n);
  const out: ISODate[] = [];
  for (let d = addDays(anchor, steps * n); d <= to; d = addDays(d, n)) {
    out.push(d);
  }
  return out;
}

function semimonthly(start: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  let { year, month } = parts(start);
  const end = parts(to);
  while (year < end.year || (year === end.year && month <= end.month)) {
    for (const day of [15, lastDayOfMonth(year, month)]) {
      const d = isoDate(year, month, day);
      if (d >= start && d <= to) out.push(d);
    }
    month += 1;
    if (month === 13) {
      month = 1;
      year += 1;
    }
  }
  return out;
}

function monthly(anchor: ISODate, start: ISODate, to: ISODate): ISODate[] {
  const targetDay = parts(anchor).day;
  const out: ISODate[] = [];
  let { year, month } = parts(start);
  const end = parts(to);
  while (year < end.year || (year === end.year && month <= end.month)) {
    const day = Math.min(targetDay, lastDayOfMonth(year, month));
    const d = isoDate(year, month, day);
    if (d >= start && d <= to) out.push(d);
    month += 1;
    if (month === 13) {
      month = 1;
      year += 1;
    }
  }
  return out;
}
