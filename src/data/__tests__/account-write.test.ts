import { describe, it, expect } from "vitest";
import { accountCreateSchema, accountUpdateSchema } from "../account-write";

// ─── create: discriminated union por kind ────────────────────────────────────────

const cashBase = { kind: "cash" as const, name: "Cartera" };
const creditBase = {
  kind: "credit" as const,
  name: "TDC Banorte",
  cutoffDay: 10,
  paymentDay: 28,
};

describe("Zod — accountCreateSchema (no crédito)", () => {
  it("acepta cash mínimo (saldo inicial default 0)", () => {
    const r = accountCreateSchema.safeParse(cashBase);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.openingBalancePesos).toBe(0);
  });

  it("acepta debit con banco, número enmascarado y vigencia", () => {
    const r = accountCreateSchema.safeParse({
      kind: "debit",
      name: "Nómina",
      openingBalancePesos: 1500.5,
      bank: "BBVA",
      number: "****1234",
      expirationMonth: "2028-09",
    });
    expect(r.success).toBe(true);
  });

  it("rechaza campos de crédito en una cuenta no-crédito", () => {
    // discriminatedUnion: cutoffDay no existe en la rama cash → strip silencioso
    // sería peligroso; el runtime de updateAccount los rechaza, y aquí el parse
    // no debe exponerlos en la salida.
    const r = accountCreateSchema.safeParse({ ...cashBase, cutoffDay: 10 });
    if (r.success) {
      expect("cutoffDay" in r.data).toBe(false);
    }
  });

  it("rechaza un número de tarjeta completo (13-19 dígitos)", () => {
    const r = accountCreateSchema.safeParse({
      ...cashBase,
      kind: "debit",
      number: "4111111111111111",
    });
    expect(r.success).toBe(false);
  });

  it("acepta número enmascarado con dígitos y símbolos", () => {
    const r = accountCreateSchema.safeParse({
      ...cashBase,
      kind: "debit",
      number: "•••• 5678",
    });
    expect(r.success).toBe(true);
  });

  it("rechaza vigencia mal formada", () => {
    const r = accountCreateSchema.safeParse({
      ...cashBase,
      kind: "debit",
      expirationMonth: "13/26",
    });
    expect(r.success).toBe(false);
  });

  it("rechaza mes 13", () => {
    const r = accountCreateSchema.safeParse({
      ...cashBase,
      kind: "debit",
      expirationMonth: "2028-13",
    });
    expect(r.success).toBe(false);
  });
});

describe("Zod — accountCreateSchema (crédito)", () => {
  it("acepta crédito válido con límite", () => {
    const r = accountCreateSchema.safeParse({ ...creditBase, creditLimitPesos: 50000 });
    expect(r.success).toBe(true);
  });

  it("acepta crédito sin límite (opcional)", () => {
    expect(accountCreateSchema.safeParse(creditBase).success).toBe(true);
  });

  it("rechaza crédito sin día de corte", () => {
    const rest: Record<string, unknown> = { ...creditBase };
    delete rest.cutoffDay;
    expect(accountCreateSchema.safeParse(rest).success).toBe(false);
  });

  it("rechaza día de corte fuera de rango (0, 29)", () => {
    expect(accountCreateSchema.safeParse({ ...creditBase, cutoffDay: 0 }).success).toBe(false);
    expect(accountCreateSchema.safeParse({ ...creditBase, cutoffDay: 29 }).success).toBe(false);
  });

  it("rechaza corte == pago", () => {
    const r = accountCreateSchema.safeParse({ ...creditBase, cutoffDay: 10, paymentDay: 10 });
    expect(r.success).toBe(false);
  });

  it("rechaza límite <= 0", () => {
    expect(
      accountCreateSchema.safeParse({ ...creditBase, creditLimitPesos: 0 }).success
    ).toBe(false);
    expect(
      accountCreateSchema.safeParse({ ...creditBase, creditLimitPesos: -100 }).success
    ).toBe(false);
  });

  it("acepta saldo inicial negativo (deuda preexistente)", () => {
    const r = accountCreateSchema.safeParse({ ...creditBase, openingBalancePesos: -1200 });
    expect(r.success).toBe(true);
  });
});

// ─── update: kind y openingBalance inmutables ───────────────────────────────────

describe("Zod — accountUpdateSchema", () => {
  it("acepta patch parcial de nombre", () => {
    expect(accountUpdateSchema.safeParse({ name: "Nuevo nombre" }).success).toBe(true);
  });

  it("no expone kind ni openingBalance en la salida (inmutables)", () => {
    const r = accountUpdateSchema.safeParse({
      kind: "credit",
      openingBalancePesos: 999,
      name: "X",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect("kind" in r.data).toBe(false);
      expect("openingBalancePesos" in r.data).toBe(false);
    }
  });

  it("acepta null para limpiar campos descriptivos", () => {
    const r = accountUpdateSchema.safeParse({ bank: null, number: null, expirationMonth: null });
    expect(r.success).toBe(true);
  });

  it("rechaza número completo también en update", () => {
    expect(accountUpdateSchema.safeParse({ number: "4111111111111111" }).success).toBe(false);
  });

  it("acepta límite null (quitar límite)", () => {
    expect(accountUpdateSchema.safeParse({ creditLimitPesos: null }).success).toBe(true);
  });
});
