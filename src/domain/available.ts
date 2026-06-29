import { Money, add, ZERO } from "./money";
import { LedgerEntry, deriveBalance } from "./balances";

export type AccountKind = "cash" | "debit" | "investment" | "credit";

export interface AccountForAvailable {
  kind: AccountKind;
  openingBalance: Money;
  entries: LedgerEntry[];
}

// Cash, debit, and investment accounts are liquid.
// Credit card debt is surfaced separately by payment date — not subtracted from available.
function isLiquid(kind: AccountKind): boolean {
  return kind === "cash" || kind === "debit" || kind === "investment";
}

// Real available: sum of cleared balances on liquid accounts only.
export function realAvailable(accounts: AccountForAvailable[]): Money {
  return accounts
    .filter((a) => isLiquid(a.kind))
    .reduce((acc, a) => add(acc, deriveBalance(a.openingBalance, a.entries)), ZERO);
}

// Projected available: cleared + projected income on liquid accounts.
// Projected expenses are excluded (not committed until cleared).
export function projectedAvailable(accounts: AccountForAvailable[]): Money {
  return accounts
    .filter((a) => isLiquid(a.kind))
    .reduce((acc, a) => {
      const balance = a.entries
        .filter((e) => e.status === "cleared" || (e.status === "projected" && e.kind === "income"))
        .reduce((sum, e) => add(sum, e.amount), a.openingBalance);
      return add(acc, balance);
    }, ZERO);
}
