# dashboard-restructure - Dashboard como centro de navegación + indicadores clave

- Status: committed
- Date: 2026-07-06
- Mode: Workshop   <!-- migración 100 % aditiva (reversible), densidad alta -->
- Branch: feat/dashboard-restructure

## Goal

Re-estructurar `/` como el centro de navegación de la app: saldo actual, línea de tiempo de saldo
histórico/proyectado (−10/+30 días, interactiva), saldos por cuenta con captura contextual, y
barras de presupuesto por categoría — todo conectado a los módulos existentes y verificado
mobile-first (~390 px, targets táctiles >= 44 px).

## Affected modules

- ledger (query de rango, captura contextual, projected como "transacción programada")
- accounts (saldos por cuenta, ajuste de inversión, pago/liquidación de crédito)
- budgets (barras de avance del plan vigente, prorrateo en la proyección)
- catalog (consumo: categorías en modales; edición/creación desde el detalle de budgets)
- **nuevo**: income_schedule (ingresos recurrentes del usuario)
- dashboard (`/`) — re-escritura de `src/app/page.tsx`

## DB impact

Migración `0008_steady_sister_grimm` — **aplicada a dev en la fase de planeación** (2026-07-06),
revisada por el sub-agente `dba`, 100 % aditiva, sin operaciones irreversibles:

- Enum `income_frequency`: `weekly` | `biweekly` (catorcenal) | `semimonthly` (quincenal = día 15
  **y último día del mes**, convención de nómina MX; "15 y 30" está indefinido en febrero) |
  `monthly` (día del ancla con clamp en meses cortos).
- Tabla `income_schedule`: `user_id` CASCADE (config desechable, como `plan`); `name`;
  `estimated_amount` centavos > 0 (CHECK); `account_id` NOT NULL RESTRICT (cuenta destino);
  `income_category_id` opcional; `anchor_date` inmutable (las ocurrencias se calculan en memoria,
  jamás se materializan filas; nada se proyecta antes del ancla); `is_active`; timestamps.
  Índices: parcial user+active (lectura caliente), user, account (lookup inverso al desactivar la
  cuenta destino). RLS + policy `income_schedule_select_mcp_readonly` + `GRANT SELECT` a
  `mcp_readonly` (verificado en vivo: el MCP `db` ve la tabla).
- Rollback: `DROP TABLE income_schedule; DROP TYPE income_frequency;`.

## Decisiones de diseño (aprobadas)

1. **Saldo actual** = Σ balances derivados de TODAS las cuentas activas, crédito incluido en
   negativo. Formato `$#,##0.00` (`domain/money.format`), puede ser negativo. Fuente:
   `listAccountsWithBalances` — nada nuevo en DB.
2. **Timeline** (serie diaria en memoria, dominio visible por defecto hoy−10 → hoy+30, arrastrable):
   - Pasado: saldo del día d = saldo actual − Σ legs *cleared* con `occurred_at` > d (derivación
     hacia atrás; nueva query de rango en `ledger-repo`).
   - Futuro: saldo de hoy + acumulado de (a) entries `projected` futuros, (b) ocurrencias
     estimadas de `income_schedule` (dedupe: se omite la ocurrencia si ya existe un income real en
     esa cuenta/ventana de fecha), (c) remanente de cada `category_cap` del plan vigente
     prorrateado linealmente en los días restantes del periodo, restando antes los gastos
     `projected` ya categorizados (no doble conteo).
   - Marcador destacado en "hoy". Tooltip con saldo del día bajo el dedo/mouse; tap fija el día y
     expande el detalle abajo. Drag horizontal con `touch-action: pan-y` + umbral de gesto para no
     pelear con el scroll vertical.
   - Componente SVG propio con pointer events — **sin librería de charts** (precedente del
     proyecto: "Patrimonio por tipo").
3. **Detalle de día**: transacciones del día (cleared + projected) con edición (reusa
   `editEntry`); crear ingreso/gasto proyectado con concepto (reusa `createEntry`,
   `status: projected`); acceso a configurar `income_schedule` (alta/edición de tipo de ingreso).
4. **Día de pago**: si hay ocurrencia hoy/vencida sin income real registrado, el dashboard muestra
   un aviso que pide el monto REAL y crea el `ledger_entry` income *cleared* (categoría copiada
   del schedule). El estimado del schedule nunca entra al ledger.
5. **Saldos por cuenta** (orden: efectivo → débito → inversión → crédito), tap abre modal de
   captura contextual:
   - Ingreso a efectivo/débito pregunta "¿viene de otra cuenta tuya?" → sí = `transfer`.
   - Inversión: además "ajustar saldo total" → income/expense de ajuste por la diferencia (el
     balance sigue derivado, nunca almacenado).
   - Crédito: un ingreso es un pago = `transfer` desde otra cuenta propia; opción "liquidar"
     prellena el total adeudado (balance derivado negado, mismo criterio que el dashboard actual).
   - Editar cuenta / añadir cuenta reusa las actions de `/accounts`.
