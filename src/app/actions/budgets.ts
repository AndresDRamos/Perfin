"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
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
import { requireSessionUser } from "@/data/auth-repo";
import { db } from "@/data/db";
import { account, plan, type PlanRow, type Account, type ExpenseCategoryRow } from "@/data/schema";

// ─── plan CRUD ──────────────────────────────────────────────────────────────────

export async function createPlanAction(raw: unknown) {
  const { userId } = await requireSessionUser();
  const parsed = planCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten().fieldErrors };
  }
  const row = await createPlan(userId, parsed.data);
  revalidatePath("/plans");
  return { ok: true as const, id: row.id };
}

export async function updatePlanAction(id: number, raw: unknown) {
  const { userId } = await requireSessionUser();
  const parsed = planUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten().fieldErrors };
  }
  const row = await updatePlan(userId, id, parsed.data);
  revalidatePath("/plans");
  revalidatePath(`/plans/${id}`);
  return { ok: true as const, id: row.id };
}

export async function deletePlanAction(id: number) {
  const { userId } = await requireSessionUser();
  await deletePlan(userId, id); // budgets cascade
  revalidatePath("/plans");
  return { ok: true as const };
}

// ─── budget CRUD ──────────────────────────────────────────────────────────────

export async function createBudgetAction(raw: unknown) {
  const { userId } = await requireSessionUser();
  const parsed = budgetSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten().fieldErrors };
  }
  const dupe = await checkDuplicate(userId, parsed.data);
  if (dupe) return dupe;
  const row = await createBudget(userId, parsed.data);
  revalidatePath(`/plans/${parsed.data.planId}`);
  return { ok: true as const, id: row.id };
}

export async function updateBudgetAction(id: number, raw: unknown) {
  const { userId } = await requireSessionUser();
  const parsed = budgetSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten().fieldErrors };
  }
  const dupe = await checkDuplicate(userId, parsed.data, id);
  if (dupe) return dupe;
  const row = await updateBudget(userId, id, parsed.data);
  revalidatePath(`/plans/${parsed.data.planId}`);
  return { ok: true as const, id: row.id };
}

export async function deleteBudgetAction(id: number, planId: number) {
  const { userId } = await requireSessionUser();
  await deleteBudget(userId, id, planId);
  revalidatePath(`/plans/${planId}`);
  return { ok: true as const };
}

// Friendly duplicate guard mirroring the partial unique indexes.
async function checkDuplicate(
  userId: string,
  data: ReturnType<typeof budgetSchema.parse>,
  excludeId?: number
) {
  if (
    data.subtype === "category_cap" &&
    (await capCategoryExists(userId, data.planId, data.expenseCategoryId, excludeId))
  ) {
    return {
      ok: false as const,
      errors: { expenseCategoryId: ["Ya existe un tope para esa categoría en el plan"] },
    };
  }
  if (
    data.subtype === "savings_reservation" &&
    (await reservationAccountExists(userId, data.planId, data.accountId, excludeId))
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
  const { userId } = await requireSessionUser();
  const plans = await listPlans(userId);
  return { plans };
}

export interface PlanDetail {
  progress: PlanProgress;
  expenseCategories: ExpenseCategoryRow[];
  accounts: Account[];
}

export async function getPlanDetail(planId: number): Promise<PlanDetail | null> {
  const { userId } = await requireSessionUser();
  const progress = await planProgress(userId, planId);
  if (!progress) return null;
  const [expenseCategories, accounts] = await Promise.all([
    listActiveExpenseCategories(),
    db
      .select()
      .from(account)
      .where(and(eq(account.userId, userId), eq(account.isActive, true)))
      .orderBy(account.name),
  ]);
  return { progress, expenseCategories, accounts };
}

// Used by the plan-creation flow before any detail page exists.
export async function getPlanById(id: number): Promise<PlanRow | undefined> {
  const { userId } = await requireSessionUser();
  const [row] = await db
    .select()
    .from(plan)
    .where(and(eq(plan.id, id), eq(plan.userId, userId)))
    .limit(1);
  return row;
}
