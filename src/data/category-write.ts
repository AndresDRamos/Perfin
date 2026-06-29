import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { db } from "./db";
import {
  incomeCategory,
  expenseCategory,
  IncomeCategoryRow,
  ExpenseCategoryRow,
} from "./schema";

// ─── Zod schemas ─────────────────────────────────────────────────────────────

export const incomeCategoryCreateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(300).optional(),
});

export const incomeCategoryUpdateSchema = incomeCategoryCreateSchema.partial();

export const expenseCategoryCreateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(300).optional(),
  isSavings: z.boolean().default(false),
});

export const expenseCategoryUpdateSchema = expenseCategoryCreateSchema
  .omit({ isSavings: true })
  .partial();

export type IncomeCategoryCreateInput = z.infer<typeof incomeCategoryCreateSchema>;
export type IncomeCategoryUpdateInput = z.infer<typeof incomeCategoryUpdateSchema>;
export type ExpenseCategoryCreateInput = z.infer<typeof expenseCategoryCreateSchema>;
export type ExpenseCategoryUpdateInput = z.infer<typeof expenseCategoryUpdateSchema>;

// ─── income_category writes ──────────────────────────────────────────────────

export async function createIncomeCategory(
  input: IncomeCategoryCreateInput
): Promise<IncomeCategoryRow> {
  const parsed = incomeCategoryCreateSchema.parse(input);
  const [row] = await db
    .insert(incomeCategory)
    .values({ name: parsed.name, description: parsed.description ?? null })
    .returning();
  return row;
}

export async function updateIncomeCategory(
  id: number,
  input: IncomeCategoryUpdateInput
): Promise<IncomeCategoryRow> {
  const parsed = incomeCategoryUpdateSchema.parse(input);
  const [row] = await db
    .update(incomeCategory)
    .set({ ...parsed })
    .where(eq(incomeCategory.id, id))
    .returning();
  if (!row) throw new Error(`income_category ${id} not found`);
  return row;
}

export async function deactivateIncomeCategory(id: number): Promise<IncomeCategoryRow> {
  const [row] = await db
    .update(incomeCategory)
    .set({ isActive: false })
    .where(eq(incomeCategory.id, id))
    .returning();
  if (!row) throw new Error(`income_category ${id} not found`);
  return row;
}

// ─── expense_category writes ─────────────────────────────────────────────────

export async function createExpenseCategory(
  input: ExpenseCategoryCreateInput
): Promise<ExpenseCategoryRow> {
  const parsed = expenseCategoryCreateSchema.parse(input);
  const [row] = await db
    .insert(expenseCategory)
    .values({
      name: parsed.name,
      description: parsed.description ?? null,
      isSavings: parsed.isSavings,
    })
    .returning();
  return row;
}

export async function updateExpenseCategory(
  id: number,
  input: ExpenseCategoryUpdateInput
): Promise<ExpenseCategoryRow> {
  const parsed = expenseCategoryUpdateSchema.parse(input);
  const [row] = await db
    .update(expenseCategory)
    .set({ ...parsed })
    .where(eq(expenseCategory.id, id))
    .returning();
  if (!row) throw new Error(`expense_category ${id} not found`);
  return row;
}

export async function deactivateExpenseCategory(id: number): Promise<ExpenseCategoryRow> {
  const [row] = await db
    .update(expenseCategory)
    .set({ isActive: false })
    .where(eq(expenseCategory.id, id))
    .returning();
  if (!row) throw new Error(`expense_category ${id} not found`);
  return row;
}

// ─── duplicate check (case-insensitive) ──────────────────────────────────────
// Used by server actions before insert to give a friendly error instead of
// letting the DB unique index reject the insert with a cryptic error.

export async function incomeCategoryNameExists(name: string, excludeId?: number): Promise<boolean> {
  const rows = await db
    .select({ id: incomeCategory.id })
    .from(incomeCategory)
    .where(sql`lower(${incomeCategory.name}) = lower(${name})`);
  return rows.some((r) => r.id !== excludeId);
}

export async function expenseCategoryNameExists(name: string, excludeId?: number): Promise<boolean> {
  const rows = await db
    .select({ id: expenseCategory.id })
    .from(expenseCategory)
    .where(sql`lower(${expenseCategory.name}) = lower(${name})`);
  return rows.some((r) => r.id !== excludeId);
}
