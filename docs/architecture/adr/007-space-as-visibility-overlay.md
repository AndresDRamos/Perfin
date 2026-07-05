# 007. A space is a visibility overlay, not an owner

- Status: accepted
- Date: 2026-07-04

## Context

Perfin is adding shared "spaces" so a couple can see their finances together while each person
still manages their own accounts personally. The schema had zero tenancy before this: no table
had a `user_id`. Two shapes were possible for introducing spaces:

1. Every table (`account`, `plan`, `budget`, `ledger_entry`) gains a `space_id`; a space owns the
   data directly.
2. Each table gains a `user_id` (the account's real owner); a space is a separate overlay that
   references which of a member's accounts are visible inside it.

Shape 1 forces a decision — "which space does this account belong to?" — at account-creation
time, and breaks the "manage your finances 100% personally, no space required" case: an account
would always need a space, even a personal one.

## Decision

**The account belongs to the user, never to a space.** `account.user_id` is set once at creation
and immutable after (same discipline as `kind`/`opening_balance`, enforced in `account-write.ts`,
not the DB). A `space` is a separate aggregate: `space_member` (role: owner/member) tracks who
belongs to it, and `space_account` records "member X exposes account Y to space Z" — pure
visibility, no ownership transfer. **A space's balance is the sum of the accounts its members
have exposed to it**, computed on read, never stored.

`plan`/`budget` (the budgeting layer) gained `user_id` too and stay personal in this plan —
shared/collaborative budgeting across a space is explicitly deferred, not designed here.

Cross-user transfers are prohibited in v1: a `ledger_entry` of kind `transfer` may only move money
between two accounts owned by the same user (enforced in `ledger-write.ts`). Moving money between
a couple's individual accounts has no agreed-upon semantics yet (gift? loan? shared expense?) —
allowing it now and restricting it later is a much bigger break than the reverse.

## Consequences

- **Easier**: personal use requires no space at all — creating one is purely additive. A user can
  belong to multiple spaces (their own + a couple's) without any data migration.
- **Harder**: an "account visible in a space" query is always a join through `space_account`,
  never a direct `account.space_id = ?` filter. Leaving a space requires explicitly cleaning up
  that member's `space_account` rows (application-layer responsibility, not a DB cascade, since
  the invariant "space_account only for accounts whose owner is a member" spans three tables and
  Postgres has no declarative way to express it — see `docs/plans/auth-spaces.md` decision 3).
- **Live with**: no automatic enforcement that a space always has at least one `owner` in
  `space_member`, or that `space_account` rows stay consistent when membership changes — both are
  application-layer invariants (in the not-yet-built `space-write.ts`), not database constraints,
  matching this codebase's existing no-trigger convention (ADRs 001-005, all CHECK/index-based).
