# design-system-mobile-kit

status: committed
branch: feat/design-system-mobile-kit
mode: Workshop

## Objetivo

Implementar el aspecto visual del proyecto claude.ai/design "Perfin Design System"
(`ui_kits/mobile-app/index.html`) sobre las funcionalidades existentes del producto.

Decisiones confirmadas por el usuario (2026-07-13):
1. **Dashboard**: adoptar la estructura del kit (Saldo → timeline → Cuentas expandibles →
   Categorías/presupuestos) y **conservar re-tematizados** Por conciliar, confirmación de
   nómina y Patrimonio.
2. **Tokens globales**: migrar TODO el producto a los tokens del kit — neutrales charcoal
   fríos (reemplazan la escala marrón `secondary`), Manrope 400/500, escala tipográfica de
   4 roles (caption 13 / body 16 / heading 20 / display 34), radios/espaciados/motion del kit.
   Verde de marca y acentos mustard/purple/indigo intactos.
3. **Vistas fuera del kit** (/plans, /categories, /profile, /accounts): solo re-tematizar
   (heredan tokens); rediseño estructural en un plan posterior.

## Fuente

Design project `47244022-b2d5-4da1-9758-36b30616e173` ("Perfin Design System"):
`tokens/{colors,typography,spacing}.css`, `ui_kits/mobile-app/*` (README, index.html,
PhoneFrame, Login/Register/Onboarding/Dashboard screens, BalanceTimeline, MorphModal,
NewAccount/NewTransaction/NewBudget/TransactionDetail modals, TransactionsScreen con
MiniCalendar y filtros, data.js). El kit es un click-through: la lógica real (server
actions, repos, dominio) NO cambia — solo la capa visual/UX.

## Pasos

1. `globals.css` + `layout.tsx`: tokens charcoal (secondary-* re-mapeado a la escala
   neutral fría para no romper clases existentes + escala `neutral-*` nueva), semánticos
   surface/surface-muted/surface-raised/border/text/text-muted/accent/accent-strong/
   accent-soft/negative (light/dark vía prefers-color-scheme y `[data-theme]`), Manrope vía
   `next/font`, escala de 4 roles como utilidades `text-*`, radios sm 6/md 12/lg 16,
   `--control-h` 44px, sombras/motion. Alias planos (`--surface`, `--text`, …) para estilos
   inline portados del kit.
2. Primitivas `src/app/components/ui/`: MorphModal (container-transform), ModalSelect,
   MiniCalendar, IconBadge, CircleIconButton, estilos de campo/label/pill.
3. Dashboard (`Dashboard.tsx` y componentes): StatDisplay, secciones Cuentas y Categorías
   con filas expandibles (últimas 3 transacciones + acciones), TransactionsScreen morph con
   filtros, modales morph conectados a acciones reales; ReconcileList/PaydayPrompt/
   Patrimonio conservados y re-tematizados.
4. BalanceTimeline: restyle (línea suave + gradiente, hoy rojo punteado, meses, panel de
   día con MiniCalendar y (+) → modal transacción/proyección) sobre la serie real.
5. Login/Registro/Onboarding: restyle según LoginScreen/RegisterScreen/OnboardingScreen.
6. Re-tema ligero del resto de vistas (correcciones de clases/contraste).
7. Verificación 390px light/dark + build/lint/tests; docs-sync no aplica (cero DDL).

## Riesgos

- Cambio de paleta global puede degradar contraste en pantallas no auditadas — revisar
  con los ratios WCAG de los nuevos tokens.
- Las animaciones morph usan geometría de viewport (position: fixed); en Next se portan a
  componentes cliente — verificar con el layout real (sin PhoneFrame, viewport nativo).
- Cero DDL: no requiere dba ni docs/database.

## Enmiendas (durante la construcción)

- **Onboarding creció a 5 pasos** (el kit lo prescribe y las funcionalidades existen):
  paso 3 crea `income_schedule` real (chips de frecuencia + fecha del próximo pago como
  anchor) y paso 4 crea `fixed_expense` reales (tipo Servicio/Suscripción resuelve las
  categorías seed por nombre; requiere una cuenta creada).
- **Detalle de transacción sin "Eliminar"**: no existe acción de borrado para entries
  normales (`deleteProjection` está acotado a proyecciones de ingreso), así que el modal
  ofrece edición en sitio + "Confirmar movimiento" para proyectadas.
- **`getDashboardV2` extendido** con `entriesByAccount` / `entriesByCategory` (historial
  completo, transferencias en ambas cuentas) para las filas expandibles y la vista de
  transacciones.
- **rAF → setTimeout(30ms)** en los flips de apertura de MorphModal/TransactionsView:
  `requestAnimationFrame` no dispara sin frames de pintura (pestañas en segundo plano y el
  browser pane de verificación), y el timeout produce la misma transición.
- **Componentes retirados**: `EntryModal`, `DayDetail`, `BudgetBars`, `AccountBalanceList`
  (reemplazados por los componentes del kit); `CaptureForm` ya había sido retirado antes.
- **Logo** migrado a la marca "shield-check" del design system (componente + `icon.svg`).
- Limitación del entorno de verificación: el Browser pane no produce frames de pintura
  (screenshots/rAF no disponibles), así que la pasada visual se hizo estructuralmente
  (DOM + estilos computados: tokens, tipografía, alturas 44px, sin overflow a 390px) y
  funcionalmente (captura E2E real: gasto de $125.50 registrado, saldo derivado actualizado,
  detalle/vista morph/wizard verificados). Pendiente una ojeada visual humana en dispositivo.

## Verificación

- `tsc --noEmit` limpio; `vitest` 143/143; `eslint` 0 errores (4 warnings pre-existentes);
  `next build` exitoso.
- Preview 390px dark y light: tokens nuevos activos (surface #070a09 / #ffffff, Manrope,
  radius-sm 6px, control 44px), sin overflow horizontal.
- Flujo real: expandir cuenta → nueva transacción (tabs, monto héroe con centavos, pill de
  contexto) → guardado vía `captureEntry` → revalidación (saldo $5,000.00 → $4,874.50) →
  entry visible en fila, panel del día y `TransactionsView`; detalle con edición en sitio;
  onboarding pasos 1→3 recorridos sin escrituras.
