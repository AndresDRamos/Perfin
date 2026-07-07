# plan-types-dashboard-neto - Proyectado neto, patrimonio por cuenta y tipos de plan

- Status: committed
- Date: 2026-07-06
- Mode: Workshop

## Goal

El "Proyectado" del dashboard pasa a ser **saldo neto** (patrimonio + ingresos esperados − deuda
de tarjetas); la sección "Patrimonio por tipo" se convierte en "Patrimonio" con desglose por
cuenta (filas estilo tarjetas de crédito, montos en verde); y crear un plan pregunta primero el
tipo: **Presupuesto**, **Proyección** o **Fijo** (materializa el gasto recurrente diferido en
STATE desde 0003).

## Affected modules

- ledger (nueva semántica del proyectado, proyecciones de ingreso, entries materializadas de fijos)
- budgets (UX de creación de plan; la página /plans se reorganiza por tipo)
- catalog (flag `is_fixed` en `expense_category`, seeds "Servicios"/"Subscripciones"; el motor de
  recurrencia que su module doc tenía como pendiente)
- accounts (solo lectura: desglose de patrimonio por cuenta)

## Decisiones aprobadas

1. **Proyectado neto (ADR-010)**: `neto = disponible real (cash+débito+inversión, cleared)
   + ingresos proyectados − deuda de tarjetas (saldo derivado, cleared)`. Los gastos proyectados
   sobre cuentas líquidas siguen excluidos. La tarjeta del dashboard explica la fórmula en su
   leyenda.
2. **Los tres tipos no son tres tablas nuevas**:
   - *Presupuesto* = `plan` + `budget` existentes. Nombre opcional con default
     "Plan de {inicio} a {fin}" / "Plan para el {fecha}"; checkbox periodo vs fecha única
     (fecha única se guarda `period_start = period_end`). Cero DDL.
   - *Proyección* = `ledger_entry` kind=`income` status=`projected` + nueva columna
     `expected_amount` (conserva el esperado; conciliar actualiza `amount`+`status` y muestra la
     diferencia esperado vs real).
   - *Fijo* = nueva tabla `fixed_expense` (plantilla) + motor lazy que materializa un
     `ledger_entry` kind=`expense` **status=`cleared`** por ocurrencia vencida (aprobado: los
     servicios se cargan solos; así la deuda aparece de inmediato en el saldo de la tarjeta).
3. **Categorías propias para fijos**: `expense_category.is_fixed` boolean (no singleton, editable)
   + seeds "Servicios" y "Subscripciones". El formulario de Fijo solo ofrece categorías
   `is_fixed`; la restricción es app-layer + filtro de UI (coherente con los demás invariantes
   cross-table del repo). Un gasto manual sí puede usar esas categorías.
4. **Idempotencia de materialización**: `ledger_entry.fixed_expense_id` (FK `ON DELETE SET NULL`:
   borrar la plantilla nunca borra transacciones) + `fixed_expense_month` (date, día 1 del mes
   programado, escrito por el motor — NO derivado de `occurred_at`) + unique index parcial
   `(fixed_expense_id, fixed_expense_month)`. El motor inserta con `ON CONFLICT DO NOTHING`.
5. **Página /plans** en tres secciones (Presupuestos / Proyecciones / Fijos); el alta empieza con
   selector de tipo (3 tarjetas, mobile-first 390px).

## DB impact

Migración `0008` (Drizzle auto-numera), **aditiva, riesgo bajo, nada irreversible en forward**;
más `0009_fix_credit_opening_sign` (data-only, post-verificación — ver Amendments)
(el rollback sí borra plantillas/expected/enlaces; las entries del ledger sobreviven).
Revisión dba (sesión 2026-07-06):

- Nueva tabla `fixed_expense`: user_id (CASCADE, metadata de planeación como `plan`), name,
  amount centavos >0, account_id (RESTRICT), expense_category_id NOT NULL (RESTRICT),
  day_of_month 1..31 (clamp a fin de mes en el motor), start_date, end_date? (>= start),
  is_active, timestamps. Índice parcial `(user_id) WHERE is_active`. RLS + pgPolicy
  `fixed_expense_select_mcp_readonly` + `GRANT SELECT TO "mcp_readonly"` **a mano** en la
  migración (convención CLAUDE.md).
- `ledger_entry` + 3 columnas: `fixed_expense_id` FK SET NULL, `fixed_expense_month` date
  (CHECK día 1; CHECK enlace solo kind=expense y month presente — un solo sentido, permite
  month huérfano tras SET NULL), `expected_amount` integer (CHECK solo kind=income y > 0;
  "solo si nació proyectada" se garantiza en `ledger-write`, no expresable en CHECK).
