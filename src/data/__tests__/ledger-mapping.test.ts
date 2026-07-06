import { describe, it, expect } from "vitest";
import { toSignedLegs } from "../ledger-mapping";
import { LedgerEntryRow } from "../schema";

function row(overrides: Partial<LedgerEntryRow> = {}): LedgerEntryRow {
  return {
    id: 1,
    userId: "00000000-0000-0000-0000-000000000001",
    kind: "expense",
    status: "cleared",
    amount: 5000,
    concept: null,
    occurredAt: new Date("2025-01-15"),
    createdAt: new Date("2025-01-15"),
    updatedAt: new Date("2025-01-15"),
    accountId: 10,
    toAccountId: null,
    incomeCategoryId: null,
    expenseCategoryId: null,
    fixedExpenseId: null,
    fixedExpenseMonth: null,
    expectedAmount: null,
    ...overrides,
  };
}

describe("toSignedLegs — income", () => {
  it("produce una sola pata con amount positivo", () => {
    const legs = toSignedLegs(row({ kind: "income", amount: 3000 }));
    expect(legs).toHaveLength(1);
    expect(legs[0].accountId).toBe(10);
    expect(legs[0].entry.amount).toBe(3000);
    expect(legs[0].entry.kind).toBe("income");
  });
});

describe("toSignedLegs — expense", () => {
  it("produce una sola pata con amount negativo", () => {
    const legs = toSignedLegs(row({ kind: "expense", amount: 5000 }));
    expect(legs).toHaveLength(1);
    expect(legs[0].accountId).toBe(10);
    expect(legs[0].entry.amount).toBe(-5000);
    expect(legs[0].entry.kind).toBe("expense");
  });
});

describe("toSignedLegs — transfer", () => {
  it("produce dos patas: origen negativa, destino positiva", () => {
    const legs = toSignedLegs(
      row({ kind: "transfer", amount: 2000, accountId: 10, toAccountId: 20 })
    );
    expect(legs).toHaveLength(2);

    const src = legs.find((l) => l.accountId === 10)!;
    const dst = legs.find((l) => l.accountId === 20)!;

    expect(src.entry.amount).toBe(-2000);
    expect(dst.entry.amount).toBe(2000);
  });

  it("lanza si to_account_id es null (violación de constraint DB)", () => {
    expect(() =>
      toSignedLegs(row({ kind: "transfer", toAccountId: null }))
    ).toThrow();
  });
});

// ─── Netting tests ────────────────────────────────────────────────────────────
// A liquid→liquid transfer must net to zero in realAvailable.
// A liquid→credit transfer reduces liquid and adds no debt to available.

import { realAvailable } from "@/domain/available";
import { AccountForAvailable } from "@/domain/available";
import { money } from "@/domain/money";

function buildAccountsFromTransfer(
  srcKind: "cash" | "debit" | "investment" | "credit",
  dstKind: "cash" | "debit" | "investment" | "credit",
  amount: number
) {
  const transferRow = row({
    kind: "transfer",
    amount,
    accountId: 10,
    toAccountId: 20,
    status: "cleared",
  });
  const legs = toSignedLegs(transferRow);

  const srcEntries = legs.filter((l) => l.accountId === 10).map((l) => l.entry);
  const dstEntries = legs.filter((l) => l.accountId === 20).map((l) => l.entry);

  const accounts: AccountForAvailable[] = [
    { kind: srcKind, openingBalance: money(50000), entries: srcEntries },
    { kind: dstKind, openingBalance: money(0), entries: dstEntries },
  ];
  return accounts;
}

describe("netting — transferencia liquid→liquid", () => {
  it("no modifica realAvailable (neto cero)", () => {
    const accounts = buildAccountsFromTransfer("cash", "debit", 10000);
    // combined opening = 50000, transfer is internal → net stays 50000
    expect(realAvailable(accounts)).toBe(50000);
  });
});

describe("netting — transferencia liquid→credit (pago de tarjeta)", () => {
  it("reduce el disponible líquido y no agrega deuda a available", () => {
    const accounts = buildAccountsFromTransfer("debit", "credit", 8000);
    // debit opening=50000, transfer out -8000 → liquid = 42000
    // credit is excluded from realAvailable
    expect(realAvailable(accounts)).toBe(42000);
  });
});
