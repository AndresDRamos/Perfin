"use server";

import { revalidatePath } from "next/cache";
import {
  ledgerEntrySchema,
  createEntry,
  updateEntry,
  reconcile,
} from "@/data/ledger-write";
import {
  allAccountsForAvailable,
  balanceOf,
  creditEntriesFor,
} from "@/data/ledger-repo";
import { requireSessionUser } from "@/data/auth-repo";
import { db } from "@/data/db";
import { account } from "@/data/schema";
import { and, eq } from "drizzle-orm";
import { realAvailable, projectedAvailable } from "@/domain/available";
import { currentStatementOwed, nextDueDate } from "@/domain/credit";
import { toPesos } from "@/domain/money";

// ─── capture ──────────────────────────────────────────────────────────────────

export async function captureEntry(raw: unknown) {
  const { userId } = await requireSessionUser();
  const parsed = ledgerEntrySchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten().fieldErrors };
  }
  const row = await createEntry(userId, parsed.data);
  revalidatePath("/");
  return { ok: true as const, id: row.id };
}

export async function editEntry(id: number, raw: unknown) {
  const { userId } = await requireSessionUser();
  const parsed = ledgerEntrySchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten().fieldErrors };
  }
  const row = await updateEntry(userId, id, parsed.data);
  revalidatePath("/");
  return { ok: true as const, id: row.id };
}


export async function reconcileEntry(id: number) {
  const { userId } = await requireSessionUser();
  await reconcile(userId, id);
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
  const { userId } = await requireSessionUser();
  const accounts = await allAccountsForAvailable(userId);
  const real = toPesos(realAvailable(accounts));
  const projected = toPesos(projectedAvailable(accounts));

  const creditAccounts = await db
    .select()
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.kind, "credit")));

  const creditCards = await Promise.all(
    creditAccounts.map(async (acc) => {
      if (!acc.cutoffDay || !acc.paymentDay) {
        throw new Error(`Credit account ${acc.id} missing cutoff/payment config`);
      }
      const entries = await creditEntriesFor(userId, acc.id);
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
