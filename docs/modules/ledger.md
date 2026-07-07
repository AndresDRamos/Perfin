# Module: ledger

- Type: ledger
- Status: built

## Purpose

The transaction ledger -- the single source of truth from which all balances are derived. Records
`income`, `expense`, and `transfer` entries, each `projected` or `cleared`, and computes real vs
projected available. Fast capture is the top priority (the user records constantly).

## Key entities / tables

<!-- schema-derived: kept in sync with docs/database/data-dictionary.md (live schema) -->

- `ledger_entry` (id, kind, status, amount, concept?, occurred_at, created_at, updated_at, account_id, to_account_id?, income_category_id?, expense_category_id?, user_id). Live in schema as of `0000_strong_smasher` (categories added in `0001`, `user_id` in `0004`). (This is the table the prose calls the "transaction" ledger.)
- `kind` enum: `income` | `expense` | `transfer`. `status` enum: `cleared` | `projected`.
- Transfers set `to_account_id` (the destination `account`); non-transfers leave it NULL and self-transfers are rejected. `amount` must be > 0.
- `income_schedule` (migration `0008`) — the user's recurring income config ("tipo de ingreso"): frequency enum `income_frequency` (`weekly` | `biweekly` | `semimonthly` = 15th AND last day of month | `monthly` clamped), ESTIMATED amount in centavos, destination account (RESTRICT), optional income category, immutable `anchor_date`. Occurrences are derived in memory (`domain/recurrence.ts`), never materialized; on payday the app asks the real amount and writes an income/cleared entry (`confirmPaydayAction`, ±3-day dedupe window, re-checked server-side). No FK between schedule and entry.
- Not yet in schema (planned): `external_account`.

## Public interface

- Capture / edit / reconcile (`projected` -> `cleared`) transactions. The dashboard (`/`) captures
  contextually per account kind via `EntryModal` (income into cash/debit may be a transfer from
  another own account; investment offers a balance adjustment entry for the difference; a credit
  "income" is a payment = transfer, with a "liquidar" shortcut).
- Derived reads: per-account balance, **available real** (cleared cash+debit+investment), **available projected** (+ projected income).
- **Balance timeline** (`getDashboardV2` + `domain/timeline.ts`): end-of-day balance series across
  all active accounts, today−40..today+30 (default view −10/+30). Past = current balance minus
  later cleared legs (walked backwards); future = projected legs + estimated `income_schedule`
  occurrences (deduped against captured incomes, ±3 days) + linear burn of the current plan's
  remaining category caps (future-dated expenses in the category are subtracted from the burn —
  no double counting). Projected entries dated today or earlier are ignored by the curve (pending
  reconciliation; the payday prompt / day detail handles them).
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