- Unique parcial `uq_ledger_entry_fixed_expense_month (fixed_expense_id, fixed_expense_month)
  WHERE fixed_expense_id IS NOT NULL`. Descartado `date_trunc('month', occurred_at)`: STABLE
  (no indexable) y editar la fecha movería la clave de idempotencia.
- `expense_category.is_fixed` boolean NOT NULL DEFAULT false + CHECK
  `chk_expense_category_savings_fixed_excl` (`NOT (is_savings AND is_fixed)`) + seeds
  idempotentes "Servicios"/"Subscripciones" con `ON CONFLICT (lower("name")) DO NOTHING`
  (target explícito, más estricto que el DO NOTHING desnudo de la 0001; verificado contra el
  esquema vivo: 6 filas, sin colisiones). Restricción "fixed_expense solo categorías is_fixed"
  es app-layer (dba descartó trigger y FK compuesta).

## Steps

1. **Schema Drizzle**: nuevo `src/data/schema/fixed-expense.ts`; `expense-category.ts` +
   `is_fixed`; `ledger-entry.ts` + `fixed_expense_id`/`fixed_expense_month`/`expected_amount`
   con CHECKs e índice único parcial; exportar en `index.ts`. `npm run db:generate` → editar la
   migración generada a mano: GRANT mcp_readonly + seeds de categorías. `npm run db:migrate`
   (dev, vía pooler).
2. **Dominio**: `netProjected()` en `src/domain/available.ts` (proyectado neto; suma el saldo
   firmado de cuentas credit al proyectado líquido) + nuevo `src/domain/recurrence.ts`
   (`occurrencesBetween(template, from, to)` con clamp de día 29–31, vigencia start/end,
   meses atrasados múltiples). Tests unitarios de ambos.
3. **Data layer**: `fixed-expense-write.ts` (Zod create/update/deactivate; categoría debe ser
   `is_fixed` y activa; cuenta del caller) + `fixed-expense-repo.ts` (listar del usuario;
   `materializeDueFixedExpenses(userId, today)`: ocurrencias vencidas → INSERT cleared con
   ON CONFLICT DO NOTHING). `ledger-write.ts`: `toRow` nullifica campos de fijo si `kind` deja
   de ser expense (patrón categorías); `createProjection` (income projected,
   `expected_amount = amount`); `reconcileWithAmount(userId, id, realPesos)` (actualiza amount
   + status, nunca `expected_amount`). `category-repo`: `listActiveFixedCategories()`.
4. **Server actions**: CRUD de fijos; `createProjectionAction` / `reconcileProjectionAction`;
   materialización invocada al inicio de `getDashboard` y de la carga de /plans; `getDashboard`
   devuelve además `netProjectedPesos`, desglose de patrimonio por cuenta y proyecciones
   vencidas por conciliar.
5. **UI dashboard** (`src/app/page.tsx`): tarjeta "Proyectado" con valor neto y leyenda
   "Patrimonio + ingresos esperados − deuda"; sección **"Patrimonio"** (sin barras): filas como
   las de tarjetas de crédito — ícono por tipo en círculo suave, nombre, tipo/banco debajo,
   monto en verde (`text-primary-*` con variante dark), total en el encabezado; bloque
   **"Por conciliar"** listando proyecciones con `occurred_at <= hoy`, input de monto real.
6. **UI planes** (`src/app/plans/*`): selector de tipo como primer paso; formulario Presupuesto
   (nombre opcional + checkbox periodo/fecha única + defaults de nombre); formulario Proyección
   (fecha, monto esperado, cuenta destino); formulario Fijo (nombre, monto, día del mes, cuenta,
   categoría is_fixed, vigencia); listado en tres secciones con estados (proyección
   pendiente/conciliada con diferencia; fijo activo/inactivo, próxima ocurrencia). De paso:
   contraste dark-mode en `PlanList`/`BudgetManager` (riesgo anotado en STATE).
7. **Docs**: ADR-010 (proyectado neto); module docs ledger/budgets/catalog; `/docs-sync`
   (data dictionary, ERD, migrations-log); STATE al commit.
8. **Verificación**: `npm test` + build/lint + preview móvil 390px: crear fijo → materializa
   cleared → saldo de tarjeta sube; crear proyección → neto sube; conciliar con monto real
   distinto → diferencia visible; presupuesto de fecha única → nombre default correcto.

