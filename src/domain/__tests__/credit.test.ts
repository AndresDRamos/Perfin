import { describe, it, expect } from "vitest";
import {
  currentStatementPeriod,
  currentStatementOwed,
  nextDueDate,
  CreditCardConfig,
  CreditLedgerEntry,
} from "../credit";
import { money } from "../money";

const config: CreditCardConfig = { cutoffDay: 15, paymentDay: 10 };

// Helper for dates in UTC midnight to avoid timezone confusion in tests
const d = (year: number, month: number, day: number) =>
  new Date(year, month - 1, day);

describe("currentStatementPeriod", () => {
  it("retorna el período correcto cuando la fecha es posterior al corte", () => {
    const asOf = d(2026, 3, 20); // 20 de marzo, corte ya pasó (día 15)
    const period = currentStatementPeriod(asOf, config);
    expect(period.end).toEqual(d(2026, 3, 15));   // corte: 15 marzo
    expect(period.start).toEqual(d(2026, 2, 16));  // inicio: 16 feb
    expect(period.dueDate).toEqual(d(2026, 4, 10)); // pago: 10 abril
  });

  it("retorna el período correcto cuando la fecha es anterior al corte", () => {
    const asOf = d(2026, 3, 10); // 10 de marzo, corte aún no llega
    const period = currentStatementPeriod(asOf, config);
    expect(period.end).toEqual(d(2026, 2, 15));    // corte: 15 feb
    expect(period.start).toEqual(d(2026, 1, 16));  // inicio: 16 ene
    expect(period.dueDate).toEqual(d(2026, 3, 10)); // pago: 10 marzo
  });

  it("maneja cruce de año correctamente", () => {
    const asOf = d(2026, 1, 5); // 5 enero, corte aún no llega
    const period = currentStatementPeriod(asOf, config);
    expect(period.end).toEqual(d(2025, 12, 15));   // corte: 15 dic 2025
    expect(period.start).toEqual(d(2025, 11, 16)); // inicio: 16 nov 2025
    expect(period.dueDate).toEqual(d(2026, 1, 10));
  });
});

describe("currentStatementOwed", () => {
  it("suma gastos del período actual como deuda positiva", () => {
    const asOf = d(2026, 3, 20);
    const entries: CreditLedgerEntry[] = [
      { amount: money(-50000), status: "cleared", kind: "expense", occurredAt: d(2026, 3, 17) },
      { amount: money(-20000), status: "cleared", kind: "expense", occurredAt: d(2026, 3, 19) },
    ];
    // Owe: negate(-70000) = 70000
    expect(currentStatementOwed(entries, config, money(0), asOf)).toBe(70000);
  });

  it("excluye transacciones fuera del período", () => {
    const asOf = d(2026, 3, 20);
    const entries: CreditLedgerEntry[] = [
      // En el período anterior (antes del corte de feb 15)
      { amount: money(-30000), status: "cleared", kind: "expense", occurredAt: d(2026, 2, 10) },
      // En el período actual
      { amount: money(-10000), status: "cleared", kind: "expense", occurredAt: d(2026, 3, 16) },
    ];
    expect(currentStatementOwed(entries, config, money(0), asOf)).toBe(10000);
  });

  it("excluye entradas proyectadas", () => {
    const asOf = d(2026, 3, 20);
    const entries: CreditLedgerEntry[] = [
      {
        amount: money(-50000),
        status: "projected",
        kind: "expense",
        occurredAt: d(2026, 3, 18),
      },
    ];
    expect(currentStatementOwed(entries, config, money(0), asOf)).toBe(0);
  });
});

describe("nextDueDate", () => {
  it("retorna la fecha de pago correcta", () => {
    const asOf = d(2026, 3, 20); // después del corte de marzo 15
    expect(nextDueDate(config, asOf)).toEqual(d(2026, 4, 10));
  });
});
