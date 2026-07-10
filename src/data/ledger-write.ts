import { z } from "zod";
import { and, eq, isNotNull } from "drizzle-orm";
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
    // Campos de origen fijo / proyección: el input nunca los trae, pero un
    // cambio de kind en updateEntry debe nullificar el que ya no aplica
    // (chk_fixed_expense_link / chk_expected_amount_income) — mismo patrón
    // que las categorías. Si el kind se conserva, se dejan intactos.
    ...(input.kind !== "expense" && { fixedExpenseId: null, fixedExpenseMonth: null }),
    ...(input.kind !== "income" && { expectedAmount: null }),
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

// ─── income projections (plan type "Proyección") ─────────────────────────────

export const projectionCreateSchema = z.object({
  amountPesos: z.number().positive({ message: "El monto debe ser mayor a 0" }),
  concept: z.string().max(200).optional(),
  occurredAt: z.coerce.date(),
  accountId: z.number().int().positive(),
  categoryId: z.number().int().positive().optional(),
});

export type ProjectionCreateInput = z.infer<typeof projectionCreateSchema>;

// Un ingreso proyectado que conserva su monto esperado: expected_amount se
// escribe una sola vez aquí (= amount inicial) y nunca vuelve a mutarse, para
// poder mostrar esperado vs real tras conciliar.
export async function createProjection(
  userId: string,
  input: ProjectionCreateInput
): Promise<LedgerEntryRow> {
  const parsed = projectionCreateSchema.parse(input);
  await assertOwnedAccount(userId, parsed.accountId);

  const amount = Math.round(parsed.amountPesos * 100);
  const [row] = await db
    .insert(ledgerEntry)
    .values({
      userId,
      kind: "income",
      status: "projected",
      amount,
      expectedAmount: amount,
      concept: parsed.concept ?? null,
      occurredAt: parsed.occurredAt,
      accountId: parsed.accountId,
      incomeCategoryId: parsed.categoryId ?? null,
      expenseCategoryId: null,
    })
    .returning();
  return row;
}

// Concilia una proyección de ingreso con el monto que realmente llegó:
// actualiza amount y status; expected_amount queda intacto (es la memoria
// del esperado, la diferencia se deriva en la lectura).
export async function reconcileWithAmount(
  userId: string,
  id: number,
  realPesos: number
): Promise<LedgerEntryRow> {
  if (!(realPesos > 0)) throw new Error("El monto real debe ser mayor a 0");

  const [existing] = await db
    .select({ kind: ledgerEntry.kind, status: ledgerEntry.status })
    .from(ledgerEntry)
    .where(and(eq(ledgerEntry.id, id), eq(ledgerEntry.userId, userId)))
    .limit(1);
  if (!existing) throw new Error(`ledger_entry ${id} not found`);
  if (existing.kind !== "income" || existing.status !== "projected") {
    throw new Error(`ledger_entry ${id} is not a pending income projection`);
  }

  const [row] = await db
    .update(ledgerEntry)
    .set({
      amount: Math.round(realPesos * 100),
      status: "cleared",
      updatedAt: new Date(),
    })
    .where(and(eq(ledgerEntry.id, id), eq(ledgerEntry.userId, userId)))
    .returning();
  return row;
}

// Borra una proyección de ingreso (pendiente o ya conciliada). Acotado a
// kind=income + expected_amount NOT NULL para no poder borrar una entry
// normal por esta vía.
export async function deleteProjection(userId: string, id: number): Promise<void> {
  const rows = await db
    .delete(ledgerEntry)
    .where(
      and(
        eq(ledgerEntry.id, id),
        eq(ledgerEntry.userId, userId),
        eq(ledgerEntry.kind, "income"),
        isNotNull(ledgerEntry.expectedAmount)
      )
    )
    .returning({ id: ledgerEntry.id });
  if (rows.length === 0) throw new Error(`projection ${id} not found`);
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
