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
- **Onboarding** (`/onboarding`, `src/app/onboarding/`): 5-step guided flow (cash -> bank accounts
  -> salary/nómina -> fixed expenses -> summary) for a brand-new user (plan
  `design-system-mobile-kit`). Steps 1-2 call the same `createAccountAction` as `/accounts`; step 3
  creates an `income_schedule` (`createIncomeScheduleAction`, frequency chips semanal/catorcenal/
  quincenal/mensual -> weekly/biweekly/semimonthly/monthly, anchor = "fecha de tu próximo pago");
  step 4 creates `fixed_expense` templates (tipo Servicio/Suscripción resuelve la categoría seed
  "Servicios"/"Subscripciones" por nombre). `/` redirects here when the signed-in user has 0
  active accounts.
- **Dashboard** (`/`, `src/app/page.tsx` + `src/app/components/dashboard/`): estructura del design
  system (plan `design-system-mobile-kit`): "Saldo actual" (StatDisplay display 34px) → timeline →
  sección **Cuentas** con `ExpandableRow` por cuenta (últimas 3 transacciones + acciones editar/
  nueva transacción/ver transacciones) → sección **Presupuestos** (barras expandibles del plan
  vigente). "Ver transacciones" abre `TransactionsView` (container-transform del encabezado de la
  fila + filtros: búsqueda difusa, badge cruzado, fecha con `MiniCalendar`, rango de montos). La
  captura contextual vive en `NewTransactionModal` (morph circular→modal; en crédito el ingreso es
  Pago = transferencia con atajo liquidar; en inversión hay tab Ajustar); alta/edición de cuentas
  en `NewAccountModal` y topes en `NewBudgetModal`, todos sobre el shell `MorphModal`.
  `getDashboardV2` además expone `entriesByAccount`/`entriesByCategory` (historial completo,
  transferencias en ambas cuentas).

## Branding

Tokens del proyecto claude.ai/design "Perfin Design System" (plan `design-system-mobile-kit`):
neutrales charcoal fríos (`neutral-*`; la escala `secondary-*` quedó como alias de compat),
verde de marca y acentos mustard/purple/indigo intactos, semánticos
`surface/surface-muted/surface-raised/border/text/text-muted/accent/accent-strong/accent-soft/
negative` (light + dark vía `prefers-color-scheme` y `[data-theme]`), tipografía **Manrope**
400/500 (next/font, `--font-manrope`) con escala de 4 roles (caption 13 / body 16 / heading 20 /
display 34 como utilidades `text-*`), radios sm 6 / md 12 / lg 16, `--control-h`/`--tap-target`
44px. Alias planos (`--surface`, `--text`, …) en `:root` para los estilos inline portados del kit.
Marca: escudo verde + palomita ("shield-check", `src/app/components/Logo.tsx` + `src/app/icon.svg`).

`src/lib/branding/account-kind.ts` -- `ACCOUNT_KIND_META`, the single source of truth for the
kind -> `{label, icon (Iconify mdi:*), textLight/textDark, bgSoft, barClass}` mapping consumed by
`/accounts`, `/onboarding` and `/`; `KIND_ACCENT` (`src/app/components/ui/kit.ts`) lo traduce al
acento del kit (cash=green, debit=indigo, investment=purple, credit=mustard) para `IconBadge`
(círculo `-100` + glifo `-700`, mismo tratamiento en light y dark). Fixed mapping, no per-account
override exists (confirmed with the `dba` review: purely a design decision, not data). `barClass`
must stay a literal Tailwind class string (e.g. `"bg-primary-500"`) -- Tailwind's build-time
scanner cannot see runtime-computed class names.

## Dependencies

- Consumed by `ledger` (account references), `budgets` (available balance), `catalog` (savings/target account).

## Routing notes

What a planner should read/ask before touching this module (feeds `docs-routing.md`).
Read `docs/modules/accounts.md` + `docs/database/data-dictionary.md`. Ask: which account type(s)?
Does the change touch the opening-balance or derived-balance contract (balance must stay derived,
never stored)? Does it touch the `cash`-has-no-bank-fields invariant (ADR-009) or the branding
icon/color map?
