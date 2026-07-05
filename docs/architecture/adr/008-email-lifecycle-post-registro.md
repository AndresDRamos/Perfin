# 008. Ciclo de vida del correo post-registro: verificación por posesión app-owned

- Status: accepted
- Date: 2026-07-04

## Context

ADR-006 dejó el correo como dato opcional y sin ciclo de vida: todo usuario se crea vía Admin API
con `email_confirm: true` (no hay pipeline de correo que entregue confirmaciones bloqueantes), así
que `auth.users.email_confirmed_at` está sellado para todos y **no prueba posesión del buzón**.
Sin esa prueba no hay recuperación de contraseña confiable ni forma segura de cambiar el correo.
Además, el usuario decidió unificar la identidad visible: el username es el único nombre
(`display_name` eliminado en la migración `0005`).

## Decision

1. **La prueba de posesión es de la app, no de Supabase**: `profile.email_verified_at`
   (timestamptz NULL). Se sella únicamente cuando el usuario consume un link recibido en su
   buzón. Dos CHECKs amarran los invariantes en DB: `chk_email_verified_real` (verificado ⇒
   `has_real_email`) y `chk_login_email_domain` (`has_real_email` ⇔ dominio no sintético).
2. **Un único punto de sincronización** (`confirmEmailPossession` en `auth-write.ts`): mueve
   `login_email`, `has_real_email` y `email_verified_at` juntos, de modo que los CHECKs se
   cumplen por construcción. Lo invocan el callback `/auth/confirm` (cambio de correo y
   verificación) y la auto-reparación de `getSessionUser` cuando `auth.users.email` difiere del
   espejo `profile.login_email` (callback que murió a mitad).
3. **Verificar un correo existente** (dado en el registro): magic link de Supabase
   (`signInWithOtp`, `shouldCreateUser: false`) — consumirlo prueba posesión; el handler sella
   `email_verified_at`. No se usa el flujo de confirmación de signup porque el usuario ya está
   confirmado a ojos de Supabase.
4. **Añadir/cambiar correo**: `updateUser({ email })` con **"Secure email change" OFF** en el
   proyecto Supabase — la confirmación viaja solo al correo nuevo, porque el viejo puede ser
   sintético (nadie leería ese link). El perfil no cambia hasta que el link se consume.
5. **Recuperación de contraseña**: `resetPasswordForEmail` solo si el identificador resuelve a
   un perfil con `has_real_email`; la respuesta es siempre genérica (mismo criterio
   anti-enumeración que el login). Las cuentas username-only **no pueden recuperar contraseña**
   en v1 — la UI del perfil las empuja a añadir un correo.
6. **Todos los links aterrizan en `/auth/confirm`** (route handler público), que soporta ambos
   estilos de link (`?code=` de las plantillas stock y `?token_hash=&type=`) y enruta por el
   query param `intent` que la app fija al solicitar el correo.

## Consequences

- **Easier**: recuperación de contraseña y cambio de correo funcionan sin SMTP propio (servicio
  integrado de Supabase, límite ~2-4 correos/hora, aceptado a escala personal); el estado de
  verificación es consultable en `profile` sin tocar `auth.users`.
- **Harder**: la config del dashboard es parte del contrato (Redirect URLs + Secure email change
  OFF); si se enciende Secure email change, los usuarios con correo sintético quedan atrapados.
- **Live with**: el magic link de verificación también inicia sesión donde se abra — equivale a
  un login legítimo por correo, aceptado. `email_confirmed_at` de Supabase queda sin significado
  para siempre en cuentas creadas en v1; la verdad vive en `profile.email_verified_at`.
