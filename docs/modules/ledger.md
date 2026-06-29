# Module: ledger

- Type: ledger
- Status: planned

## Purpose

The transaction ledger -- the single source of truth from which all balances are derived. Records
`income`, `expense`, and `transfer` entries, each `projected` or `cleared`, and computes real vs
projected available. Fast capture is the top priority (the user records constantly).

## Key entities / tables

<!-- schema-derived: kept in sync with docs/database/data-dictionary.md (live schema) -->

- `ledger_entry` (id, kind, status, amount, concept?, occurred_at, created_at, updated_at, account_id, to_account_id?). Live in schema as of `0000_strong_smasher`. (This is the table the prose calls the "transaction" ledger.)
- `kind` enum: `income` | `expense` | `transfer`. `status` enum: `cleared` | `projected`.
- Transfers set `to_account_id` (the destination `account`); non-transfers leave it NULL and self-transfers are rejected. `amount` must be > 0.
- Not yet in schema (planned): `external_account`, and category links (`income_category_id`, `expense_category_id`).

## Public interface

- Capture / edit / reconcile (`projected` -> `cleared`) transactions.
- Derived reads: per-account balance, **available real** (cleared cash+debit+investment), **available projected** (+ projected income).
- Credit: an expense creates debt; payment is a `transfer` of real money into the credit account. Statement/due derived from `occurred_at` vs the card's cutoff/payment days.
- Invariant: `transfer` entries are **excluded** from category & budget totals.

## Dependencies

- `accounts` (every entry references an account; transfers reference a counter or external account).
- `catalog` (income/expense category; transfers carry none).
- Feeds `budgets` (only income/expense count; transfers excluded).

## Routing notes

What a planner should read/ask before touching this module (feeds `doc-routing.md`).
Read `docs/modules/ledger.md` + `docs/modules/accounts.md` + `docs/database/data-dictionary.md`.
Ask: which kind? cleared vs projected semantics? Does it touch balance derivation or the
transfers-excluded-from-budgets invariant?
