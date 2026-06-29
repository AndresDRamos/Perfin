---
description: Reconstruct the real doc-access map for this session from the telemetry trace and reconcile it against docs/doc-routing.md.
allowed-tools: Read, Glob, Grep, Bash, Edit
---

Build the measured doc-access map for the current session and use it to keep
`docs/doc-routing.md` honest.

## 1. Locate this session's trace
The hook writes one JSONL file per session under `.claude/traces/`. Use the newest one as the
current session (or `$CLAUDE_SESSION_ID.jsonl` if that variable is set):
!`ls -t .claude/traces/*.jsonl 2>/dev/null | head -1`

If there is none, stop: telemetry may be disabled or no docs were opened yet.

## 2. Build the measured map
Read the trace. Each line is a JSON record: `{ ts, event, phase, kind, tool, target, is_doc }`.
- Keep records where `is_doc` is true. `kind: "read"` is the high-signal subset (actual ingestion);
  `kind: "search"` is intent, not ingestion -- weight it lower.
- Group by `phase` (main / dba / docs-sync / ...) to see who read what.
Produce a short table: doc path -> phase(s) that read it, read vs. search.

## 3. Reconcile against routing
Read @docs/doc-routing.md. For the module type(s) worked this session, compare declared vs. measured:
- **Read but not declared** -> undocumented dependency. Propose adding it to "Read".
- **Declared but never read** -> dead / over-declared routing. Propose moving to "Skip" or removing.
- **Read by the wrong phase** -> e.g., a doc `dba` consistently needs but routing assigns elsewhere.

## 4. Propose, then apply on approval
Present the proposed edits to `doc-routing.md` as a concrete diff. Apply them only after the user
approves. Remember the blind spot: CLAUDE.md auto-load and @-mentions are NOT in the trace, so do
not "correct" routing for docs that are always auto-loaded.
