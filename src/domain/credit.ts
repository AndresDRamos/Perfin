import { Money, add, negate, ZERO } from "./money";
import { LedgerEntry } from "./balances";

export interface CreditCardConfig {
  cutoffDay: number;   // 1-28: day of month when billing period closes
  paymentDay: number;  // 1-28: day of month in the following month when payment is due
}

export interface StatementPeriod {
  start: Date;   // first day of the open billing period (inclusive)
  end: Date;     // cutoff date (inclusive)
  dueDate: Date; // payment due date (paymentDay of the month after cutoff)
}

// Returns the current open billing period as of `asOf`.
// Uses JavaScript's Date overflow handling for month arithmetic.
export function currentStatementPeriod(asOf: Date, config: CreditCardConfig): StatementPeriod {
  const { cutoffDay, paymentDay } = config;
  const y = asOf.getFullYear();
  const m = asOf.getMonth(); // 0-indexed
  const d = asOf.getDate();

  // The most recent cutoff that has already passed
  const cutoffPassedThisMonth = d >= cutoffDay;
  const cutoffMonth = cutoffPassedThisMonth ? m : m - 1;
  const cutoffYear = y;

  const end = new Date(cutoffYear, cutoffMonth, cutoffDay);
  // Period starts the day after the previous cutoff
  const start = new Date(cutoffYear, cutoffMonth - 1, cutoffDay + 1);
  // Payment is due on paymentDay of the month AFTER the cutoff
  const dueDate = new Date(cutoffYear, cutoffMonth + 1, paymentDay);

  return { start, end, dueDate };
}

export interface CreditLedgerEntry extends LedgerEntry {
  occurredAt: Date;
}

// Amount owed for transactions in the current open period (up to asOf).
// Returns a positive number = how much you owe. v1: pay-in-full model (no revolving interest).
export function currentStatementOwed(
  entries: CreditLedgerEntry[],
  config: CreditCardConfig,
  openingBalance: Money = ZERO,
  asOf: Date = new Date()
): Money {
  const { start } = currentStatementPeriod(asOf, config);

  // Only cleared transactions within [start, asOf]
  const periodCleared = entries.filter(
    (e) => e.status === "cleared" && e.occurredAt >= start && e.occurredAt <= asOf
  );

  // Expense amounts are negative in the signed scheme; negate to get positive debt.
  const balance = periodCleared.reduce((acc, e) => add(acc, e.amount), openingBalance);
  return negate(balance);
}

export function nextDueDate(config: CreditCardConfig, asOf: Date = new Date()): Date {
  return currentStatementPeriod(asOf, config).dueDate;
}
