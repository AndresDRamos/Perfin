---
description: Save the approved plan into docs/plans with the assigned number and name.
argument-hint: [NNNN] [plan-name]
allowed-tools: Read, Write, Glob
---

Take the **already-approved** plan from this session's context and persist it.

- Number and name: from "$ARGUMENTS". If missing, ask for them.
- Use the structure in @docs/plans/_template.md.
- Write `docs/plans/NNNN-name.md` with NNNN as 4 digits (zero-padded).
- If that number already exists, **do not overwrite**: warn and ask for another.
- Do not touch `STATE.md` (that is `/commit-plan`'s job, after building).

Confirm the final file path.
