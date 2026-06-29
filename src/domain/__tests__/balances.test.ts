import { describe, it, expect } from "vitest";
import { deriveBalance, LedgerEntry } from "../balances";
import { money } from "../money";

const cleared = (amount: number): LedgerEntry => ({
  amount: money(amount),
  status: "cleared",
  kind: "expense",
});

const projected = (amount: number): LedgerEntry => ({
  amount: money(amount),
  status: "projected",
  kind: "income",
});

const transfer = (amount: number): LedgerEntry => ({
  amount: money(amount),
  status: "cleared",
  kind: "transfer",
});

describe("deriveBalance", () => {
  it("devuelve saldo inicial si no hay transacciones", () => {
    expect(deriveBalance(money(50000), [])).toBe(50000);
  });

  it("suma transacciones cleared al saldo inicial", () => {
    const entries: LedgerEntry[] = [
      { amount: money(-2000), status: "cleared", kind: "expense" },
      { amount: money(5000), status: "cleared", kind: "income" },
    ];
    expect(deriveBalance(money(10000), entries)).toBe(13000);
  });

  it("excluye transacciones proyectadas", () => {
    const entries: LedgerEntry[] = [cleared(-2000), projected(99999)];
    expect(deriveBalance(money(10000), entries)).toBe(8000);
  });

  it("incluye transferencias cleared en el balance", () => {
    // transfers afectan el saldo de la cuenta; la exclusión de categorías es en otro layer
    const entries: LedgerEntry[] = [transfer(-5000)];
    expect(deriveBalance(money(20000), entries)).toBe(15000);
  });

  it("saldo puede ser negativo", () => {
    expect(deriveBalance(money(1000), [cleared(-5000)])).toBe(-4000);
  });
});
