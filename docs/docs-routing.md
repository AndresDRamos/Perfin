# Doc Routing

Self-managed routing table. Maps each module type to which docs to read, which to skip, and which
questions to ask up front. `/trace-map` reconciles this against the measured doc-access trace each
session and proposes corrections.

> Blind spot: the trace captures docs opened via Read/Grep/Glob only. It does NOT capture
> `CLAUDE.md` auto-load or `@`-mentions. Account for that when reading trace-map's report.

| Module type | Read | Skip | Ask up front |
| --- | --- | --- | --- |
| accounts | docs/modules/accounts.md; docs/database/data-dictionary.md | docs/plans/* (history) | Which account type(s)? Does it touch the opening-balance or derived-balance contract? |
| ledger | docs/modules/ledger.md; docs/modules/accounts.md; docs/database/data-dictionary.md | docs/plans/* (history) | Which kind (income/expense/transfer)? cleared vs projected? Does it touch balance derivation? |
| budgets | docs/modules/budgets.md; docs/modules/ledger.md; docs/database/data-dictionary.md | docs/plans/* (history) | Which sub-type (category cap / savings reservation / purchase goal)? Binds to real or projected available? |
| catalog | docs/modules/catalog.md; docs/database/data-dictionary.md | docs/plans/* (history) | Income or expense catalog? Touches the reserved `savings` category or the fixed-expense recurrence engine? |
| auth | docs/modules/auth.md; docs/architecture/adr/006-supabase-auth-username-login.md; docs/architecture/adr/008-email-lifecycle-post-registro.md; docs/database/data-dictionary.md | docs/plans/* (history) | Touches the `profile` table, the username↔email resolution, session validation (`getSessionUser`/`requireSessionUser`), or the email lifecycle (`login_email` mirror, `email_verified_at`, `/auth/confirm`)? |
| spaces | docs/modules/spaces.md; docs/architecture/adr/007-space-as-visibility-overlay.md; docs/modules/accounts.md; docs/database/data-dictionary.md | docs/plans/* (history) | Touches the "account owner must be a space member" or "at least one owner per space" invariants? Both are app-layer, not DB. |
| branding | docs/modules/accounts.md (Branding section); docs/architecture/adr/009-cash-is-not-a-bank-product.md | docs/plans/* (history) | Touches the color-token scale (`src/app/globals.css` `@theme`) or the per-kind icon/color map (`src/lib/branding/account-kind.ts`)? Any new solid-fill class must be added as a literal string there, never derived at runtime. |
