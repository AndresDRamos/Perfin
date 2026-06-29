import { money, Money, negate } from "@/domain/money";
import { LedgerEntry, TransactionKind, TransactionStatus } from "@/domain/balances";
import { CreditLedgerEntry } from "@/domain/credit";
import { LedgerEntryRow } from "./schema";

export interface SignedLeg {
  accountId: number;
  entry: LedgerEntry;
}

export interface SignedCreditLeg {
  accountId: number;
  entry: CreditLedgerEntry;
}

function signedAmount(rawAmount: number, kind: TransactionKind): Money {
  // DB stores amount always positive; direction is determined by kind per the contract.
  const m = money(rawAmount);
  return kind === "income" ? m : negate(m);
}

// Single source of truth for the DB-row → signed-per-account-legs mapping.
// income  → +amount  on account_id
// expense → -amount  on account_id
// transfer → -amount on account_id  AND  +amount on to_account_id
export function toSignedLegs(row: LedgerEntryRow): SignedLeg[] {
  const status = row.status as TransactionStatus;
  const kind = row.kind as TransactionKind;

  if (kind === "income" || kind === "expense") {
    return [
      {
        accountId: row.accountId,
        entry: { amount: signedAmount(row.amount, kind), status, kind },
      },
    ];
  }

  // transfer
  if (!row.toAccountId) {
    throw new Error(
      `Transfer ledger_entry id=${row.id} is missing to_account_id (DB constraint violation)`
    );
  }

  return [
    {
      accountId: row.accountId,
      entry: { amount: negate(money(row.amount)), status, kind },
    },
    {
      accountId: row.toAccountId,
      entry: { amount: money(row.amount), status, kind },
    },
  ];
}

// Variant that projects a CreditLedgerEntry for credit-account reads.
export function toCreditLegs(row: LedgerEntryRow): SignedCreditLeg[] {
  return toSignedLegs(row).map((leg) => ({
    accountId: leg.accountId,
    entry: { ...leg.entry, occurredAt: row.occurredAt },
  }));
}
