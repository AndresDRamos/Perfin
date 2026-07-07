# Module: catalog

- Type: catalog
- Status: active (0008 — fixed expenses + recurrence engine landed)

## Purpose

Supporting catalogs: **categories** (separate for income vs expense, including a reserved `savings`
category) and **fixed expenses** (recurring monthly transactions carrying a subtype).

## Key entities / tables

<!-- schema-derived: generated from live schema as of 0001_loving_jubilee (2026-06-29) -->

**`income_category`**

| Column | Type | Nullable | Default | Notes |
| --- | --- | --- | --- | --- |
| `id` | integer | NO | identity | `GENERATED ALWAYS AS IDENTITY`. |
| `name` | varchar(100) | NO | | Case-insensitive unique (`lower(name)`). |
| `description` | varchar(300) | YES | | |
| `is_active` | boolean | NO | `true` | Partial index on active rows. |
| `created_at` | timestamptz | NO | `now()` | |

**`expense_category`**

| Column | Type | Nullable | Default | Notes |
| --- | --- | --- | --- | --- |
| `id` | integer | NO | identity | `GENERATED ALWAYS AS IDENTITY`. |
| `name` | varchar(100) | NO | | Case-insensitive unique (`lower(name)`). |
| `description` | varchar(300) | YES | | |
| `is_savings` | boolean | NO | `false` | At most one row may be `true` (singleton partial unique index). Reserved "Ahorro" row seeded. |
| `is_fixed` | boolean | NO | `false` | Eligible for fixed-expense templates (0008). NOT a singleton; seeds "Servicios"/"Subscripciones" (editable, not reserved). CHECK `chk_expense_category_savings_fixed_excl` (never savings AND fixed). |
| `is_active` | boolean | NO | `true` | Partial index on active rows. |
| `created_at` | timestamptz | NO | `now()` | |

**`fixed_expense`** (live as of `0008_shallow_ricochet` — monthly recurring-expense template)

| Column | Type | Nullable | Default | Notes |
| --- | --- | --- | --- | --- |
| `id` | integer | NO | identity | |
| `user_id` | uuid | NO | | FK `auth.users` ON DELETE CASCADE (planning metadata, like `plan`). |
| `name` | varchar(100) | NO | | Becomes the materialized entry's `concept`. |
| `amount` | integer | NO | | Centavos, > 0. |
| `account_id` | integer | NO | | FK `account` ON DELETE RESTRICT; any kind (credit charges become card debt via the normal ledger flow). |
| `expense_category_id` | integer | NO | | FK `expense_category` ON DELETE RESTRICT. Must be `is_fixed` + active — **app-layer rule** (`fixed-expense-write.ts`), no cross-table CHECK. |
| `day_of_month` | integer | NO | | 1..31; the engine clamps to month end (Feb → 28/29). |
| `start_date` / `end_date` | date | NO / YES | | Validity window; `end_date` NULL = open-ended. |
| `is_active` | boolean | NO | `true` | Paused templates don't materialize; existing entries survive. |

- **Recurrence engine** (`src/domain/recurrence.ts` + `materializeDueFixedExpenses` in
  `src/data/fixed-expense-repo.ts`): lazy, invoked at the top of `getDashboard` and the /plans
  load. Each due occurrence inserts a `ledger_entry` kind=`expense` **status=`cleared`** dated on
  its scheduled (clamped) day. Idempotent via the partial unique
  `uq_ledger_entry_fixed_expense_month` + `ON CONFLICT DO NOTHING`; a multi-month catch-up
  inserts only the missing months. Deleting a template SET-NULLs the link, never the entries.

## Public interface

- CRUD for income/expense categories (name, description, easy config).
- CRUD for fixed expenses (`fixed-expense-write.ts` + actions in
  `src/app/actions/fixed-expenses.ts`; UI lives in /plans, section "Gastos fijos").
- Spend by fixed category comes from the normal category totals ("Servicios" vs
  "Subscripciones" are plain categories flagged `is_fixed`, not a subtype enum).

## Dependencies

- Consumed by `ledger` (categories tag income/expense; recurrence creates transactions).
- `budgets` (category cap references a category; reserved savings category).
- `accounts` (savings target account; fixed-expense target account).

## Routing notes

What a planner should read/ask before touching this module (feeds `docs-routing.md`).
Read `docs/modules/catalog.md` + `docs/database/data-dictionary.md`. Ask: income or expense catalog?
Does it touch the reserved `savings` category or the fixed-expense recurrence engine?
