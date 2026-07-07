import {
  boolean,
  check,
  index,
  integer,
  pgPolicy,
  pgTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { mcpReadonly } from "./roles";

export const expenseCategory = pgTable(
  "expense_category",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    name: varchar("name", { length: 100 }).notNull(),
    description: varchar("description", { length: 300 }),
    isSavings: boolean("is_savings").notNull().default(false),
    // Categorías para gastos fijos (plantillas fixed_expense). No singleton:
    // puede haber varias; seeds "Servicios"/"Subscripciones" (editables).
    isFixed: boolean("is_fixed").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("expense_category_name_lower_uq").on(sql`lower(${t.name})`),
    // At most one savings category: unique on is_savings filtered to TRUE rows
    uniqueIndex("expense_category_savings_singleton")
      .on(t.isSavings)
      .where(sql`${t.isSavings} = TRUE`),
    // Invariante estructural: la categoría de ahorro nunca es de fijos.
    check(
      "chk_expense_category_savings_fixed_excl",
      sql`NOT (${t.isSavings} AND ${t.isFixed})`
    ),
    index("idx_expense_category_is_active").on(t.isActive).where(sql`${t.isActive} = TRUE`),
    pgPolicy("expense_category_select_mcp_readonly", {
      for: "select",
      to: mcpReadonly,
      using: sql`true`,
    }),
  ]
);

export type ExpenseCategoryRow = typeof expenseCategory.$inferSelect;
export type NewExpenseCategory = typeof expenseCategory.$inferInsert;
