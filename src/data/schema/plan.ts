import {
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

export const plan = pgTable(
  "plan",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    // Owner. CASCADE (unlike account): plans/budgets are disposable planning
    // metadata, not records of real money.
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    // Arbitrary date range (not just calendar months). Plain dates: no time/TZ.
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("chk_plan_period_order", sql`${t.periodEnd} >= ${t.periodStart}`),
    index("idx_plan_user_id").on(t.userId),
    pgPolicy("plan_select_mcp_readonly", {
      for: "select",
      to: mcpReadonly,
      using: sql`true`,
    }),
  ]
);

export type PlanRow = typeof plan.$inferSelect;
export type NewPlan = typeof plan.$inferInsert;
