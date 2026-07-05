# auth-profile-recovery - Correo post-registro, recuperación de contraseña y perfil

- Status: verified
- Date: 2026-07-04
- Mode: Review

## Goal

Cerrar el ciclo de vida del correo sobre Supabase Auth (verificación post-registro por posesión,
alta/cambio de correo con confirmación por link) y la recuperación de contraseña; unificar la
identidad en **un solo nombre** (eliminar `profile.display_name` — el username es el nombre
visible) y añadir la vista de perfil configurable. UI mobile-first (la app es principalmente de
uso móvil). Los espacios compartidos siguen diferidos: primero el flujo individual.

## Decisiones de diseño

1. **Un solo nombre**: se elimina `profile.display_name`; el username es lo que se muestra en toda
   la app. El username es **inmutable** desde el perfil en v1 (renombrarlo arrastra el correo
   sintético y el login — plan futuro si se necesita).
2. **Verificación de correo con marcador propio** (`profile.email_verified_at`, NULL = no
   verificado): en v1 todos los usuarios se crean con `email_confirm: true` vía Admin API
   (ADR-006), así que `auth.users.email_confirmed_at` ya no prueba posesión del buzón. La app
   sella el timestamp cuando el usuario demuestra posesión:
   - **Verificar correo existente** (dado en el registro): botón en `/profile` → magic link
     (`signInWithOtp`, `shouldCreateUser: false`) → al consumirse en `/auth/confirm` se sella
     `email_verified_at`.
   - **Añadir/cambiar correo**: `supabase.auth.updateUser({ email })` → Supabase envía
     confirmación **solo al correo nuevo** (requiere "Secure email change" OFF en el dashboard:
     el correo viejo puede ser sintético y nadie leería ese link) → al confirmar,
     `/auth/confirm` sincroniza `profile.login_email = auth.users.email`,
     `has_real_email = true`, `email_verified_at = now()`.
   - **Auto-reparación**: si `auth.users.email` ≠ `profile.login_email` al leer la sesión,
     `auth-repo` reconcilia (cubre callbacks de confirmación que fallaron a la mitad).
3. **Recuperación de contraseña**: `/forgot-password` acepta usuario o correo, resuelve
   server-side a `login_email` y solo llama `resetPasswordForEmail` si `has_real_email`.
   Respuesta **siempre genérica** ("si la cuenta tiene un correo asociado, enviamos un enlace")
   — sin oráculo de enumeración (mismo criterio que `logIn`). `/reset-password` fija la nueva
   contraseña (con confirmación) vía `updateUser({ password })` sobre la sesión de recovery.
   Los usuarios username-only no pueden recuperar contraseña (limitación honesta de v1).
4. **Registro/login UX**: campo "confirmar contraseña" en registro y reset (Zod `refine`
   compartido + validación UI); componente compartido `PasswordInput` con toggle ver/ocultar
   (registro, login, reset, cambio de contraseña). El correo sigue siendo opcional en el
   registro (ADR-006 intacto).
5. **Perfil `/profile`**: username (solo lectura), correo con estado de verificación y acciones
   (verificar / añadir / cambiar), cambio de contraseña (pide la actual y re-autentica con
   `signInWithPassword` antes de `updateUser`), cerrar sesión.
6. **Correo saliente**: servicio integrado de Supabase (límite ~2-4 correos/hora). Aceptado a
   escala personal; SMTP propio fuera de alcance.

## Affected modules

- `auth` (único módulo tocado; sin cambios en accounts/ledger/budgets/spaces).

## DB impact

Migración sobre `profile`, revisada por el sub-agente `dba` contra la base viva (2026-07-04,
3 filas). **Aplicada en dev el 2026-07-04, partida en dos archivos**: `0005_wide_vulture`
(solo el drop — drizzle-kit sin TTY no puede responder el prompt drop-vs-rename cuando la misma
tabla pierde y gana columnas, y de paso la parte irreversible queda aislada) y
`0006_fluffy_rhodey` (columna nueva + CHECKs). SQL cotejado 1:1 contra el bloque del dba;
esquema vivo verificado post-aplicación (columnas y constraints coinciden).

