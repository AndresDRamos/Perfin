import { describe, it, expect } from "vitest";
import { planCreateSchema, budgetSchema } from "../budget-write";

// ─── plan ────────────────────────────────────────────────────────────────────────

describe("Zod — planCreateSchema", () => {
  it("acepta un plan válido", () => {
    const r = planCreateSchema.safeParse({
      name: "Junio",
      periodStart: "2026-06-01",
      periodEnd: "2026-06-30",
    });
    expect(r.success).toBe(true);
  });

  it("rechaza fin anterior al inicio", () => {
    const r = planCreateSchema.safeParse({
      name: "Junio",
      periodStart: "2026-06-30",
      periodEnd: "2026-06-01",
    });
    expect(r.success).toBe(false);
  });

  it("rechaza fecha mal formada", () => {
    const r = planCreateSchema.safeParse({
      name: "Junio",
      periodStart: "06/01/2026",
      periodEnd: "2026-06-30",
    });
    expect(r.success).toBe(false);
  });
});

// ─── budget: discriminated union por subtype ──────────────────────────────────────

const capBase = { planId: 1, subtype: "category_cap" as const, targetAmountPesos: 500 };
const resBase = { planId: 1, subtype: "savings_reservation" as const, targetAmountPesos: 500 };
const goalBase = { planId: 1, subtype: "purchase_goal" as const, targetAmountPesos: 500 };

describe("Zod — budgetSchema category_cap", () => {
  it("acepta cap válido", () => {
    expect(budgetSchema.safeParse({ ...capBase, expenseCategoryId: 3 }).success).toBe(true);
  });

  it("rechaza cap sin categoría", () => {
    expect(budgetSchema.safeParse({ ...capBase }).success).toBe(false);
  });

  it("rechaza monto <= 0", () => {
    const r = budgetSchema.safeParse({ ...capBase, expenseCategoryId: 3, targetAmountPesos: 0 });
    expect(r.success).toBe(false);
  });
});

describe("Zod — budgetSchema savings_reservation", () => {
  it("acepta reserva válida", () => {
    expect(budgetSchema.safeParse({ ...resBase, accountId: 2 }).success).toBe(true);
  });

  it("rechaza reserva sin cuenta", () => {
    expect(budgetSchema.safeParse({ ...resBase }).success).toBe(false);
  });
});

describe("Zod — budgetSchema purchase_goal", () => {
  it("acepta meta válida", () => {
    const r = budgetSchema.safeParse({ ...goalBase, itemName: "Laptop", horizon: "long" });
    expect(r.success).toBe(true);
  });

  it("rechaza meta sin horizonte", () => {
    expect(budgetSchema.safeParse({ ...goalBase, itemName: "Laptop" }).success).toBe(false);
  });

  it("rechaza horizonte desconocido", () => {
    const r = budgetSchema.safeParse({ ...goalBase, itemName: "Laptop", horizon: "forever" });
    expect(r.success).toBe(false);
  });
});

describe("Zod — budgetSchema subtype desconocido", () => {
  it("rechaza subtype inválido", () => {
    const r = budgetSchema.safeParse({ planId: 1, subtype: "rainy_day", targetAmountPesos: 100 });
    expect(r.success).toBe(false);
  });
});

describe("Zod — budgetSchema override de periodo", () => {
  it("acepta override completo y ordenado", () => {
    const r = budgetSchema.safeParse({
      ...capBase,
      expenseCategoryId: 3,
      periodStart: "2026-06-01",
      periodEnd: "2026-06-15",
    });
    expect(r.success).toBe(true);
  });

  it("rechaza solo inicio sin fin", () => {
    const r = budgetSchema.safeParse({
      ...capBase,
      expenseCategoryId: 3,
      periodStart: "2026-06-01",
    });
    expect(r.success).toBe(false);
  });

  it("rechaza override con fin anterior al inicio", () => {
    const r = budgetSchema.safeParse({
      ...capBase,
      expenseCategoryId: 3,
      periodStart: "2026-06-15",
      periodEnd: "2026-06-01",
    });
    expect(r.success).toBe(false);
  });
});
