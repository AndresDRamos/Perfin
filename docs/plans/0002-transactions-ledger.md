# 0002 - Transactions ledger (capture + derived reads)

- Status: active
- Date: 2026-06-29
- Mode: Architecture   <!-- Reversibility x Density -->

## Goal
Build the ledger application layer on top of the existing domain and schema: capture/edit/reconcile
`ledger_entry` rows (income/expense/transfer; projected/cleared) and expose the derived reads
(per-account balance, available real vs projected, credit debt and due date). Fast capture is the
top priority.

## Affected modules
- `ledger` (primary): repository, validation, server actions.
- `accounts` (read-only): `opening_balance` + `kind` consumed for balance derivation.
- `src/data/*` (new): repositories and read models.
- `src/domain/*`: no logic changes; at most share/move types.
- `src/app/*`: minimal fast-capture form + dashboard reads.

## Current state (do NOT rebuild)
- **Pure domain + tests**: `deriveBalance`, `realAvailable`, `projectedAvailable`,
  `currentStatementOwed`, `nextDueDate`. They operate on `Money` with **signed** amounts.
- **Live schema** (`0000_strong_smasher`): `account`, `ledger_entry` with all checks and indexes.
- **Gap**: nothing reads `ledger_entry` or maps the row (amount **always positive** + `kind`) into the
  domain's **signed** legs. That bridge is described in comments but unimplemented.

## Central contract to fix (the irreversible part)
The DB-row → signed-per-account-legs mapping, as the **single source of truth for sign**:
- `income` → `+amount` on `account_id`.
- `expense` → `-amount` on `account_id`.
- `transfer` → **two legs**: `-amount` on `account_id` and `+amount` on `to_account_id`.

With this, the existing domain needs no changes: a transfer between liquid accounts nets to zero in
`realAvailable`; a transfer into a credit account reduces liquid (a payment) and is not subtracted as
debt. Isolated in a pure `toSignedLegs(row)` function, testable without a DB.

## DB impact
**None (no DDL).** Reuses existing tables and indexes; per-account/status aggregations hit
`idx_ledger_entry_account_status` and the credit window hits `idx_ledger_entry_occurred_at`. The
`dba` subagent was **not** invoked because the schema is untouched. Scope decision: the category
links (`income_category_id` / `expense_category_id`) are **deferred to `catalog`** (the target table
does not exist yet); see Risks.

## Steps
1. **Pure mapper** `src/data/ledger-mapping.ts`: `toSignedLegs(row) -> { accountId, entry }[]`
   (1 leg for income/expense, 2 for transfer). Plus unit tests with no DB.
2. **Read repository** `src/data/ledger-repo.ts`: fetch entries per account, assemble
   `AccountForAvailable[]` and `CreditLedgerEntry[]`; expose `balanceOf(accountId)`,
   `availableReal()`, `availableProjected()`, `creditStatus(accountId)` wiring the domain.
3. **Write path**: per-kind Zod schemas (amount > 0; transfer requires a distinct `to_account_id`;
   income/expense forbid it — mirrors the DB checks for UX); `createEntry`, `updateEntry`, and
   `reconcile` (projected->cleared, bumps `updated_at`).
4. **Server actions** (App Router) exposing capture and the dashboard reads.
5. **Minimal UI**: fast-capture form + dashboard (balances, available real/projected, next credit due
   date). Candidate to split into its own plan/commit.
6. **Tests / guards** (see below).

## Risks
- **Transfer double leg**: if read-model assembly forgets to inject the `+` leg on the destination
  account, balances drift silently. Mitigation: single pure mapper + cross-netting test.
- **Deferred categories**: income/expense are captured with `concept` but **without a category**
  until `catalog` exists; budgets will be blocked by that dependency. Confirmed acceptable for this
  iteration.
- **Credit**: `currentStatementOwed` assumes pay-in-full (v1); a credit account's `opening_balance`
  must enter the calculation with the correct sign.
- **Reconciliation idempotency**: reconciling twice must not duplicate effects (it is a `status`
  change, not an insert).

## Tests / guards
- `toSignedLegs`: income/expense/transfer -> correct legs.
- Netting: liquid->liquid transfer = 0 in `realAvailable`; liquid->credit reduces liquid and adds no
  debt to available.
- Zod rejects self-transfer, amount <= 0, and `to_account_id` on a non-transfer.
- `reconcile`: projected->cleared moves the amount into the real balance and bumps `updated_at`.

## Rollback
All new, additive code with no migration. Rollback = revert the commits; schema and data are
untouched.
