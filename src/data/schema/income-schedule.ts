import {
  boolean,
  check,
  date,
  index,
  integer,
  pgEnum,
  pgPolicy,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { authUsers } from "./auth-users";
import { account } from "./account";
import { incomeCategory } from "./income-category";
import { mcpReadonly } from "./roles";

// Recurrence of the user's expected income ("tipo de ingreso").
// - weekly:      every 7 days from anchor_date
// - biweekly:    catorcenal, every 14 days from anchor_date
// - semimonthly: quincenal, the 15th AND the LAST day of each month ("15 y 30"
//   is undefined in February; 15/end-of-month is the real Mexican payroll
//   convention). anchor_date only marks the start of validity here.
// - monthly:     anchor_date's day-of-month, clamped to short months
export const incomeFrequencyEnum = pgEnum("income_frequency", [
  "weekly",
  "biweekly",
  "semimonthly",
  "monthly",
]);

export const incomeSchedule = pgTable(
  "income_schedule",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    // Owner. CASCADE (like plan, unlike account): a schedule is disposable
    // user configuration, not a record of real money.
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    frequency: incomeFrequencyEnum("frequency").notNull(),
    // ESTIMATED centavos; the real amount is asked on payday and lands in
    // ledger_entry as an income/cleared row. Occurrences are computed in
    // memory — schedule rows are never materialized into the ledger.
    estimatedAmount: integer("estimated_amount").notNull(),
    // Destination account. RESTRICT: accounts are deactivated, never deleted,
    // so this never blocks in practice and avoids a nullable zombie state.
    accountId: integer("account_id")
      .notNull()
      .references(() => account.id, { onDelete: "restrict" }),
    incomeCategoryId: integer("income_category_id").references(() => incomeCategory.id),
    // Immutable anchor: one known payday. Every frequency derives all of its
    // occurrences from it in memory; no occurrence is projected before it.
    anchorDate: date("anchor_date").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("chk_income_schedule_amount_pos", sql`${t.estimatedAmount} > 0`),
    // Hot read: "active schedules for this user" (dashboard projection).
    index("idx_income_schedule_user_active")
      .on(t.userId)
      .where(sql`${t.isActive} = true`),
    // Full listing (settings screen, includes inactive).
    index("idx_income_schedule_user_id").on(t.userId),
    // Reverse lookup when deactivating the destination account.
    index("idx_income_schedule_account_id").on(t.accountId),
    pgPolicy("income_schedule_select_mcp_readonly", {
      for: "select",
      to: mcpReadonly,
      using: sql`true`,
    }),
  ]
);

export type IncomeScheduleRow = typeof incomeSchedule.$inferSelect;
export type NewIncomeSchedule = typeof incomeSchedule.$inferInsert;
