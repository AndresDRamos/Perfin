import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { account, expenseCategory, fixedExpense, FixedExpenseRow } from "./schema";

// ─── Zod schemas ─────────────────────────────────────────────────────────────
// amount in pesos (UI input); converted to centavos before write.

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Fecha inválida (YYYY-MM-DD)" });

export const fixedExpenseCreateSchema = z
  .object({
    name: z.string().min(1).max(100),
    amountPesos: z.number().positive({ message: "El monto debe ser mayor a 0" }),
    accountId: z.number().int().positive(),
    expenseCategoryId: z.number().int().positive(),
    dayOfMonth: z.number().int().min(1).max(31),
    startDate: isoDate,
    endDate: isoDate.optional(),
  })
  .refine((d) => d.endDate === undefined || d.endDate >= d.startDate, {
    message: "La fecha fin no puede ser anterior al inicio",
    path: ["endDate"],
  });

export const fixedExpenseUpdateSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    amountPesos: z.number().positive({ message: "El monto debe ser mayor a 0" }).optional(),
    accountId: z.number().int().positive().optional(),
    expenseCategoryId: z.number().int().positive().optional(),
    dayOfMonth: z.number().int().min(1).max(31).optional(),
    startDate: isoDate.optional(),
    // null despeja la vigencia (vuelve a indefinida).
    endDate: isoDate.nullable().optional(),
  })
  .refine(
    (d) =>
      d.startDate === undefined ||
      d.endDate === undefined ||
      d.endDate === null ||
      d.endDate >= d.startDate,
    { message: "La fecha fin no puede ser anterior al inicio", path: ["endDate"] }
  );

export type FixedExpenseCreateInput = z.infer<typeof fixedExpenseCreateSchema>;
export type FixedExpenseUpdateInput = z.infer<typeof fixedExpenseUpdateSchema>;

// ─── invariant guards (app-layer, no cross-table CHECK in DB) ────────────────

async function assertOwnedAccount(userId: string, accountId: number): Promise<void> {
  const [row] = await db
    .select({ id: account.id })
    .from(account)
    .where(and(eq(account.id, accountId), eq(account.userId, userId)))
    .limit(1);
  if (!row) throw new Error(`account ${accountId} not found`);
}

// Un fijo solo acepta categorías is_fixed activas. La restricción vive aquí
// (la dba descartó trigger/FK compuesta); un gasto manual sí puede usarlas.
async function assertActiveFixedCategory(categoryId: number): Promise<void> {
  const [row] = await db
    .select({ id: expenseCategory.id })
    .from(expenseCategory)
    .where(
      and(
        eq(expenseCategory.id, categoryId),
        eq(expenseCategory.isActive, true),
        eq(expenseCategory.isFixed, true)
      )
    )
    .limit(1);
  if (!row) {
    throw new Error(`expense_category ${categoryId} is not an active fixed category`);
  }
}

// ─── writes ──────────────────────────────────────────────────────────────────

export async function createFixedExpense(
  userId: string,
  input: FixedExpenseCreateInput
): Promise<FixedExpenseRow> {
  const parsed = fixedExpenseCreateSchema.parse(input);
  await assertOwnedAccount(userId, parsed.accountId);
  await assertActiveFixedCategory(parsed.expenseCategoryId);

  const [row] = await db
    .insert(fixedExpense)
    .values({
      userId,
      name: parsed.name,
      amount: Math.round(parsed.amountPesos * 100), // pesos → centavos
      accountId: parsed.accountId,
      expenseCategoryId: parsed.expenseCategoryId,
      dayOfMonth: parsed.dayOfMonth,
      startDate: parsed.startDate,
      endDate: parsed.endDate ?? null,
    })
    .returning();
  return row;
}

export async function updateFixedExpense(
  userId: string,
  id: number,
  input: FixedExpenseUpdateInput
): Promise<FixedExpenseRow> {
  const parsed = fixedExpenseUpdateSchema.parse(input);
  if (parsed.accountId !== undefined) await assertOwnedAccount(userId, parsed.accountId);
  if (parsed.expenseCategoryId !== undefined) {
    await assertActiveFixedCategory(parsed.expenseCategoryId);
  }

  const [row] = await db
    .update(fixedExpense)
    .set({
      ...(parsed.name !== undefined && { name: parsed.name }),
      ...(parsed.amountPesos !== undefined && {
        amount: Math.round(parsed.amountPesos * 100),
      }),
      ...(parsed.accountId !== undefined && { accountId: parsed.accountId }),
      ...(parsed.expenseCategoryId !== undefined && {
        expenseCategoryId: parsed.expenseCategoryId,
      }),
      ...(parsed.dayOfMonth !== undefined && { dayOfMonth: parsed.dayOfMonth }),
      ...(parsed.startDate !== undefined && { startDate: parsed.startDate }),
      ...(parsed.endDate !== undefined && { endDate: parsed.endDate }),
      updatedAt: new Date(),
    })
    .where(and(eq(fixedExpense.id, id), eq(fixedExpense.userId, userId)))
    .returning();
  if (!row) throw new Error(`fixed_expense ${id} not found`);
  return row;
}

// Soft-deactivate: la plantilla deja de materializar; las entries ya
// materializadas sobreviven intactas (son transacciones reales).
export async function setFixedExpenseActive(
  userId: string,
  id: number,
  isActive: boolean
): Promise<FixedExpenseRow> {
  const [row] = await db
    .update(fixedExpense)
    .set({ isActive, updatedAt: new Date() })
    .where(and(eq(fixedExpense.id, id), eq(fixedExpense.userId, userId)))
    .returning();
  if (!row) throw new Error(`fixed_expense ${id} not found`);
  return row;
}

// Hard delete de la plantilla. El FK ON DELETE SET NULL desengancha las
// entries materializadas sin tocarlas.
export async function deleteFixedExpense(userId: string, id: number): Promise<void> {
  const rows = await db
    .delete(fixedExpense)
    .where(and(eq(fixedExpense.id, id), eq(fixedExpense.userId, userId)))
    .returning({ id: fixedExpense.id });
  if (rows.length === 0) throw new Error(`fixed_expense ${id} not found`);
}
