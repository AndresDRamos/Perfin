"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import {
  planCreateSchema,
  planUpdateSchema,
  budgetSchema,
  createPlan,
  updatePlan,
  deletePlan,
  createBudget,
  updateBudget,
  deleteBudget,
  capCategoryExists,
  reservationAccountExists,
} from "@/data/budget-write";
import { listPlans, planProgress, type PlanProgress } from "@/data/budget-repo";
import { listActiveExpenseCategories } from "@/data/category-repo";
import { db } from "@/data/db";
import { account, plan, type PlanRow, type Account, type ExpenseCategoryRow } from "@/data/schema";

// ─── plan CRUD ──────────────────────────────────────────────────────────────────

export async function createPlanAction(raw: unknown) {
  const parsed = planCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten().fieldErrors };
  }
  const row = await createPlan(parsed.data);
  revalidatePath("/plans");
  return { ok: true as const, id: row.id };
}

export async function updatePlanAction(id: number, raw: unknown) {
  const parsed = planUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten().fieldErrors };
  }
  const row = await updatePlan(id, parsed.data);
  revalidatePath("/plans");
  revalidatePath(`/plans/${id}`);
  return { ok: true as const, id: row.id };
}

export async function deletePlanAction(id: number) {
  await deletePlan(id); // budgets cascade
  revalidatePath("/plans");
  return { ok: true as const };
}

// ─── budget CRUD ──────────────────────────────────────────────────────────────

export async function createBudgetAction(raw: unknown) {
  const parsed = budgetSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten().fieldErrors };
  }
  const dupe = await checkDuplicate(parsed.data);
  if (dupe) return dupe;
  const row = await createBudget(parsed.data);
  revalidatePath(`/plans/${parsed.data.planId}`);
  return { ok: true as const, id: row.id };
}

export async function updateBudgetAction(id: number, raw: unknown) {
  const parsed = budgetSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten().fieldErrors };
  }
  const dupe = await checkDuplicate(parsed.data, id);
  if (dupe) return dupe;
  const row = await updateBudget(id, parsed.data);
  revalidatePath(`/plans/${parsed.data.planId}`);
  return { ok: true as const, id: row.id };
}

export async function deleteBudgetAction(id: number, planId: number) {
  await deleteBudget(id);
  revalidatePath(`/plans/${planId}`);
  return { ok: true as const };
}

// Friendly duplicate guard mirroring the partial unique indexes.
async function checkDuplicate(
  data: ReturnType<typeof budgetSchema.parse>,
  excludeId?: number
) {
  if (
    data.subtype === "category_cap" &&
    (await capCategoryExists(data.planId, data.expenseCategoryId, excludeId))
  ) {
    return {
      ok: false as const,
      errors: { expenseCategoryId: ["Ya existe un tope para esa categoría en el plan"] },
    };
  }
  if (
    data.subtype === "savings_reservation" &&
    (await reservationAccountExists(data.planId, data.accountId, excludeId))
  ) {
    return {
      ok: false as const,
      errors: { accountId: ["Ya existe una reserva para esa cuenta en el plan"] },
    };
  }
  return null;
}

// ─── reads ────────────────────────────────────────────────────────────────────

export async function getPlansPage(): Promise<{ plans: PlanRow[] }> {
  const plans = await listPlans();
  return { plans };
}

export interface PlanDetail {
  progress: PlanProgress;
  expenseCategories: ExpenseCategoryRow[];
  accounts: Account[];
}

export async function getPlanDetail(planId: number): Promise<PlanDetail | null> {
  const progress = await planProgress(planId);
  if (!progress) return null;
  const [expenseCategories, accounts] = await Promise.all([
    listActiveExpenseCategories(),
    db.select().from(account).where(eq(account.isActive, true)).orderBy(account.name),
  ]);
  return { progress, expenseCategories, accounts };
}

// Used by the plan-creation flow before any detail page exists.
export async function getPlanById(id: number): Promise<PlanRow | undefined> {
  const [row] = await db.select().from(plan).where(eq(plan.id, id)).limit(1);
  return row;
}
