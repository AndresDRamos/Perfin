# STATE

Active context of the repo. Curated by `/commit-plan`. Keep it short: only what is *active*.

## Active milestones

- **Bootstrap** (`0001-bootstrap`, complete) -- scaffold landed. Next.js (App Router) + TypeScript +
  Drizzle/Postgres(Supabase). `domain/` layer (money, balances, available, credit) with unit tests in
  place; ADRs 001-005 recorded. Initial migration `0000` applied -- live schema is `account` +
  single-table `ledger_entry`.
- **Transactions ledger** (`0002-transactions-ledger`, complete) -- full data layer landed: signed-leg
  mapper (`ledger-mapping`), Zod write path + `createEntry`/`updateEntry`/`reconcile`
  (`ledger-write`), read repository (`ledger-repo`), server actions (`captureEntry`, `editEntry`,
  `reconcileEntry`, `getDashboard`), and minimal UI (fast-capture form + dashboard with real/projected
  available and credit cards). No DDL changes.
- **Next**: add categories (`catalog` module -- `income_category` / `expense_category` tables) to
  unlock budget tracking; then budgets and fixed expenses module by module via `/plan-module`.

## Active risks

- Derived-balance queries may slow as the ledger grows -- mitigate with indexes / materialized read
  models *only if needed* (always derived, never authoritative state).
- Date/timezone handling for cutoff/payment-day derivation -- `occurred_at` stored explicitly; fix a
  single TZ for v1.
- **Deferred categories**: income/expense are captured with `concept` only -- no category link until
  `catalog` exists. Budget totals are blocked by this dependency.
- Loose end: `src/data/schema/transaction.ts` exists but is not exported from `schema/index.ts`
  (superseded by the single-table `ledger_entry` model) -- dead file to remove.

## Active logic

- Single user, single currency (**MXN**) for v1. Simplest model that stays correct (not double-entry).
- Balances are **derived from the ledger** (per-account opening balance + sum of transactions); never a stored mutable field.
- **Available** = liquid *cleared* balances (cash + debit + investment). Credit debt is a separate liability surfaced by payment date; **not** subtracted from available.
- Two readings of available: *real* (cleared only) vs *projected* (incl. `projected` income).
- Ledger is a **single `ledger_entry` table**. Kinds: `income` / `expense` count toward categories & budgets; `transfer` is **excluded** from those totals. `amount` is stored as a **positive** integer (centavos); direction is set by kind (repositories translate to signed `domain.Money`). Status is `cleared` / `projected`.
- **Signed-leg contract** (implemented in `src/data/ledger-mapping.ts`): `income` → `+amount` on `account_id`; `expense` → `-amount` on `account_id`; `transfer` → two legs (`-amount` on `account_id`, `+amount` on `to_account_id`). Single source of truth for sign -- domain layer never touches raw DB amounts.
- Credit statements & dues are **derived** from transaction dates vs the card's cutoff/payment days -- not stored as mutable records. v1 assumes pay-in-full (no revolving interest).
- Investment annual rate is effective-dated history, **informational only** -- no automatic interest posting.
