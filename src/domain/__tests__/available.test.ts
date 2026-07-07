import { describe, it, expect } from "vitest";
import {
  realAvailable,
  projectedAvailable,
  netProjected,
  AccountForAvailable,
} from "../available";
import { money } from "../money";

const mkAccount = (
  kind: AccountForAvailable["kind"],
  opening: number,
  entries: AccountForAvailable["entries"] = []
): AccountForAvailable => ({
  kind,
  openingBalance: money(opening),
  entries,
});

describe("realAvailable", () => {
  it("suma saldos cleared de cuentas líquidas", () => {
    const accounts: AccountForAvailable[] = [
      mkAccount("cash", 10000),
      mkAccount("debit", 20000),
      mkAccount("investment", 15000),
    ];
    expect(realAvailable(accounts)).toBe(45000);
  });

  it("excluye tarjetas de crédito", () => {
    const accounts: AccountForAvailable[] = [
      mkAccount("cash", 10000),
      mkAccount("credit", 50000), // saldo crédito no se resta de disponible
    ];
    expect(realAvailable(accounts)).toBe(10000);
  });

  it("excluye entradas proyectadas", () => {
    const accounts: AccountForAvailable[] = [
      mkAccount("debit", 10000, [
        { amount: money(99999), status: "projected", kind: "income" },
      ]),
    ];
    expect(realAvailable(accounts)).toBe(10000);
  });
});

describe("projectedAvailable", () => {
  it("incluye ingresos proyectados en cuentas líquidas", () => {
    const accounts: AccountForAvailable[] = [
      mkAccount("debit", 10000, [
        { amount: money(5000), status: "projected", kind: "income" },
        { amount: money(-2000), status: "cleared", kind: "expense" },
      ]),
    ];
    // real: 10000 - 2000 = 8000; projected income +5000 = 13000
    expect(projectedAvailable(accounts)).toBe(13000);
  });

  it("excluye gastos proyectados", () => {
    const accounts: AccountForAvailable[] = [
      mkAccount("cash", 20000, [
        { amount: money(-99999), status: "projected", kind: "expense" },
      ]),
    ];
    expect(projectedAvailable(accounts)).toBe(20000);
  });

  it("excluye tarjetas de crédito igual que real", () => {
    const accounts: AccountForAvailable[] = [
      mkAccount("cash", 10000),
      mkAccount("credit", 50000),
    ];
    expect(projectedAvailable(accounts)).toBe(10000);
  });
});

describe("netProjected", () => {
  it("sin tarjetas equivale al proyectado", () => {
    const accounts: AccountForAvailable[] = [
      mkAccount("debit", 10000, [
        { amount: money(5000), status: "projected", kind: "income" },
      ]),
    ];
    expect(netProjected(accounts)).toBe(15000);
  });

  it("resta la deuda cleared de tarjetas (saldo firmado negativo)", () => {
    const accounts: AccountForAvailable[] = [
      mkAccount("cash", 20000),
      mkAccount("credit", 0, [
        { amount: money(-8000), status: "cleared", kind: "expense" },
      ]),
    ];
    // 20000 − 8000 de deuda = 12000
    expect(netProjected(accounts)).toBe(12000);
  });

  it("una tarjeta con saldo a favor suma", () => {
    const accounts: AccountForAvailable[] = [
      mkAccount("cash", 10000),
      mkAccount("credit", 3000), // opening balance positivo = saldo a favor
    ];
    expect(netProjected(accounts)).toBe(13000);
  });

  it("ignora movimientos projected en tarjetas (solo cleared cuenta como deuda)", () => {
    const accounts: AccountForAvailable[] = [
      mkAccount("cash", 10000),
      mkAccount("credit", 0, [
        { amount: money(-99999), status: "projected", kind: "expense" },
      ]),
    ];
    expect(netProjected(accounts)).toBe(10000);
  });

  it("combina ingresos proyectados líquidos y deuda de tarjeta", () => {
    const accounts: AccountForAvailable[] = [
      mkAccount("debit", 10000, [
        { amount: money(5000), status: "projected", kind: "income" },
        { amount: money(-2000), status: "cleared", kind: "expense" },
      ]),
      mkAccount("credit", -4000),
    ];
    // (10000 − 2000 + 5000) − 4000 = 9000
    expect(netProjected(accounts)).toBe(9000);
  });
});
