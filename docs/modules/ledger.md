# Module: ledger

- Type: ledger
- Status: active

## Purpose

The transaction ledger -- the single source of truth from which all balances are derived. Records
`income`, `expense`, and `transfer` entries, each `projected` or `cleared`, and computes real vs
projected available. Fast capture is the top priority (the user records constantly).

## Key entities / tables

<!-- schema-derived: kept in sync with docs/database/data-dictionary.md (live schema) -->

- `ledger_entry` (id, user_id, kind, status, amount, concept?, occurred_at, created_at,
  updated_at, account_id, to_account_id?, income_category_id?, expense_category_id?,
  fixed_expense_id?, fixed_expense_month?, expected_amount?). Live as of `0008_shallow_ricochet`.
- `kind` enum: `income` | `expense` | `transfer`. `status` enum: `cleared` | `projected`.
- Transfers set `to_account_id` (the destination `account`); non-transfers leave it NULL and self-transfers are rejected. `amount` must be > 0.
- **Fixed-expense origin** (0008): `fixed_expense_id` (FK → `fixed_expense`, ON DELETE SET NULL)
  + `fixed_expense_month` (day 1 of the SCHEDULED month, written by the recurrence engine).
  Partial unique `(fixed_expense_id, fixed_expense_month)` = materialization idempotency key.
  Only expenses may carry the link (`chk_fixed_expense_link`).
- **Income projections** (0008, plan type "Proyección"): `expected_amount` is written once at
  `createProjection` (= initial amount) and never mutated; `reconcileWithAmount` updates
  `amount`/`status` so expected-vs-real stays derivable. Only income, > 0
  (`chk_expected_amount_income`). `expected_amount IS NOT NULL` identifies the projection subset.
- Not yet in schema (planned): `external_account`.

## Public interface

- Capture / edit / reconcile (`projected` -> `cleared`) transactions.
- Income projections: `createProjection` / `reconcileWithAmount(userId, id, realPesos)`
  (`ledger-write.ts`); `listProjections` (`ledger-repo.ts`). Due projections (occurred_at <= today,
  still projected) surface on the dashboard as "Por conciliar".
- Derived reads: per-account balance, **available real** (cleared cash+debit+investment), **available projected** (+ projected income), **net projected** (ADR-010: projected + signed cleared credit balance — the dashboard's "Proyectado" card).
- Credit: an expense creates debt; payment is a `transfer` of real money into the credit account. Statement/due derived from `occurred_at` vs the card's cutoff/payment days.
- Invariant: `transfer` entries are **excluded** from category & budget totals.

## Dependencies

- `accounts` (every entry references an account; transfers reference a counter or external account).
- `catalog` (income/expense category; transfers carry none).
- Feeds `budgets` (only income/expense count; transfers excluded).

## Routing notes

What a planner should read/ask before touching this module (feeds `docs-routing.md`).
Read `docs/modules/ledger.md` + `docs/modules/accounts.md` + `docs/database/data-dictionary.md`.
Ask: which kind? cleared vs projected semantics? Does it touch balance derivation or the
transfers-excluded-from-budgets invariant?
