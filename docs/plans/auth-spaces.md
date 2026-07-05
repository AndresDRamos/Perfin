# auth-spaces - Autenticación y espacios compartidos (modelo de datos + auth mínima)

- Status: committed
- Date: 2026-07-03
- Mode: Architecture

## Goal

Introducir identidad de usuario (Supabase Auth con login por username o email) y el modelo de
datos de espacios compartidos (el espacio es un overlay de **visibilidad** de cuentas, nunca su
dueño), dejando el aislamiento por usuario en la capa de server actions. No incluye UI de
onboarding/dashboard, gestión de espacios, ni RLS.

## Decisiones (a formalizar como ADR-006 y ADR-007 en el build)

1. **Motor de auth = Supabase Auth**, no auth casero. Username es lo que el usuario ve; internamente
   todo usuario tiene un email en `auth.users`. `profile.login_email` es el espejo usado para
   `signInWithPassword`; si el usuario registró sin correo se genera uno sintético
   (`<username>@users.perfin.internal`, `has_real_email = false`). Login acepta username o email y
   resuelve server-side a `login_email`. Cambio/confirmación de correo post-registro: fuera de
   alcance.
2. **La cuenta pertenece al usuario** (`account.user_id`, inmutable tras creación, mismo patrón que
   `kind`/`opening_balance`: enforced en `account-write`, sin triggers). Un `space` agrega
   visibilidad vía `space_account`; el saldo del espacio es la **suma de las cuentas expuestas**.
3. **Sin triggers en DB** (el esquema sigue 100% declarativo: CHECK + índices). Invariantes
   cross-tabla viven en la capa de escritura:
   - Transferencias cross-usuario prohibidas en v1 (`ledger-write` valida que `to_account_id`
     pertenezca al mismo dueño).
   - `space_account` solo para cuentas cuyo dueño es miembro del espacio; al salir un miembro se
     limpian sus `space_account` (futuro `space-write`).
   - Al menos un `owner` por espacio (futuro `space-write`).
4. **Categorías siguen siendo catálogo global** (sin `user_id`): son metadata de clasificación, no
   datos financieros; evita duplicar el singleton `is_savings` por usuario y el arranque en cero.
5. **RLS habilitado pero sin policies de usuario (aislamiento sigue en server actions).** Hallazgo
   durante la aplicación: RLS ya estaba habilitado en las 6 tablas de `public` (activado fuera de
   migraciones, vía dashboard Supabase) con 0 policies. La app no lo nota porque conecta como
   `postgres` (owner ⇒ bypass), pero dejaba **ciego al MCP `db`** (`mcp_readonly` veía todas las
   tablas vacías — así se produjo el falso "0 filas" del dba). Decisión (usuario, 2026-07-03):
   mantener RLS habilitado (fail-closed para roles no-owner), codificarlo en el esquema Drizzle
   (`pgPolicy` por tabla) y dar a `mcp_readonly` una policy `FOR SELECT USING (true)` por tabla +
   GRANT en las tablas nuevas. Las policies por-usuario (`auth.uid()`) siguen diferidas: requieren
   rol no-owner para la app + propagación del JWT por transacción — plan futuro. Aislamiento real:
   `WHERE user_id = session.userId` explícito en cada repo/action. Registrar en STATE.md.
6. `ledger_entry.user_id` **denormalizado** desde `account.user_id` (se copia en `ledger-write` al
   insertar): evita joins en el hot path y deja listo el camino para RLS.
7. `plan.user_id` con `ON DELETE CASCADE` (planes desechables); `account.user_id` y
   `ledger_entry.user_id` con `ON DELETE RESTRICT` (nunca perder al dueño de dinero real).
   `budget` no cambia: hereda vía `plan_id`.

## Affected modules

- Nuevos: `auth`, `spaces` (solo esquema en este plan).
- Tocados (esquema): `accounts`, `ledger`, `budgets` (plan).

## DB impact

Migración `0004_marvelous_tigra`, **aplicada en dev el 2026-07-03**. Revisada por el sub-agente
`dba` (sin drift de esquema contra el data dictionary). Nota: el dba reportó "tablas vacías" pero
era un falso negativo por el RLS sin policies (ver decisión 5); en realidad `plan` tenía 1 fila de
prueba ("Semana 27") + 1 `budget`, eliminados con aprobación del usuario antes de aplicar:

- `profile`: PK `user_id uuid` → FK `auth.users(id)` ON DELETE CASCADE; `username` varchar(30)
  NOT NULL, `chk_username_format` (`^[a-z0-9_]{3,30}$`), único case-insensitive; `display_name`
  varchar(100) NOT NULL; `login_email` varchar(255) NOT NULL único ci; `has_real_email` boolean
  NOT NULL default false; timestamps.
