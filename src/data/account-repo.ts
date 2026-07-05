import { and, eq, or } from "drizzle-orm";
import { db } from "./db";
import { account, ledgerEntry, Account } from "./schema";
import { toSignedLegs } from "./ledger-mapping";
import { money, Money } from "@/domain/money";
import { deriveBalance } from "@/domain/balances";

export interface AccountWithBalance {
  account: Account;
  balance: Money; // derived: opening_balance + Σ cleared signed legs
}

export async function listActiveAccounts(userId: string): Promise<Account[]> {
  return db
    .select()
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.isActive, true)))
    .orderBy(account.name);
}

export async function listAllAccounts(userId: string): Promise<Account[]> {
  return db.select().from(account).where(eq(account.userId, userId)).orderBy(account.name);
}

// Every account (active and inactive) with its derived balance, for /accounts.
// Same signed-leg discipline as ledger-repo: the mapper owns the sign.
export async function listAccountsWithBalances(userId: string): Promise<AccountWithBalance[]> {
  const accounts = await db
    .select()
    .from(account)
    .where(eq(account.userId, userId))
    .orderBy(account.name);
  if (accounts.length === 0) return [];

  const ids = accounts.map((a) => a.id);
  const rows = await db
    .select()
    .from(ledgerEntry)
    .where(
      or(
        ...ids.map((id) => eq(ledgerEntry.accountId, id)),
        ...ids.map((id) => eq(ledgerEntry.toAccountId, id))
      )
    );

  const entriesByAccount = new Map<number, Parameters<typeof deriveBalance>[1]>();
  for (const a of accounts) entriesByAccount.set(a.id, []);
  for (const row of rows) {
    for (const leg of toSignedLegs(row)) {
      entriesByAccount.get(leg.accountId)?.push(leg.entry);
    }
  }

  return accounts.map((a) => ({
    account: a,
    balance: deriveBalance(money(a.openingBalance), entriesByAccount.get(a.id) ?? []),
  }));
}
