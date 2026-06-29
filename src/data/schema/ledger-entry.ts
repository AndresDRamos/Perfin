import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { account } from "./account";
import { incomeCategory } from "./income-category";
import { expenseCategory } from "./expense-category";

export const ledgerEntryKindEnum = pgEnum("ledger_entry_kind", [
  "income",
  "expense",
  "transfer",
]);

export const ledgerEntryStatusEnum = pgEnum("ledger_entry_status", [
  "cleared",
  "projected",
]);

export const ledgerEntry = pgTable(
  "ledger_entry",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    kind: ledgerEntryKindEnum("kind").notNull(),
    status: ledgerEntryStatusEnum("status").notNull(),
    // ALWAYS POSITIVE integer centavos (MXN).
    // Direction is determined by kind: income adds, expense subtracts.
    // Repositories translate to signed domain.Money when building LedgerEntry objects.
    amount: integer("amount").notNull(),
    // Nullable: fast-capture allows omitting description; user fills in later.
    concept: varchar("concept", { length: 200 }),
    // User-supplied occurrence date (used for ledger ordering and credit statement windows).
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    accountId: integer("account_id")
      .notNull()
      .references(() => account.id),
    // Destination account for internal transfers only. NULL for income/expense.
    toAccountId: integer("to_account_id").references(() => account.id),
    // Category FKs: only one is ever populated; the other is NULL.
    // chk_category_kind enforces which column matches the entry's kind.
    incomeCategoryId: integer("income_category_id").references(() => incomeCategory.id),
    expenseCategoryId: integer("expense_category_id").references(() => expenseCategory.id),
  },
  (t) => [
    // Amount must always be a meaningful positive value
    check("chk_amount_positive", sql`${t.amount} > 0`),
    // to_account_id: required for transfer, prohibited for income/expense
    check(
      "chk_transfer_to_account",
      sql`(${t.kind} = 'transfer' AND ${t.toAccountId} IS NOT NULL)
          OR (${t.kind} <> 'transfer' AND ${t.toAccountId} IS NULL)`
    ),
    // No self-transfer
    check(
      "chk_no_self_transfer",
      sql`${t.toAccountId} IS NULL OR ${t.toAccountId} <> ${t.accountId}`
    ),
    // Saldo derivado y reconciliación: query más frecuente
    index("idx_ledger_entry_account_status").on(t.accountId, t.status),
    // Historial por fecha y cálculo de estado de cuenta de crédito
    index("idx_ledger_entry_occurred_at").on(t.occurredAt),
    // Lookup del lado receptor en transferencias
    index("idx_ledger_entry_to_account")
      .on(t.toAccountId)
      .where(sql`${t.toAccountId} IS NOT NULL`),
    // income_category_id is only valid for income; expense_category_id for expense; transfer forbids both
    check(
      "chk_category_kind",
      sql`
        (${t.kind} = 'income' AND ${t.expenseCategoryId} IS NULL)
        OR (${t.kind} = 'expense' AND ${t.incomeCategoryId} IS NULL)
        OR (${t.kind} = 'transfer' AND ${t.incomeCategoryId} IS NULL AND ${t.expenseCategoryId} IS NULL)
      `
    ),
    index("idx_ledger_entry_income_category")
      .on(t.incomeCategoryId)
      .where(sql`${t.incomeCategoryId} IS NOT NULL`),
    index("idx_ledger_entry_expense_category")
      .on(t.expenseCategoryId)
      .where(sql`${t.expenseCategoryId} IS NOT NULL`),
  ]
);

export type LedgerEntryRow = typeof ledgerEntry.$inferSelect;
export type NewLedgerEntry = typeof ledgerEntry.$inferInsert;