- `space`: id identity PK; `name` varchar(100); `created_by uuid` **nullable** → FK `auth.users`
  ON DELETE SET NULL (metadata informativa, no bloquea borrado de usuarios).
- `space_member`: PK compuesta (`space_id`, `user_id`); enum `space_role` (`owner`|`member`),
  default `member`; FKs ON DELETE CASCADE ambas; índice por `user_id` (membresías por request).
- `space_account`: PK compuesta (`space_id`, `account_id`); `shared_by uuid` NOT NULL → FK
  `auth.users`; FKs a `space`/`account` ON DELETE CASCADE; índice por `account_id`.
- `account` + `user_id uuid NOT NULL` → FK `auth.users` ON DELETE RESTRICT; índice
  `idx_account_user_id`.
- `plan` + `user_id uuid NOT NULL` → FK `auth.users` ON DELETE CASCADE; índice `idx_plan_user_id`.
- `ledger_entry` + `user_id uuid NOT NULL` → FK `auth.users` ON DELETE RESTRICT; se reemplaza
  `idx_ledger_entry_account_status` por `idx_ledger_entry_user_account_status`
  (`user_id`, `account_id`, `status`); nuevo `idx_ledger_entry_user_occurred_at`.
- RLS: `ENABLE ROW LEVEL SECURITY` en las 10 tablas (codifica lo ya activado por dashboard en las
  6 existentes) + policy `<tabla>_select_mcp_readonly FOR SELECT USING (true)` por tabla
  (declaradas en Drizzle vía `pgPolicy` + rol `pgRole("mcp_readonly").existing()` en
  `src/data/schema/roles.ts`) + `GRANT SELECT` a `mcp_readonly` en las 4 tablas nuevas (añadido a
  mano en el SQL; drizzle-kit no administra grants).
- Drizzle: referencia externa `auth.users` declarada con `pgSchema("auth")` +
  `schemaFilter: ["public"]` en `drizzle.config.ts`. **Gotcha**: `db:generate` aún emitió
  `CREATE SCHEMA "auth"` / `CREATE TABLE "auth"."users"`; se removieron a mano del SQL (quedan
  solo en el snapshot para resolver FKs — generaciones futuras ya no los re-emiten).

**Riesgo/irreversibilidad**: los `SET NOT NULL` fallarían con filas sin backfill. Hoy las tablas
de dominio están vacías en dev (verificado por `dba`), así que la migración es segura *ahora*. Si
se siembra data antes de aplicar en otro entorno: crear usuario dev vía signup normal de Supabase
(nunca INSERT crudo a `auth.users`), backfillear `user_id` (account y plan primero, ledger después
vía JOIN a account) y verificar 0 NULLs antes del `SET NOT NULL`.

## Steps (para /build-plan)

Hechos en fase de plan: esquema Drizzle + migración `0004` aplicada en dev (ver DB impact).

1. Instalar `@supabase/supabase-js` + `@supabase/ssr`. Clientes server/browser
   (`src/lib/supabase/server.ts`, `client.ts`). Env: `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` en `.env` (gitignored) + `.env.example`.
2. `src/data/auth-write.ts`: `signUp` (valida username contra `chk_username_format`, genera email
   sintético si no hay correo, crea `auth.users` vía `supabase.auth.signUp` + inserta `profile`),
   `logIn` (resuelve identifier → `login_email` consultando `profile`, luego
   `signInWithPassword`), `logOut`. Zod en los tres.
3. `src/data/auth-repo.ts`: `getSessionUser()` (server-side; lee la sesión Supabase y devuelve
   `{ userId, username, displayName }` o null).
4. `middleware.ts`: rutas protegidas (todo excepto `/login`, `/register`, assets) redirigen a
   `/login` sin sesión.
5. UI mínima: `/login` (identifier + password), `/register` (username, display name, email
   opcional, password). Sin estilos elaborados; solo probar el flujo.
6. `ledger-write.ts`: al insertar/actualizar, copiar `user_id` desde `account.userId`; rechazar
   transferencias donde `to_account_id` pertenezca a otro usuario.
7. `account-write.ts`: `user_id` viene de la sesión al crear; inmutable después (mismo trato que
   `kind`/`opening_balance`).
8. Repos (`account-repo`, `ledger-repo`, `budget-repo`, plan): `WHERE user_id = sessionUserId`
   explícito en toda query. Server actions obtienen el userId vía `getSessionUser()`; nunca del
   cliente.
9. Docs: ADR-006 (Supabase Auth + resolución username→login_email), ADR-007 (espacio como overlay
   de visibilidad; saldo = suma de cuentas expuestas); `docs/modules/auth.md`,
   `docs/modules/spaces.md`; filas `auth` y `spaces` en `docs-routing.md`; `/docs-sync` para el
   data dictionary; STATE.md: riesgo activo "RLS diferido — aislamiento vive en server actions".

