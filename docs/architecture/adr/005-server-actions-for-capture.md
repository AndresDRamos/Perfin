# 005. Server Actions for transaction capture

- Status: accepted
- Date: 2026-06-28

## Context

The app is a single-user personal finance tracker. Write operations (create account, record a
transaction, mark projected→cleared) are low-volume but need to feel fast. The two main alternatives
are a REST/tRPC API layer or Next.js Server Actions (App Router).

A dedicated API layer adds routing boilerplate, a separate validation layer, and network round-trips
for what is ultimately a direct DB write from the same host. Server Actions let the mutation live
co-located with the UI component, skip the network serialization for the happy path, and revalidate
the cache automatically in one call.

The main drawback of Server Actions is coupling to Next.js. For a single-user personal app that is
already fully committed to Next.js App Router (ADR-001 stack), this coupling is acceptable.

## Decision

**Use Next.js Server Actions for all write operations (create, update, delete).**

- Actions live in `src/server/actions/` (one file per domain area, e.g. `accounts.ts`,
  `ledger.ts`).
- Each action validates input with Zod, calls a `data/repositories/` function, and returns a
  typed result `{ ok: true, data } | { ok: false, error }`.
- Read-heavy pages (balance derivation, budget actuals) use Server Components that call repository
  functions directly — no Server Action needed.
- If a public API surface is ever needed (mobile app, CLI import), wrap the repository layer in
  a Route Handler at that point. The domain and data layers are already decoupled from the
  Next.js boundary.

## Consequences

- **Easier**: zero API boilerplate, automatic cache revalidation, co-located mutations, no
  client-side fetch management for writes.
- **Harder**: tight coupling to Next.js for mutations; cannot call these actions outside the
  Next.js runtime without a wrapper.
- **Live with**: mutations are the minority of the code surface. The domain and data layers are
  fully portable; only the action files are Next.js-specific.
