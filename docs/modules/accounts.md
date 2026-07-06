# Module: accounts

- Type: accounts
- Status: built

## Purpose

Register and manage the user's accounts across 4 types -- **cash**, **debit**, **credit**,
**investment** -- including per-type configuration and the opening balance that seeds the derived
ledger balance. Onboarding (`/onboarding`) and the dashboard consume the shared branding map
(`icon`/color per kind) documented in `branding` below.

## Key entities / tables

<!-- schema-derived: kept in sync with docs/database/data-dictionary.md (live schema) -->

- `account` (id, name, kind, opening_balance, cutoff_day?, payment_day?, credit_limit?, bank?,
  number?, expiration_date?, is_active, created_at). Live in schema as of `0003_mighty_young_avengers`.
- `kind` enum: `cash` | `debit` | `investment` | `credit`. Activation via `is_active` (not a separate `archived` flag).
- Credit config: `cutoff_day`, `payment_day` (both 1-28, distinct), optional `credit_limit` (> 0). Enforced by check constraints; non-credit accounts must leave these NULL.
- Descriptive metadata (migration `0003`): `bank`, `number` (masked identifier --
  `chk_number_masked` rejects a full 13-19-digit PAN), `expiration_date` (normalized to day 1;
  card valid through the END of that month; UI uses MM/YY). **`cash` is a physical account, never
  a bank product** (ADR-009): `chk_cash_no_bank_fields` (migration `0007`) forces all three to
  NULL when `kind = 'cash'`; `debit`/`investment` still carry `bank` freely.
- Not yet in schema (deferred): `currency` (v1 is single-currency MXN) and the investment rate
  history table `account_interest_rate` (informational only; needs its own plan).

## Public interface

- Data layer: `src/data/account-write.ts` (Zod discriminated union on `kind`; create / update /
  deactivate / reactivate; app-level case-insensitive duplicate-name check). **`kind` and
  `opening_balance` are immutable after creation** -- editing either would rewrite the derived
  balance of existing ledger entries. The `cash` branch of the union has no
  `bank`/`number`/`expirationMonth` fields at all (ADR-009); `updateAccount` also rejects those
  fields at runtime for an existing `cash` account, mirroring the DB CHECK.
- Read models: `src/data/account-repo.ts` -- active/all listings and `listAccountsWithBalances`
  (derived **balance(account)** = opening_balance + Σ *cleared* signed legs, via `toSignedLegs` +
  `deriveBalance`; see `ledger`).
- Server actions: `src/app/actions/accounts.ts`. UI: `/accounts` (list split liquid vs credit,
  per-type config forms, activate/deactivate; type chip uses the branding icon/color).
- **Onboarding** (`/onboarding`, `src/app/onboarding/`): 3-step guided flow (cash -> bank accounts
  -> summary) for a brand-new user, calling the same `createAccountAction` as `/accounts`. `/`
  redirects here when the signed-in user has 0 active accounts.
- **Dashboard** (`/`, `src/app/page.tsx`): "Patrimonio por tipo" groups the real (cleared-only)
  balance by `kind` for the liquid kinds (`cash`/`debit`/`investment`) via
  `listAccountsWithBalances`; credit cards render with the same icon/color as their chip.

## Branding

`src/lib/branding/account-kind.ts` -- `ACCOUNT_KIND_META`, the single source of truth for the
kind -> `{label, icon (Iconify mdi:*), textLight/textDark, bgSoft, barClass}` mapping consumed by
`/accounts`, `/onboarding` and `/`. Colors are drawn from the brand token scale in
`src/app/globals.css` (`@theme`, Tailwind v4 CSS-first) -- see
`docs/plans/onboarding-dashboard-branding.md` for the derivation and WCAG contrast table. Fixed
mapping, no per-account override exists (confirmed with the `dba` review: purely a design
decision, not data). `barClass` must stay a literal Tailwind class string (e.g. `"bg-primary-500"`)
-- Tailwind's build-time scanner cannot see runtime-computed class names.

## Dependencies

- Consumed by `ledger` (account references), `budgets` (available balance), `catalog` (savings/target account).

## Routing notes

What a planner should read/ask before touching this module (feeds `docs-routing.md`).
Read `docs/modules/accounts.md` + `docs/database/data-dictionary.md`. Ask: which account type(s)?
Does the change touch the opening-balance or derived-balance contract (balance must stay derived,
never stored)? Does it touch the `cash`-has-no-bank-fields invariant (ADR-009) or the branding
icon/color map?
