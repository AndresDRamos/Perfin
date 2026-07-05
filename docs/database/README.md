# Base de datos — cómo aplicar migraciones

Memoria operativa del repo para el ciclo de migraciones (Drizzle + Supabase Postgres). Los
documentos hermanos (`data-dictionary.md`, `erd.md`, `migrations-log.md`) se regeneran desde el
esquema vivo con `/docs-sync`; este README no — se mantiene a mano.

## Ciclo normal (un plan aprobado con cambios de esquema)

1. **Editar el esquema declarativo** en `src/data/schema/*.ts` — nunca SQL a mano primero.
2. **Generar**: `npm run db:generate` → emite `drizzle/NNNN_<nombre>.sql` auto-numerado.
   - Sin TTY (sesiones de agente), drizzle-kit **no puede responder el prompt drop-vs-rename**
     que aparece cuando una misma tabla pierde y gana columnas en el mismo diff. Solución:
     generar en dos pasos (primero el drop, luego el add) — así quedaron `0005`/`0006`.
3. **Cotejar el SQL** contra la propuesta del sub-agente `dba` del plan antes de aplicar.
   Editar el SQL generado a mano es válido *antes* de aplicarlo (p. ej. respaldos inline como
   en `0005`, o quitar DDL de `auth.*` como en `0004`).
4. **Aplicar**: `npm run db:migrate` — usa la URL del **pooler** en `.env` (la URL directa es
   IPv6-only desde esta red y está comentada en `.env`; ver `.env.example`).
5. **Verificar** contra la base viva vía el MCP `db` (columnas, constraints, policies).
6. **`/docs-sync`** para regenerar data dictionary, ERD y migrations-log.

## Gotchas que ya mordieron

- **RLS + `mcp_readonly`**: toda tabla nueva de `public` debe declarar
  `pgPolicy("<tabla>_select_mcp_readonly", ...)` en Drizzle **y** un `GRANT SELECT ... TO
  "mcp_readonly"` añadido a mano en su migración (drizzle-kit no administra grants). Si falta,
  el MCP `db` ve la tabla **vacía** (filas, no esquema, desaparecen en silencio) — así se produjo
  el falso "0 filas" del plan auth-spaces.
- **`auth.users`**: referencia externa declarada con `pgSchema("auth")` +
  `schemaFilter: ["public"]`; si `db:generate` emitiera `CREATE SCHEMA "auth"` / `CREATE TABLE
  "auth"."users"`, quitarlos del SQL a mano (pasó en `0004`; generaciones posteriores ya no los
  re-emiten).
- **Migraciones destructivas**: respaldar los datos afectados inline (comentario en el SQL +
  entrada en `migrations-log.md`) antes de aplicar, como el drop de `display_name` en `0005`.
- **`SET NOT NULL` / backfill**: si la tabla tiene filas, backfillear y verificar 0 NULLs antes
  del `SET NOT NULL` (ver riesgo documentado en el plan auth-spaces para `user_id`).
- **Usuarios dev**: crear siempre vía signup normal de Supabase (nunca INSERT crudo a
  `auth.users`).

## Roles y conexiones

- La app conecta como owner de las tablas (bypassa RLS); el aislamiento por usuario vive en la
  capa de server actions (`WHERE user_id = session.userId`) — ver STATE.md, riesgo "RLS
  habilitado pero sin policies por usuario".
- El MCP `db` conecta como `mcp_readonly` (SELECT-only). Secretos en `.env` (gitignored), nunca
  en `.mcp.json` — usar expansión `${VAR}`.
