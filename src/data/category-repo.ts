import { eq } from "drizzle-orm";
import { db } from "./db";
import { incomeCategory, expenseCategory, IncomeCategoryRow, ExpenseCategoryRow } from "./schema";

export async function listActiveIncomeCategories(): Promise<IncomeCategoryRow[]> {
  return db
    .select()
    .from(incomeCategory)
    .where(eq(incomeCategory.isActive, true))
    .orderBy(incomeCategory.name);
}

export async function listActiveExpenseCategories(): Promise<ExpenseCategoryRow[]> {
  return db
    .select()
    .from(expenseCategory)
    .where(eq(expenseCategory.isActive, true))
    .orderBy(expenseCategory.name);
}

export async function listAllIncomeCategories(): Promise<IncomeCategoryRow[]> {
  return db.select().from(incomeCategory).orderBy(incomeCategory.name);
}

export async function listAllExpenseCategories(): Promise<ExpenseCategoryRow[]> {
  return db.select().from(expenseCategory).orderBy(expenseCategory.name);
}
