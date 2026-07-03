# 0004 - Budgets

- Status: verified
- Date: 2026-06-29
- Mode: Review   <!-- DDL aditivo pero denso; sigue patrones aprobados (chk_category_kind), el CHECK polimórfico pide revisión cuidadosa -->

## Goal
Añadir la capa opcional de planificación: un `plan` que agrupa `budget`s sobre rangos de
fecha arbitrarios, con tres sub-tipos (`category_cap`, `savings_reservation`,
`purchase_goal`). Rastrea *actuals* contra *targets*. **No mueve dinero**:
`savings_reservation` solo rastrea los transfers que el usuario registre manualmente.

## Affected modules
- **Nuevo**: `budgets` (data layer + server actions + UI).
- **Lee de**: `ledger` (actuals = sumas de entries), `accounts` (cuenta de ahorro destino),
  `catalog` (categoría de gasto del cap).
- **No modifica**: `ledger_entry`, `account`, ni los catálogos. Cero cambios a contratos
  existentes.

## DB impact
Revisado por `dba` (sin drift: esquema vivo == `data-dictionary.md`). Migración puramente
aditiva `drizzle/0002_budgets.sql`, generada con `drizzle-kit generate` desde los schemas.

- **2 enums nuevos**: `budget_subtype` (`category_cap` | `savings_reservation` |
  `purchase_goal`), `purchase_horizon` (`short` | `medium` | `long`).
- **Tabla `plan`**: `id`, `name` (varchar 100), `period_start`/`period_end` (date),
  `created_at` (timestamptz). CHECK `chk_plan_period_order` (`period_end >= period_start`).
- **Tabla `budget`** (polimórfica por `subtype`, una sola tabla con columnas nullables):
  - Columnas: `id`, `plan_id` (FK → `plan`, **ON DELETE cascade**), `subtype`,
    `target_amount` (centavos, `> 0`), `period_start`/`period_end` (override opcional,
    `NULL` = hereda del plan), `expense_category_id?` (FK → `expense_category`),
    `account_id?` (FK → `account`), `item_name?` (varchar 100), `horizon?`, `created_at`.
  - CHECKs: `chk_budget_target_positive`; `chk_budget_period_pair` (ambos-o-ninguno y
    `end >= start`); `chk_budget_subtype_fields` (matriz polimórfica fail-closed, mismo
    patrón que `chk_category_kind`):
    - `category_cap` → `expense_category_id` NOT NULL; resto condicionales NULL.
    - `savings_reservation` → `account_id` NOT NULL; resto condicionales NULL.
    - `purchase_goal` → `item_name` + `horizon` NOT NULL; resto condicionales NULL.
  - Índices: `idx_budget_plan_id`; parciales `idx_budget_expense_category`,
    `idx_budget_account`; únicos parciales anti-duplicados
    `budget_cap_category_uq` sobre `(plan_id, expense_category_id)` WHERE
    `subtype = 'category_cap'`, y `budget_reservation_account_uq` sobre
    `(plan_id, account_id)` WHERE `subtype = 'savings_reservation'`.
- **Decisiones de diseño resueltas**: `category_cap` referencia **solo** `expense_category`
  (un tope sobre ingreso no tiene semántica; un futuro `income_target` sería subtype propio);
  `item_name` columna dedicada (no reusar `name`); `period_*` del budget como override
  opcional sin CHECK de contención (no expresable en CHECK sin trigger).

## Steps
1. **Schema**: crear `src/data/schema/plan.ts` y `src/data/schema/budget.ts`
   (`pgEnum` para `budget_subtype` y `purchase_horizon`); exportar en
   `src/data/schema/index.ts`. Generar migración con `drizzle-kit generate`.
2. **Data layer — escritura** (`src/data/budget-write.ts`): schemas Zod como discriminated
   union sobre `subtype`; `createPlan`/`updatePlan`/`deletePlan` y
   `createBudget`/`updateBudget`/`deleteBudget`. Dupe-check amigable antes de chocar contra
   los índices únicos (patrón `category-write.ts`).
3. **Data layer — lectura/actuals** (`src/data/budget-repo.ts`):
   - `category_cap` actual = suma de expense entries con esa categoría dentro del rango. Dos
     lecturas: **real** (cleared) y **projected** (incl. projected), siguiendo el doc.
   - `savings_reservation` actual = suma de transfers cleared con
     `to_account_id = budget.account_id` dentro del rango.
   - `purchase_goal` v1 = solo target + horizon (sin actual computado; afford = projected
     available informativo). *Ver riesgo.*
4. **Server actions** (`src/app/actions/budgets.ts`): CRUD de planes/budgets +
   `getPlanProgress(planId)` que arma target/actual por budget. `revalidatePath`.
5. **UI**: página `/plans` — listar/crear planes, gestionar budgets por sub-tipo, mostrar
   progreso (barra target vs actual). Reusar patrones de `/categories`.
6. **Docs**: actualizar `docs/modules/budgets.md` (status → building/complete) y disparar
   `docs-sync` para regenerar `data-dictionary` + ERD + migrations-log.

## Risks
- **`purchase_goal` sin actual duro**: en v1 es display de meta (sin vínculo a movimientos).
  Riesgo de expectativa de "avance automático". Mitigación: documentarlo; iteración futura.
- **`savings_reservation` acoplamiento flexible**: el avance es heurístico (suma de transfers
  a la cuenta), sin vínculo duro reserva↔transfer. Intencional; documentar.
- **Override `period_*` del budget**: sin CHECK de contención (budget dentro del plan) — no
  expresable en CHECK sin trigger. `NULL` = hereda. Pieza más prescindible si se quiere
  simplicidad máxima en v1.
- **`ON DELETE cascade`** en `budget.plan_id` se desvía de la convención `no action` de las
  migraciones existentes; aprobado explícitamente (budgets son hijos sin valor propio).

## Tests / guards
- Unit (Vitest) `budget-write`: el discriminated-union Zod rechaza combinaciones inválidas
  (cap sin categoría, reservation sin cuenta, goal sin horizon) **antes** de la BD.
- Unit de los CHECK polimórficos: la BD es la última línea (fail-closed).
- Unit de actuals: cap suma solo expenses de la categoría en rango; reservation suma solo
  transfers a la cuenta; **transfers excluidos de cap** (invariante del ledger).
- Guard: dupe-check de cap/reservation devuelve error amigable, no excepción cruda del índice.

## Rollback
Migración puramente aditiva: `DROP TABLE budget, plan; DROP TYPE budget_subtype,
purchase_horizon;` revierte sin tocar datos existentes. El código nuevo vive en archivos
nuevos → eliminar archivos + entradas del barrel `index.ts`.
