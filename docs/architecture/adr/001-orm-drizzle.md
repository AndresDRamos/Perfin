# 001. Use Drizzle as the ORM / query layer

- Status: accepted
- Date: 2026-06-28

## Context

The app is a single-user personal finance tracker on Next.js (App Router) + TypeScript +
Postgres/Supabase. Its core is not CRUD but a **ledger with derived balances**: most of the valuable
logic is analytical SQL -- `SUM` of transactions per account, *available* real vs projected, credit
statement/due derivation (windows over `cutoff`/`payment` days), and budget actuals over arbitrary
date ranges. Two prior decisions shape this: money is stored as integer minor units (centavos) and
balances are **derived, never stored**. We need a data layer that stays close to SQL, is type-safe,
is light on the Supabase pooler, and supports reviewable migrations. The choice was Drizzle vs Prisma.

## Decision

Adopt **Drizzle ORM** with **Drizzle Kit** for migrations.

- Schema defined in TypeScript under `data/schema/`; migrations generated as reviewable SQL.
- Typed queries in `data/repositories/`; complex derived-balance/aggregation queries written with
  Drizzle's SQL-first API (and `sql` template where needed), keeping them transparent and 1:1 with
  the SQL we intend to run.
- Money math and financial rules remain in the pure `domain/` layer; the data layer only reads/writes
  rows. Connection via `DATABASE_URL` (Supabase Session pooler).

## Consequences

- **Easier**: aggregation-heavy queries (the bulk of this app), transparency over the executed SQL,
  a light runtime well suited to the pooler/serverless, and migrations that are plain reviewable SQL.
  Aligns naturally with the integer-money and derived-balance invariants.
- **Harder**: less "batteries-included" guidance than Prisma; we write more explicit query code and
  own more of the SQL. Relations are more manual.
- **Live with**: Drizzle Studio for data browsing (slightly less polished than Prisma Studio). If we
  ever need a heavy relational-graph CRUD surface, we accept doing it by hand rather than via a
  high-level client. Revisit only if the app's shape shifts away from a derived ledger.