- **(IRREVERSIBLE)** `DROP COLUMN display_name` — destruye 3 valores de dev, no derivables del
  username. Respaldo tomado por el dba (copiar a `migrations-log.md` al aplicar):
  `ana_ramos → 'Ana Ramos'`, `carlosperez → 'Carlos Pérez'`, `aramos → 'Andrés Ramos'`.
- `ADD COLUMN email_verified_at timestamptz NULL` (reversible; sin índice — se lee por PK).
- `CHECK chk_email_verified_real`: `email_verified_at IS NULL OR has_real_email` (verificado ⇒
  correo real; obliga a limpiar el timestamp si `has_real_email` baja a false en el mismo UPDATE).
- `CHECK chk_login_email_domain`: `has_real_email` ⇔ dominio no sintético de `login_email`.
  Validado en vivo: 0 violaciones.

Sin impacto en índices (DROP/ADD nullable son metadata-only), sin cambios RLS/GRANTs (policy
`profile_select_mcp_readonly` y GRANT son table-level; cubren la columna nueva).

Rollback SQL (solo el drop pierde datos; rehidratar desde el respaldo):

```sql
ALTER TABLE "profile" DROP CONSTRAINT "chk_login_email_domain";
ALTER TABLE "profile" DROP CONSTRAINT "chk_email_verified_real";
ALTER TABLE "profile" DROP COLUMN "email_verified_at";
ALTER TABLE "profile" ADD COLUMN "display_name" varchar(100) NOT NULL DEFAULT '';
-- rehidratar display_name desde el respaldo, luego:
ALTER TABLE "profile" ALTER COLUMN "display_name" DROP DEFAULT;
```

## Steps (para /build-plan)

Hechos en fase de plan: esquema Drizzle + migración `0005` aplicada en dev (ver DB impact).

1. ~~Esquema Drizzle `profile.ts`~~ (fase de plan): quitar `displayName`, añadir
   `emailVerifiedAt` + 2 CHECKs; `db:generate` → `0005_*`; cotejar SQL contra el bloque del dba;
   `db:migrate`.
2. Purgar `displayName` del código: `src/data/auth-write.ts` (signUpSchema, `SessionIdentity`,
   `signUp`), `src/data/auth-repo.ts`, `src/app/page.tsx` (mostrar `username`),
   `src/app/register/RegisterForm.tsx`.
3. Componente compartido `src/app/components/PasswordInput.tsx` (toggle ver/ocultar, accesible,
   táctil-cómodo, mobile-first) + campo "confirmar contraseña" en registro (Zod `refine`
   compartido en `auth-write`, p. ej. `passwordPairSchema`).
4. `auth-write.ts`: `requestPasswordReset(identifier)` (resuelve a `login_email`, solo envía si
   `has_real_email`, retorno siempre genérico), `resetPassword(newPassword)` (sesión recovery),
   `requestEmailChange(newEmail)` (valida unicidad contra `profile` antes de `updateUser` —
   Supabase solo valida contra `auth.users`; manejar violación de unique), `sendVerificationEmail()`
   (magic link al `login_email` real), `changePassword(current, new)` (re-auth con
   `signInWithPassword` + `updateUser`), helper `reconcileLoginEmail(userId, authEmail)` (setea
   `login_email`, `has_real_email = true`, `email_verified_at = now()`, `updated_at`).
5. Route handler `src/app/auth/confirm/route.ts`: `verifyOtp({ token_hash, type })`; si
   `type = email_change` → `reconcileLoginEmail`; si magic link (`type = email`) → sellar
   `email_verified_at`. Redirigir a `/profile` con estado (éxito/error) y a `/reset-password`
   cuando `type = recovery`.
6. Páginas `/forgot-password`, `/reset-password`, `/profile` (+ server actions en
   `src/app/actions/auth.ts`); `PUBLIC_PATHS` en `src/lib/supabase/middleware.ts` gana
   `/forgot-password`, `/reset-password` y `/auth/confirm`.
7. `auth-repo.getSessionUser`: quitar `displayName`; reconciliar si `user.email` ≠
   `profile.login_email` (auto-reparación, decisión 2).
8. Config manual del dashboard Supabase (checklist para el usuario): Site URL + Redirect URLs
   (dev y prod → `/auth/confirm`), **"Secure email change" OFF**, plantillas de correo en
   español (opcional).
