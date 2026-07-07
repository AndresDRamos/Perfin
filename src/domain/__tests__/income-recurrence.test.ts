import { describe, expect, it } from "vitest";
import { occurrencesBetween, RecurrenceSpec } from "../income-recurrence";

function spec(frequency: RecurrenceSpec["frequency"], anchorDate: string): RecurrenceSpec {
  return { frequency, anchorDate };
}

describe("occurrencesBetween — weekly / biweekly", () => {
  it("keeps the anchor's 7-day parity", () => {
    // anchor Friday 2026-07-03
    expect(occurrencesBetween(spec("weekly", "2026-07-03"), "2026-07-06", "2026-07-31")).toEqual([
      "2026-07-10",
      "2026-07-17",
      "2026-07-24",
      "2026-07-31",
    ]);
  });

  it("includes the anchor itself when in range", () => {
    expect(occurrencesBetween(spec("weekly", "2026-07-10"), "2026-07-06", "2026-07-17")).toEqual([
      "2026-07-10",
      "2026-07-17",
    ]);
  });

  it("biweekly steps 14 days and skips the off week", () => {
    expect(
      occurrencesBetween(spec("biweekly", "2026-06-26"), "2026-07-01", "2026-08-10")
    ).toEqual(["2026-07-10", "2026-07-24", "2026-08-07"]);
  });

  it("projects nothing before the anchor (floor)", () => {
    expect(occurrencesBetween(spec("weekly", "2026-08-01"), "2026-07-01", "2026-07-31")).toEqual(
      []
    );
  });
});

describe("occurrencesBetween — semimonthly (quincenal: 15 y fin de mes)", () => {
  it("yields the 15th and the LAST day of each month", () => {
    expect(
      occurrencesBetween(spec("semimonthly", "2026-01-01"), "2026-07-01", "2026-08-31")
    ).toEqual(["2026-07-15", "2026-07-31", "2026-08-15", "2026-08-31"]);
  });

  it("February: last day is the 28th (not an undefined 30th)", () => {
    expect(
      occurrencesBetween(spec("semimonthly", "2026-01-01"), "2026-02-01", "2026-02-28")
    ).toEqual(["2026-02-15", "2026-02-28"]);
  });

  it("leap-year February pays on the 29th", () => {
    expect(
      occurrencesBetween(spec("semimonthly", "2028-01-01"), "2028-02-16", "2028-03-01")
    ).toEqual(["2028-02-29"]);
  });

  it("anchor mid-month floors the first quincena", () => {
    expect(
      occurrencesBetween(spec("semimonthly", "2026-07-20"), "2026-07-01", "2026-08-15")
    ).toEqual(["2026-07-31", "2026-08-15"]);
  });
});

describe("occurrencesBetween — monthly", () => {
  it("repeats the anchor's day of month", () => {
    expect(occurrencesBetween(spec("monthly", "2026-05-10"), "2026-07-01", "2026-09-30")).toEqual([
      "2026-07-10",
      "2026-08-10",
      "2026-09-10",
    ]);
  });

  it("clamps day 31 to short months (30) and February (28)", () => {
    expect(occurrencesBetween(spec("monthly", "2026-01-31"), "2026-02-01", "2026-04-30")).toEqual([
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
    ]);
  });

  it("day 29 pays Feb 29 on leap years", () => {
    expect(occurrencesBetween(spec("monthly", "2028-01-29"), "2028-02-01", "2028-02-29")).toEqual([
      "2028-02-29",
    ]);
  });
});

describe("occurrencesBetween — edges", () => {
  it("empty when the range is inverted", () => {
    expect(occurrencesBetween(spec("weekly", "2026-07-03"), "2026-07-10", "2026-07-01")).toEqual(
      []
    );
  });

  it("single-day range hits only an exact payday", () => {
    expect(occurrencesBetween(spec("weekly", "2026-07-03"), "2026-07-10", "2026-07-10")).toEqual([
      "2026-07-10",
    ]);
    expect(occurrencesBetween(spec("weekly", "2026-07-03"), "2026-07-11", "2026-07-11")).toEqual(
      []
    );
  });
});
