# Migrations Log

> Append-only. Each entry: date, what changed, and why. `docs-sync` appends; history is never rewritten.

## 2026-07-04 — `0004_marvelous_tigra` (auth + spaces: user identity and visibility overlay)

- Declared external `auth.users` (Supabase-managed, `pgSchema("auth")`) purely so `public` tables
  can FK to it; `drizzle-kit` never manages it (`schemaFilter: ["public"]` in `drizzle.config.ts`).
  Generation gotcha: `db:generate` still emitted `CREATE SCHEMA "auth"` / `CREATE TABLE
  "auth"."users"`; removed by hand from the applied SQL (kept only in the snapshot to resolve FKs).
- Created table `profile`: PK `user_id uuid` → FK `auth.users(id)` ON DELETE CASCADE (1:1 with the
  auth user); `username` varchar(30) NOT NULL with `chk_username_format`
  (`^[a-z0-9_]{3,30}$`) and case-insensitive unique index; `display_name` varchar(100) NOT NULL;
  `login_email` varchar(255) NOT NULL, case-insensitive unique (mirror of `auth.users.email`, used
  for `signInWithPassword`; synthetic `<username>@users.perfin.internal` when no real email was
  given); `has_real_email` boolean NOT NULL default false; `created_at`/`updated_at`.
- Created table `space`: identity PK; `name` varchar(100) NOT NULL; `created_by uuid` **nullable**
  → FK `auth.users` ON DELETE SET NULL (informational metadata only — doesn't block deleting the
  creator). A space is a visibility overlay over accounts, never their owner.
- Created enum `space_role` (`owner`, `member`) and table `space_member`: composite PK
  (`space_id`, `user_id`), both FKs ON DELETE CASCADE; `role` NOT NULL default `member`; index
  `idx_space_member_user_id` (membership lookups by user).
- Created table `space_account`: composite PK (`space_id`, `account_id`), both FKs ON DELETE
  CASCADE; `shared_by uuid` NOT NULL → FK `auth.users`; `shared_at` timestamptz; index
  `idx_space_account_account_id`.
- Added `account.user_id uuid NOT NULL` → FK `auth.users(id)` ON DELETE RESTRICT (owner, immutable
  after creation — enforced in `account-write`, not by trigger); index `idx_account_user_id`.
- Added `plan.user_id uuid NOT NULL` → FK `auth.users(id)` ON DELETE CASCADE (plans are
  disposable); index `idx_plan_user_id`.
- Added `ledger_entry.user_id uuid NOT NULL` → FK `auth.users(id)` ON DELETE RESTRICT
  (denormalized from `account.user_id`, copied at write time by `ledger-write`); dropped index
  `idx_ledger_entry_account_status`, replaced by `idx_ledger_entry_user_account_status`
  (`user_id`, `account_id`, `status`); added `idx_ledger_entry_user_occurred_at`
  (`user_id`, `occurred_at`).
- RLS: `ENABLE ROW LEVEL SECURITY` on all 10 `public` tables (codifies what was already toggled on
  the 6 pre-existing tables outside of migrations, via the Supabase dashboard, with zero policies —
  see below) + one policy per table, `<table>_select_mcp_readonly FOR SELECT USING (true)` scoped
  to `pgRole("mcp_readonly").existing()` (`src/data/schema/roles.ts`), plus a hand-added
  `GRANT SELECT ... TO mcp_readonly` on the 4 new tables (drizzle-kit does not manage grants). No
  per-user policies yet; isolation stays in the server-action/repo layer.
  Verified live: `pg_class.relrowsecurity = true` and a `mcp_readonly`-scoped SELECT policy exist
  on all 10 tables (`account`, `budget`, `expense_category`, `income_category`, `ledger_entry`,
  `plan`, `profile`, `space`, `space_account`, `space_member`); `information_schema.role_table_grants`
  confirms the SELECT grant on all 10 for `mcp_readonly`.
- Why: plan `auth-spaces` — Supabase Auth (login by username or email) + shared-space data model
  (a space is a visibility overlay over accounts, never their owner). Domain tables
  (`account`, `plan`, `budget`, `ledger_entry`) remain empty in dev post-migration — a test user
  ("ana_ramos") signed up but has not yet created any account or transaction; this is real data
  state, not an RLS-induced false negative (confirmed via direct row counts plus `pg_policies`).
- Gotcha discovered during rollout (recorded for future migrations): RLS enabled with zero
  policies makes every table look empty to any non-owner role, including `mcp_readonly` — always
  check `pg_policy`/`pg_policies` (and the grant) before reporting a table as empty in dev.

## 2026-07-03 — `0003_mighty_young_avengers` (accounts: descriptive metadata)

- Added column `account.bank` (varchar 100, nullable) — institution name, informative only.
- Added column `account.number` (varchar 30, nullable) — masked identifier; NEVER a full PAN.
- Added column `account.expiration_date` (date, nullable) — card expiry normalized to day 1 of the
  month; the card is valid through the LAST day of that month. UI captures/displays MM/YY.
- Added check constraint `chk_number_masked` — `number IS NULL OR number !~ '^[0-9]{13,19}$'`,
  rejecting full card numbers.
- Why: plan 0005-accounts-module — CRUD for the accounts module; optional descriptive fields.
  `currency` and `account_interest_rate` explicitly deferred.

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
