---
description: Start a module/change: read the active state, follow the routing table, and produce a plan for approval.
argument-hint: [module type / change name]
allowed-tools: Read, Glob, Grep, Bash
---

You **plan, you do not implement**.

## 1. Read the active state (in this order)
1. @docs/STATE.md -- active milestones, risks, and logic.
2. @docs/doc-routing.md -- based on the type in "$ARGUMENTS", decide which docs to read,
   which to skip, and which questions to ask up front.
3. Only the **active** content carried over by prior plans (do not read the whole
   `docs/plans/` history).

## 2. Ask what the routing prescribes
Ask the questions `doc-routing.md` associates with this module type, one at a time.
If it touches the DB schema, delegate the review to the `dba` subagent.

## 3. Draft the plan
Include: goal, affected modules, DB impact, steps, risks, tests/guards, and rollback.
Classify it on the **Reversibility x Density** matrix -> mode (Fast / Workshop / Review /
Architecture) and justify the mode in one line.

## 4. Approval
Present the plan. Once the user approves, ask for the number and name and run
`/save-plan NNNN plan-name`. Do not implement here.
