"use server";

import { revalidatePath } from "next/cache";
import {
  ledgerEntrySchema,
  LedgerEntryInput,
  createEntry,
  updateEntry,
  reconcile,
} from "@/data/ledger-write";
import {
  allAccountsForAvailable,
  balanceOf,
  creditEntriesFor,
} from "@/data/ledger-repo";
import { db } from "@/data/db";
import { account } from "@/data/schema";
import { eq } from "drizzle-orm";
import { realAvailable, projectedAvailable } from "@/domain/available";
import { currentStatementOwed, nextDueDate } from "@/domain/credit";
import { toPesos } from "@/domain/money";

// ─── capture ──────────────────────────────────────────────────────────────────

export async function captureEntry(raw: unknown) {
  const parsed = ledgerEntrySchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten().fieldErrors };
  }
  const row = await createEntry(parsed.data);
  revalidatePath("/");
  return { ok: true as const, id: row.id };
}

export async function editEntry(id: number, raw: unknown) {
  const parsed = ledgerEntrySchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten().fieldErrors };
  }
  const row = await updateEntry(id, parsed.data);
  revalidatePath("/");
  return { ok: true as const, id: row.id };
}

export async function reconcileEntry(id: number) {
  await reconcile(id);
  revalidatePath("/");
  return { ok: true as const };
}

// ─── dashboard reads ──────────────────────────────────────────────────────────

export interface DashboardData {
  realAvailablePesos: number;
  projectedAvailablePesos: number;
  creditCards: {
    id: number;
    name: string;
    owedPesos: number;
    nextDue: Date;
  }[];
}

export async function getDashboard(): Promise<DashboardData> {
  const accounts = await allAccountsForAvailable();
  const real = toPesos(realAvailable(accounts));
  const projected = toPesos(projectedAvailable(accounts));

  const creditAccounts = await db
    .select()
    .from(account)
    .where(eq(account.kind, "credit"));

  const creditCards = await Promise.all(
    creditAccounts.map(async (acc) => {
      if (!acc.cutoffDay || !acc.paymentDay) {
        throw new Error(`Credit account ${acc.id} missing cutoff/payment config`);
      }
      const entries = await creditEntriesFor(acc.id);
      const config = { cutoffDay: acc.cutoffDay, paymentDay: acc.paymentDay };
      const owed = currentStatementOwed(entries, config);
      const due = nextDueDate(config);
      return {
        id: acc.id,
        name: acc.name,
        owedPesos: toPesos(owed),
        nextDue: due,
      };
    })
  );

  return {
    realAvailablePesos: real,
    projectedAvailablePesos: projected,
    creditCards,
  };
}
