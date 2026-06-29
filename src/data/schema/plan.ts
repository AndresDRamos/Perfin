import { check, date, integer, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const plan = pgTable(
  "plan",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    name: varchar("name", { length: 100 }).notNull(),
    // Arbitrary date range (not just calendar months). Plain dates: no time/TZ.
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check("chk_plan_period_order", sql`${t.periodEnd} >= ${t.periodStart}`)]
);

export type PlanRow = typeof plan.$inferSelect;
export type NewPlan = typeof plan.$inferInsert;