6. **Budgets**: barras solo de `category_cap` del plan cuyo periodo cubre hoy (reusa
   `planProgress`), ordenadas por % de avance desc. Sin plan vigente → CTA a `/plans`. Tap en
   categoría → transacciones del periodo/categoría, crear transacción con categoría prellenada,
   **programar** transacción futura (`projected` + `occurred_at` futuro), y editar/crear
   categorías (reusa actions de catálogo).
7. TZ fija v1 (fechas locales MX); días como `date` local, sin aritmética UTC.

## Steps

1. ~~Schema + migración `0008` + aplicar a dev~~ — **hecho en fase de plan**
   (`src/data/schema/income-schedule.ts`, export en `index.ts`, `drizzle/0008_steady_sister_grimm.sql`
   con `GRANT SELECT` manual, `npm run db:migrate` OK, visibilidad `mcp_readonly` verificada).
2. **Dominio puro + tests** (`src/domain/`):
   - `recurrence.ts`: `occurrencesBetween(schedule, from, to): LocalDate[]` por frecuencia —
     weekly/biweekly desde `anchor_date` (paridad 7/14 días), semimonthly = 15 y último día del
     mes, monthly = día del ancla con clamp (ancla 31 → paga 30/28); piso en `anchor_date`.
   - `timeline.ts`: `buildBalanceSeries({ today, currentBalance, clearedLegs, projectedLegs,
     scheduleOccurrences, budgetBurn })` → `{ date, balance }[]` pasado y futuro con las reglas de
     dedupe de la decisión 2. Tests unitarios de ambos (febrero, meses de 30/31, cruces
     projected×schedule×budget).
3. **Data layer**:
   - `src/data/income-schedule-write.ts`: Zod (`name`, `frequency`, `estimatedAmount` > 0,
     `accountId`, `incomeCategoryId?`, `anchorDate`) + create/update/deactivate, siempre
     `WHERE user_id`.
   - `src/data/income-schedule-repo.ts`: `listActiveSchedules(userId)`, `listAllSchedules(userId)`.
   - `src/data/ledger-repo.ts`: añadir `entriesBetween(userId, from, to)` (todas las entries del
     rango con categoría y cuenta, para serie + detalle de día) y helper de legs firmados por día.
4. **Server actions**:
   - `src/app/actions/income-schedule.ts`: CRUD + `confirmPaydayAction(scheduleId, realAmount,
     occurredOn)` → crea income cleared vía `createEntry` (dedupe re-verificado server-side).
   - `src/app/actions/dashboard.ts`: `getDashboardV2()` — un solo fetch que devuelve: saldo
     actual, serie de timeline (−10/+30 con datos para extender al arrastrar), entries por día,
     saldos por cuenta agrupados por kind, progreso de budgets del plan vigente, schedules
     activos y aviso de payday pendiente. `getDashboard` actual queda intacto hasta que `page.tsx`
     migre; se elimina si nada más lo usa.
5. **UI** (`src/app/components/dashboard/`, mobile-first 390 px):
   - `BalanceTimeline.tsx` — SVG interactivo (drag, tooltip, tap→día seleccionado, marcador hoy).
   - `DayDetail.tsx` — transacciones del día, editar, crear projected, link a tipo de ingreso.
   - `IncomeScheduleForm.tsx` — alta/edición de ingresos recurrentes (frecuencia, monto estimado,
     cuenta destino, categoría, ancla).
   - `PaydayPrompt.tsx` — aviso "¿Cuánto recibiste?" → `confirmPaydayAction`.
   - `AccountBalanceList.tsx` + `EntryModal.tsx` — tarjetas por cuenta agrupadas por kind y modal
     contextual (evolución de `CaptureForm`: pregunta de cuenta origen, ajuste de inversión,
     pago/liquidar crédito), editar cuenta y añadir cuenta.
   - `BudgetBars.tsx` + `CategoryDetail.tsx` — barras ordenadas por %, detalle con transacciones
     del periodo, crear/programar transacción con categoría prellenada, editar/crear categorías;
     CTA a `/plans` si no hay plan vigente.
   - Re-escritura de `src/app/page.tsx` componiendo todo (orden: saldo actual → timeline →
     saldos por cuenta → budgets). Nav superior se conserva.
   - De paso: corregir contraste dark pendiente (riesgo en STATE) en `CaptureForm`/
     `BudgetManager`/`CategoryList` **solo donde este plan los toque**.
