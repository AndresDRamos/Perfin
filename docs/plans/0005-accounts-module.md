# 0005 - accounts-module

- Status: committed
- Date: 2026-07-03
- Mode: Fast   <!-- Reversibility x Density -->
- Branch: accounts/accounts-module
- Touches: src/data/schema/account.ts; src/data/account-write.ts; src/data/account-repo.ts;
  src/app/actions/accounts.ts; src/app/accounts/*; src/app/page.tsx; docs/modules/accounts.md
- Migrations: drizzle/0003_* (additive: bank, number, expiration_date + chk_number_masked)

## Goal

CRUD completo de cuentas (cash/debit/credit/investment) con formularios de configuración por tipo y
balance derivado visible, sobre la tabla `account` existente más tres columnas descriptivas nuevas.

## Affected modules

- accounts (nuevo CRUD + UI)
- dashboard/home (link de navegación)

## DB impact

Revisión dba: aditivo y reversible en su totalidad. `ALTER TABLE account ADD COLUMN bank varchar(100),
ADD COLUMN "number" varchar(30), ADD COLUMN expiration_date date` (nullable, sin default → sin
reescritura de tabla) + `chk_number_masked` (`"number" IS NULL OR "number" !~ '^[0-9]{13,19}$'` —
rechaza un PAN completo; solo identificadores enmascarados). Sin CHECK por `kind`: campos
informativos, no derivan lógica. Sin índices nuevos; impacto en rendimiento nulo.

Convención: `expiration_date` se normaliza al día 1 del mes; la tarjeta vige hasta el último día de
ese mes; la UI captura/muestra MM/YY.

Diferido explícitamente: `currency` (v1 mono-moneda MXN) y tabla `account_interest_rate` (plan propio).

## Steps

1. Rama `accounts/accounts-module` desde origin/main.
2. Schema: 3 columnas + `chk_number_masked` en `account.ts`; `npm run db:generate` → `drizzle/0003_*`;
   `npm run db:migrate` (dev).
3. `src/data/account-write.ts`: Zod discriminado por `kind` (credit exige cutoff/payment 1-28
   distintos, creditLimit opcional > 0; no-credit los prohíbe), create/update/deactivate/reactivate,
   dupe-check de nombre case-insensitive a nivel app. `kind` y `openingBalance` inmutables tras
   creación (contrato de balance derivado).
4. `src/data/account-repo.ts`: listados activas/todas + `listAccountsWithBalances` vía
   `toSignedLegs` + `deriveBalance`.
5. `src/app/actions/accounts.ts` (patrón catalog.ts: safeParse + revalidatePath).
6. UI `/accounts`: lista con balance derivado (líquidas vs crédito), forms alta/edición condicionados
   por tipo, activar/desactivar; link "Cuentas →" en la nav del home.
7. Tests: `src/data/__tests__/account-write.test.ts` (matriz Zod por kind).
8. docs-sync + `docs/modules/accounts.md` + STATE.md.
9. Verify: `npm run lint && npm run build && npm test` + pase visual de `/accounts`.

## Risks

- `number` es non-reserved keyword en Postgres (funciona citado; Drizzle lo cita).
- Editar `kind`/`opening_balance` con movimientos rompería el balance derivado → excluidos del update.

## Tests / guards

- Matriz Zod por kind en `account-write.test.ts`; checks existentes de BD (`chk_credit_fields`, etc.)
  siguen como última línea.
- `chk_number_masked` como guardrail de BD contra PANs completos.

## Rollback

`ALTER TABLE account DROP CONSTRAINT chk_number_masked, DROP COLUMN bank, DROP COLUMN "number",
DROP COLUMN expiration_date;` + descartar la rama. Ninguna operación irreversible.

## Amendments

- Rama nombrada `accounts/accounts-module` (sin prefijo NNNN, a petición del usuario).
- **Journal de migraciones desincronizado**: `drizzle.__drizzle_migrations` en la BD dev solo
  registraba `0000` aunque los objetos de `0001`/`0002` existían. Se hizo backfill de las dos filas
  (hash + created_at del journal local) antes de aplicar `0003`.
- **`DATABASE_URL_MIGRATE` inalcanzable en esta red**: apunta a la conexión directa de Supabase
  (`db.<ref>.supabase.co`, solo IPv6). La migración se aplicó con override puntual usando
  `DATABASE_URL_APP` (pooler, usuario postgres). Considerar actualizar `.env`.
- **Lint reparado (preexistente, bloqueaba la verificación)**: `next lint` no existe en Next 16 →
  script `lint` ahora es `eslint src`; `eslint.config.mjs` importa los flat configs de
  `eslint-config-next` directamente (FlatCompat tronaba). Los 5 errores `no-html-link-for-pages`
  (4 preexistentes) se corrigieron convirtiendo `<a>` internos a `<Link>` en home, categories,
  plans, plans/[id] y la nueva accounts.
- **`db.ts` pool acotado + singleton global en dev**: durante el pase visual el pooler de Supabase
  (15 sesiones) se agotó (`EMAXCONNSESSION`) porque cada recompilación HMR filtraba un pool de 10.
  Ahora `max: 5` y reuso vía `globalThis` en no-producción.
- **Reset de formularios de React 19**: tras un submit con error de validación, React reseteaba el
  DOM del form (valores perdidos y select desincronizado del estado). `AccountManager` preserva los
  valores tecleados en el estado y remonta el form con `key` por intento; verificado en navegador.
- `.claude/launch.json` añadido (config de dev server para previews).
