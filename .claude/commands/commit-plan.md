---
description: Turn the current working tree into atomic Conventional Commits, then curate STATE.md as a final commit. Asks for approval before committing. Never pushes.
allowed-tools: Bash, Read, Grep, Glob, Write, Edit
---

You partition the current changes into atomic commits and then refresh the repo's active state.
You never push.

## 1. Inventory
Run `git status --porcelain` and `git --no-pager diff` (staged and unstaged) to see every added,
modified, and deleted path. If the tree is clean, stop and say so.

## 2. Plan the commits
Group the changes into **atomic** commits -- one concern per commit, each independently revertible.
Draft a Conventional Commits message for each (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`,
`chore:` ...) with a scope where it helps. Do not include the STATE.md update here; that is step 5.

## 3. Approval gate
Present the proposed partition: for each commit, its message and the exact files it will include.
**Wait for explicit approval.** Do not run any `git commit` before the user says yes. If they want
changes, re-plan and re-present.

## 4. Commit
On approval, create the commits in order: stage only that commit's files (`git add -- <paths>`) and
commit with the agreed message. Keep them isolated -- never `git add -A` across concerns.

## 5. Curate STATE.md (final, separate commit)
Re-read the repo and reconcile @docs/STATE.md against the plans still marked active in
`docs/plans/`: update active milestones, active risks, and active logic; retire what no longer
applies. Then commit **only** STATE.md as its own final commit:
`chore(state): sync repo context`

## 6. Close
Summarize the commits created (hash + message). **Do not push** -- leave that to the user.
