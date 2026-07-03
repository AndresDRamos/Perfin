# Module: accounts

- Type: accounts
- Status: built

## Purpose

Register and manage the user's accounts across 4 types -- **cash**, **debit**, **credit**,
**investment** -- including per-type configuration and the opening balance that seeds the derived
ledger balance.

## Key entities / tables

<!-- schema-derived: kept in sync with docs/database/data-dictionary.md (live schema) -->

- `account` (id, name, kind, opening_balance, cutoff_day?, payment_day?, credit_limit?, bank?,
  number?, expiration_date?, is_active, created_at). Live in schema as of `0003_mighty_young_avengers`.
- `kind` enum: `cash` | `debit` | `investment` | `credit`. Activation via `is_active` (not a separate `archived` flag).
- Credit config: `cutoff_day`, `payment_day` (both 1-28, distinct), optional `credit_limit` (> 0). Enforced by check constraints; non-credit accounts must leave these NULL.
- Descriptive metadata (migration `0003`, all nullable, no per-kind restriction): `bank`,
  `number` (masked identifier -- `chk_number_masked` rejects a full 13-19-digit PAN),
  `expiration_date` (normalized to day 1; card valid through the END of that month; UI uses MM/YY).
- Not yet in schema (deferred): `currency` (v1 is single-currency MXN) and the investment rate
  history table `account_interest_rate` (informational only; needs its own plan).

## Public interface

- Data layer: `src/data/account-write.ts` (Zod discriminated union on `kind`; create / update /
  deactivate / reactivate; app-level case-insensitive duplicate-name check). **`kind` and
  `opening_balance` are immutable after creation** -- editing either would rewrite the derived
  balance of existing ledger entries.
- Read models: `src/data/account-repo.ts` -- active/all listings and `listAccountsWithBalances`
  (derived **balance(account)** = opening_balance + Σ *cleared* signed legs, via `toSignedLegs` +
  `deriveBalance`; see `ledger`).
- Server actions: `src/app/actions/accounts.ts`. UI: `/accounts` (list split liquid vs credit,
  per-type config forms, activate/deactivate).

## Dependencies

- Consumed by `ledger` (account references), `budgets` (available balance), `catalog` (savings/target account).

## Routing notes

What a planner should read/ask before touching this module (feeds `docs-routing.md`).
Read `docs/modules/accounts.md` + `docs/database/data-dictionary.md`. Ask: which account type(s)?
Does the change touch the opening-balance or derived-balance contract (balance must stay derived,
never stored)?
