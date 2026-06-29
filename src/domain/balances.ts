import { Money, add } from "./money";

export type TransactionKind = "income" | "expense" | "transfer";
export type TransactionStatus = "cleared" | "projected";

// Domain representation of a ledger entry.
// amount is SIGNED: positive = credit (money in), negative = debit (money out).
// The DB stores amounts as always-positive integers; repositories apply the sign
// before constructing these objects so the domain math stays simple.
export interface LedgerEntry {
  amount: Money;
  status: TransactionStatus;
  kind: TransactionKind;
}

// Core invariant: balance is always derived, never stored.
// balance = openingBalance + Σ(signed amount of cleared entries)
export function deriveBalance(openingBalance: Money, entries: LedgerEntry[]): Money {
  return entries
    .filter((e) => e.status === "cleared")
    .reduce((acc, e) => add(acc, e.amount), openingBalance);
}
