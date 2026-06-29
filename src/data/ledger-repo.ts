import { eq, or } from "drizzle-orm";
import { db } from "./db";
import { account, ledgerEntry, LedgerEntryRow } from "./schema";
import { toSignedLegs, toCreditLegs } from "./ledger-mapping";
import { money, Money } from "@/domain/money";
import { AccountForAvailable } from "@/domain/available";
import { CreditLedgerEntry } from "@/domain/credit";
import { deriveBalance } from "@/domain/balances";

// ─── raw fetch helpers ───────────────────────────────────────────────────────

async function fetchEntriesForAccounts(accountIds: number[]): Promise<LedgerEntryRow[]> {
  if (accountIds.length === 0) return [];
  return db
    .select()
    .from(ledgerEntry)
    .where(
      or(
        ...accountIds.map((id) => eq(ledgerEntry.accountId, id)),
        ...accountIds.map((id) => eq(ledgerEntry.toAccountId, id))
      )
    );
}

// ─── public read API ─────────────────────────────────────────────────────────

// All active accounts with their signed entries, ready for domain calls.
export async function allAccountsForAvailable(): Promise<AccountForAvailable[]> {
  const accounts = await db
    .select()
    .from(account)
    .where(eq(account.isActive, true));

  const ids = accounts.map((a) => a.id);
  const rows = await fetchEntriesForAccounts(ids);

  // Build a map: accountId → signed LedgerEntry[]
  const legsByAccount = new Map<number, AccountForAvailable["entries"]>();
  for (const a of accounts) {
    legsByAccount.set(a.id, []);
  }
  for (const row of rows) {
    for (const leg of toSignedLegs(row)) {
      legsByAccount.get(leg.accountId)?.push(leg.entry);
    }
  }

  return accounts.map((a) => ({
    kind: a.kind,
    openingBalance: money(a.openingBalance),
    entries: legsByAccount.get(a.id) ?? [],
  }));
}

// Derived balance for a single account.
export async function balanceOf(accountId: number): Promise<Money> {
  const [acc] = await db
    .select()
    .from(account)
    .where(eq(account.id, accountId))
    .limit(1);
  if (!acc) throw new Error(`Account ${accountId} not found`);

  const rows = await db
    .select()
    .from(ledgerEntry)
    .where(
      or(eq(ledgerEntry.accountId, accountId), eq(ledgerEntry.toAccountId, accountId))
    );

  const entries = rows.flatMap((row) =>
    toSignedLegs(row)
      .filter((leg) => leg.accountId === accountId)
      .map((leg) => leg.entry)
  );

  return deriveBalance(money(acc.openingBalance), entries);
}

// Signed credit entries for a single credit account (for currentStatementOwed / nextDueDate).
export async function creditEntriesFor(accountId: number): Promise<CreditLedgerEntry[]> {
  const rows = await db
    .select()
    .from(ledgerEntry)
    .where(
      or(eq(ledgerEntry.accountId, accountId), eq(ledgerEntry.toAccountId, accountId))
    );

  return rows.flatMap((row) =>
    toCreditLegs(row)
      .filter((leg) => leg.accountId === accountId)
      .map((leg) => leg.entry)
  );
}
