import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { ledgerEntry, NewLedgerEntry, LedgerEntryRow } from "./schema";

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
});

export const expenseSchema = baseEntry.extend({
  kind: z.literal("expense"),
  toAccountId: z.undefined({ message: "expense no acepta to_account_id" }).optional(),
});

export const transferSchema = baseEntry.extend({
  kind: z.literal("transfer"),
  toAccountId: z.number().int().positive(),
}).refine((d) => d.toAccountId !== d.accountId, {
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

function toRow(input: LedgerEntryInput): NewLedgerEntry {
  return {
    kind: input.kind,
    status: input.status,
    amount: Math.round(input.amountPesos * 100), // pesos → centavos
    concept: input.concept ?? null,
    occurredAt: input.occurredAt,
    accountId: input.accountId,
    toAccountId: input.kind === "transfer" ? input.toAccountId : null,
  };
}

export async function createEntry(input: LedgerEntryInput): Promise<LedgerEntryRow> {
  const [row] = await db.insert(ledgerEntry).values(toRow(input)).returning();
  return row;
}

export async function updateEntry(
  id: number,
  input: LedgerEntryInput
): Promise<LedgerEntryRow> {
  const [row] = await db
    .update(ledgerEntry)
    .set({ ...toRow(input), updatedAt: new Date() })
    .where(eq(ledgerEntry.id, id))
    .returning();
  if (!row) throw new Error(`ledger_entry ${id} not found`);
  return row;
}

// Idempotent: projected → cleared. No-op if already cleared.
export async function reconcile(id: number): Promise<LedgerEntryRow> {
  const [row] = await db
    .update(ledgerEntry)
    .set({ status: "cleared", updatedAt: new Date() })
    .where(eq(ledgerEntry.id, id))
    .returning();
  if (!row) throw new Error(`ledger_entry ${id} not found`);
  return row;
}
