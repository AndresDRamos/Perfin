"use server";

import { revalidatePath } from "next/cache";
import {
  ledgerEntrySchema,
  projectionCreateSchema,
  createEntry,
  updateEntry,
  reconcile,
  createProjection,
  reconcileWithAmount,
  deleteProjection,
} from "@/data/ledger-write";
import {
  allAccountsForAvailable,
  balanceOf,
  creditEntriesFor,
  listProjections,
} from "@/data/ledger-repo";
import { listAccountsWithBalances } from "@/data/account-repo";
import { materializeDueFixedExpenses, todayISO } from "@/data/fixed-expense-repo";
import { requireSessionUser } from "@/data/auth-repo";
import { db } from "@/data/db";
import { account, type Account } from "@/data/schema";
import { and, eq } from "drizzle-orm";
import { realAvailable, projectedAvailable, netProjected } from "@/domain/available";
import { currentStatementOwed, nextDueDate } from "@/domain/credit";
import { money, toPesos } from "@/domain/money";

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

// ─── income projections (plan tipo "Proyección") ──────────────────────────────

export async function createProjectionAction(raw: unknown) {
  const { userId } = await requireSessionUser();
  const parsed = projectionCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten().fieldErrors };
  }
  const row = await createProjection(userId, parsed.data);
  revalidatePath("/");
  revalidatePath("/plans");
  return { ok: true as const, id: row.id };
}

// Concilia con el monto que realmente llegó; expected_amount queda como
// memoria del esperado para mostrar la diferencia.
export async function reconcileProjectionAction(id: number, realPesos: number) {
  const { userId } = await requireSessionUser();
  try {
    await reconcileWithAmount(userId, id, realPesos);
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Error" };
  }
  revalidatePath("/");
  revalidatePath("/plans");
  return { ok: true as const };
}

export async function deleteProjectionAction(id: number) {
  const { userId } = await requireSessionUser();
  await deleteProjection(userId, id);
  revalidatePath("/");
  revalidatePath("/plans");
  return { ok: true as const };
}

// ─── dashboard reads ──────────────────────────────────────────────────────────

export interface DashboardData {
  realAvailablePesos: number;
  projectedAvailablePesos: number;
  // Proyectado neto (ADR-010): patrimonio + ingresos esperados − deuda de tarjetas.
  netProjectedPesos: number;
  creditCards: {
    id: number;
    name: string;
    owedPesos: number;
    nextDue: Date;
  }[];
  // Desglose de patrimonio por cuenta líquida activa (sección "Patrimonio").
  netWorthAccounts: {
    id: number;
    name: string;
    kind: Account["kind"];
    bank: string | null;
    balancePesos: number;
  }[];
  // Proyecciones de ingreso ya vencidas (occurred_at <= hoy), por conciliar.
  dueProjections: {
    id: number;
    concept: string | null;
    occurredAt: Date;
    expectedPesos: number;
    accountName: string;
  }[];
}

export async function getDashboard(): Promise<DashboardData> {
  const { userId } = await requireSessionUser();
  // Motor lazy de gastos fijos: materializa ocurrencias vencidas antes de leer
  // (idempotente — el unique parcial absorbe repeticiones).
  await materializeDueFixedExpenses(userId, todayISO());
  const accounts = await allAccountsForAvailable(userId);
  const real = toPesos(realAvailable(accounts));
  const projected = toPesos(projectedAvailable(accounts));
  const net = toPesos(netProjected(accounts));

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

  const [accountViews, projections] = await Promise.all([
    listAccountsWithBalances(userId),
    listProjections(userId),
  ]);

  const netWorthAccounts = accountViews
    .filter((v) => v.account.isActive && v.account.kind !== "credit")
    .map((v) => ({
      id: v.account.id,
      name: v.account.name,
      kind: v.account.kind,
      bank: v.account.bank,
      balancePesos: toPesos(v.balance),
    }));

  const now = new Date();
  const dueProjections = projections
    .filter((p) => p.status === "projected" && p.occurredAt <= now)
    .map((p) => ({
      id: p.id,
      concept: p.concept,
      occurredAt: p.occurredAt,
      // expected_amount nunca es NULL aquí: listProjections filtra por él.
      expectedPesos: toPesos(money(p.expectedAmount ?? p.amount)),
      accountName:
        accountViews.find((v) => v.account.id === p.accountId)?.account.name ?? "—",
    }));

  return {
    realAvailablePesos: real,
    projectedAvailablePesos: projected,
    netProjectedPesos: net,
    creditCards,
    netWorthAccounts,
    dueProjections,
  };
}
