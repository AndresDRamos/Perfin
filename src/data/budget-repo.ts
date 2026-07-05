import { and, eq, sql, type SQL } from "drizzle-orm";
import { db } from "./db";
import { plan, budget, ledgerEntry, PlanRow, BudgetRow } from "./schema";

// ─── plan / budget reads ────────────────────────────────────────────────────────

export async function listPlans(userId: string): Promise<PlanRow[]> {
  return db.select().from(plan).where(eq(plan.userId, userId)).orderBy(plan.periodStart);
}

export async function getPlan(userId: string, id: number): Promise<PlanRow | undefined> {
  const [row] = await db
    .select()
    .from(plan)
    .where(and(eq(plan.id, id), eq(plan.userId, userId)))
    .limit(1);
  return row;
}

// Not user-scoped directly (budget has no user_id — it inherits ownership via
// plan_id). Safe only because its one caller, planProgress, already resolves
// the plan through the owner-scoped getPlan above before reaching here.
async function listBudgets(planId: number): Promise<BudgetRow[]> {
  return db.select().from(budget).where(eq(budget.planId, planId)).orderBy(budget.id);
}

// ─── actuals ────────────────────────────────────────────────────────────────────
// Effective window = budget override (both dates) when present, else the plan's.
// Actuals are derived from the ledger; transfers are excluded from category caps
// (the ledger invariant), and a reservation tracks only transfers into its account.

interface Window {
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD inclusive
}

function effectiveWindow(b: BudgetRow, p: PlanRow): Window {
  if (b.periodStart && b.periodEnd) return { start: b.periodStart, end: b.periodEnd };
  return { start: p.periodStart, end: p.periodEnd };
}

// occurred_at (timestamptz) inside [start, end] at day granularity.
function withinWindow(w: Window) {
  return and(
    sql`${ledgerEntry.occurredAt} >= ${w.start}`,
    sql`${ledgerEntry.occurredAt} < (${w.end}::date + interval '1 day')`
  );
}

async function sumAmount(...conds: (SQL | undefined)[]): Promise<number> {
  const [r] = await db
    .select({ total: sql<string>`coalesce(sum(${ledgerEntry.amount}), 0)` })
    .from(ledgerEntry)
    .where(and(...conds));
  return Number(r.total);
}

// category_cap: expenses in the category within the window.
async function capActual(
  expenseCategoryId: number,
  w: Window,
  clearedOnly: boolean
): Promise<number> {
  return sumAmount(
    eq(ledgerEntry.kind, "expense"),
    eq(ledgerEntry.expenseCategoryId, expenseCategoryId),
    withinWindow(w),
    clearedOnly ? eq(ledgerEntry.status, "cleared") : undefined
  );
}

// savings_reservation: transfers into the account within the window.
async function reservationActual(
  accountId: number,
  w: Window,
  clearedOnly: boolean
): Promise<number> {
  return sumAmount(
    eq(ledgerEntry.kind, "transfer"),
    eq(ledgerEntry.toAccountId, accountId),
    withinWindow(w),
    clearedOnly ? eq(ledgerEntry.status, "cleared") : undefined
  );
}

// ─── progress aggregation ───────────────────────────────────────────────────────

export interface BudgetProgress {
  budget: BudgetRow;
  // centavos. purchase_goal has no derived actual in v1 (both 0).
  realActual: number;
  projectedActual: number;
}

export interface PlanProgress {
  plan: PlanRow;
  budgets: BudgetProgress[];
}

async function progressFor(b: BudgetRow, p: PlanRow): Promise<BudgetProgress> {
  const w = effectiveWindow(b, p);

  if (b.subtype === "category_cap" && b.expenseCategoryId !== null) {
    const [realActual, projectedActual] = await Promise.all([
      capActual(b.expenseCategoryId, w, true),
      capActual(b.expenseCategoryId, w, false),
    ]);
    return { budget: b, realActual, projectedActual };
  }

  if (b.subtype === "savings_reservation" && b.accountId !== null) {
    const [realActual, projectedActual] = await Promise.all([
      reservationActual(b.accountId, w, true),
      reservationActual(b.accountId, w, false),
    ]);
    return { budget: b, realActual, projectedActual };
  }

  // purchase_goal (or any subtype without a ledger linkage): target-only in v1.
  return { budget: b, realActual: 0, projectedActual: 0 };
}

export async function planProgress(
  userId: string,
  planId: number
): Promise<PlanProgress | undefined> {
  const p = await getPlan(userId, planId);
  if (!p) return undefined;
  const budgets = await listBudgets(planId);
  const progress = await Promise.all(budgets.map((b) => progressFor(b, p)));
  return { plan: p, budgets: progress };
}
