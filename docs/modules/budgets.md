# Module: budgets

- Type: budgets
- Status: active   <!-- plan 0004 landed: data layer + actions + UI; migration 0002_keen_terror applied to the live DB -->

## Purpose

Optional planning layer. A **plan** holds budgets, always tied to the available balance, over
**arbitrary date ranges** (not just calendar months). Three sub-types track or reserve money.

## Key entities / tables

<!-- schema-derived: tables defined in src/data/schema/{plan,budget}.ts; migration drizzle/0002_keen_terror.sql applied to the live DB. -->

- `plan` (id, name, period_start, period_end, created_at). CHECK `chk_plan_period_order` (end >= start).
- `budget` (id, plan_id, subtype, target_amount, period_start?, period_end?, expense_category_id?, account_id?, item_name?, horizon?, created_at). Polymorphic by `subtype`; `chk_budget_subtype_fields` enforces the column matrix (fail-closed, like `chk_category_kind`). Partial unique indexes prevent a duplicate cap per category / reservation per account within a plan. `plan_id` FK is ON DELETE cascade.
- Subtypes: `category_cap` (expense_category + planned spend cap), `savings_reservation` (earmark into a destination account), `purchase_goal` (item_name + target + horizon: short/medium/long).
- **Actuals are derived from the ledger** (`budget-repo.planProgress`): cap = expenses in the category within the window (real = cleared, projected = all); reservation = transfers into the account within the window; `purchase_goal` is target-only in v1 (no derived actual). The window is the budget's own `period_*` override when set, else the plan's. `savings_reservation` does **not** move money — it only tracks the transfers the user records.

## Public interface

- **/plans is the home of the three plan types** (plan `plan-types-dashboard-neto`): the page
  lists three sections — *Presupuestos* (`plan` + `budget`), *Proyecciones de ingreso*
  (`ledger_entry` income projections, owned by the ledger module) and *Gastos fijos*
  (`fixed_expense` templates, owned by catalog) — and creation starts with a type selector
  (3 cards, mobile-first). Only *Presupuesto* creates rows in this module's tables.
- Presupuesto quality-of-life: name is optional (defaults to "Plan de {inicio} a {fin}" or
  "Plan para el {fecha}") and a "fecha única" checkbox stores `period_start = period_end`.
  Both are UI-level — `plan` gained no columns.
- Create plans & budgets; track actuals against targets.
- Binds to **projected** available for planning, **real** (cleared) available for actuals.
- Savings reservation helps set money aside from budgeted income into the designated savings account (modeled as a `transfer`).

## Dashboard surface

The dashboard (`/`, `BudgetBars`) shows the `category_cap` budgets of the plan whose period covers
today, sorted by % of real spend (desc). Tapping a category expands its period transactions and
offers capture with the category prefilled or scheduling a future `projected` expense; a light
inline "new expense category" input reuses the catalog action (full CRUD stays in `/categories`).
No current plan → CTA to `/plans`. The remaining cap also feeds the balance-timeline projection
(linear burn — see `ledger.md`).

## Dependencies

- `ledger` (actuals come from income/expense entries; reservations are transfers).
- `accounts` (available balance; savings/target account).
- `catalog` (category cap references a category; reserved `savings` category).

## Routing notes

What a planner should read/ask before touching this module (feeds `docs-routing.md`).
Read `docs/modules/budgets.md` + `docs/modules/ledger.md` + `docs/database/data-dictionary.md`.
Ask: which sub-type? Binds to real or projected available? Does it move money (transfer) or only track?
