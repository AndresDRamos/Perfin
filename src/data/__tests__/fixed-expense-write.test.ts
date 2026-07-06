import { describe, it, expect } from "vitest";
import {
  fixedExpenseCreateSchema,
  fixedExpenseUpdateSchema,
} from "../fixed-expense-write";
import { projectionCreateSchema } from "../ledger-write";

const base = {
  name: "Internet",
  amountPesos: 599,
  accountId: 1,
  expenseCategoryId: 7,
  dayOfMonth: 5,
  startDate: "2026-07-01",
};

describe("Zod — fixedExpenseCreateSchema", () => {
  it("acepta una plantilla válida sin endDate (vigencia indefinida)", () => {
    expect(fixedExpenseCreateSchema.safeParse(base).success).toBe(true);
  });

  it("rechaza dayOfMonth fuera de 1..31", () => {
    expect(fixedExpenseCreateSchema.safeParse({ ...base, dayOfMonth: 0 }).success).toBe(false);
    expect(fixedExpenseCreateSchema.safeParse({ ...base, dayOfMonth: 32 }).success).toBe(false);
  });

  it("rechaza amount <= 0", () => {
    expect(fixedExpenseCreateSchema.safeParse({ ...base, amountPesos: 0 }).success).toBe(false);
  });

  it("rechaza endDate anterior a startDate", () => {
    const r = fixedExpenseCreateSchema.safeParse({ ...base, endDate: "2026-06-30" });
    expect(r.success).toBe(false);
  });

  it("acepta endDate igual a startDate", () => {
    const r = fixedExpenseCreateSchema.safeParse({ ...base, endDate: "2026-07-01" });
    expect(r.success).toBe(true);
  });
});

describe("Zod — fixedExpenseUpdateSchema", () => {
  it("acepta update parcial", () => {
    expect(fixedExpenseUpdateSchema.safeParse({ amountPesos: 650 }).success).toBe(true);
  });

  it("acepta endDate null para despejar la vigencia", () => {
    expect(fixedExpenseUpdateSchema.safeParse({ endDate: null }).success).toBe(true);
  });

  it("rechaza el par start/end desordenado cuando ambos vienen", () => {
    const r = fixedExpenseUpdateSchema.safeParse({
      startDate: "2026-08-01",
      endDate: "2026-07-01",
    });
    expect(r.success).toBe(false);
  });
});

describe("Zod — projectionCreateSchema", () => {
  it("acepta una proyección de ingreso válida", () => {
    const r = projectionCreateSchema.safeParse({
      amountPesos: 15000,
      occurredAt: "2026-07-15",
      accountId: 1,
    });
    expect(r.success).toBe(true);
  });

  it("rechaza monto esperado <= 0", () => {
    const r = projectionCreateSchema.safeParse({
      amountPesos: 0,
      occurredAt: "2026-07-15",
      accountId: 1,
    });
    expect(r.success).toBe(false);
  });
});