9. Docs: **ADR-008** (ciclo de vida del correo: `email_verified_at` app-owned, single
   confirmation, recovery solo con correo real); `docs/modules/auth.md`; fila `auth` de
   `docs-routing.md` (añadir email_verified_at/flujos a "Ask up front");
   **`docs/database/README.md`** (cómo aplicar migraciones: `npm run db:migrate` vía pooler,
   gotcha RLS/GRANT `mcp_readonly` para tablas nuevas, journal drizzle); `CLAUDE.md`: nota
   **mobile-first** (uso principalmente móvil); `/docs-sync` para data dictionary/ERD/log;
   STATE.md al commit. Podar `docs/plans/auth-spaces.md` (ya committed) en el commit.
10. Tests (Vitest): `refine` de confirmación de contraseña; resolución de recovery (username /
    correo real / sintético → genérico); `reconcileLoginEmail` (flags + CHECK-compat);
    `requestEmailChange` rechaza correo ya usado por otro perfil.

## Risks

- Los links de correo dependen de la config manual del dashboard (paso 8); si "Secure email
  change" queda ON, los usuarios con correo sintético no pueden completar el cambio.
- Límite de envío del correo integrado de Supabase (~2-4 correos/hora) — aceptado en v1;
  SMTP propio en plan futuro si estorba.
- `verifyOtp` de magic link crea sesión: si el link se abre en otro navegador, inicia sesión
  ahí — aceptable (equivale a magic-link login), pero el handler debe sellar la verificación
  solo para el usuario dueño del token.
- Recovery inutilizable para username-only: mitigado con mensaje en `/profile` invitando a
  añadir y verificar un correo.

## Tests / guards

- Unit (paso 10) + `npm run lint` + `npm run build` + suite completa.
- Manual (preview): registro con confirmación de contraseña y toggle; login con toggle; añadir
  correo desde perfil → link → `login_email`/`has_real_email`/`email_verified_at` actualizados;
  forgot/reset password de punta a punta con correo real; respuesta genérica con username
  sintético; rutas públicas nuevas accesibles sin sesión.
- SQL generado de `0005` cotejado contra el bloque del dba antes de migrar.

## Amendments

Diferencias entre lo planeado y lo construido (2026-07-04):

1. **Migración partida en `0005` + `0006`** (ver DB impact): drizzle-kit sin TTY no puede
   responder el prompt drop-vs-rename. Beneficio lateral: la parte irreversible quedó aislada
   en su propio archivo con el respaldo inline.
2. **`/login` muestra el aviso `notice=link-invalid`** (no estaba en los Steps): `/auth/confirm`
   ya redirigía con ese query param pero nadie lo renderizaba — banner añadido en
   `src/app/login/page.tsx`.
3. **`NEXT_PUBLIC_SITE_URL`** añadida a `env.ts` (default `http://localhost:3000`) y
   `.env.example` — los `redirectTo` de los tres flujos de correo la necesitan.
4. **Verificación** (2026-07-04, preview móvil 375px + DB viva): registro con confirmación de
   contraseña (mismatch rechazado con error en campo), toggle ver/ocultar alternando
   `password↔text` con aria-label correcto, usuario nuevo `test_perfil` creado sin display_name
   (fila en DB con correo sintético + CHECKs satisfechos) y dashboard aislado en $0.00, perfil
   con estado "sin correo", cambio de contraseña rechaza contraseña actual incorrecta,
   forgot-password responde genérico para cuenta sin correo, link inválido → `/login` con aviso.
   Lint 0 errores / 88 tests en verde / build de producción OK. **No verificado de punta a
   punta** (requiere buzón real + config del dashboard, paso 8 pendiente del usuario): entrega
   real de los correos de recovery/cambio/verificación. Usuario de prueba `test_perfil` quedó
   en la DB de dev.

## Rollback

Migración: SQL de rollback en "DB impact" (solo `display_name` pierde datos; respaldo inline).
Código: la rama `feat/auth-profile-recovery` se descarta sin merge. Config Supabase: revertir
"Secure email change" y Redirect URLs no afecta a auth-spaces (no dependía de ellos).
