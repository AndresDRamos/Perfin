import { describe, it, expect } from "vitest";
import {
  incomeSchema,
  expenseSchema,
  transferSchema,
  ledgerEntrySchema,
} from "../ledger-write";

const base = {
  amountPesos: 100,
  occurredAt: new Date(),
  status: "cleared" as const,
  accountId: 1,
};

describe("Zod — incomeSchema", () => {
  it("acepta income válido", () => {
    expect(incomeSchema.safeParse({ ...base, kind: "income" }).success).toBe(true);
  });

  it("rechaza amount <= 0", () => {
    const r = incomeSchema.safeParse({ ...base, kind: "income", amountPesos: 0 });
    expect(r.success).toBe(false);
  });
});

describe("Zod — expenseSchema", () => {
  it("acepta expense válido", () => {
    expect(expenseSchema.safeParse({ ...base, kind: "expense" }).success).toBe(true);
  });

  it("rechaza amount negativo", () => {
    const r = expenseSchema.safeParse({ ...base, kind: "expense", amountPesos: -50 });
    expect(r.success).toBe(false);
  });
});

describe("Zod — transferSchema", () => {
  it("acepta transferencia válida", () => {
    const r = transferSchema.safeParse({ ...base, kind: "transfer", toAccountId: 2 });
    expect(r.success).toBe(true);
  });

  it("rechaza auto-transferencia (mismo accountId)", () => {
    const r = transferSchema.safeParse({
      ...base,
      kind: "transfer",
      toAccountId: base.accountId,
    });
    expect(r.success).toBe(false);
  });

  it("rechaza transferencia sin toAccountId", () => {
    const r = transferSchema.safeParse({ ...base, kind: "transfer" });
    expect(r.success).toBe(false);
  });
});

describe("Zod — ledgerEntrySchema (discriminatedUnion)", () => {
  it("rechaza kind desconocido", () => {
    const r = ledgerEntrySchema.safeParse({ ...base, kind: "payment" });
    expect(r.success).toBe(false);
  });
});
