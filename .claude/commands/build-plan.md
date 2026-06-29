---
description: Execute a saved plan by its number. Does not commit.
argument-hint: [NNNN]
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

## 1. Load the plan
Read `docs/plans/$1-*.md`. If it does not exist, stop and say so.

## 2. Re-contextualize
Read @docs/STATE.md and, per @docs/doc-routing.md, the docs for the affected modules.

## 3. Execute
Implement the plan step by step, respecting its **mode**:
- **Fast**: direct, reversible changes.
- **Workshop / Review**: more friction, intermediate validation.
- **Architecture**: dense / low-reversibility changes -> propose before touching, and record an ADR.

For schema changes, delegate to `dba` (review) and, once applied, to `docs-sync`
(regenerate data-dictionary / erd / migrations-log). Run the relevant tests/guards.

## 4. Close
**Do not commit** (that is `/commit-plan`). Leave a clean, reviewable diff, and summarize what got
done vs. what was planned, flagging any deviation.
