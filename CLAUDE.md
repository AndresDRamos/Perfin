# Project conventions

## Read first, every session
1. `docs/STATE.md` -- active milestones, risks, and logic.
2. `docs/doc-routing.md` -- which docs to read/skip per module type.
Read only what routing prescribes; do not read the whole `docs/plans/` history.

## Workflow (manual pipeline)
- `/plan-module <type>` -> drafts a plan, then calls `/save-plan NNNN name` on approval.
- `/build-plan NNNN` -> executes a saved plan. Does NOT commit.
- `/commit-plan` -> atomic Conventional Commits + curates STATE.md as a final
  `chore(state): sync repo context`. Asks before committing. Never pushes.
- `/trace-map` -> reconciles the doc-access trace against `doc-routing.md`.

## Subagents
- `dba` -- database expert, **read-only**. Proposes DDL/DML as SQL for human review; never executes.
- `docs-sync` -- regenerates `docs/database/*` from the live schema via the `db` MCP.

## Conventions
- Plans: `docs/plans/NNNN-name.md` (4 digits). ADRs: `docs/architecture/adr/NNN-title.md` (3 digits).
- Plan modes (Reversibility x Density): Fast / Workshop / Review / Architecture.
- Commits: Conventional Commits, atomic (one concern each).
- The `db` MCP uses a read-only (SELECT-only) DB user. Secrets live in `.env` (gitignored), never in
  `.mcp.json` -- use `${VAR}` expansion.
