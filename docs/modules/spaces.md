# Module: spaces

- Type: spaces
- Status: building

## Purpose

Shared visibility overlay so a couple (or any group) can see an aggregated view of the accounts
its members choose to expose, without either person losing full personal ownership/control of
their own accounts. A space owns nothing; it aggregates (ADR-007).

## Key entities / tables

<!-- schema-derived: kept in sync with docs/database/data-dictionary.md (live schema) -->

- `space` (`id` identity PK, `name`, `created_by` nullable FK → `auth.users` ON DELETE SET NULL —
  informational only, not an authority column).
- `space_member` (PK `(space_id, user_id)`, `role` enum `owner`/`member`, `joined_at`). FKs ON
  DELETE CASCADE both ways.
- `space_account` (PK `(space_id, account_id)`, `shared_by` FK → `auth.users`, `shared_at`). FKs
  to `space`/`account` ON DELETE CASCADE. Represents "member `shared_by` exposed `account_id` to
  `space_id`" — pure visibility, `account.user_id` (the real owner) never changes.

Live since migration `0004_marvelous_tigra`. No data-layer module exists yet — schema only.

## Public interface

Not yet built (deferred to a follow-up plan; see `docs/plans/auth-spaces.md` "Fuera de alcance").
Planned: `space-write.ts` (create space, invite/remove member, expose/hide account — each of
these enforces the invariants below in application code, no DB triggers) and `space-repo.ts`
(list a user's spaces, aggregate balance of a space = sum of its exposed accounts' balances).

## Dependencies

- `auth` (membership is keyed by `auth.users.id`; every space action needs `requireSessionUser()`).
- `accounts` (`space_account.account_id` → `account.id`; a space can only expose accounts, never
  create or own them).

## Routing notes

What a planner should read/ask before touching this module (feeds `docs-routing.md`).
Read `docs/modules/spaces.md` + ADR-007 + `docs/modules/accounts.md` +
`docs/database/data-dictionary.md`. Ask: does the change touch the "account owner must be a space
member" invariant, or the "at least one owner per space" invariant? Both are enforced in
application code (not the DB — see ADR-007), so any new write path must re-check them explicitly.
