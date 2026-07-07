import {
  check,
  date,
  index,
  integer,
  pgEnum,
  pgPolicy,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { authUsers } from "./auth-users";
import { mcpReadonly } from "./roles";
import { account } from "./account";
import { incomeCategory } from "./income-category";
import { expenseCategory } from "./expense-category";
import { fixedExpense } from "./fixed-expense";

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
    // Denormalized owner, always copied from account.user_id in ledger-write:
    // keeps owner-scoped queries (the hot path) join-free and RLS-ready.
    // v1 forbids cross-user transfers, so a single owner per entry is unambiguous.
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "restrict" }),
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
    // Origen de materialización de gastos fijos. SET NULL: las entries son
    // transacciones reales que sobreviven a su plantilla.
    fixedExpenseId: integer("fixed_expense_id").references(() => fixedExpense.id, {
      onDelete: "set null",
    }),
    // Mes de la OCURRENCIA PROGRAMADA (día 1), escrito por el motor. NO se
    // deriva de occurred_at: date_trunc('month', timestamptz) es STABLE (no
    // indexable) y editar occurred_at movería la clave de idempotencia.
    fixedExpenseMonth: date("fixed_expense_month"),
    // Monto ESPERADO de una proyección de ingreso (centavos). Se escribe al
    // crearla (= amount inicial); conciliar actualiza amount/status y nunca
    // esta columna. "Solo si nació proyectada" se garantiza en ledger-write
    // (el status muta al conciliar; no es expresable en CHECK).
    expectedAmount: integer("expected_amount"),
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
    // Saldo derivado y reconciliación: query más frecuente, siempre bajo scoping
    // por dueño; el sufijo (account_id, status) sigue cubriendo queries sin user_id
    index("idx_ledger_entry_user_account_status").on(t.userId, t.accountId, t.status),
    // Historial por fecha y cálculo de estado de cuenta de crédito
    index("idx_ledger_entry_occurred_at").on(t.occurredAt),
    // Historial del usuario por fecha (dashboard, reportes)
    index("idx_ledger_entry_user_occurred_at").on(t.userId, t.occurredAt),
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
    // Solo gastos pueden venir de plantilla, y si vienen, traen su mes.
    // (Un solo sentido: permite month huérfano tras el SET NULL del FK.)
    check(
      "chk_fixed_expense_link",
      sql`${t.fixedExpenseId} IS NULL
          OR (${t.kind} = 'expense' AND ${t.fixedExpenseMonth} IS NOT NULL)`
    ),
    // Normalizado a día 1 del mes (mismo patrón que account.expiration_date).
    check(
      "chk_fixed_expense_month_day1",
      sql`${t.fixedExpenseMonth} IS NULL OR EXTRACT(DAY FROM ${t.fixedExpenseMonth}) = 1`
    ),
    // Solo ingresos llevan monto esperado, siempre positivo.
    check(
      "chk_expected_amount_income",
      sql`${t.expectedAmount} IS NULL OR (${t.kind} = 'income' AND ${t.expectedAmount} > 0)`
    ),
    // IDEMPOTENCIA de materialización: máximo una entry por plantilla por mes
    // de ocurrencia. El motor inserta con ON CONFLICT DO NOTHING contra este índice.
    uniqueIndex("uq_ledger_entry_fixed_expense_month")
      .on(t.fixedExpenseId, t.fixedExpenseMonth)
      .where(sql`${t.fixedExpenseId} IS NOT NULL`),
    pgPolicy("ledger_entry_select_mcp_readonly", {
      for: "select",
      to: mcpReadonly,
      using: sql`true`,
    }),
  ]
);

export type LedgerEntryRow = typeof ledgerEntry.$inferSelect;
export type NewLedgerEntry = typeof ledgerEntry.$inferInsert;
