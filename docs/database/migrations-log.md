# Migrations Log

> Append-only. Each entry: date, what changed, and why. `docs-sync` appends; history is never rewritten.

## 2026-06-29 — `0002_keen_terror` (budgets: plan + budget)

- Created enums `budget_subtype` (category_cap, savings_reservation, purchase_goal) and
  `purchase_horizon` (short, medium, long).
- Created table `plan` with identity PK, `name` (varchar 100, NOT NULL), `period_start` (date,
  NOT NULL), `period_end` (date, NOT NULL), `created_at`. Check constraint `chk_plan_period_order`
  enforces `period_end >= period_start`.
- Created table `budget` with identity PK, `plan_id` (NOT NULL), `subtype` (NOT NULL),
  `target_amount` (integer, NOT NULL), optional `period_start`/`period_end` (date) window override,
  `expense_category_id`, `account_id`, `item_name` (varchar 100), `horizon`, and `created_at`.
- Added FK `budget_plan_id_plan_id_fk` → `plan(id)` ON DELETE cascade; FKs
  `budget_expense_category_id_expense_category_id_fk` → `expense_category(id)` and
  `budget_account_id_account_id_fk` → `account(id)`, both ON DELETE no action ON UPDATE no action.
- Added check constraints: `chk_budget_target_positive` (`target_amount > 0`);
  `chk_budget_period_pair` (period columns both NULL, or both set with `period_end >= period_start`);
  `chk_budget_subtype_fields` enforcing the polymorphic column matrix per subtype (fail-closed).
- Added indexes `idx_budget_plan_id`, partial `idx_budget_expense_category` and `idx_budget_account`
  (WHERE NOT NULL), and partial unique indexes `budget_cap_category_uq` on (`plan_id`,
  `expense_category_id`) WHERE `subtype = 'category_cap'` and `budget_reservation_account_uq` on
  (`plan_id`, `account_id`) WHERE `subtype = 'savings_reservation'`.

## 2026-06-29 — `0001_loving_jubilee` (catalog categories + ledger links)

- Created table `expense_category` with identity PK, `name` (varchar 100, NOT NULL), `description`
  (varchar 300, nullable), `is_savings` (boolean, default false), `is_active` (boolean, default
  true), `created_at`. Case-insensitive unique name enforced via `expense_category_name_lower_uq`
  (`lower(name)`). Singleton partial unique index `expense_category_savings_singleton` ensures at
  most one row has `is_savings = true`. Partial index `idx_expense_category_is_active` on active
  rows. Seeded with one reserved row (`name = 'Ahorro'`, `is_savings = true`).
- Created table `income_category` with identity PK, `name` (varchar 100, NOT NULL), `description`
  (varchar 300, nullable), `is_active` (boolean, default true), `created_at`. Case-insensitive
  unique name via `income_category_name_lower_uq` (`lower(name)`). Partial index
  `idx_income_category_is_active` on active rows.
- Added columns `income_category_id` (integer, nullable) and `expense_category_id` (integer,
  nullable) to `ledger_entry`.
- Added FK `ledger_entry_income_category_id_income_category_id_fk` → `income_category(id)` and
  FK `ledger_entry_expense_category_id_expense_category_id_fk` → `expense_category(id)`, both
  ON DELETE no action ON UPDATE no action.
- Added partial indexes `idx_ledger_entry_income_category` and `idx_ledger_entry_expense_category`
  on their respective columns WHERE NOT NULL.
- Added check constraint `chk_category_kind`: income entries must have `expense_category_id` NULL;
  expense entries must have `income_category_id` NULL; transfer entries must have both NULL.

## 2026-06-29 — `0000_strong_smasher` (initial schema)

First migration applied; baseline of the live `public` schema.

- Created enums `account_kind` (cash, debit, investment, credit), `ledger_entry_kind`
  (income, expense, transfer), and `ledger_entry_status` (cleared, projected).
- Created table `account` with identity PK, `name`, `kind`, `opening_balance`, credit fields
  (`cutoff_day`, `payment_day`, `credit_limit`), `is_active`, `created_at`. Check constraints
  enforce credit-only fields, day ranges (1-28), `cutoff_day <> payment_day`, and positive
  `credit_limit`. Partial index `idx_account_is_active` on active rows.
- Created table `ledger_entry` with identity PK, `kind`, `status`, `amount`, `concept`,
  `occurred_at`, `created_at`, `updated_at`, `account_id`, `to_account_id`. Check constraints
  enforce positive `amount`, transfer-only `to_account_id`, and no self-transfer.
- Foreign keys `account_id` and `to_account_id` reference `account(id)` (no action on
  delete/update). Indexes `idx_ledger_entry_account_status`, `idx_ledger_entry_occurred_at`, and
  partial `idx_ledger_entry_to_account`.
