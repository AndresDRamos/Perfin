import { describe, it, expect } from "vitest";
import { occurrencesBetween, nextOccurrenceAfter, RecurrenceTemplate } from "../recurrence";

const tpl = (
  dayOfMonth: number,
  startDate: string,
  endDate?: string | null
): RecurrenceTemplate => ({ dayOfMonth, startDate, endDate });

describe("occurrencesBetween", () => {
  it("una ocurrencia por mes en el día programado", () => {
    const occ = occurrencesBetween(tpl(10, "2026-01-01"), "2026-01-01", "2026-03-31");
    expect(occ).toEqual([
      { month: "2026-01-01", date: "2026-01-10" },
      { month: "2026-02-01", date: "2026-02-10" },
      { month: "2026-03-01", date: "2026-03-10" },
    ]);
  });

  it("clamp de día 31 a fin de mes corto", () => {
    const occ = occurrencesBetween(tpl(31, "2026-04-01"), "2026-04-01", "2026-06-30");
    expect(occ).toEqual([
      { month: "2026-04-01", date: "2026-04-30" },
      { month: "2026-05-01", date: "2026-05-31" },
      { month: "2026-06-01", date: "2026-06-30" },
    ]);
  });

  it("clamp de día 30 en febrero no bisiesto", () => {
    const occ = occurrencesBetween(tpl(30, "2026-02-01"), "2026-02-01", "2026-02-28");
    expect(occ).toEqual([{ month: "2026-02-01", date: "2026-02-28" }]);
  });

  it("clamp de día 29 en febrero bisiesto cae en el 29", () => {
    const occ = occurrencesBetween(tpl(29, "2028-02-01"), "2028-02-01", "2028-02-29");
    expect(occ).toEqual([{ month: "2028-02-01", date: "2028-02-29" }]);
  });

  it("respeta la vigencia: sin ocurrencias antes de startDate", () => {
    // start el 15, día programado el 10 → enero no ocurre; arranca en febrero.
    const occ = occurrencesBetween(tpl(10, "2026-01-15"), "2026-01-01", "2026-02-28");
    expect(occ).toEqual([{ month: "2026-02-01", date: "2026-02-10" }]);
  });

  it("respeta la vigencia: endDate corta las ocurrencias posteriores", () => {
    // end el 5 de marzo, día programado el 10 → marzo ya no ocurre.
    const occ = occurrencesBetween(tpl(10, "2026-01-01", "2026-03-05"), "2026-01-01", "2026-12-31");
    expect(occ).toEqual([
      { month: "2026-01-01", date: "2026-01-10" },
      { month: "2026-02-01", date: "2026-02-10" },
    ]);
  });

  it("catch-up multi-mes tras meses sin abrir la app, cruzando año", () => {
    const occ = occurrencesBetween(tpl(5, "2025-11-01"), "2025-11-01", "2026-02-15");
    expect(occ).toEqual([
      { month: "2025-11-01", date: "2025-11-05" },
      { month: "2025-12-01", date: "2025-12-05" },
      { month: "2026-01-01", date: "2026-01-05" },
      { month: "2026-02-01", date: "2026-02-05" },
    ]);
  });

  it("ventana vacía cuando from > to o vigencia fuera de rango", () => {
    expect(occurrencesBetween(tpl(10, "2026-01-01"), "2026-03-01", "2026-02-01")).toEqual([]);
    expect(occurrencesBetween(tpl(10, "2027-01-01"), "2026-01-01", "2026-12-31")).toEqual([]);
  });

  it("la ocurrencia del mes de `to` solo entra si ya venció", () => {
    // hoy = 2026-03-07, día programado 10 → marzo aún no ocurre.
    const occ = occurrencesBetween(tpl(10, "2026-02-01"), "2026-02-01", "2026-03-07");
    expect(occ).toEqual([{ month: "2026-02-01", date: "2026-02-10" }]);
  });
});

describe("nextOccurrenceAfter", () => {
  it("la de este mes si aún no vence", () => {
    expect(nextOccurrenceAfter(tpl(10, "2026-01-01"), "2026-03-07")).toEqual({
      month: "2026-03-01",
      date: "2026-03-10",
    });
  });

  it("la del mes siguiente si la de este mes ya pasó", () => {
    expect(nextOccurrenceAfter(tpl(10, "2026-01-01"), "2026-03-10")).toEqual({
      month: "2026-04-01",
      date: "2026-04-10",
    });
  });

  it("clamp: día 31 tras el 30 de abril cae el 31 de mayo", () => {
    expect(nextOccurrenceAfter(tpl(31, "2026-01-01"), "2026-04-30")).toEqual({
      month: "2026-05-01",
      date: "2026-05-31",
    });
  });

  it("antes de la vigencia devuelve la primera ocurrencia válida", () => {
    expect(nextOccurrenceAfter(tpl(10, "2026-06-15"), "2026-01-01")).toEqual({
      month: "2026-07-01",
      date: "2026-07-10",
    });
  });

  it("null si la vigencia ya terminó", () => {
    expect(nextOccurrenceAfter(tpl(10, "2026-01-01", "2026-03-31"), "2026-03-15")).toBeNull();
  });
});
