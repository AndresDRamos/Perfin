"use server";

import { requireSessionUser } from "@/data/auth-repo";
import { listAccountsWithBalances } from "@/data/account-repo";
import { listEntriesForUser } from "@/data/ledger-repo";
import { listActiveIncomeSchedules } from "@/data/income-schedule-repo";
import { listPlans, planProgress } from "@/data/budget-repo";
import {
  listActiveIncomeCategories,
  listActiveExpenseCategories,
  listAllIncomeCategories,
  listAllExpenseCategories,
} from "@/data/category-repo";
import { toSignedLegs } from "@/data/ledger-mapping";
import { LedgerEntryRow } from "@/data/schema";
import { money, toPesos, add, ZERO, Money } from "@/domain/money";
import { addDays, ISODate } from "@/domain/dates";
import { occurrencesBetween, IncomeFrequency } from "@/domain/recurrence";
import {
  buildBalanceSeries,
  CategoryBurn,
  DatedAmount,
} from "@/domain/timeline";

// ─── view types (all serializable: pesos numbers + ISO strings) ──────────────

export interface EntryView {
  id: number;
  kind: "income" | "expense" | "transfer";
  status: "cleared" | "projected";
  amountPesos: number;
  concept: string | null;
  date: ISODate;
  accountId: number;
  accountName: string;
  toAccountId: number | null;
  toAccountName: string | null;
  categoryId: number | null;
  categoryName: string | null;
}

export interface AccountCardView {
  id: number;
  name: string;
  kind: "cash" | "debit" | "investment" | "credit";
  bank: string | null;
  balancePesos: number;
}

export interface ScheduleView {
  id: number;
  name: string;
  frequency: IncomeFrequency;
  estimatedAmountPesos: number;
  accountId: number;
  incomeCategoryId: number | null;
  anchorDate: ISODate;
}

export interface PendingPayday {
  scheduleId: number;
  scheduleName: string;
  date: ISODate;
  estimatedAmountPesos: number;
  accountId: number;
  accountName: string;
}

export interface BudgetBarView {
  budgetId: number;
  categoryId: number;
  categoryName: string;
  targetPesos: number;
  realPesos: number;
  projectedPesos: number;
}

export interface DashboardV2Data {
  today: ISODate;
  currentBalancePesos: number;
  // Series window: wider than the default view (−10/+30) so horizontal drag
  // has somewhere to go without a refetch.
  seriesFrom: ISODate;
  seriesTo: ISODate;
  series: { date: ISODate; balancePesos: number }[];
  entriesByDay: Record<ISODate, EntryView[]>;
  accounts: AccountCardView[];
  schedules: ScheduleView[];
  pendingPaydays: PendingPayday[];
  currentPlan: {
    id: number;
    name: string;
    periodStart: ISODate;
    periodEnd: ISODate;
    bars: BudgetBarView[];
  } | null;
  incomeCategories: { id: number; name: string }[];
  expenseCategories: { id: number; name: string }[];
}

// ─── constants ────────────────────────────────────────────────────────────────

const SERIES_PAST_DAYS = 40; // default view shows 10; drag reveals up to 40
const SERIES_FUTURE_DAYS = 30;
// A real income on the schedule's account within ±3 days of an occurrence
// counts as "that payday was registered" (same window as confirmPaydayAction).
const PAYDAY_DEDUPE_DAYS = 3;
// How far back an unregistered payday keeps prompting before going silent.
const PAYDAY_LOOKBACK_DAYS = 7;

// v1 calendar convention (same as CaptureForm/ledger-write): business dates
// are stored at UTC midnight, so the UTC slice of occurred_at IS the day.
function dayOf(occurredAt: Date): ISODate {
  return occurredAt.toISOString().slice(0, 10);
}

// ─── main read ────────────────────────────────────────────────────────────────

