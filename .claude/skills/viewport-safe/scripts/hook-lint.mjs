#!/usr/bin/env node
// PostToolUse hook (Edit|Write|MultiEdit): runs lint-sizing on a Framer code component right after it is written,
// and hands the findings back to the agent as additional context. Silent for everything else.
//
// Scope: only .tsx/.jsx files that import from "framer" or carry a @vs-type header, so Next.js sites in the same
// workspace are left alone. Skips node_modules and this skill's own deliberately broken test fixtures.
// Never blocks (always exit 0); a lint clean is NOT proof the component is safe, the audit still has to run.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const LINT = join(HERE, 'lint-sizing.mjs');

async function readStdin() {
  if (process.stdin.isTTY) return '';
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}

function emit(text) {
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: text } }));
}

try {
  let event = {};
  try { event = JSON.parse((await readStdin()).replace(/^﻿/, '') || '{}'); } catch { process.exit(0); }
  const file = event?.tool_input?.file_path;
  if (!file || !/\.(tsx|jsx)$/i.test(file) || !existsSync(file)) process.exit(0);

  const norm = file.replace(/\\/g, '/').toLowerCase();
  if (/\/node_modules\//.test(norm) || /\/viewport-safe\/tests\/(fixtures|lint-cases)\//.test(norm)) process.exit(0);

  const src = readFileSync(file, 'utf8');
  if (!/from\s+["']framer["']/.test(src) && !/@vs-type\b/.test(src)) process.exit(0);

  const r = spawnSync(process.execPath, [LINT, file, '--json'], { encoding: 'utf8', timeout: 15000 });
  if (!r.stdout) process.exit(0);
  let data;
  try { data = JSON.parse(r.stdout); } catch { process.exit(0); }

  const open = (data.findings || []).filter(f => !f.justified);
  const errors = open.filter(f => f.severity === 'error');
  const warnings = open.filter(f => f.severity !== 'error');
  if (!errors.length && !warnings.length) process.exit(0);

  const line = f => `- L${f.line} ${f.id} (rule ${f.rule}) ${f.severity}: ${f.message}`;
  const shown = [...errors, ...warnings].slice(0, 8).map(line).join('\n');
  const more = errors.length + warnings.length > 8 ? `\n(+${errors.length + warnings.length - 8} more: run node ${LINT.replace(/\\/g, '/')} "${file.replace(/\\/g, '/')}")` : '';
  emit(
    `[viewport-safe] lint on ${file.replace(/\\/g, '/')}: ${errors.length} error(s), ${warnings.length} warning(s).\n${shown}${more}\n` +
    `Fix the errors, or keep a warning only with a "// vs-ignore Lx: reason" comment. A clean lint does not prove the component is safe: ` +
    `before calling it done, run viewport-audit.mjs (--matrix required) and review the compare sheets, see .claude/skills/viewport-safe/SKILL.md.`
  );
} catch {
  // A hook must never get in the way of the edit itself.
}
process.exit(0);
