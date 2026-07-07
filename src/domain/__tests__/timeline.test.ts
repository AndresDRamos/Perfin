import { describe, expect, it } from "vitest";
import { money } from "../money";
import {
  buildBalanceSeries,
  remainingBurn,
  CategoryBurn,
  TimelineInput,
} from "../timeline";

const TODAY = "2026-07-06";

function base(overrides: Partial<TimelineInput> = {}): TimelineInput {
  return {
    today: TODAY,
    currentBalance: money(100_00),
    clearedLegs: [],
    projectedLegs: [],
    scheduleOccurrences: [],
    categoryBurns: [],
    from: "2026-07-04",
    to: "2026-07-08",
    ...overrides,
  };
}

function balances(input: TimelineInput): Record<string, number> {
  return Object.fromEntries(buildBalanceSeries(input).map((p) => [p.date, p.balance]));
}

describe("buildBalanceSeries — past", () => {
  it("reconstructs prior days by removing that day's cleared delta", () => {
    // Yesterday an expense of $20 happened; the day before, an income of $50.
    const b = balances(
      base({
        clearedLegs: [
          { date: "2026-07-05", amount: money(-20_00) },
          { date: "2026-07-04", amount: money(50_00) },
        ],
      })
    );
    expect(b[TODAY]).toBe(100_00);
    expect(b["2026-07-05"]).toBe(100_00); // nothing ON today; balance held since the expense
    expect(b["2026-07-04"]).toBe(120_00); // before the -20 of the 5th... after +50 of the 4th
  });

  it("own-account transfers net to zero per day and don't move the curve", () => {
    const b = balances(
      base({
        clearedLegs: [
          { date: "2026-07-05", amount: money(-300_00) },
          { date: "2026-07-05", amount: money(300_00) },
        ],
      })
    );
    expect(b["2026-07-04"]).toBe(100_00);
    expect(b["2026-07-05"]).toBe(100_00);
  });
});

describe("buildBalanceSeries — future", () => {
  it("adds projected legs and schedule occurrences on their day", () => {
    const b = balances(
      base({
        projectedLegs: [{ date: "2026-07-07", amount: money(-30_00) }],
        scheduleOccurrences: [{ date: "2026-07-08", amount: money(200_00) }],
      })
    );
    expect(b[TODAY]).toBe(100_00);
    expect(b["2026-07-07"]).toBe(70_00);
    expect(b["2026-07-08"]).toBe(270_00);
  });

  it("ignores projected legs dated today or earlier (pending reconciliation)", () => {
    const b = balances(
      base({
        projectedLegs: [
          { date: TODAY, amount: money(-500_00) },
          { date: "2026-07-01", amount: money(-500_00) },
        ],
      })
    );
    expect(b["2026-07-08"]).toBe(100_00);
  });

  it("re-attributes future-dated cleared legs to their own day", () => {
    // currentBalance (derived from ALL cleared legs) already contains the +40
    // dated the 8th; the curve must show it appearing on the 8th, not today.
    const b = balances(
      base({
        currentBalance: money(140_00),
        clearedLegs: [{ date: "2026-07-08", amount: money(40_00) }],
      })
    );
    expect(b[TODAY]).toBe(100_00);
    expect(b["2026-07-07"]).toBe(100_00);
    expect(b["2026-07-08"]).toBe(140_00);
  });
});

describe("buildBalanceSeries — budget burn", () => {
  const burn: CategoryBurn = {
    targetAmount: money(100_00),
    actualToDate: money(0),
    projectedFuture: money(0),
    periodEnd: "2026-07-10", // 4 days left from TODAY
  };

  it("prorates the remaining cap linearly and lands exactly on the total", () => {
    const b = balances(base({ to: "2026-07-10", categoryBurns: [burn] }));
    expect(b["2026-07-07"]).toBe(100_00 - 25_00);
    expect(b["2026-07-08"]).toBe(100_00 - 50_00);
    expect(b["2026-07-10"]).toBe(0);
  });

  it("deduplicates: future projected expenses in the category reduce the burn", () => {
    // $60 of the cap is already plotted as a projected expense on the 7th.
    const b = balances(
      base({
        to: "2026-07-10",
        projectedLegs: [{ date: "2026-07-07", amount: money(-60_00) }],
        categoryBurns: [{ ...burn, projectedFuture: money(60_00) }],
      })
    );
    // Burn only the remaining $40 over 4 days; total drop is still $100.
    expect(b["2026-07-10"]).toBe(0);
    expect(b["2026-07-07"]).toBe(100_00 - 60_00 - 10_00);
  });

  it("an overspent cap projects no further spending (never negative)", () => {
    expect(
      remainingBurn({ ...burn, actualToDate: money(150_00) })
    ).toBe(0);
    const b = balances(
      base({ to: "2026-07-10", categoryBurns: [{ ...burn, actualToDate: money(150_00) }] })
    );
    expect(b["2026-07-10"]).toBe(100_00);
  });

  it("burns nothing when the period already ended", () => {
    const b = balances(
      base({ to: "2026-07-08", categoryBurns: [{ ...burn, periodEnd: TODAY }] })
    );
    expect(b["2026-07-08"]).toBe(100_00);
  });

  it("integer rounding: cumulative burn is monotone and exact at period end", () => {
    // $1.00 over 3 days → 33/67/100 centavos.
    const b = balances(
      base({
        to: "2026-07-09",
        categoryBurns: [
          { targetAmount: money(100), actualToDate: money(0), projectedFuture: money(0), periodEnd: "2026-07-09" },
        ],
      })
    );
    expect(b["2026-07-07"]).toBe(100_00 - 33);
    expect(b["2026-07-08"]).toBe(100_00 - 67);
    expect(b["2026-07-09"]).toBe(100_00 - 100);
  });
});

describe("buildBalanceSeries — edges", () => {
  it("empty when the range is inverted", () => {
    expect(buildBalanceSeries(base({ from: "2026-07-10", to: "2026-07-01" }))).toEqual([]);
  });

  it("covers every day of [from, to] inclusive", () => {
    const series = buildBalanceSeries(base());
    expect(series.map((p) => p.date)).toEqual([
      "2026-07-04",
      "2026-07-05",
      "2026-07-06",
      "2026-07-07",
      "2026-07-08",
    ]);
  });
});
