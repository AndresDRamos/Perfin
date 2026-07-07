# Plans ledger

Append-only registry of every plan that has existed, committed or in flight. `docs/plans/` itself
holds **only in-flight plans** (a committed plan's file is pruned — git history is the archive);
this ledger is how slugs stay unique forever. Never reuse a slug: `git log --follow` would
conflate two plans under one filename.

| Date | Slug | Type | Status | Summary |
| --- | --- | --- | --- | --- |
| 2026-07-06 | onboarding-dashboard-branding | feat | committed | Onboarding wizard, dashboard visual y branding (ADR-009) |
| 2026-07-06 | dashboard-restructure | feat | approved | Dashboard como centro de navegación: saldo actual, timeline −10/+30 días, saldos por cuenta con captura contextual, barras de budgets; tabla `income_schedule` (migración 0008) |
