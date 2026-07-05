# STATE

Active context of the repo. Curated by `/commit-plan`. Keep it short: only what is *active*.

## Active milestones

- **Bootstrap** (`0001-bootstrap`, complete) -- scaffold landed. Next.js (App Router) + TypeScript +
  Drizzle/Postgres(Supabase). `domain/` layer (money, balances, available, credit) with unit tests in
  place; ADRs 001-005 recorded. Initial migration `0000` applied -- live schema is `account` +
  single-table `ledger_entry`.
- **Transactions ledger** (`0002-transactions-ledger`, complete) -- full data layer landed: signed-leg
  mapper (`ledger-mapping`), Zod write path + `createEntry`/`updateEntry`/`reconcile`
  (`ledger-write`), read repository (`ledger-repo`), server actions (`captureEntry`, `editEntry`,
  `reconcileEntry`, `getDashboard`), and minimal UI (fast-capture form + dashboard with real/projected
  available and credit cards). No DDL changes.
- **Catalog: categories** (`0003-catalog-categories`, complete) -- `income_category` /
  `expense_category` tables live (migration `0001_loving_jubilee` applied). Reserved `savings`
  category seeded (`is_savings = true`, singleton partial index). `ledger_entry` linked via nullable
  FK pair + `chk_category_kind` check. Data layer: `category-write` (Zod CRUD + soft-delete + dupe
  check), `category-repo` (list active/all). Ledger write path extended to accept `categoryId`.
  Server actions for category CRUD. UI: category select in `CaptureForm` (hidden for transfers),
  `/categories` management page.
- **Budgets** (`0004-budgets`, complete) -- planning layer landed: `plan` + polymorphic `budget`
  tables (migration `0002_keen_terror` applied), subtypes `category_cap` / `savings_reservation` /
  `purchase_goal` enforced by `chk_budget_subtype_fields` (fail-closed) with partial unique
  anti-duplicate indexes. Data layer (`budget-write` Zod discriminated union + dupe checks,
  `budget-repo.planProgress` for derived actuals), server actions, and UI (`/plans` pages + budget
  manager). Budgets **do not move money** -- actuals are derived from the ledger.
- **Accounts module** (`0005-accounts-module`, complete) -- CRUD de cuentas + UI `/accounts` con
  balance derivado; migración `0003_mighty_young_avengers` aplicada (bank, number enmascarado +
  `chk_number_masked`, expiration_date día-1, vigente hasta fin de mes). `kind` y `opening_balance`
  inmutables tras creación. Diferidos a plan propio: `currency` (v1 mono-moneda MXN) y
  `account_interest_rate`. De paso: lint reparado (Next 16 flat config), pool de `db.ts` acotado
  con singleton dev, journal drizzle re-sincronizado, migraciones vía pooler en `.env`.
- **Auth + spaces** (`auth-spaces`, built, pending verify) -- Supabase Auth como motor (ADR-006);
  login por username o correo resuelto server-side a `login_email` (sintético si el usuario no dio
  correo). Migración `0004_marvelous_tigra` aplicada: tabla `profile`; `account`/`plan`/
  `ledger_entry` ganan `user_id` (denormalizado en `ledger_entry`, inmutable en `account` por
  convención de app); esquema de espacios compartidos (`space`, `space_member`, `space_account`,
  ADR-007) vive en DB pero **sin capa de aplicación todavía** -- ver "Fuera de alcance" en
  `docs/plans/auth-spaces.md`. RLS habilitado en las 10 tablas de `public` (hallazgo: ya estaba
  activo desde el dashboard de Supabase con 0 policies, lo que dejaba ciego al MCP `db`); cada
  tabla ahora declara `pgPolicy` de solo-lectura para `mcp_readonly`. Categorías siguen siendo
  catálogo global (sin `user_id`). Flujo verificado manualmente: registro sin correo, login por
  username, ruta protegida.
- **Next**: fixed expenses (`fixed_expense` table + recurrence engine) via `/plan-module` or
  `/ship-module`. También pendientes (fuera de este plan): gestión de espacios (crear/invitar/
  exponer cuentas), onboarding wizard de alta de cuentas, dashboard visual del patrimonio, marca de
  cuenta de nómina + proyección de próximo ingreso (ver visión en memoria del usuario).

## Active risks

- Derived-balance queries may slow as the ledger grows -- mitigate with indexes / materialized read
  models *only if needed* (always derived, never authoritative state).
- Date/timezone handling for cutoff/payment-day derivation -- `occurred_at` stored explicitly; fix a
  single TZ for v1.
- **Deferred fixed expenses**: `fixed_expense` table and recurrence engine not yet built; catalog
  module is still `building` until that lands.
- **Savings tracking is manual**: `savings_reservation` budgets only track transfers the user
  records into the destination account; there is no automatic money movement or enforcement.
- **RLS habilitado pero sin policies por usuario**: el aislamiento real entre usuarios vive en la
  capa de server actions/repos (`WHERE user_id = session.userId` explícito), no en Postgres. La
  app conecta con credenciales de servicio fijas vía el pooler, así que `auth.uid()` no se puede
  usar sin propagar el JWT por transacción (`SET LOCAL`) -- trabajo de infraestructura diferido a
  un plan futuro de "RLS como defensa en profundidad". Cualquier query de dominio nueva debe
  filtrar por `user_id` explícitamente o queda expuesta entre usuarios.
- **Espacios sin capa de aplicación**: las tablas `space`/`space_member`/`space_account` existen
  en DB (ADR-007) pero no hay `space-write.ts`/`space-repo.ts` ni UI -- los invariantes ("al menos
  un owner", "cuenta expuesta solo si el dueño es miembro") no están enforced todavía en ningún
  lado.

## Active logic

- Single user, single currency (**MXN**) for v1. Simplest model that stays correct (not double-entry).
- Balances are **derived from the ledger** (per-account opening balance + sum of transactions); never a stored mutable field.
- **Available** = liquid *cleared* balances (cash + debit + investment). Credit debt is a separate liability surfaced by payment date; **not** subtracted from available.
- Two readings of available: *real* (cleared only) vs *projected* (incl. `projected` income).
- Ledger is a **single `ledger_entry` table**. Kinds: `income` / `expense` count toward categories & budgets; `transfer` is **excluded** from those totals. `amount` is stored as a **positive** integer (centavos); direction is set by kind (repositories translate to signed `domain.Money`). Status is `cleared` / `projected`.
- **Signed-leg contract** (implemented in `src/data/ledger-mapping.ts`): `income` → `+amount` on `account_id`; `expense` → `-amount` on `account_id`; `transfer` → two legs (`-amount` on `account_id`, `+amount` on `to_account_id`). Single source of truth for sign -- domain layer never touches raw DB amounts.
- **Category contract**: `income_category_id` / `expense_category_id` in `ledger_entry` are mutually exclusive -- `chk_category_kind` enforces that only the column matching the entry's `kind` may be non-NULL (both NULL for `transfer`). `toRow` in `ledger-write.ts` always writes both columns so a kind change in `updateEntry` nullifies the stale one automatically.
- **Savings category**: exactly one `expense_category` row may have `is_savings = true` (partial unique index `expense_category_savings_singleton`). Budgets resolve it via `SELECT id FROM expense_category WHERE is_savings` -- no hard-coded id.
- Credit statements & dues are **derived** from transaction dates vs the card's cutoff/payment days -- not stored as mutable records. v1 assumes pay-in-full (no revolving interest).
- Investment annual rate is effective-dated history, **informational only** -- no automatic interest posting.
