# 006. Supabase Auth as the auth engine, with username-or-email login

- Status: accepted
- Date: 2026-07-04

## Context

Perfin needed real user accounts (multi-user, shared "spaces") but the product requirement was
username-first login, with email optional and only "preferred to activate the account." Rolling a
custom auth stack (password hashing, session tokens, password-reset flows, email verification)
means owning security-critical code for a personal-finance app — exactly where a bug is most
costly. Supabase Auth already provides all of that, audited and maintained, but its native
identifier is email (or phone); it has no first-class concept of "username."

## Decision

**Supabase Auth is the auth engine.** `auth.users` remains Supabase-managed; Perfin never writes
to it directly except via the Admin API at signup. A `profile` table extends it 1:1
(`profile.user_id` PK/FK → `auth.users.id`) and owns:

- `username` (unique, case-insensitive) — what the user sees and types to log in.
- `login_email` — mirrors whatever `auth.users.email` actually is; the value
  `signInWithPassword` is actually called with.
- `has_real_email` — whether `login_email` is a real, user-provided address or a synthetic one.

At signup, if the user provides no email, `auth-write.ts` generates a synthetic
`<username>@users.perfin.internal` address and uses it as `auth.users.email` — the user never
sees it. Login accepts either username or email; `auth-write.logIn` resolves the identifier to
`login_email` via a `profile` lookup, then calls `signInWithPassword` with the resolved value.

v1 has no email-delivery pipeline (no SMTP/templates configured yet), so every user — real or
synthetic email — is created via the Admin API with `email_confirm: true`. Nobody is blocked
behind a confirmation link they may never receive. `has_real_email` is not a login gate; it only
marks whether we have a legitimate contact address for future features (password reset,
notifications).

## Consequences

- **Easier**: password hashing, session/JWT handling, and the security-sensitive parts of auth are
  Supabase's problem, not Perfin's. Adding OAuth providers later is a Supabase Auth config change.
- **Harder**: every login path (server actions, `getSessionUser`) must resolve through `profile`
  first — there's no direct "log in with this row" shortcut. Changing a user's email post-signup
  needs `profile.login_email` kept in sync with `auth.users.email`, which is out of scope for this
  ADR (no confirmation-email flow exists yet to do this safely).
- **Live with**: synthetic emails at `users.perfin.internal` are permanent placeholders unless a
  future plan adds an email-change flow. Real-email users get no confirmation step in v1 either —
  acceptable for an invite-only/couple-scale app, revisit once SMTP is configured and open
  registration is truly public-facing.
