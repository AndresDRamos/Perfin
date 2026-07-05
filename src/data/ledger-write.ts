import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { account, ledgerEntry, NewLedgerEntry, LedgerEntryRow } from "./schema";

// ─── Zod validation schemas ───────────────────────────────────────────────────
// amount in pesos (UI input); converted to centavos before write.
// Mirrors DB check constraints so invalid input is rejected at the UX layer.

const baseEntry = z.object({
  amountPesos: z.number().positive({ message: "El monto debe ser mayor a 0" }),
  concept: z.string().max(200).optional(),
  occurredAt: z.coerce.date(),
  status: z.enum(["cleared", "projected"]),
  accountId: z.number().int().positive(),
});

export const incomeSchema = baseEntry.extend({
  kind: z.literal("income"),
  toAccountId: z.undefined({ message: "income no acepta to_account_id" }).optional(),
  categoryId: z.number().int().positive().optional(),
});

export const expenseSchema = baseEntry.extend({
  kind: z.literal("expense"),
  toAccountId: z.undefined({ message: "expense no acepta to_account_id" }).optional(),
  categoryId: z.number().int().positive().optional(),
});

export const transferSchema = baseEntry
  .extend({
    kind: z.literal("transfer"),
    toAccountId: z.number().int().positive(),
    categoryId: z
      .undefined({ message: "transfer no acepta categoryId" })
      .optional(),
  })
  .refine((d) => d.toAccountId !== d.accountId, {
    message: "La cuenta destino debe ser diferente a la cuenta origen",
    path: ["toAccountId"],
  });

export const ledgerEntrySchema = z.discriminatedUnion("kind", [
  incomeSchema,
  expenseSchema,
  transferSchema,
]);

export type LedgerEntryInput = z.infer<typeof ledgerEntrySchema>;

// ─── write operations ────────────────────────────────────────────────────────

function toRow(input: LedgerEntryInput): Omit<NewLedgerEntry, "userId"> {
  const incomeCategoryId =
    input.kind === "income" ? (input.categoryId ?? null) : null;
  const expenseCategoryId =
    input.kind === "expense" ? (input.categoryId ?? null) : null;

  return {
    kind: input.kind,
    status: input.status,
    amount: Math.round(input.amountPesos * 100), // pesos → centavos
    concept: input.concept ?? null,
    occurredAt: input.occurredAt,
    accountId: input.accountId,
    toAccountId: input.kind === "transfer" ? input.toAccountId : null,
    incomeCategoryId,
    expenseCategoryId,
  };
}

// Both accountId and (for transfers) toAccountId must belong to the caller —
// this is what "no cross-user transfers in v1" (docs/plans/auth-spaces.md
// decision 3) reduces to: you may only move money between your own accounts.
async function assertOwnedAccount(userId: string, accountId: number): Promise<void> {
  const [row] = await db
    .select({ id: account.id })
    .from(account)
    .where(and(eq(account.id, accountId), eq(account.userId, userId)))
    .limit(1);
  if (!row) throw new Error(`account ${accountId} not found`);
}

export async function createEntry(
  userId: string,
  input: LedgerEntryInput
): Promise<LedgerEntryRow> {
  await assertOwnedAccount(userId, input.accountId);
  if (input.kind === "transfer") await assertOwnedAccount(userId, input.toAccountId);

  const [row] = await db
    .insert(ledgerEntry)
    .values({ ...toRow(input), userId })
    .returning();
  return row;
}

export async function updateEntry(
  userId: string,
  id: number,
  input: LedgerEntryInput
): Promise<LedgerEntryRow> {
  await assertOwnedAccount(userId, input.accountId);
  if (input.kind === "transfer") await assertOwnedAccount(userId, input.toAccountId);

  // Always set both category columns explicitly so that changing kind
  // nullifies the column that no longer applies (e.g., expense→income
  // must clear expense_category_id or chk_category_kind fires).
  const [row] = await db
    .update(ledgerEntry)
    .set({ ...toRow(input), userId, updatedAt: new Date() })
    .where(and(eq(ledgerEntry.id, id), eq(ledgerEntry.userId, userId)))
    .returning();
  if (!row) throw new Error(`ledger_entry ${id} not found`);
  return row;
}

// Idempotent: projected → cleared. No-op if already cleared.
export async function reconcile(userId: string, id: number): Promise<LedgerEntryRow> {
  const [row] = await db
    .update(ledgerEntry)
    .set({ status: "cleared", updatedAt: new Date() })
    .where(and(eq(ledgerEntry.id, id), eq(ledgerEntry.userId, userId)))
    .returning();
  if (!row) throw new Error(`ledger_entry ${id} not found`);
  return row;
}
