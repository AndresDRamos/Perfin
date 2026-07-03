# Project conventions

## Read first, every session
1. `docs/STATE.md` -- active milestones, risks, and logic.
2. `docs/docs-routing.md` -- which docs to read/skip per module type.
Read only what routing prescribes; do not read the whole `docs/plans/` history.

## Workflow (user-level skills, `~/.claude/skills/`)
The pipeline skills live at the user level; this repo only keeps the project-specific
`docs-sync` command and the `dba`/`docs-sync` agents.

- `/plan-module <type>` -> full lane: drafts a plan (dba sub-agent for schema changes); on
  approval persists it to `docs/plans/`, materializes migrations and applies them to the dev DB.
  Use for large plans, destructive migrations, or handoffs to another session.
- `/ship-module <type>` -> fast lane: plan + (on approval) build, docs-sync and verify in one
  continuous pass. Use for small-to-medium same-session changes.
- `/build-plan NNNN` -> executes a saved plan, syncs docs, verifies against the plan's objective
  and marks it `status: verified`. Does NOT commit.
- `/commit-plan` -> atomic Conventional Commits + curates STATE.md as a final
  `chore(state): sync repo context`. Refuses if the plan isn't `status: verified`. Asks before
  committing; pushes to the target branch after approval.
- `/trace-map` -> reconciles the doc-access trace against `docs-routing.md`.

Plan lifecycle statuses: `active` (saved) -> `verified` (built + verified) -> committed via
`/commit-plan`.

## Subagents
Project-level agents that intentionally **shadow** the generic user-level ones of the same name
(they carry the `db` MCP + this repo's conventions):
- `dba` -- database expert, **read-only**. Proposes DDL/DML as SQL for human review; never executes.
- `docs-sync` -- regenerates `docs/database/*` from the live schema via the `db` MCP
  (invoked via the project command `/docs-sync`).

Doc-access tracing comes from the **user-level** hook (`~/.claude/hooks/trace-doc-access.mjs`);
the repo defines no hooks of its own. Traces land in `.claude/traces/` (untracked).

## Conventions
- Plans: `docs/plans/NNNN-name.md` (4 digits). ADRs: `docs/architecture/adr/NNN-title.md` (3 digits).
- `docs/plans/` holds **only in-flight plans**: once a plan is committed, prune its file — git
  history is the archive; durable knowledge goes to STATE.md / module docs / ADRs.
- Plan modes (Reversibility x Density): Fast / Workshop / Review / Architecture.
- Commits: Conventional Commits, atomic (one concern each).
- The `db` MCP uses a read-only (SELECT-only) DB user. Secrets live in `.env` (gitignored), never in
  `.mcp.json` -- use `${VAR}` expansion.
