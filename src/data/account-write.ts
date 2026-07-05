import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { db } from "./db";
import { account, Account, NewAccount } from "./schema";

// ─── shared building blocks ────────────────────────────────────────────────────

const dayOfMonth = z
  .number()
  .int()
  .min(1, { message: "Debe estar entre 1 y 28" })
  .max(28, { message: "Debe estar entre 1 y 28" });

// Masked identifier ("****1234", partial CLABE) — a full PAN (13-19 straight
// digits) is rejected here and by chk_number_masked in the DB.
const maskedNumber = z
  .string()
  .min(1)
  .max(30)
  .refine((v) => !/^[0-9]{13,19}$/.test(v), {
    message: "No guardes el número completo; usa una versión enmascarada (p.ej. ****1234)",
  });

// Card validity captured as YYYY-MM (input type="month"); persisted as the 1st
// of that month. The card is valid through the END of that month.
const expirationMonth = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, { message: "Vigencia inválida (YYYY-MM)" });

function expirationToDate(month: string | null | undefined): string | null {
  return month ? `${month}-01` : null;
}

const accountBase = z.object({
  name: z.string().min(1).max(100),
  // Pesos (UI input); converted to centavos before write. May be negative
  // (e.g. a credit card created with existing debt).
  openingBalancePesos: z.number().finite().default(0),
  bank: z.string().min(1).max(100).optional(),
  number: maskedNumber.optional(),
  expirationMonth: expirationMonth.optional(),
});

// ─── create schema (discriminated union on kind) ────────────────────────────────
// Credit accounts own cutoff/payment/limit; all other kinds must not send them
// (chk_credit_fields is the DB backstop).

export const accountCreateSchema = z
  .discriminatedUnion("kind", [
    accountBase.extend({ kind: z.literal("cash") }),
    accountBase.extend({ kind: z.literal("debit") }),
    accountBase.extend({ kind: z.literal("investment") }),
    accountBase.extend({
      kind: z.literal("credit"),
      cutoffDay: dayOfMonth,
      paymentDay: dayOfMonth,
      creditLimitPesos: z
        .number()
        .positive({ message: "El límite debe ser mayor a 0" })
        .optional(),
    }),
  ])
  .superRefine((d, ctx) => {
    if (d.kind === "credit" && d.cutoffDay === d.paymentDay) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El día de pago debe ser distinto al día de corte",
        path: ["paymentDay"],
      });
    }
  });

export type AccountCreateInput = z.infer<typeof accountCreateSchema>;

// ─── update schema ──────────────────────────────────────────────────────────────
// kind and openingBalance are IMMUTABLE after creation: changing either would
// silently rewrite the derived balance of every entry already in the ledger.
// null = clear the field; undefined = leave untouched.

export const accountUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  bank: z.string().min(1).max(100).nullable().optional(),
  number: maskedNumber.nullable().optional(),
  expirationMonth: expirationMonth.nullable().optional(),
  // credit-only; rejected at runtime for other kinds
  cutoffDay: dayOfMonth.optional(),
  paymentDay: dayOfMonth.optional(),
  creditLimitPesos: z
    .number()
    .positive({ message: "El límite debe ser mayor a 0" })
    .nullable()
    .optional(),
});

export type AccountUpdateInput = z.infer<typeof accountUpdateSchema>;

// ─── mappers ─────────────────────────────────────────────────────────────────

function toCreateRow(input: AccountCreateInput): Omit<NewAccount, "userId"> {
  return {
    name: input.name,
    kind: input.kind,
    openingBalance: Math.round(input.openingBalancePesos * 100), // pesos → centavos
    bank: input.bank ?? null,
    number: input.number ?? null,
    expirationDate: expirationToDate(input.expirationMonth),
    cutoffDay: input.kind === "credit" ? input.cutoffDay : null,
    paymentDay: input.kind === "credit" ? input.paymentDay : null,
    creditLimit:
      input.kind === "credit" && input.creditLimitPesos !== undefined
        ? Math.round(input.creditLimitPesos * 100)
        : null,
  };
}

// ─── writes ────────────────────────────────────────────────────────────────────

export async function createAccount(userId: string, input: AccountCreateInput): Promise<Account> {
  const parsed = accountCreateSchema.parse(input);
  const [row] = await db
    .insert(account)
    .values({ ...toCreateRow(parsed), userId })
    .returning();
  return row;
}

export async function updateAccount(
  userId: string,
  id: number,
  input: AccountUpdateInput
): Promise<Account> {
  const parsed = accountUpdateSchema.parse(input);

  const [current] = await db
    .select()
    .from(account)
    .where(and(eq(account.id, id), eq(account.userId, userId)))
    .limit(1);
  if (!current) throw new Error(`account ${id} not found`);

  const touchesCreditFields =
    parsed.cutoffDay !== undefined ||
    parsed.paymentDay !== undefined ||
    parsed.creditLimitPesos !== undefined;
  if (current.kind !== "credit" && touchesCreditFields) {
    throw new Error(`account ${id} is not a credit account; credit fields are not allowed`);
  }

  // Validate cutoff ≠ payment on the MERGED values (either side may be updated alone).
  if (current.kind === "credit") {
    const cutoff = parsed.cutoffDay ?? current.cutoffDay;
    const payment = parsed.paymentDay ?? current.paymentDay;
    if (cutoff === payment) {
      throw new Error("El día de pago debe ser distinto al día de corte");
    }
  }

  const patch: Partial<NewAccount> = {};
  if (parsed.name !== undefined) patch.name = parsed.name;
  if (parsed.bank !== undefined) patch.bank = parsed.bank;
  if (parsed.number !== undefined) patch.number = parsed.number;
  if (parsed.expirationMonth !== undefined) {
    patch.expirationDate = expirationToDate(parsed.expirationMonth);
  }
  if (parsed.cutoffDay !== undefined) patch.cutoffDay = parsed.cutoffDay;
  if (parsed.paymentDay !== undefined) patch.paymentDay = parsed.paymentDay;
  if (parsed.creditLimitPesos !== undefined) {
    patch.creditLimit =
      parsed.creditLimitPesos === null ? null : Math.round(parsed.creditLimitPesos * 100);
  }

  const [row] = await db
    .update(account)
    .set(patch)
    .where(and(eq(account.id, id), eq(account.userId, userId)))
    .returning();
  return row;
}

export async function deactivateAccount(userId: string, id: number): Promise<Account> {
  const [row] = await db
    .update(account)
    .set({ isActive: false })
    .where(and(eq(account.id, id), eq(account.userId, userId)))
    .returning();
  if (!row) throw new Error(`account ${id} not found`);
  return row;
}

export async function reactivateAccount(userId: string, id: number): Promise<Account> {
  const [row] = await db
    .update(account)
    .set({ isActive: true })
    .where(and(eq(account.id, id), eq(account.userId, userId)))
    .returning();
  if (!row) throw new Error(`account ${id} not found`);
  return row;
}

// ─── duplicate check (case-insensitive, app-level — no unique index needed) ─────
// Scoped per user: two different users may each name an account "Efectivo".

export async function accountNameExists(
  userId: string,
  name: string,
  excludeId?: number
): Promise<boolean> {
  const rows = await db
    .select({ id: account.id })
    .from(account)
    .where(and(eq(account.userId, userId), sql`lower(${account.name}) = lower(${name})`));
  return rows.some((r) => r.id !== excludeId);
}
