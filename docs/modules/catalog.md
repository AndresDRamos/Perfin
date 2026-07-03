# Module: catalog

- Type: catalog
- Status: building (0003 — categories + ledger link)

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
| `is_active` | boolean | NO | `true` | Partial index on active rows. |
| `created_at` | timestamptz | NO | `now()` | |

- `fixed_expense` — not yet in the live schema; design is planned (see module purpose above).

## Public interface

- CRUD for income/expense categories (name, description, easy config).
- CRUD for fixed expenses; the recurrence engine generates (or prompts) the monthly `transaction`.
- Breakdown of spend by fixed-expense subtype (subscription vs service).

## Dependencies

- Consumed by `ledger` (categories tag income/expense; recurrence creates transactions).
- `budgets` (category cap references a category; reserved savings category).
- `accounts` (savings target account; fixed-expense target account).

## Routing notes

What a planner should read/ask before touching this module (feeds `docs-routing.md`).
Read `docs/modules/catalog.md` + `docs/database/data-dictionary.md`. Ask: income or expense catalog?
Does it touch the reserved `savings` category or the fixed-expense recurrence engine?
