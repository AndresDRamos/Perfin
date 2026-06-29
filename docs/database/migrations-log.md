# Migrations Log

> Append-only. Each entry: date, what changed, and why. `docs-sync` appends; history is never rewritten.

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
