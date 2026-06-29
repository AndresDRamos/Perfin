# 0003 - Catalog: categories + ledger link

- Status: active
- Date: 2026-06-29
- Mode: Workshop   <!-- Reversibility x Density: reversible pero alta densidad -->

## Goal
Crear los catálogos de categorías de ingreso y gasto (tablas separadas), reservar la
categoría `savings` (sin lógica de acumulación todavía) y vincular el ledger a categorías
(`category_id` nullable, solo income/expense). Desbloquea el milestone "budgets".

## Decisión de diseño (revisada por `dba`)
Opción A: dos columnas nullable en `ledger_entry` (`income_category_id`,
`expense_category_id`), cada una con FK a su tabla, más un único `chk_category_kind`
declarativo que ata la columna al `kind` y prohíbe categoría en `transfer`. Evita
trigger/FK compuesta de la tabla unificada y respeta el doc del módulo (tablas separadas).

## Affected modules
- **DB / schema** (Drizzle): tablas nuevas `income_category`, `expense_category` + ALTER `ledger_entry`.
- **data**: `ledger-write.ts` (Zod + `toRow` + nulificar categoría contraria al cambiar `kind`),
  nuevo `category-write.ts` (Zod create/update, soft-delete), nuevo `category-repo.ts` (listar activas por tipo).
- **actions**: nuevas server actions CRUD de categorías + extender `captureEntry`/`editEntry` para aceptar categoría.
- **UI**: `CaptureForm` (select de categoría según kind, oculto en transfer); `page.tsx` (cargar categorías activas);
  lista básica para crear/editar/desactivar categorías (UI mínima).
- **docs**: `catalog.md` (status planned→building), `data-dictionary.md` (vía `docs-sync` tras migrar),
  `STATE.md` (vía `/commit-plan`).

## DB impact
Tablas nuevas + columnas nullable + constraints sobre filas que hoy satisfacen el CHECK
trivialmente (todo el ledger queda con ambas columnas NULL, transfers incluidos). **No reescribe datos.**
DDL revisado por `dba` (read-only; lo aplica la migración Drizzle, no el subagente):
- `income_category` (id identity, name, description, is_active, created_at) + UNIQUE `lower(name)`.
- `expense_category` (igual + `is_savings boolean default false`) + UNIQUE `lower(name)`
  + **UNIQUE parcial singleton** `WHERE is_savings = true` → garantiza ≤1 categoría de ahorro;
  budgets la resuelve por flag (`SELECT id FROM expense_category WHERE is_savings`), sin id mágico.
- `ledger_entry`: `+income_category_id` FK, `+expense_category_id` FK, `chk_category_kind`,
  dos índices parciales por categoría (`idx_ledger_entry_income_category` / `..._expense_category`).
- **Diferido a budgets**: `savings_target_account_id` en `expense_category`.
- **Seed**: `INSERT INTO expense_category (name, description, is_savings) VALUES ('Ahorro', …, true) ON CONFLICT DO NOTHING`.

## Steps
1. **Schema Drizzle**: `src/data/schema/income-category.ts`, `expense-category.ts`; exportar en
   `schema/index.ts`. Definir los FK en `ledger-entry.ts` para que Drizzle los nombre a su estilo.
   Agregar `chk_category_kind` e índices parciales.
2. **Migración**: `drizzle-kit generate` → revisar el SQL generado contra la propuesta del `dba`
   (no aplicar a ciegas).
3. **Seed savings**: `INSERT … ('Ahorro', …, is_savings=true) ON CONFLICT DO NOTHING` en la migración.
4. **Write path categorías**: `category-write.ts` (Zod create/update, soft-delete vía `is_active`)
   + `category-repo.ts` (listar activas por tipo).
5. **Vínculo en ledger-write**: extender los Zod schemas (income/expense aceptan `categoryId?`;
   transfer lo rechaza), mapear a la columna correcta en `toRow`, y en `updateEntry`
   **nulificar la columna contraria** al cambiar de kind (riesgo 3 del `dba`).
6. **Actions**: CRUD de categorías + extender `captureEntry`/`editEntry`.
7. **UI**: select de categoría en `CaptureForm` (poblado por kind, oculto en transfer);
   `page.tsx` carga categorías activas; lista mínima crear/editar/desactivar.
8. **Docs**: `docs-sync` para regenerar `data-dictionary.md`/ERD tras migrar; actualizar `catalog.md`.

## Risks
- **Cambio de `kind` en edición** deja categoría incoherente → `chk_category_kind` falla ruidoso;
  mitigado nulificando la columna contraria en `updateEntry` (paso 5).
- **Borrado de categoría en uso** → FK `NO ACTION` lo impide; CRUD usa soft-delete (`is_active=false`).
- **Desmarcar la única savings** → no forzado en BD ahora; validación diferida a budgets.
- **Unicidad case-insensitive estricta** (`lower(name)`) — decisión asumida; cambiable a parcial
  por `is_active` si se quiere permitir duplicados entre activas/inactivas.

## Tests / guards
- Unit `ledger-write`: income con categoría → `income_category_id` poblado, `expense_*` NULL;
  expense análogo; transfer con `categoryId` → rechazado por Zod; update expense→income
  nulifica `expense_category_id`.
- Unit `category-write`: create/update, soft-delete, rechazo de duplicado case-insensitive.
- Guarda: la migración generada debe coincidir con el DDL revisado por `dba`.

## Rollback
SQL de reversión (del `dba`), reversible y sin pérdida de datos del ledger:

```sql
DROP INDEX IF EXISTS idx_ledger_entry_expense_category;
DROP INDEX IF EXISTS idx_ledger_entry_income_category;
ALTER TABLE ledger_entry DROP CONSTRAINT IF EXISTS chk_category_kind;
ALTER TABLE ledger_entry
    DROP COLUMN IF EXISTS expense_category_id,
    DROP COLUMN IF EXISTS income_category_id;
DROP TABLE IF EXISTS expense_category;
DROP TABLE IF EXISTS income_category;
```
