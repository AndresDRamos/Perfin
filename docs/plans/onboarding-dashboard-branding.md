# onboarding-dashboard-branding - Onboarding, dashboard visual y branding

- Status: committed
- Date: 2026-07-06
- Mode: Workshop

## Goal

Cerrar el hueco de modelado señalado por el usuario (efectivo nunca debe poder llevar banco), dar
personalidad visual al proyecto (paleta, iconos Iconify, marca), y agregar un wizard de alta
guiada + un dashboard con esa identidad aplicada. Mobile-first en todo.

## Affected modules

- `accounts` (esquema: nuevo CHECK; UI: chip de tipo con ícono/color).
- Nuevo: `branding` (tokens, mapa kind→icono/color, marca) -- sin fila propia en
  `docs-routing.md` todavía; se agrega al cierre de este plan.
- `dashboard` (home `/`): iconos/colores, desglose "Patrimonio por tipo".
- Nuevo: `/onboarding` (wizard de alta guiada, 3 pasos).

## DB impact

Migración `0007`, revisada por el sub-agente `dba` (2026-07-06): `account` tiene 0 filas en dev,
sin riesgo de backfill.

- `ADD CONSTRAINT chk_cash_no_bank_fields CHECK (kind <> 'cash' OR (bank IS NULL AND number IS
  NULL AND expiration_date IS NULL))` -- cierra el hueco: hoy nada impedía `kind = 'cash'` con
  `bank` no nulo (el único CHECK por-kind existente, `chk_credit_fields`, no cubre estas
  columnas). Alcance deliberado: solo `cash` queda prohibido de `bank`/`number`/
  `expiration_date`; `debit`/`investment` conservan `bank` legítimamente.
- **100% reversible** (`DROP CONSTRAINT`), sin rewrite, sin índice, tabla vacía.
- `accountCreateSchema` (Zod, `account-write.ts`): la rama `cash` deja de heredar
  `bank`/`number`/`expirationMonth` de `accountBase` -- deja de ser "opcional" para pasar a "no
  existe en esa rama". La UI (`AccountManager.tsx`) ya no los muestra para `cash` (`BANK_KINDS`
  ya lo excluye) -- sin cambio visual.

## Branding

Paleta (valores dados = token 500; escala 100-900 por interpolación de luminosidad HSL,
tono/saturación fijos, verificada con ratios de contraste WCAG):

| Token | 100 | 200 | 300 | 400 | 500 (dado) | 600 | 700 | 800 | 900 |
|---|---|---|---|---|---|---|---|---|---|
| primary | `#ddf8e3` | `#b3efc0` | `#81e495` | `#46d764` | `#27B544` | `#219739` | `#19752c` | `#125420` | `#0b3213` |
| secondary | `#efeae6` | `#dbd0c7` | `#c4b0a1` | `#a88b75` | `#261E18` | `#715947` | `#584537` | `#3f3127` | `#261e18` |
| mustard | `#f8ecde` | `#eed3b4` | `#e3b682` | `#d69447` | `#B57428` | `#966021` | `#754b1a` | `#543612` | `#32200b` |
| purple | `#e7def8` | `#cab4ee` | `#a682e3` | `#7d47d6` | `#5D28B5` | `#4d2196` | `#3c1a75` | `#2b1254` | `#1a0b32` |
| indigo | `#dfedf6` | `#b7d6eb` | `#88bbdd` | `#509bce` | `#1B4460` | `#28668f` | `#1f4f6f` | `#163850` | `#0d2230` |

Implementación: `@theme` de Tailwind v4 en `globals.css` (sin `tailwind.config.js` -- el proyecto
usa el modelo CSS-first). Alias semánticos por modo (`--color-surface`, `--color-text`) vía
`@media (prefers-color-scheme: dark)`. Barrido acotado: botones primarios y links de
auth/perfil/cuentas pasan de `blue-600` ad hoc a los tokens `primary-*`.

Colores por tipo de cuenta (texto ≥4.5:1 en ambos modos, verificado):

