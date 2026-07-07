import {
  boolean,
  check,
  date,
  index,
  integer,
  pgPolicy,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { authUsers } from "./auth-users";
import { mcpReadonly } from "./roles";
import { account } from "./account";
import { expenseCategory } from "./expense-category";

// Plantilla de gasto fijo mensual. El motor de recurrencia materializa un
// ledger_entry kind=expense status=cleared por ocurrencia vencida (el cargo de
// un servicio ocurre solo); la plantilla nunca es saldo — el dinero vive en el
// ledger. Idempotencia: ledger_entry.(fixed_expense_id, fixed_expense_month).
export const fixedExpense = pgTable(
  "fixed_expense",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    // CASCADE: la plantilla es metadata de planeación (coherente con plan).
    // Las entries materializadas conservan su propio user_id RESTRICT.
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    // Centavos MXN, siempre positivo (mismo contrato que ledger_entry.amount).
    amount: integer("amount").notNull(),
    // Cuenta de cargo: cualquier kind; si es credit, la entry materializada se
    // vuelve deuda de la tarjeta por el flujo normal del ledger.
    accountId: integer("account_id")
      .notNull()
      .references(() => account.id, { onDelete: "restrict" }),
    // Obligatoria: los gastos fijos alimentan los topes por categoría de los
    // presupuestos. "Solo categorías is_fixed" se valida en la app (no hay
    // CHECK cross-table; dba descartó trigger/FK compuesta).
    expenseCategoryId: integer("expense_category_id")
      .notNull()
      .references(() => expenseCategory.id, { onDelete: "restrict" }),
    // Día programado 1..31; el motor hace clamp a fin de mes (feb → 28/29).
    dayOfMonth: integer("day_of_month").notNull(),
    startDate: date("start_date").notNull(),
    // NULL = vigencia indefinida.
    endDate: date("end_date"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("chk_fixed_expense_amount_positive", sql`${t.amount} > 0`),
    check("chk_fixed_expense_day_range", sql`${t.dayOfMonth} BETWEEN 1 AND 31`),
    check(
      "chk_fixed_expense_period_order",
      sql`${t.endDate} IS NULL OR ${t.endDate} >= ${t.startDate}`
    ),
    // Query del motor: plantillas activas del usuario con vigencia abierta.
    index("idx_fixed_expense_user_active").on(t.userId).where(sql`${t.isActive} = TRUE`),
    pgPolicy("fixed_expense_select_mcp_readonly", {
      for: "select",
      to: mcpReadonly,
      using: sql`true`,
    }),
  ]
);

export type FixedExpenseRow = typeof fixedExpense.$inferSelect;
export type NewFixedExpense = typeof fixedExpense.$inferInsert;
