#!/usr/bin/env node
// Regression tests for the audit checks that produce false results. Runs the browser audit (matrix quick) on four
// fixtures and asserts which checks must and must not fire. Needs Chrome and the harness dependencies.
//   node tests/run-audit-fixtures.mjs
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const audit = join(here, '..', 'scripts', 'viewport-audit.mjs');
const fixtures = join(here, 'fixtures');

const cases = [
  { file: 'TightHeadline.tsx', name: 'tight leading is not an overlap (C10) and a gradient backdrop is not judged (C12)', absent: ['C10', 'C12'] },
  { file: 'OverlappingText.tsx', name: 'text drawn over text is still a C10 error', present: [['C10', 'error']] },
  { file: 'InvisibleText.tsx', name: 'light text on a failed background is a C12 error', present: [['C12', 'error']] },
  { file: 'SvgLabels.tsx', name: 'default-coloured SVG text over drawn shapes is not judged (C12)', absent: ['C12'] },
  { file: 'FixedHero.tsx', name: 'a legible hero on a solid dark background raises no C10 or C12', absent: ['C10', 'C12'] },
];

let failed = 0;
for (const c of cases) {
  const out = mkdtempSync(join(tmpdir(), 'vs-fixture-'));
  const r = spawnSync(process.execPath, [audit, '--component', join(fixtures, c.file), '--matrix', 'quick', '--concurrency', '1', '--out', out], { encoding: 'utf8' });
  let report;
  try {
    const run = readdirSync(out).sort().pop();
    report = JSON.parse(readFileSync(join(out, run, 'report.json'), 'utf8'));
  } catch {
    console.log(`FAIL  ${c.file}: the audit produced no report\n${(r.stdout || '') + (r.stderr || '')}`);
    failed++;
    rmSync(out, { recursive: true, force: true });
    continue;
  }
  const found = report.viewports.flatMap(v => v.findings.map(f => ({ vp: v.id, check: f.check, severity: f.severity })));
  const problems = [];
  for (const id of c.absent || []) {
    const hit = found.filter(f => f.check === id);
    if (hit.length) problems.push(`${id} fired at ${[...new Set(hit.map(h => h.vp))].join(', ')}`);
  }
  for (const [id, sev] of c.present || []) {
    if (!found.some(f => f.check === id && f.severity === sev)) problems.push(`${id} ${sev} did not fire`);
  }
  console.log(`${problems.length ? 'FAIL' : 'PASS'}  ${c.file}: ${c.name}${problems.length ? '\n        ' + problems.join('; ') : ''}`);
  if (problems.length) failed++;
  rmSync(out, { recursive: true, force: true });
}
console.log(`\n${cases.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
