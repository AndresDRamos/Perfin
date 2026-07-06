# 009. Efectivo es una cuenta física, no un producto bancario

- Status: accepted
- Date: 2026-07-06

## Context

`account.kind` agrupa `cash`/`debit`/`credit`/`investment` bajo un mismo enum, y las columnas
descriptivas `bank`/`number`/`expiration_date` (migración `0003`) se declararon nullable **sin
restricción por kind** -- el único CHECK por-kind existente, `chk_credit_fields`, solo cubre
`cutoff_day`/`payment_day`/`credit_limit` para crédito. En la práctica nada en DB impedía crear
una cuenta `kind = 'cash'` con `bank` no nulo, aunque la UI (`AccountManager.tsx`) nunca mostraba
ese campo para efectivo.

El usuario señaló la causa raíz: **efectivo no es un producto emitido por una institución** -- es
dinero físico que el usuario ya tiene, sin banco, número ni vigencia. Es una regla de dominio, no
una preferencia de UI.

## Decision

**`bank`, `number` y `expiration_date` deben ser NULL cuando `kind = 'cash'`**, aplicado en dos
capas (mismo patrón fail-closed que el resto del esquema: DB como límite autoritativo, Zod para
mensajes de error tempranos):

1. **CHECK `chk_cash_no_bank_fields`** (migración `0007`):
   `kind <> 'cash' OR (bank IS NULL AND number IS NULL AND expiration_date IS NULL)`.
   Alcance deliberado: solo `cash` queda restringido -- `debit`/`investment` conservan `bank`
   legítimamente (débito además puede llevar tarjeta con vigencia).
2. **`accountCreateSchema`** (`account-write.ts`): la rama `cash` del discriminated union ya no
   hereda `bank`/`number`/`expirationMonth` de `accountBase` -- deja de ser "opcional" para no
   existir en esa rama. `updateAccount` rechaza en runtime cualquier intento de tocar esos campos
   sobre una cuenta `cash` existente, con el mismo criterio que ya aplicaba a los campos de
   crédito en cuentas no-crédito.

## Consequences

- **Easier**: el modelo de datos ahora es fiel a la afirmación de producto ("efectivo es una
  cuenta física"); un bug futuro en la capa de escritura no puede colar un banco en una cuenta de
  efectivo -- el CHECK lo rechaza sin importar el punto de entrada.
- **Harder**: ninguna -- la tabla `account` estaba vacía en dev al aplicar la migración (verificado
  por el sub-agente `dba`), así que no hubo backfill ni fila existente en riesgo.
- **Live with**: si en el futuro se necesita "efectivo en una caja fuerte de un banco" o algo
  similar, sería una nueva discusión de producto -- hoy el modelo asume que efectivo nunca tiene
  contraparte institucional.