## Fuera de alcance (planes siguientes)

- Gestión de espacios (crear, invitar, exponer cuentas, vista agregada del espacio).
- Onboarding wizard (alta de cuentas guiada) y dashboard visual del patrimonio.
- Confirmación/cambio de correo post-registro; recuperación de contraseña.
- RLS como defensa en profundidad.
- Marca de cuenta de nómina + proyección de próximo ingreso (visión registrada en memoria).

## Risks

- Email sintético: si Supabase tiene "confirm email" activado, los usuarios sin correo real no
  podrían confirmar. El build debe configurar el proyecto Supabase con confirmación desactivada
  (registro abierto) o auto-confirm para dominios sintéticos.
- Aislamiento depende de disciplina en repos/actions (RLS habilitado pero sin policies de
  usuario): mitigar con revisión de que TODA query de dominio filtre por `user_id`.
- Toda tabla nueva de `public` debe declarar su `pgPolicy` de `mcp_readonly` (+ GRANT a mano en la
  migración) o el MCP `db` la verá vacía — exactamente el falso negativo que ocurrió en este plan.

## Tests / guards

- Unit: resolución identifier→login_email (username, email real, email sintético); generación de
  email sintético; rechazo de transferencia cross-usuario en `ledger-write`.
- Manual: registro sin correo → login por username; registro con correo → login por ambos;
  ruta protegida redirige sin sesión.
- SQL generado de `0004` revisado contra la sección "DB impact" antes de migrar.

## Amendments

Diferencias entre lo planeado y lo construido (2026-07-04), sin reescribir los Steps originales:

1. **`middleware.ts` debe vivir en `src/middleware.ts`**, no en la raíz del proyecto. El paso 4
   original no lo especificaba; con la estructura `src/app` de Next.js, un `middleware.ts` en la
   raíz nunca se compila ni se ejecuta (fallo silencioso -- ninguna ruta quedaba protegida hasta
   moverlo). Next 16 además marca `middleware.ts` como convención deprecated en favor de
   `proxy.ts`; se mantuvo `middleware.ts` por ahora (funciona, solo advertencia) -- revisar
   migración a `proxy.ts` en un plan futuro si Next lo retira.
2. **`SUPABASE_SERVICE_ROLE_KEY` fue necesaria** además de las dos variables públicas del paso 1:
   `signUp` crea el usuario vía el Admin API (`auth.admin.createUser`) para poder forzar
   `email_confirm: true` sin depender de un pipeline de correo. Es un secreto server-only, nunca
   `NEXT_PUBLIC_`; documentado en `.env.example` y `src/lib/supabase/admin.ts`.
3. **Todo usuario se crea con `email_confirm: true` en v1**, no solo los de correo sintético. Sin
   SMTP/plantillas configuradas en Supabase, no hay forma de entregarle un correo de confirmación
   a nadie -- forzarlo para todos evita bloquear también a quienes sí dieron un correo real. Esto
   difiere de la visión original ("correo opcional y preferente para activar el usuario"): en v1,
   dar un correo real no activa ni desbloquea nada todavía, solo se guarda (`has_real_email`) para
   una futura funcionalidad de recuperación de contraseña/notificaciones. Registrado también en
   ADR-006.
4. **`vitest.config.ts`** necesitó las 3 variables de Supabase en `test.env` (valores dummy) porque
   `src/lib/env.ts` ahora las valida al importar `./db`, y varios tests importan módulos de
   escritura que arrastran esa cadena -- sin esto, 3 archivos de test fallaban en la carga, no en
   las aserciones.
5b. **Usuario case-insensitive al escribir** (2026-07-04, feedback post-verificación): el usuario
    puede teclear "CarlosPerez" y se normaliza a minúsculas (`carlosperez`) antes de validar contra
    `chk_username_format` y de generar el correo sintético -- no se le fuerza a pensar en
    mayúsculas/minúsculas para un nombre que quiere que sea fácil de recordar. El regex en sí no
    cambió (números/guion bajo siguen siendo opcionales, nunca fueron obligatorios); se corrigió el
    texto de ayuda del formulario, que sonaba a requisito sin serlo.
5. **Verificación manual real** (no solo lint/build/tests): registro sin correo → login por
   username, logout, y carga de `/accounts` con sesión activa, contra la base de dev vía
   `preview_start`. Confirmado: dashboard aísla correctamente a un usuario nuevo (disponible en
   $0.00, sin cuentas ajenas visibles) y el catálogo de categorías (global) sí es visible.

## Rollback

Sin datos en dev: `drizzle-kit drop` de la migración `0004` o revertir con DROP TABLE
`profile`/`space`/`space_member`/`space_account` + ALTER DROP COLUMN `user_id` en
`account`/`plan`/`ledger_entry` + recrear `idx_ledger_entry_account_status`. La rama se descarta
sin merge.
