# 002. Money as integer minor units (centavos)

- Status: accepted
- Date: 2026-06-28

## Context

The app tracks financial data in MXN. Floating-point arithmetic on monetary values is notoriously
imprecise: `0.1 + 0.2 !== 0.3` in IEEE 754. Rounding errors accumulate in balance derivations and
budget comparisons. The alternative is to store money as an integer in the smallest unit (centavos,
i.e. ×100) and only convert to a decimal representation at display boundaries.

Prior decision: balances are derived (ADR-003), so no aggregation error can be hidden in a stored
total. Every summation is over integer centavos, which are exact.

## Decision

All monetary values are stored and computed as **integer centavos** (MXN).

- DB column type: `INTEGER` (never `NUMERIC`, `DECIMAL`, or `FLOAT`).
- TypeScript type: `Money = number & { readonly _brand: "Money" }` (branded to prevent accidental
  mixing with plain numbers).
- Conversion to/from pesos (`fromPesos`, `toPesos`, `format`) happens only at input/output
  boundaries via `src/domain/money.ts`.
- DB stores `ledger_entry.amount` as always-positive integer; the sign is applied in the repository
  layer based on `kind` before constructing domain `LedgerEntry` objects.

## Consequences

- **Easier**: exact integer arithmetic everywhere; no rounding surprises in balances or budget totals.
- **Harder**: display formatting requires dividing by 100; amounts entered in pesos must be
  converted at the edge (`fromPesos`).
- **Live with**: the `Money` branded type adds a small layer of ceremony (explicit `money()`
  constructor). Accepted as a worthwhile invariant.
