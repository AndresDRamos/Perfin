import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { account, incomeSchedule, IncomeScheduleRow } from "./schema";

// ─── Zod validation schemas ───────────────────────────────────────────────────
// estimatedAmount in pesos (UI input); converted to centavos before write.
// The amount is an ESTIMATE — the real amount is asked on payday and lands in
// ledger_entry; schedule rows never enter the ledger.

export const incomeScheduleSchema = z.object({
  name: z.string().min(1).max(100),
  frequency: z.enum(["weekly", "biweekly", "semimonthly", "monthly"]),
  estimatedAmountPesos: z.number().positive({ message: "El monto debe ser mayor a 0" }),
  accountId: z.number().int().positive(),
  incomeCategoryId: z.number().int().positive().optional(),
  anchorDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Fecha inválida" }),
});

export type IncomeScheduleInput = z.infer<typeof incomeScheduleSchema>;

// ─── write operations ────────────────────────────────────────────────────────

async function assertOwnedAccount(userId: string, accountId: number): Promise<void> {
  const [row] = await db
    .select({ id: account.id })
    .from(account)
    .where(and(eq(account.id, accountId), eq(account.userId, userId)))
    .limit(1);
  if (!row) throw new Error(`account ${accountId} not found`);
}

function toRow(input: IncomeScheduleInput) {
  return {
    name: input.name,
    frequency: input.frequency,
    estimatedAmount: Math.round(input.estimatedAmountPesos * 100), // pesos → centavos
    accountId: input.accountId,
    incomeCategoryId: input.incomeCategoryId ?? null,
    anchorDate: input.anchorDate,
  };
}

export async function createIncomeSchedule(
  userId: string,
  input: IncomeScheduleInput
): Promise<IncomeScheduleRow> {
  await assertOwnedAccount(userId, input.accountId);
  const [row] = await db
    .insert(incomeSchedule)
    .values({ ...toRow(input), userId })
    .returning();
  return row;
}

export async function updateIncomeSchedule(
  userId: string,
  id: number,
  input: IncomeScheduleInput
): Promise<IncomeScheduleRow> {
  await assertOwnedAccount(userId, input.accountId);
  const [row] = await db
    .update(incomeSchedule)
    .set({ ...toRow(input), updatedAt: new Date() })
    .where(and(eq(incomeSchedule.id, id), eq(incomeSchedule.userId, userId)))
    .returning();
  if (!row) throw new Error(`income_schedule ${id} not found`);
  return row;
}

export async function deactivateIncomeSchedule(
  userId: string,
  id: number
): Promise<IncomeScheduleRow> {
  const [row] = await db
    .update(incomeSchedule)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(eq(incomeSchedule.id, id), eq(incomeSchedule.userId, userId)))
    .returning();
  if (!row) throw new Error(`income_schedule ${id} not found`);
  return row;
}
