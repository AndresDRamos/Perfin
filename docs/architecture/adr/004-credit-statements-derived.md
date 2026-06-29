# 004. Credit card statements and dues are derived from transaction dates

- Status: accepted
- Date: 2026-06-28

## Context

Credit card billing has a periodic structure: a "cutoff date" closes each billing period and a
"payment due date" follows. A naïve approach stores a `statement` record each month with the period
total. This means running a background job to generate statements, handling edge cases (missed cutoff,
transactions added retroactively), and a growing table of historical records.

The alternative treats the credit card account as a ledger segment: the statement balance is derived
by summing cleared transactions within the window `[previous_cutoff + 1 day, current_cutoff]`.
The window is computed from two account-level integers (`cutoff_day`, `payment_day`) and the
current date.

## Decision

**No `statement` table. Credit statement balances and due dates are derived at read time.**

- `account.cutoff_day` (1–28) and `account.payment_day` (1–28) are the only stored credit config.
  Both are enforced to be present for `kind = 'credit'` accounts and absent for all others
  (DB CHECK constraint).
- `src/domain/credit.ts` provides `currentStatementPeriod(asOf, config)` and
  `currentStatementOwed(entries, config, openingBalance, asOf)` as pure functions.
- v1 assumption: **pay-in-full** each cycle. No revolving interest computation.
- Credit debt is surfaced as a separate liability by due date; it is **not subtracted** from
  the available balance (see STATE.md active logic).

## Consequences

- **Easier**: no background jobs, no statement migration, no reconciliation of stored statement
  totals vs ledger entries.
- **Harder**: showing multiple past statements requires iterating the cutoff window backward;
  slightly more computation but trivially fast for a personal-scale ledger.
- **Live with**: if the user ever needs interest computation or installment splits, this model
  needs extension (a new table or derivation rule). Revisit when/if revolving credit is required.
