"use server";

import { revalidatePath } from "next/cache";
import {
  incomeCategoryCreateSchema,
  incomeCategoryUpdateSchema,
  expenseCategoryCreateSchema,
  expenseCategoryUpdateSchema,
  createIncomeCategory,
  updateIncomeCategory,
  deactivateIncomeCategory,
  createExpenseCategory,
  updateExpenseCategory,
  deactivateExpenseCategory,
  incomeCategoryNameExists,
  expenseCategoryNameExists,
} from "@/data/category-write";
import {
  listAllIncomeCategories,
  listAllExpenseCategories,
} from "@/data/category-repo";
import type { IncomeCategoryRow, ExpenseCategoryRow } from "@/data/schema";

// ─── income categories ────────────────────────────────────────────────────────

export async function createIncomeCategoryAction(raw: unknown) {
  const parsed = incomeCategoryCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten().fieldErrors };
  }
  if (await incomeCategoryNameExists(parsed.data.name)) {
    return { ok: false as const, errors: { name: ["Ya existe una categoría con ese nombre"] } };
  }
  const row = await createIncomeCategory(parsed.data);
  revalidatePath("/categories");
  return { ok: true as const, id: row.id };
}

export async function updateIncomeCategoryAction(id: number, raw: unknown) {
  const parsed = incomeCategoryUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten().fieldErrors };
  }
  if (parsed.data.name && (await incomeCategoryNameExists(parsed.data.name, id))) {
    return { ok: false as const, errors: { name: ["Ya existe una categoría con ese nombre"] } };
  }
  const row = await updateIncomeCategory(id, parsed.data);
  revalidatePath("/categories");
  return { ok: true as const, id: row.id };
}

export async function deactivateIncomeCategoryAction(id: number) {
  await deactivateIncomeCategory(id);
  revalidatePath("/categories");
  return { ok: true as const };
}

// ─── expense categories ───────────────────────────────────────────────────────

export async function createExpenseCategoryAction(raw: unknown) {
  const parsed = expenseCategoryCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten().fieldErrors };
  }
  if (await expenseCategoryNameExists(parsed.data.name)) {
    return { ok: false as const, errors: { name: ["Ya existe una categoría con ese nombre"] } };
  }
  const row = await createExpenseCategory(parsed.data);
  revalidatePath("/categories");
  return { ok: true as const, id: row.id };
}

export async function updateExpenseCategoryAction(id: number, raw: unknown) {
  const parsed = expenseCategoryUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, errors: parsed.error.flatten().fieldErrors };
  }
  if (parsed.data.name && (await expenseCategoryNameExists(parsed.data.name, id))) {
    return { ok: false as const, errors: { name: ["Ya existe una categoría con ese nombre"] } };
  }
  const row = await updateExpenseCategory(id, parsed.data);
  revalidatePath("/categories");
  return { ok: true as const, id: row.id };
}

export async function deactivateExpenseCategoryAction(id: number) {
  await deactivateExpenseCategory(id);
  revalidatePath("/categories");
  return { ok: true as const };
}

// ─── reads ────────────────────────────────────────────────────────────────────

export async function getCategoriesPage(): Promise<{
  incomeCategories: IncomeCategoryRow[];
  expenseCategories: ExpenseCategoryRow[];
}> {
  const [incomeCategories, expenseCategories] = await Promise.all([
    listAllIncomeCategories(),
    listAllExpenseCategories(),
  ]);
  return { incomeCategories, expenseCategories };
}
