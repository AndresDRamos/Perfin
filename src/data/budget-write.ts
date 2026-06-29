import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { plan, budget, NewBudget, PlanRow, BudgetRow } from "./schema";

// ─── shared building blocks ────────────────────────────────────────────────────

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Fecha inválida (YYYY-MM-DD)" });

// ISO dates compare correctly as strings, so end >= start is a lexicographic test.
function endNotBeforeStart(start: string, end: string): boolean {
  return end >= start;
}

// ─── plan schemas ───────────────────────────────────────────────────────────────

export const planCreateSchema = z
  .object({
    name: z.string().min(1).max(100),
    periodStart: isoDate,
    periodEnd: isoDate,
  })
  .refine((d) => endNotBeforeStart(d.periodStart, d.periodEnd), {
    message: "La fecha fin no puede ser anterior al inicio",
    path: ["periodEnd"],
  });

// Partial update; re-validate the period order only when both ends are present.
export const planUpdateSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    periodStart: isoDate.optional(),
    periodEnd: isoDate.optional(),
  })
  .refine(
    (d) =>
      d.periodStart === undefined ||
      d.periodEnd === undefined ||
      endNotBeforeStart(d.periodStart, d.periodEnd),
    { message: "La fecha fin no puede ser anterior al inicio", path: ["periodEnd"] }
  );

export type PlanCreateInput = z.infer<typeof planCreateSchema>;
export type PlanUpdateInput = z.infer<typeof planUpdateSchema>;

// ─── budget schemas (discriminated union on subtype) ────────────────────────────
// target in pesos (UI input); converted to centavos before write.
// The optional period overrides the plan range (both or neither).

const budgetBase = z.object({
  planId: z.number().int().positive(),
  targetAmountPesos: z.number().positive({ message: "El monto debe ser mayor a 0" }),
  periodStart: isoDate.optional(),
  periodEnd: isoDate.optional(),
});

// Structural validation per subtype; the period override is checked once on the
// whole union below (discriminatedUnion members must stay plain ZodObjects).
export const budgetSchema = z
  .discriminatedUnion("subtype", [
    budgetBase.extend({
      subtype: z.literal("category_cap"),
      expenseCategoryId: z.number().int().positive(),
    }),
    budgetBase.extend({
      subtype: z.literal("savings_reservation"),
      accountId: z.number().int().positive(),
    }),
    budgetBase.extend({
      subtype: z.literal("purchase_goal"),
      itemName: z.string().min(1).max(100),
      horizon: z.enum(["short", "medium", "long"]),
    }),
  ])
  .superRefine((d, ctx) => {
    const hasStart = d.periodStart !== undefined;
    const hasEnd = d.periodEnd !== undefined;
    if (hasStart !== hasEnd) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El override de periodo requiere inicio y fin (o ninguno)",
        path: [hasStart ? "periodEnd" : "periodStart"],
      });
    } else if (hasStart && hasEnd && !endNotBeforeStart(d.periodStart!, d.periodEnd!)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La fecha fin no puede ser anterior al inicio",
        path: ["periodEnd"],
      });
    }
  });

export type BudgetInput = z.infer<typeof budgetSchema>;

// ─── mappers ─────────────────────────────────────────────────────────────────

function toBudgetRow(input: BudgetInput): NewBudget {
  // Conditional columns: only the ones the subtype owns are populated; the rest
  // stay NULL so chk_budget_subtype_fields is satisfied.
  return {
    planId: input.planId,
    subtype: input.subtype,
    targetAmount: Math.round(input.targetAmountPesos * 100), // pesos → centavos
    periodStart: input.periodStart ?? null,
    periodEnd: input.periodEnd ?? null,
    expenseCategoryId: input.subtype === "category_cap" ? input.expenseCategoryId : null,
    accountId: input.subtype === "savings_reservation" ? input.accountId : null,
    itemName: input.subtype === "purchase_goal" ? input.itemName : null,
    horizon: input.subtype === "purchase_goal" ? input.horizon : null,
  };
}

// ─── plan writes ────────────────────────────────────────────────────────────────

export async function createPlan(input: PlanCreateInput): Promise<PlanRow> {
  const parsed = planCreateSchema.parse(input);
  const [row] = await db
    .insert(plan)
    .values({
      name: parsed.name,
      periodStart: parsed.periodStart,
      periodEnd: parsed.periodEnd,
    })
    .returning();
  return row;
}

export async function updatePlan(id: number, input: PlanUpdateInput): Promise<PlanRow> {
  const parsed = planUpdateSchema.parse(input);
  const [row] = await db.update(plan).set({ ...parsed }).where(eq(plan.id, id)).returning();
  if (!row) throw new Error(`plan ${id} not found`);
  return row;
}

// Hard delete; budget children cascade (FK ON DELETE cascade).
export async function deletePlan(id: number): Promise<void> {
  const rows = await db.delete(plan).where(eq(plan.id, id)).returning({ id: plan.id });
  if (rows.length === 0) throw new Error(`plan ${id} not found`);
}

// ─── budget writes ────────────────────────────────────────────────────────────

export async function createBudget(input: BudgetInput): Promise<BudgetRow> {
  const [row] = await db.insert(budget).values(toBudgetRow(input)).returning();
  return row;
}

export async function updateBudget(id: number, input: BudgetInput): Promise<BudgetRow> {
  // Rewrite every conditional column so a subtype change nullifies stale ones
  // (same discipline as ledger-write.toRow vs chk_category_kind).
  const [row] = await db
    .update(budget)
    .set(toBudgetRow(input))
    .where(eq(budget.id, id))
    .returning();
  if (!row) throw new Error(`budget ${id} not found`);
  return row;
}

export async function deleteBudget(id: number): Promise<void> {
  const rows = await db.delete(budget).where(eq(budget.id, id)).returning({ id: budget.id });
  if (rows.length === 0) throw new Error(`budget ${id} not found`);
}

// ─── duplicate checks (friendly error before the DB unique index fires) ─────────

export async function capCategoryExists(
  planId: number,
  expenseCategoryId: number,
  excludeId?: number
): Promise<boolean> {
  const rows = await db
    .select({ id: budget.id })
    .from(budget)
    .where(
      and(
        eq(budget.planId, planId),
        eq(budget.subtype, "category_cap"),
        eq(budget.expenseCategoryId, expenseCategoryId)
      )
    );
  return rows.some((r) => r.id !== excludeId);
}

export async function reservationAccountExists(
  planId: number,
  accountId: number,
  excludeId?: number
): Promise<boolean> {
  const rows = await db
    .select({ id: budget.id })
    .from(budget)
    .where(
      and(
        eq(budget.planId, planId),
        eq(budget.subtype, "savings_reservation"),
        eq(budget.accountId, accountId)
      )
    );
  return rows.some((r) => r.id !== excludeId);
}