export async function getDashboardV2(): Promise<DashboardV2Data> {
  const { userId } = await requireSessionUser();
  const today = dayOf(new Date());
  const seriesFrom = addDays(today, -SERIES_PAST_DAYS);
  const seriesTo = addDays(today, SERIES_FUTURE_DAYS);

  const [accountViews, entries, schedules, plans, incomeCats, expenseCats, allIncomeCats, allExpenseCats] =
    await Promise.all([
      listAccountsWithBalances(userId),
      listEntriesForUser(userId),
      listActiveIncomeSchedules(userId),
      listPlans(userId),
      listActiveIncomeCategories(),
      listActiveExpenseCategories(),
      listAllIncomeCategories(),
      listAllExpenseCategories(),
    ]);

  const activeViews = accountViews.filter((v) => v.account.isActive);
  const activeIds = new Set(activeViews.map((v) => v.account.id));
  const accountNameById = new Map(accountViews.map((v) => [v.account.id, v.account.name]));
  const incomeCatNameById = new Map(allIncomeCats.map((c) => [c.id, c.name]));
  const expenseCatNameById = new Map(allExpenseCats.map((c) => [c.id, c.name]));

  // Saldo actual: Σ derived balances of ALL active accounts, credit included
  // (negative when in debt) — patrimonio menos deudas.
  let currentBalance: Money = ZERO;
  for (const v of activeViews) currentBalance = add(currentBalance, v.balance);

  // Signed legs per day across active accounts (own-account transfers net out).
  const clearedLegs: DatedAmount[] = [];
  const projectedLegs: DatedAmount[] = [];
  for (const row of entries) {
    const date = dayOf(row.occurredAt);
    for (const leg of toSignedLegs(row)) {
      if (!activeIds.has(leg.accountId)) continue;
      const bucket = row.status === "cleared" ? clearedLegs : projectedLegs;
      bucket.push({ date, amount: leg.entry.amount });
    }
  }

  // Schedule occurrences after today, skipping any that already have an
  // income entry (real or projected) on the same account near the same date —
  // the user's own capture wins over the estimate.
  const incomeDatesByAccount = new Map<number, ISODate[]>();
  for (const row of entries) {
    if (row.kind !== "income") continue;
    const list = incomeDatesByAccount.get(row.accountId) ?? [];
    list.push(dayOf(row.occurredAt));
    incomeDatesByAccount.set(row.accountId, list);
  }
  const hasIncomeNear = (accountId: number, date: ISODate, clearedOnly = false): boolean => {
    const lo = addDays(date, -PAYDAY_DEDUPE_DAYS);
    const hi = addDays(date, PAYDAY_DEDUPE_DAYS);
    return entries.some(
      (row) =>
        row.kind === "income" &&
        row.accountId === accountId &&
        (!clearedOnly || row.status === "cleared") &&
        dayOf(row.occurredAt) >= lo &&
        dayOf(row.occurredAt) <= hi
    );
  };

  const scheduleOccurrences: DatedAmount[] = [];
  const pendingPaydays: PendingPayday[] = [];
  for (const s of schedules) {
    const spec = { frequency: s.frequency as IncomeFrequency, anchorDate: s.anchorDate };
    for (const date of occurrencesBetween(spec, addDays(today, 1), seriesTo)) {
      if (hasIncomeNear(s.accountId, date)) continue;
      scheduleOccurrences.push({ date, amount: money(s.estimatedAmount) });
    }
    // Pending payday: latest due occurrence without a registered real income.
    const due = occurrencesBetween(spec, addDays(today, -PAYDAY_LOOKBACK_DAYS), today);
    const latest = due[due.length - 1];
    if (latest && !hasIncomeNear(s.accountId, latest, true)) {
      pendingPaydays.push({
        scheduleId: s.id,
        scheduleName: s.name,
        date: latest,
        estimatedAmountPesos: toPesos(money(s.estimatedAmount)),
        accountId: s.accountId,
        accountName: accountNameById.get(s.accountId) ?? "",
      });
    }
  }

  // Current plan (period covers today) + budget burn for the projection.
  const currentPlanRow = plans.find((p) => p.periodStart <= today && today <= p.periodEnd);
  const categoryBurns: CategoryBurn[] = [];
  let currentPlan: DashboardV2Data["currentPlan"] = null;
  if (currentPlanRow) {
    const progress = await planProgress(userId, currentPlanRow.id);
    if (progress) {
      const caps = progress.budgets.filter(
        (b) => b.budget.subtype === "category_cap" && b.budget.expenseCategoryId !== null
      );
      for (const cap of caps) {
        const wStart = cap.budget.periodStart ?? progress.plan.periodStart;
        const wEnd = cap.budget.periodEnd ?? progress.plan.periodEnd;
        let actualToDate: Money = ZERO;
        let futurePlotted: Money = ZERO;
        for (const row of entries) {
          if (row.kind !== "expense") continue;
          if (row.expenseCategoryId !== cap.budget.expenseCategoryId) continue;
          const date = dayOf(row.occurredAt);
          if (date < wStart || date > wEnd) continue;
          if (date <= today) actualToDate = add(actualToDate, money(row.amount));
          // Future-dated expenses (projected or cleared) are already plotted
          // as individual legs; the burn must not re-spend them.
          else futurePlotted = add(futurePlotted, money(row.amount));
        }
        categoryBurns.push({
          targetAmount: money(cap.budget.targetAmount),
          actualToDate,
          projectedFuture: futurePlotted,
          periodEnd: wEnd,
        });
      }
      const bars = caps
        .map((cap) => ({
          budgetId: cap.budget.id,
          categoryId: cap.budget.expenseCategoryId!,
          categoryName: expenseCatNameById.get(cap.budget.expenseCategoryId!) ?? "",
          targetPesos: toPesos(money(cap.budget.targetAmount)),
          realPesos: toPesos(money(cap.realActual)),
          projectedPesos: toPesos(money(cap.projectedActual)),
        }))
        .sort((a, b) => b.realPesos / b.targetPesos - a.realPesos / a.targetPesos);
      currentPlan = {
        id: progress.plan.id,
        name: progress.plan.name,
        periodStart: progress.plan.periodStart,
        periodEnd: progress.plan.periodEnd,
        bars,
      };
    }
  }

  const series = buildBalanceSeries({
    today,
    currentBalance,
    clearedLegs,
    projectedLegs,
    scheduleOccurrences,
    categoryBurns,
    from: seriesFrom,
    to: seriesTo,
  }).map((p) => ({ date: p.date, balancePesos: toPesos(p.balance) }));

  // Entries of the visible window, grouped by day for the day detail.
  const entriesByDay: Record<ISODate, EntryView[]> = {};
  for (const row of entries) {
    const date = dayOf(row.occurredAt);
    if (date < seriesFrom || date > seriesTo) continue;
    (entriesByDay[date] ??= []).push(toEntryView(row, date, accountNameById, incomeCatNameById, expenseCatNameById));
  }

  return {
    today,
    currentBalancePesos: toPesos(currentBalance),
    seriesFrom,
    seriesTo,
    series,
    entriesByDay,
    accounts: activeViews.map((v) => ({
      id: v.account.id,
      name: v.account.name,
      kind: v.account.kind,
      bank: v.account.bank,
      balancePesos: toPesos(v.balance),
    })),
    schedules: schedules.map((s) => ({
      id: s.id,
      name: s.name,
      frequency: s.frequency as IncomeFrequency,
      estimatedAmountPesos: toPesos(money(s.estimatedAmount)),
      accountId: s.accountId,
      incomeCategoryId: s.incomeCategoryId,
      anchorDate: s.anchorDate,
    })),
    pendingPaydays,
    currentPlan,
    incomeCategories: incomeCats.map((c) => ({ id: c.id, name: c.name })),
    expenseCategories: expenseCats.map((c) => ({ id: c.id, name: c.name })),
  };
}

function toEntryView(
  row: LedgerEntryRow,
  date: ISODate,
  accountNameById: Map<number, string>,
  incomeCatNameById: Map<number, string>,
  expenseCatNameById: Map<number, string>
): EntryView {
  const categoryId = row.incomeCategoryId ?? row.expenseCategoryId;
  const categoryName =
    row.incomeCategoryId !== null
      ? (incomeCatNameById.get(row.incomeCategoryId) ?? null)
      : row.expenseCategoryId !== null
        ? (expenseCatNameById.get(row.expenseCategoryId) ?? null)
        : null;
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    amountPesos: toPesos(money(row.amount)),
    concept: row.concept,
    date,
    accountId: row.accountId,
    accountName: accountNameById.get(row.accountId) ?? "",
    toAccountId: row.toAccountId,
    toAccountName: row.toAccountId !== null ? (accountNameById.get(row.toAccountId) ?? null) : null,
    categoryId,
    categoryName,
  };
}
