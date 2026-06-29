# Module: catalog

- Type: catalog
- Status: planned

## Purpose

Supporting catalogs: **categories** (separate for income vs expense, including a reserved `savings`
category) and **fixed expenses** (recurring monthly transactions carrying a subtype).

## Key entities / tables

<!-- schema-derived: none of these tables exist in the live schema yet (as of 0000_strong_smasher); design below is planned. -->

- `income_category` / `expense_category` (id, name, description). One reserved `savings` category used in budgeting that accumulates into a designated savings account.
- `fixed_expense` (id, name, amount, subtype, recurrence, next_due, target_account_id, expense_category_id?). Subtype: `subscription` | `service`.

## Public interface

- CRUD for income/expense categories (name, description, easy config).
- CRUD for fixed expenses; the recurrence engine generates (or prompts) the monthly `transaction`.
- Breakdown of spend by fixed-expense subtype (subscription vs service).

## Dependencies

- Consumed by `ledger` (categories tag income/expense; recurrence creates transactions).
- `budgets` (category cap references a category; reserved savings category).
- `accounts` (savings target account; fixed-expense target account).

## Routing notes

What a planner should read/ask before touching this module (feeds `doc-routing.md`).
Read `docs/modules/catalog.md` + `docs/database/data-dictionary.md`. Ask: income or expense catalog?
Does it touch the reserved `savings` category or the fixed-expense recurrence engine?