6. **Docs**: sub-agente `docs-sync` (data-dictionary, ERD, migrations-log ya tiene la fila 0008);
   actualizar `docs/modules/{ledger,accounts,budgets}.md` y añadir routing para el nuevo dato de
   ingresos recurrentes en `docs/docs-routing.md` (fila `dashboard`/`income-schedule`).
7. **Verificación**: `npm test` (dominio), `npm run build` + lint, y pase E2E en preview móvil
   390 px: registro→dashboard, drag/tooltip/tap del timeline, captura por cuenta (los 4 kinds),
   confirmación de payday, barras de budgets con plan vigente y CTA sin plan; sin overflow
   horizontal.

## Risks

- **Doble conteo en la proyección** (projected × schedule × prorrateo de caps) — reglas de dedupe
  explícitas en la decisión 2; tests de `timeline.ts` cubren los cruces.
- **Drag del SVG vs scroll vertical** en móvil — `touch-action: pan-y` + umbral; verificar en
  preview táctil.
- **Enum de Postgres**: quitar/renombrar valores de `income_frequency` luego es doloroso — los 4
  valores quedaron aprobados con el plan.
- `page.tsx` crece mucho — mitigado extrayendo todo a `components/dashboard/`.

## Tests / guards

- Unit: `recurrence.ts` (febrero, clamp 31→30/28, quincenal 15/fin de mes, piso de ancla) y
  `timeline.ts` (serie pasada, dedupe de proyección, prorrateo).
- Server-side: dedupe de payday re-verificado en la action (no solo en UI).
- Build + lint + pase visual móvil 390 px (checklist del paso 7).

## Rollback

Revertir la rama. Si la migración ya está en dev: `DROP TABLE income_schedule; DROP TYPE
income_frequency;` (aditiva, sin pérdida de datos de usuario).

## Amendments

- **Editar/añadir cuenta y CRUD completo de categorías se resuelven por navegación**, no inline:
  "Saldos" enlaza a `/accounts` y `BudgetBars` enlaza a `/categories` (además de un input inline
  de *creación* de categoría de gasto que sí reusa `createExpenseCategoryAction`). El plan decía
  "reusa las actions de /accounts / catálogo"; el reuso quedó vía las páginas existentes — menos
  código duplicado y el mismo resultado funcional.
- **El detalle de transacciones por categoría en `BudgetBars` se alimenta de la ventana del
  dashboard (hoy−40/+30)**: si un plan tuviera un periodo que empezó hace más de 40 días, ese
  detalle no listaría las transacciones más antiguas (los totales y % de la barra SÍ son completos
  — vienen de `planProgress` en SQL). Aceptado para v1 (planes típicos son mensuales); si se
  alarga el periodo típico, mover el detalle a un fetch por rango (`entriesBetween` ya existe).
- **`CaptureForm.tsx` se eliminó** (su único consumidor era el dashboard viejo); `EntryModal` lo
  reemplaza con tokens de marca y variantes dark correctas. `BudgetManager.tsx` y
  `CategoryList.tsx` no fueron tocados por este plan, así que su posible deuda de contraste dark
  sigue abierta (riesgo ya registrado en STATE).
- **Edición inline en el detalle de día**: edita monto/concepto/fecha/estado (y reconciliar
  projected→cleared); cambiar kind/cuenta/categoría de una entrada existente se hace recapturando
  — `editEntry` exige el input completo y la UI reenvía los campos no editados tal cual.
- Lint pasa con 0 errores y 4 warnings **preexistentes** (imports sin uso en
  `actions/ledger.ts` y `categories/CategoryList.tsx`), fuera del alcance de este plan.

## Verificación (2026-07-06)

- `npm test`: 11 archivos / **114 tests OK** (incluye 25 nuevos de `recurrence` + `timeline`).
- `npx tsc --noEmit`, `npm run lint` (0 errores), `npm run build`: OK.
- Pase visual E2E en preview móvil 390×844 (dark real): registro → onboarding (4 cuentas de los
  4 tipos) → dashboard: saldo actual $18,300 = 1,500+8,200+12,000−3,400 (crédito negativo ✓);
  tap en timeline → detalle de día con badge "Proyección" ✓; alta de ingreso quincenal (ancla
  30-jun) → `PaydayPrompt` apareció solo y al confirmar $4,850 reales el saldo pasó a $23,150 y
  la proyección al 16-jul mostró +$5,000 de la quincena estimada del 15-jul ✓; pago de tarjeta
  con "Liquidar por completo" ($3,400 desde débito) → tarjeta en $0.00 y saldo global sin cambio
  (transfer interna) ✓; ajuste de inversión a $12,580.50 → +$580.50 en saldo ✓; plan "Julio 2026"
  + cap Transporte $1,200 → barra 0% → gasto $350 desde la categoría (preseleccionada en el
  modal) → barra 29% con detalle ✓. Sin overflow horizontal, consola limpia.