## Risks

- Cambio de semántica de "Proyectado" puede confundir — mitigado con la leyenda de la fórmula.
- Materialización lazy tras meses sin abrir la app genera varias entries de golpe — fechadas en
  su día correcto; el unique index impide duplicados.
- `cleared` automático registra pagos que podrían no haber ocurrido (monto variable, cargo
  rechazado) — el usuario puede editar/eliminar la entry; si duele, cambiar a projected+confirm
  es un cambio de un flag en el motor.
- Riesgo heredado (STATE): contraste dark-mode en pantallas de budgets/catalog — este plan
  corrige PlanList/BudgetManager.

## Tests / guards

- Unit: `recurrence.ts` (clamp 29/30/31, feb bisiesto, vigencias, catch-up multi-mes),
  `netProjected` (con/sin deuda, tarjeta con saldo a favor), `reconcileWithAmount` conserva
  `expected_amount`.
- DB: CHECKs de la 0008 (enlace fijo solo expense, expected solo income, día 1) + unique parcial
  de idempotencia (segundo INSERT del mismo mes → no-op).
- Manual móvil 390px (paso 8).

## Rollback

Forward aditivo. Revertir = migración inversa (DROP tabla/columnas/índices — destruye plantillas,
expected y enlaces; las transacciones del ledger sobreviven) + revert de commits de app. SQL de
rollback en la nota dba de la sesión de planeación.

## Amendments

- **Fechas UTC en la UI nueva** (pase visual 390px): `occurred_at` se guarda como medianoche UTC
  del día capturado (convención heredada de `z.coerce.date` sobre inputs `type=date`), así que una
  proyección para el 6/7 se mostraba "5/7" en TZ México. Fix: `ReconcileList` y
  `ProjectionRowItem` formatean con `timeZone: "UTC"`. La misma quirk existe en pantallas previas
  (p. ej. "Vence 3/7/2026" en tarjetas) — fuera de alcance aquí, queda para un plan de fechas/TZ.
- **Nombre default duplicaba la fecha**: "Plan para el 15/7/2026" mostraba además el meta
  "15/7/2026" al lado. El listado oculta el meta cuando el nombre ya contiene la fecha de inicio.
- **`toRow` matiz vs patrón categorías**: los campos de fijo/expected NO se escriben siempre
  (el input nunca los trae; escribirlos incondicionalmente borraría el enlace en cualquier
  edición). Se nullifican solo cuando el `kind` deja de corresponder — misma garantía frente a
  los CHECKs, distinto mecanismo.
- **Tests de CHECKs de la 0008**: verificados por presencia en el esquema vivo (dba en la sesión
  de plan + re-verificación por `db` MCP en esta sesión), no con INSERTs negativos — el MCP es
  read-only y no hay harness de tests contra la DB. La idempotencia del unique parcial sí se
  ejercitó funcionalmente: cargas repetidas de dashboard//plans tras materializar no duplicaron
  (2 entries exactas para jun/jul).
- **Evidencia visual sin screenshots**: `preview_screenshot` no respondió en toda la sesión (el
  renderer sí); la verificación quedó por accessibility snapshots, texto del DOM y estilos
  computados (montos verdes `primary-700`/`primary-300` según modo; contraste meta 5.16:1; sin
  overflow horizontal a 390px).
- **Extras no planeados**: `nextOccurrenceAfter` en `recurrence.ts` (para "Próximo cargo" en la
  UI) y acciones Pausar/Reanudar/Eliminar de plantillas (el plan solo pedía estados
  activo/inactivo en el listado).
- **Post-verificación (feedback del usuario con datos reales)**: el "Proyectado" neto SUMABA la
  deuda de tarjetas en vez de restarla. `netProjected()` era correcto; la causa raíz estaba
  aguas arriba: el onboarding capturaba la deuda de crédito como `opening_balance` POSITIVO
  (label "Saldo actual (deuda, si aplica)"), invirtiendo la convención de saldo firmado
  (deuda = negativo) — el mismo dato hacía que la sección "Tarjetas de crédito" mostrara montos
  negativos en rojo. Fix triple: (1) `OnboardingWizard`/`AccountManager` etiquetan "Deuda actual"
  para crédito y guardan el monto tecleado NEGADO; (2) migración de datos
  `0009_fix_credit_opening_sign` reparó las 3 filas afectadas (valores previos anotados en el
  SQL); (3) verificado contra la DB viva: neto esperado $22,269.99 (= $30,593.22 líquido −
  $8,323.23 de deuda).
