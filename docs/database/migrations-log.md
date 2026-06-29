# Migrations Log

> Append-only. Each entry: date, what changed, and why. `docs-sync` appends; history is never rewritten.

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
