import { Money, ZERO, add, money, subtract } from "./money";
import { ISODate, addDays, daysBetween } from "./dates";

// ─── inputs ──────────────────────────────────────────────────────────────────

// A signed amount attributed to a calendar day (already summed across all of
// the user's active accounts, so own-account transfers net to zero).
export interface DatedAmount {
  date: ISODate;
  amount: Money;
}

// One category_cap of the plan whose period covers `today`. The projection
// assumes the user spends the whole cap by period_end ("si se cumplen sus
// presupuestos"), prorated linearly over the remaining days.
export interface CategoryBurn {
  targetAmount: Money;
  // Everything already counted against the cap up to today (cleared +
  // projected with date <= today), i.e. planProgress' projectedActual minus
  // the future-dated projected part.
  actualToDate: Money;
  // Projected expenses in this category dated AFTER today. They are already
  // plotted individually via projectedLegs, so the burn must not re-spend
  // them (no double counting).
  projectedFuture: Money;
  periodEnd: ISODate;
}

export interface TimelineInput {
  today: ISODate;
  // Derived balance across all active accounts: Σ(opening + cleared legs of
  // ANY date). Credit included (negative when in debt).
  currentBalance: Money;
  // Signed cleared legs by day, any date (a future-dated cleared leg is
  // re-attributed to its own day in the future walk).
  clearedLegs: DatedAmount[];
  // Signed projected legs by day. Only those dated after `today` move the
  // future curve; past-dated projected entries are pending reconciliation and
  // are deliberately ignored (the payday prompt / day detail handles them).
  projectedLegs: DatedAmount[];
  // Estimated income-schedule occurrences (positive), already deduped against
  // real incomes by the caller. Only dates after `today` count.
  scheduleOccurrences: DatedAmount[];
  categoryBurns: CategoryBurn[];
  from: ISODate;
  to: ISODate; // inclusive
}

export interface TimelinePoint {
  date: ISODate;
  balance: Money; // end-of-day balance
}

// ─── series ──────────────────────────────────────────────────────────────────

function sumByDay(legs: DatedAmount[], filter: (d: ISODate) => boolean): Map<ISODate, Money> {
  const map = new Map<ISODate, Money>();
  for (const leg of legs) {
    if (!filter(leg.date)) continue;
    map.set(leg.date, add(map.get(leg.date) ?? ZERO, leg.amount));
  }
  return map;
}

// Remaining cap to burn after today, net of already-plotted projected
// expenses. Never negative (an overspent cap projects no further spending).
export function remainingBurn(burn: CategoryBurn): Money {
  const remaining = subtract(
    subtract(burn.targetAmount, burn.actualToDate),
    burn.projectedFuture
  );
  return remaining > 0 ? remaining : ZERO;
}

// Cumulative burn of one cap at end of day `d` (d > today): linear proration
// over (today, periodEnd], integer-safe — the rounding is applied to the
// cumulative value so the last day always lands exactly on the remaining total.
function cumulativeBurnAt(burn: CategoryBurn, today: ISODate, d: ISODate): Money {
  const remaining = remainingBurn(burn);
  if (remaining === 0) return ZERO;
  const daysLeft = daysBetween(today, burn.periodEnd);
  if (daysLeft <= 0) return ZERO; // period ends today or already ended
  const elapsed = Math.min(daysBetween(today, d), daysLeft);
  if (elapsed <= 0) return ZERO;
  return money(Math.round((remaining * elapsed) / daysLeft));
}

// End-of-day balance series for every day in [from, to].
export function buildBalanceSeries(input: TimelineInput): TimelinePoint[] {
  const { today, from, to } = input;
  if (to < from) return [];

  const clearedPast = sumByDay(input.clearedLegs, (d) => d <= today);
  const clearedFuture = sumByDay(input.clearedLegs, (d) => d > today);
  const projectedFuture = sumByDay(input.projectedLegs, (d) => d > today);
  const scheduleFuture = sumByDay(input.scheduleOccurrences, (d) => d > today);

  // currentBalance includes cleared legs of ANY date; the timeline re-plots
  // future-dated cleared legs on their own day, so today's anchor excludes them.
  let anchor = input.currentBalance;
  for (const amount of clearedFuture.values()) anchor = subtract(anchor, amount);

  // Past: walk backwards from today. balance(d-1) = balance(d) − delta(d).
  const balances = new Map<ISODate, Money>();
  balances.set(today, anchor);
  for (let d = today; d > from; ) {
    const prev = addDays(d, -1);
    balances.set(prev, subtract(balances.get(d)!, clearedPast.get(d) ?? ZERO));
    d = prev;
  }

  // Future: walk forwards from today accumulating deltas + budget burn.
  let running = anchor;
  for (let d = addDays(today, 1); d <= to; d = addDays(d, 1)) {
    running = add(running, clearedFuture.get(d) ?? ZERO);
    running = add(running, projectedFuture.get(d) ?? ZERO);
    running = add(running, scheduleFuture.get(d) ?? ZERO);
    let burnTotal = ZERO;
    for (const burn of input.categoryBurns) {
      burnTotal = add(burnTotal, cumulativeBurnAt(burn, today, d));
    }
    balances.set(d, subtract(running, burnTotal));
  }

  const out: TimelinePoint[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    out.push({ date: d, balance: balances.get(d)! });
  }
  return out;
}
