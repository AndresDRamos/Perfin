// Recurrence engine for fixed-expense templates (pure date math, no I/O).
// A template schedules one occurrence per month on `dayOfMonth`, clamped to
// the month's last day (31 → Apr 30, Feb 28/29). All dates are ISO strings
// (YYYY-MM-DD) — same representation the DB date columns use — so there is
// no timezone in play at this layer.

export interface RecurrenceTemplate {
  // Scheduled day 1..31; clamped per month.
  dayOfMonth: number;
  startDate: string; // YYYY-MM-DD, first day the template is in force
  endDate?: string | null; // inclusive; null/undefined = open-ended
}

export interface Occurrence {
  // Day 1 of the scheduled month (the idempotency key half:
  // ledger_entry.fixed_expense_month).
  month: string; // YYYY-MM-01
  // Clamped occurrence date within that month (ledger_entry.occurred_at).
  date: string; // YYYY-MM-DD
}

function daysInMonth(year: number, month1to12: number): number {
  // Day 0 of the next month = last day of this month. UTC to avoid DST edges.
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
}

function iso(year: number, month1to12: number, day: number): string {
  return `${year.toString().padStart(4, "0")}-${month1to12
    .toString()
    .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

function parseYearMonth(isoDate: string): { year: number; month: number } {
  return { year: Number(isoDate.slice(0, 4)), month: Number(isoDate.slice(5, 7)) };
}

// Every occurrence whose (clamped) date falls inside [from, to] AND inside the
// template's validity [startDate, endDate]. Months are walked one by one, so a
// large gap (app not opened for months) yields the full catch-up list, each
// occurrence dated on its own scheduled day. ISO strings compare correctly as
// plain strings — all comparisons here are lexicographic.
// Primera ocurrencia estrictamente posterior a `after` (para mostrar "próxima
// ocurrencia" de una plantilla). null si la vigencia ya terminó.
export function nextOccurrenceAfter(
  template: RecurrenceTemplate,
  after: string
): Occurrence | null {
  const floor = after > template.startDate ? after : template.startDate;
  let { year, month } = parseYearMonth(floor);
  // Dos iteraciones bastan (la ocurrencia de este mes ya pasó → la del
  // siguiente no), con margen por el clamp.
  for (let i = 0; i < 3; i++) {
    const day = Math.min(template.dayOfMonth, daysInMonth(year, month));
    const date = iso(year, month, day);
    if (date > after && date >= template.startDate) {
      if (template.endDate && date > template.endDate) return null;
      return { month: iso(year, month, 1), date };
    }
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return null;
}

export function occurrencesBetween(
  template: RecurrenceTemplate,
  from: string,
  to: string
): Occurrence[] {
  const lower = from > template.startDate ? from : template.startDate;
  const upper =
    template.endDate && template.endDate < to ? template.endDate : to;
  if (lower > upper) return [];

  const out: Occurrence[] = [];
  let { year, month } = parseYearMonth(lower);
  const end = parseYearMonth(upper);

  while (year < end.year || (year === end.year && month <= end.month)) {
    const day = Math.min(template.dayOfMonth, daysInMonth(year, month));
    const date = iso(year, month, day);
    if (date >= lower && date <= upper) {
      out.push({ month: iso(year, month, 1), date });
    }
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return out;
}
