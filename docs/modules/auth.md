# Module: auth

- Type: auth
- Status: building

## Purpose

User identity: registration, login (by username or email), and session resolution. Supabase Auth
is the engine (ADR-006); Perfin owns only the `profile` extension and the username↔email
resolution around it.

## Key entities / tables

<!-- schema-derived: kept in sync with docs/database/data-dictionary.md (live schema) -->

- `auth.users` — Supabase-managed, referenced only as an FK target (`src/data/schema/auth-users.ts`
  declares the minimal shape drizzle-kit needs to resolve FKs; drizzle-kit never generates DDL for
  it, via `schemaFilter: ["public"]` in `drizzle.config.ts`).
- `profile` (`user_id` PK/FK → `auth.users.id` ON DELETE CASCADE, `username` unique case-
  insensitive, `display_name`, `login_email` unique case-insensitive, `has_real_email`,
  timestamps). Live since migration `0004_marvelous_tigra`.

## Public interface

- Data layer: `src/data/auth-write.ts` — `signUp` (creates the `auth.users` row via the Admin API
  with `email_confirm: true`, generates a synthetic `<username>@users.perfin.internal` email when
  none is given, inserts `profile`, then signs in), `logIn` (resolves username-or-email to
  `login_email` via `profile`, then `signInWithPassword`), `logOut`.
- `src/data/auth-repo.ts` — `getSessionUser()` (validates the session JWT via
  `supabase.auth.getUser()`, joins `profile`; returns `null` if unauthenticated) and
  `requireSessionUser()` (throws instead — used by every other module's server actions to scope
  queries by `userId`).
- `src/lib/supabase/{server,client,admin,middleware}.ts` — the four Supabase client flavors
  (cookie-bound server client, browser client, service-role admin client, Edge middleware client).
  `client.ts` and `middleware.ts` read `process.env.NEXT_PUBLIC_*` directly rather than through the
  shared `src/lib/env.ts`, since that module also validates server-only secrets that don't exist in
  the browser/Edge bundle.
- `src/middleware.ts` (must live under `src/`, not the project root, because the app uses a `src/`
  layout) redirects unauthenticated requests away from every route except `/login` and `/register`.
- UI: `/login`, `/register` (`src/app/login/`, `src/app/register/`) — minimal forms, no styling
  investment yet.
- Server actions: `src/app/actions/auth.ts` (`signUpAction`, `logInAction`, `logOutAction`).

## Dependencies

- Every other module's server actions call `requireSessionUser()` first and pass `userId` into
  the data layer (`account-write`, `ledger-write`, `budget-write` and their repos) — see
  `docs/plans/auth-spaces.md` for the full propagation.
- `spaces` (membership determines which accounts a user can see aggregated together).

## Routing notes

What a planner should read/ask before touching this module (feeds `docs-routing.md`).
Read `docs/modules/auth.md` + ADR-006 + `docs/database/data-dictionary.md`. Ask: does the change
touch the username↔email resolution, the synthetic-email convention, or session validation
(`getSessionUser` vs `requireSessionUser`)? Any change to how `userId` is obtained affects every
other module's data-access scoping.
