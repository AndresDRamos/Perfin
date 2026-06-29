# Module: accounts

- Type: accounts
- Status: planned

## Purpose

Register and manage the user's accounts across 4 types -- **cash**, **debit**, **credit**,
**investment** -- including per-type configuration and the opening balance that seeds the derived
ledger balance.

## Key entities / tables

<!-- schema-derived: kept in sync with docs/database/data-dictionary.md (live schema) -->

- `account` (id, name, kind, opening_balance, cutoff_day?, payment_day?, credit_limit?, is_active, created_at). Live in schema as of `0000_strong_smasher`.
- `kind` enum: `cash` | `debit` | `investment` | `credit`. Activation via `is_active` (not a separate `archived` flag).
- Credit config: `cutoff_day`, `payment_day` (both 1-28, distinct), optional `credit_limit` (> 0). Enforced by check constraints; non-credit accounts must leave these NULL.
- Not yet in schema (planned): `bank`, `number`, `expiration_date`, `currency`, and the investment rate history table `account_interest_rate`.

## Public interface

- CRUD for accounts; type-specific config forms.
- Derived **balance(account)** = opening_balance + Σ *cleared* ledger entries (see `ledger`).
- Read models for the dashboard: liquid accounts (cash/debit/investment) vs credit liabilities.

## Dependencies

- Consumed by `ledger` (account references), `budgets` (available balance), `catalog` (savings/target account).

## Routing notes

What a planner should read/ask before touching this module (feeds `doc-routing.md`).
Read `docs/modules/accounts.md` + `docs/database/data-dictionary.md`. Ask: which account type(s)?
Does the change touch the opening-balance or derived-balance contract (balance must stay derived,
never stored)?
