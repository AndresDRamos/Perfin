# Module: budgets

- Type: budgets
- Status: planned

## Purpose

Optional planning layer. A **plan** holds budgets, always tied to the available balance, over
**arbitrary date ranges** (not just calendar months). Three sub-types track or reserve money.

## Key entities / tables

<!-- schema-derived: none of these tables exist in the live schema yet (as of 0000_strong_smasher); design below is planned. -->

- `plan` (id, name, period_start, period_end).
- `budget` (id, plan_id, subtype, target_amount, period_start, period_end, category_id?, account_id?, horizon?).
- Subtypes: `category_cap` (category + planned spend), `savings_reservation` (earmark into savings account), `purchase_goal` (item + target + horizon: short/medium/long).

## Public interface

- Create plans & budgets; track actuals against targets.
- Binds to **projected** available for planning, **real** (cleared) available for actuals.
- Savings reservation helps set money aside from budgeted income into the designated savings account (modeled as a `transfer`).

## Dependencies

- `ledger` (actuals come from income/expense entries; reservations are transfers).
- `accounts` (available balance; savings/target account).
- `catalog` (category cap references a category; reserved `savings` category).

## Routing notes

What a planner should read/ask before touching this module (feeds `doc-routing.md`).
Read `docs/modules/budgets.md` + `docs/modules/ledger.md` + `docs/database/data-dictionary.md`.
Ask: which sub-type? Binds to real or projected available? Does it move money (transfer) or only track?
