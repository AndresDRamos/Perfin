import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { account, ledgerEntry, LedgerEntryRow } from "./schema";
import { toSignedLegs, toCreditLegs } from "./ledger-mapping";
import { money, Money } from "@/domain/money";
import { AccountForAvailable } from "@/domain/available";
import { CreditLedgerEntry } from "@/domain/credit";
import { deriveBalance } from "@/domain/balances";

// ─── raw fetch helpers ───────────────────────────────────────────────────────
// user_id is denormalized onto ledger_entry (copied from account.user_id at
// write time — see ledger-write.ts), so scoping by it directly is equivalent
// to "any entry touching one of my accounts" without needing an account-id
// list: in v1 every leg of an entry (including transfers) shares one owner.

async function fetchEntriesForUser(userId: string): Promise<LedgerEntryRow[]> {
  return db.select().from(ledgerEntry).where(eq(ledgerEntry.userId, userId));
}

// ─── public read API ─────────────────────────────────────────────────────────

// All active accounts with their signed entries, ready for domain calls.
export async function allAccountsForAvailable(userId: string): Promise<AccountForAvailable[]> {
  const accounts = await db
    .select()
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.isActive, true)));

  const rows = await fetchEntriesForUser(userId);

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
export async function balanceOf(userId: string, accountId: number): Promise<Money> {
  const [acc] = await db
    .select()
    .from(account)
    .where(and(eq(account.id, accountId), eq(account.userId, userId)))
    .limit(1);
  if (!acc) throw new Error(`Account ${accountId} not found`);

  const rows = await fetchEntriesForUser(userId);

  const entries = rows.flatMap((row) =>
    toSignedLegs(row)
      .filter((leg) => leg.accountId === accountId)
      .map((leg) => leg.entry)
  );

  return deriveBalance(money(acc.openingBalance), entries);
}

// Signed credit entries for a single credit account (for currentStatementOwed / nextDueDate).
export async function creditEntriesFor(
  userId: string,
  accountId: number
): Promise<CreditLedgerEntry[]> {
  const rows = await fetchEntriesForUser(userId);

  return rows.flatMap((row) =>
    toCreditLegs(row)
      .filter((leg) => leg.accountId === accountId)
      .map((leg) => leg.entry)
  );
}
