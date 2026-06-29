#!/usr/bin/env node
// Doc-access telemetry hook — standard across projects.
//
// Registered in .claude/settings.json on:
//   PostToolUse  matcher "Read|Grep|Glob"  -> one JSONL line per file/path the agent opens.
//   SubagentStop                            -> one JSONL marker when a subagent finishes.
//   (optional) SubagentStart                -> open marker, only needed if agent_type is not
//                                              populated on PostToolUse in your CC version.
//
// Reads the hook payload as JSON on stdin and appends ONE JSON line to
//   <project>/.claude/traces/<session_id>.jsonl
// Captures paths/queries only, never file contents. Never throws and always exits 0
// so it cannot block a tool call. Disable by removing the hook from settings.json.
// Consumed by /trace-map.

import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join, isAbsolute, relative } from 'node:path';

function readStdin() {
  try {
    return readFileSync(0, 'utf8'); // fd 0 = stdin
  } catch {
    return '';
  }
}

// Stable project root for hooks; falls back to payload.cwd, then process.cwd().
function projectRoot(payload) {
  return process.env.CLAUDE_PROJECT_DIR || payload.cwd || process.cwd();
}

// Normalize a path to repo-relative + forward slashes so it matches doc-routing.md.
function toRel(root, p) {
  if (!p) return '';
  const rel = isAbsolute(p) ? relative(root, p) : p;
  return rel.split('\\').join('/');
}

// What did the agent look at? File for Read; query (+ scope) for Grep/Glob.
function describe(root, tool, input = {}) {
  switch (tool) {
    case 'Read':
      return { kind: 'read', target: toRel(root, input.file_path) };
    case 'Glob':
      return {
        kind: 'search',
        target: input.path ? `${input.pattern} @ ${toRel(root, input.path)}` : (input.pattern ?? ''),
      };
    case 'Grep': {
      const where = input.glob ?? (input.path ? toRel(root, input.path) : '');
      return { kind: 'search', target: where ? `/${input.pattern}/ @ ${where}` : `/${input.pattern}/` };
    }
    default:
      return { kind: 'other', target: '' };
  }
}

function main() {
  let payload = {};
  try {
    payload = JSON.parse(readStdin() || '{}');
  } catch {
    payload = {};
  }

  const root = projectRoot(payload);
  const sessionId = payload.session_id || 'unknown';

  // Prefer the payload's own event name; fall back to the CLI flag for older versions.
  const event =
    payload.hook_event_name ||
    (process.argv.includes('--subagent-stop') ? 'SubagentStop' :
     process.argv.includes('--subagent-start') ? 'SubagentStart' : 'PostToolUse');

  // agent_type is present only when the event fired inside a subagent.
  const phase = payload.agent_type || 'main';
  const ts = new Date().toISOString();

  let record;
  if (event === 'SubagentStop' || event === 'SubagentStart') {
    record = { ts, event, phase, kind: 'boundary', tool: event, target: '', is_doc: false };
  } else {
    const tool = payload.tool_name || '';
    const { kind, target } = describe(root, tool, payload.tool_input);
    if (!target) return; // nothing useful to record
    const is_doc = /(^|\/)docs\//.test(target.toLowerCase());
    record = { ts, event, phase, kind, tool, target, is_doc };
  }

  try {
    const dir = join(root, '.claude', 'traces');
    mkdirSync(dir, { recursive: true });
    appendFileSync(join(dir, `${sessionId}.jsonl`), JSON.stringify(record) + '\n');
  } catch {
    // telemetry is best-effort; never fail a tool call
  }
}

main();
