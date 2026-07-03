import {
  boolean,
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const accountKindEnum = pgEnum("account_kind", [
  "cash",
  "debit",
  "investment",
  "credit",
]);

export const account = pgTable(
  "account",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    name: varchar("name", { length: 100 }).notNull(),
    kind: accountKindEnum("kind").notNull(),
    // Opening balance in centavos (MXN). Never updated after creation.
    // Actual balance is always derived: opening_balance + Σ cleared ledger entries.
    openingBalance: integer("opening_balance").notNull().default(0),
    // Credit card only — NULL for non-credit accounts (enforced by chk_credit_fields)
    cutoffDay: integer("cutoff_day"),   // 1-28
    paymentDay: integer("payment_day"), // 1-28
    creditLimit: integer("credit_limit"), // centavos, informational
    // Descriptive metadata — informational only, no per-kind restriction
    bank: varchar("bank", { length: 100 }),
    // Masked identifier ("****1234", partial CLABE) — never a full card number
    // (enforced by chk_number_masked)
    number: varchar("number", { length: 30 }),
    // Card validity, normalized to day 1; card is valid through the END of that month.
    // UI captures/displays MM/YY.
    expirationDate: date("expiration_date"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // credit-specific fields must be present for credit accounts and absent for all others
    check(
      "chk_credit_fields",
      sql`(${t.kind} = 'credit' AND ${t.cutoffDay} IS NOT NULL AND ${t.paymentDay} IS NOT NULL)
          OR (${t.kind} <> 'credit' AND ${t.cutoffDay} IS NULL AND ${t.paymentDay} IS NULL AND ${t.creditLimit} IS NULL)`
    ),
    check("chk_cutoff_day_range", sql`${t.cutoffDay} BETWEEN 1 AND 28`),
    check("chk_payment_day_range", sql`${t.paymentDay} BETWEEN 1 AND 28`),
    check("chk_cutoff_ne_payment", sql`${t.cutoffDay} <> ${t.paymentDay}`),
    check("chk_credit_limit_pos", sql`${t.creditLimit} IS NULL OR ${t.creditLimit} > 0`),
    // Reject a full PAN (13-19 straight digits) — only masked identifiers allowed
    check("chk_number_masked", sql`${t.number} IS NULL OR ${t.number} !~ '^[0-9]{13,19}$'`),
    // Cuentas activas — evita seq scan en la lista del dashboard
    index("idx_account_is_active").on(t.isActive).where(sql`${t.isActive} = TRUE`),
  ]
);

export type Account = typeof account.$inferSelect;
export type NewAccount = typeof account.$inferInsert;
