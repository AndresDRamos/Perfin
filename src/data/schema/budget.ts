import {
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { plan } from "./plan";
import { account } from "./account";
import { expenseCategory } from "./expense-category";

export const budgetSubtypeEnum = pgEnum("budget_subtype", [
  "category_cap",
  "savings_reservation",
  "purchase_goal",
]);

export const purchaseHorizonEnum = pgEnum("purchase_horizon", [
  "short",
  "medium",
  "long",
]);

// Polymorphic by `subtype`. Conditional columns are NULL except where the
// subtype requires them; chk_budget_subtype_fields enforces the matrix
// (fail-closed, same pattern as ledger_entry.chk_category_kind).
export const budget = pgTable(
  "budget",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    planId: integer("plan_id")
      .notNull()
      .references(() => plan.id, { onDelete: "cascade" }),
    subtype: budgetSubtypeEnum("subtype").notNull(),
    // Centavos (MXN), siempre > 0. Significado depende del subtype:
    // cap = tope de gasto; reservation = monto a apartar; purchase_goal = meta.
    targetAmount: integer("target_amount").notNull(),
    // Override opcional del rango del plan; ambos NULL (= hereda) o ambos presentes.
    periodStart: date("period_start"),
    periodEnd: date("period_end"),
    // Solo category_cap.
    expenseCategoryId: integer("expense_category_id").references(() => expenseCategory.id),
    // Solo savings_reservation (cuenta de ahorro destino).
    accountId: integer("account_id").references(() => account.id),
    // Solo purchase_goal.
    itemName: varchar("item_name", { length: 100 }),
    horizon: purchaseHorizonEnum("horizon"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("chk_budget_target_positive", sql`${t.targetAmount} > 0`),
    // Override de periodo: ambos NULL o ambos presentes con end >= start.
    check(
      "chk_budget_period_pair",
      sql`(${t.periodStart} IS NULL AND ${t.periodEnd} IS NULL)
          OR (${t.periodStart} IS NOT NULL AND ${t.periodEnd} IS NOT NULL AND ${t.periodEnd} >= ${t.periodStart})`
    ),
    // Matriz polimórfica: qué columnas condicionales aplican por subtype.
    check(
      "chk_budget_subtype_fields",
      sql`
        (${t.subtype} = 'category_cap' AND ${t.expenseCategoryId} IS NOT NULL AND ${t.accountId} IS NULL AND ${t.itemName} IS NULL AND ${t.horizon} IS NULL)
        OR (${t.subtype} = 'savings_reservation' AND ${t.accountId} IS NOT NULL AND ${t.expenseCategoryId} IS NULL AND ${t.itemName} IS NULL AND ${t.horizon} IS NULL)
        OR (${t.subtype} = 'purchase_goal' AND ${t.itemName} IS NOT NULL AND ${t.horizon} IS NOT NULL AND ${t.expenseCategoryId} IS NULL AND ${t.accountId} IS NULL)
      `
    ),
    index("idx_budget_plan_id").on(t.planId),
    index("idx_budget_expense_category")
      .on(t.expenseCategoryId)
      .where(sql`${t.expenseCategoryId} IS NOT NULL`),
    index("idx_budget_account")
      .on(t.accountId)
      .where(sql`${t.accountId} IS NOT NULL`),
    // Anti-duplicados lógicos: un cap por categoría y una reserva por cuenta, por plan.
    uniqueIndex("budget_cap_category_uq")
      .on(t.planId, t.expenseCategoryId)
      .where(sql`${t.subtype} = 'category_cap'`),
    uniqueIndex("budget_reservation_account_uq")
      .on(t.planId, t.accountId)
      .where(sql`${t.subtype} = 'savings_reservation'`),
  ]
);

export type BudgetRow = typeof budget.$inferSelect;
export type NewBudget = typeof budget.$inferInsert;