| Tipo | Ícono (Iconify) | Acento | Texto claro | Texto oscuro |
|---|---|---|---|---|
| Efectivo | `mdi:cash` | primary | `primary-700` | `primary-300` |
| Débito | `mdi:bank` | indigo | `indigo-700` | `indigo-300` |
| Crédito | `mdi:credit-card` | mustard | `mustard-700` | `mustard-300` |
| Inversión | `mdi:chart-finance` | purple | `purple-500` | `purple-300` |

`secondary` queda como neutro de superficie, no ligado a un tipo de cuenta.

Marca: ícono SVG propio (usuario + columna de banco + candado; no es de Iconify, es la marca
única del proyecto) como `src/app/icon.svg` (favicon automático de Next) + componente `<Logo>`
para los headers de `/`, `/login`, `/register`, `/profile`, `/accounts`, `/forgot-password`,
`/reset-password`.

## Onboarding wizard

`/onboarding`, mobile-first (un paso por pantalla):

1. **Efectivo** (opcional, sin campos de banco): "¿Tienes efectivo que quieras registrar?" --
   nombre + monto.
2. **Cuentas bancarias**: selector de tipo con tarjetas grandes (ícono+color: débito/crédito/
   inversión), agrega una a la vez reutilizando `createAccountAction`.
3. **Resumen**: lista de cuentas creadas con ícono/color/saldo, botón "Terminar" → `/`.

Redirección: si `requireSessionUser()` resuelve pero el usuario tiene 0 cuentas activas, `/`
redirige a `/onboarding` (una sola vez; `/accounts` sigue disponible para altas posteriores, sin
cambios).

## Dashboard visual

`src/app/page.tsx`: tarjetas de crédito con ícono+color por tipo; nuevo desglose "Patrimonio por
tipo" -- barras simples con Tailwind (sin librería de charts nueva) agrupando el disponible real
por `kind` con ícono+color.

## Steps (para /build-plan)

1. Migración `0007` (CHECK) + actualizar `accountCreateSchema` (rama `cash`) -- SQL revisado por
   `dba`.
2. ADR-009: "Efectivo es una cuenta física, no un producto bancario".
3. `npm install @iconify/react`.
4. `globals.css`: tokens `@theme` (tabla de arriba) + alias semánticos dark/light.
5. `src/lib/branding/account-kind.ts`: mapa `kind → {label, icon, colorLight, colorDark}`.
6. `src/app/icon.svg` + componente `<Logo>`; reemplazar headers de las 7 páginas listadas.
7. Barrido de botones/links de auth-profile-recovery a tokens `primary-*`.
8. `AccountManager.tsx`: chip de tipo pasa de texto plano a ícono+color (usa el mapa del paso 5).
9. `/onboarding` (3 pasos) + redirección desde `/` cuando 0 cuentas activas.
10. Dashboard: iconos/colores en tarjetas de crédito + bloque "Patrimonio por tipo".
11. Tests: Zod rechaza `bank`/`number`/`expirationMonth` en la rama `cash`.
12. Docs: `docs/modules/accounts.md` (documenta `chk_cash_no_bank_fields`), nueva fila `branding`
    en `docs-routing.md`, `/docs-sync` (0007), STATE.md, marcar consumida la memoria
    `perfin-onboarding-branding-specs.md`.

## Risks

- Plan grande; si el build revela que amerita dividirse, se registra como amendment en vez de
  forzarlo en una sola sesión.
- La paleta/asignación de colores es una decisión de diseño validada por el usuario en la
  aprobación del plan.
- Sin operaciones irreversibles en este plan.

## Tests / guards

- Unit: Zod rechaza `bank`/`number`/`expirationMonth` en la rama `cash` de `accountCreateSchema`.
- Manual: preview móvil (375px) -- wizard de onboarding de punta a punta, dashboard con
  iconos/colores, `/accounts` con chip de tipo, contraste de texto verificado.
- SQL de `0007` cotejado contra el bloque del `dba` antes de migrar.

## Rollback

Migración: `ALTER TABLE public.account DROP CONSTRAINT chk_cash_no_bank_fields;` (sin pérdida de
datos, tabla vacía). Código/UI: la rama se descarta sin merge.
