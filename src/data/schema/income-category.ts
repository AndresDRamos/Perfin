import {
  boolean,
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

export const incomeCategory = pgTable(
  "income_category",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    name: varchar("name", { length: 100 }).notNull(),
    description: varchar("description", { length: 300 }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("income_category_name_lower_uq").on(sql`lower(${t.name})`),
    index("idx_income_category_is_active").on(t.isActive).where(sql`${t.isActive} = TRUE`),
    pgPolicy("income_category_select_mcp_readonly", {
      for: "select",
      to: mcpReadonly,
      using: sql`true`,
    }),
  ]
);

export type IncomeCategoryRow = typeof incomeCategory.$inferSelect;
export type NewIncomeCategory = typeof incomeCategory.$inferInsert;
