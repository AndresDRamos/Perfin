# 003. Balances are always derived, never stored

- Status: accepted
- Date: 2026-06-28

## Context

A common pattern in finance apps is to maintain a `current_balance` column updated on every
transaction. This creates a consistency risk: if any write succeeds without updating the balance
(bug, partial failure, manual import), the stored balance silently diverges from the ledger. Fixing
it requires an audit and manual reconciliation.

The alternative is to derive the balance on read from the ledger itself. The ledger is the
authoritative source of truth; the balance is a read model computed from it.

## Decision

**No column named `balance`, `current_balance`, or similar is ever stored in any table.**

The balance of an account is always computed as:

```
balance = opening_balance + Σ(signed amount of cleared ledger_entry rows for that account)
```

- `opening_balance` in `account` captures the pre-import history; it is set once at account
  creation and never updated.
- `ledger_entry.amount` is always positive in the DB; the repository applies the sign based on
  `kind` (income → +, expense → −, transfer → ± depending on which side).
- The pure derivation lives in `src/domain/balances.ts::deriveBalance`.
- If query performance degrades as the ledger grows, the mitigation is indexes or a
  materialized view — still derived, never an authoritative mutable column.

## Consequences

- **Easier**: balances are always correct by construction; no reconciliation bug class.
- **Harder**: balance derivation requires a `SUM` aggregation query; simple "read the balance"
  is now a computed read.
- **Live with**: for a single-user personal tracker the ledger will stay small for years.
  Indexes on `(account_id, status)` make the derivation fast. Revisit with a materialized
  read model only if measured queries become slow.
