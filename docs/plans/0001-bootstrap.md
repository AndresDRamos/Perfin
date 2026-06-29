# 0001 - Bootstrap

- Status: active
- Date: 2026-06-28
- Mode: Architecture

## Goal

Establish the initial code structure, layering, and conventions for the Personal Finance Tracker
(Next.js + TypeScript + Postgres/Supabase) so the feature modules (accounts, ledger, budgets,
catalog) can be built on a correct, **derived-balance** ledger model. Scaffolding + decisions only --
no feature code yet.

## Affected modules

- `accounts`, `ledger`, `budgets`, `catalog` -- all greenfield (stubs only so far).

## DB impact

Greenfield schema; no migrations applied yet. Candidate core tables (subject to `dba` review before
the first migration):

- `account` (+ credit config `cutoff_day`/`payment_day`/`credit_limit?`, `account_interest_rate` effective-dated history).
- `transaction` (kind, status, occurred_at, created_at, amount, concept, account refs, category refs) and `external_account`.
- `income_category`, `expense_category`, `fixed_expense`.
- `plan`, `budget`.

Invariant the schema must protect: **no stored mutable balance** -- balances are always derived
(`opening_balance` + Σ cleared transactions).

## Proposed code structure

Next.js App Router, layered so money math never lives in the UI:

```text
src/
  app/                      # routes (App Router); Server Actions for fast capture
    (dashboard)/            # available real/projected, upcoming credit dues
    accounts/  ledger/  budgets/  catalog/
  domain/                   # pure TS, no I/O: money + the financial rules
    money.ts                # integer minor units (centavos), MXN
    balances.ts             # derive(account) = opening + Σ cleared
    available.ts            # real (cleared) vs projected
    credit.ts               # statement / due derivation from cutoff & payment days
  data/                     # persistence
    schema/                 # table definitions (Drizzle/Prisma)
    repositories/           # typed queries
  server/                   # use-cases orchestrating domain + data
  components/  ui/          # presentational only; no money math
  lib/                      # shared utils, config, env
docs/                       # already scaffolded
```

## Candidate architecture decisions (later -> ADRs)

1. **ORM / query layer**: **Drizzle** (typed SQL, light, migration-friendly). -> Decided in [ADR-001](../architecture/adr/001-orm-drizzle.md).
2. **Money as integer minor units** (centavos), never floats. -> ADR-002.
3. **Derived balances** computed in `domain/`, surfaced via read models; never a stored column. -> ADR-003.
4. **Credit statements derived** from transaction dates vs cutoff/payment days, not persisted records. -> ADR-004.
5. **Server Actions** for transaction capture (low latency, simple for a single user). -> ADR-005.

## Steps

1. Initialize the Next.js + TypeScript app (App Router, ESLint/Prettier, path aliases, `lib/env`).
2. Add Drizzle + Drizzle Kit (ADR-001) and wire the Supabase connection via `DATABASE_URL`.
3. Scaffold `domain/` with money + balance-derivation contracts (no persistence) + unit tests.
4. Define core schema for `account` and `transaction` only; `dba` review; first migration.
5. Vertical slice: create account -> capture a cleared expense -> see derived balance & available. Proves the model end to end.
6. Layer in the remaining tables (categories, budgets, fixed expenses) module by module via `/plan-module`.
7. Promote decisions #1-#5 to ADRs once settled.

## Risks

- Derived-balance queries may slow as the ledger grows -- mitigate with indexes / materialized read models *only if needed* (still derived, never authoritative state).
- Date/timezone handling for cutoff/payment-day derivation -- store `occurred_at` explicitly and fix a single TZ for v1.
- ORM choice is sticky -- settled as Drizzle (ADR-001) before writing repositories.

## Tests / guards

- Unit tests in `domain/`: balance derivation, real vs projected available, credit statement/due calc.
- Invariant test: `transfer` entries never affect category/budget totals.
- Invariant test: no code path writes a stored balance.

## Rollback

All greenfield. To undo: drop the created migrations and remove the generated app skeleton; the
docs/scaffold remain. Nothing in production.
