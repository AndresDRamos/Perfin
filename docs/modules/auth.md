# Module: auth

- Type: auth
- Status: building

## Purpose

User identity: registration, login (by username or email), session resolution, email lifecycle
(possession-proof verification, add/change with confirmation link), password recovery/change, and
the profile view. Supabase Auth is the engine (ADR-006); Perfin owns the `profile` extension, the
username↔email resolution, and the app-owned verification state (ADR-008). The username is the
only visible name app-wide (`display_name` dropped in migration `0005`).

## Key entities / tables

<!-- schema-derived: kept in sync with docs/database/data-dictionary.md (live schema) -->

- `auth.users` — Supabase-managed, referenced only as an FK target (`src/data/schema/auth-users.ts`
  declares the minimal shape drizzle-kit needs to resolve FKs; drizzle-kit never generates DDL for
  it, via `schemaFilter: ["public"]` in `drizzle.config.ts`).
- `profile` (`user_id` PK/FK → `auth.users.id` ON DELETE CASCADE, `username` unique case-
  insensitive, `login_email` unique case-insensitive, `has_real_email`, `email_verified_at`
  nullable — NULL = mailbox possession never proven, timestamps). CHECKs `chk_email_verified_real`
  (verified ⇒ real email) and `chk_login_email_domain` (`has_real_email` ⇔ non-synthetic domain)
  live since migrations `0005`/`0006`.

## Public interface

- Data layer: `src/data/auth-write.ts` — `signUp` (Admin API + `email_confirm: true`, synthetic
  `<username>@users.perfin.internal` email when none given, password + confirmation pair),
  `logIn` (username-or-email → `login_email` → `signInWithPassword`), `logOut`,
  `requestPasswordReset` (only mails accounts with a real email; always resolves generically —
  no enumeration oracle), `resetPassword` (recovery session), `changePassword` (re-authenticates
  with the current password first), `requestEmailChange` (checks uniqueness against `profile`
  before `updateUser` — Supabase only checks `auth.users`), `sendVerificationEmail` (magic link,
  `shouldCreateUser: false`), `confirmEmailPossession` (single sync point: `login_email` +
  `has_real_email` + `email_verified_at` move together), `isSyntheticEmail`.
- `src/data/auth-repo.ts` — `getSessionUser()` (validates the JWT via `supabase.auth.getUser()`,
  joins `profile`, self-repairs the `login_email` mirror if `auth.users.email` drifted) and
  `requireSessionUser()` (throws — used by every other module's server actions to scope queries
  by `userId`). `SessionIdentity` = `{ userId, username, email (null when synthetic),
  emailVerifiedAt }`.
- `src/lib/supabase/{server,client,admin,middleware}.ts` — the four Supabase client flavors.
- `src/middleware.ts` — redirects unauthenticated requests away from every route except
  `/login`, `/register`, `/forgot-password`, `/reset-password` and `/auth/confirm`.
- `src/app/auth/confirm/route.ts` — landing point for every Supabase email link; handles both
  `?code=` and `?token_hash=&type=` styles, routes by the app-set `intent` param (recovery →
  `/reset-password`; email_change / verify → `confirmEmailPossession` → `/profile`).
- UI: `/login`, `/register` (password confirmation, no display name), `/forgot-password`,
  `/reset-password`, `/profile` (username read-only, email section with verification state,
  password change, logout). Shared `src/app/components/PasswordInput.tsx` (show/hide toggle,
  44px touch target — the app is primarily used on mobile). Minimal styling until the branding
  plan lands.
- Server actions: `src/app/actions/auth.ts` (`signUpAction`, `logInAction`, `logOutAction`,
  `forgotPasswordAction`, `resetPasswordAction`, `changePasswordAction`,
  `requestEmailChangeAction`, `sendVerificationEmailAction`).

## Supabase project config (part of the contract — ADR-008)

- Auth → URL Configuration: Site URL + Redirect URLs must include
  `<NEXT_PUBLIC_SITE_URL>/auth/confirm` for every environment.
- Auth → Email: **"Secure email change" OFF** (single confirmation to the new address — the old
  one may be synthetic). Built-in email service (~2-4 mails/hour) until an SMTP plan lands.

## Dependencies

- Every other module's server actions call `requireSessionUser()` first and pass `userId` into
  the data layer (`account-write`, `ledger-write`, `budget-write` and their repos).
- `spaces` (membership determines which accounts a user can see aggregated together).

## Routing notes

What a planner should read/ask before touching this module (feeds `docs-routing.md`).
Read `docs/modules/auth.md` + ADR-006 + ADR-008 + `docs/database/data-dictionary.md`. Ask: does
the change touch the username↔email resolution, the synthetic-email convention, session
validation (`getSessionUser`/`requireSessionUser`), or the email lifecycle (`login_email` mirror,
`email_verified_at`, `/auth/confirm`)? Any change to how `userId` is obtained affects every other
module's data-access scoping; any change to how emails are confirmed must keep the three profile
fields moving together (`confirmEmailPossession`).
