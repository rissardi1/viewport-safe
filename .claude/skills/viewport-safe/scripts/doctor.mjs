#!/usr/bin/env node
// Checks that viewport-safe can run on this machine: Node version, a Chrome-family browser that starts,
// the audit harness dependencies, and the lint test suite. Exits 1 if something blocks the audit.
//   node doctor.mjs            check only
//   node doctor.mjs --setup    also install the harness dependencies if they are missing
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL = join(HERE, '..');
const HARNESS = join(HERE, 'harness');
const setup = process.argv.includes('--setup');

let blocked = false;
const row = (ok, label, detail = '') => console.log(`${ok ? 'OK  ' : 'FAIL'}  ${label}${detail ? ': ' + detail : ''}`);
const bad = (label, detail, fix) => { blocked = true; row(false, label, detail); if (fix) console.log(`      fix: ${fix}`); };

// 1) Node
const major = Number(process.versions.node.split('.')[0]);
if (major >= 22) row(true, 'Node', process.versions.node); else bad('Node', `${process.versions.node} (need 22 or newer)`, 'install the current LTS from https://nodejs.org');

// 2) harness dependencies
if (!existsSync(join(HARNESS, 'node_modules', 'vite'))) {
  if (setup) {
    console.log('...  installing harness dependencies (about a minute)');
    // One command string through the shell: works for npm.cmd on Windows without the args-with-shell deprecation.
    spawnSync(`npm ${existsSync(join(HARNESS, 'package-lock.json')) ? 'ci' : 'install'} --prefix "${HARNESS}"`, { stdio: 'inherit', shell: true });
  }
}
if (existsSync(join(HARNESS, 'node_modules', 'vite'))) row(true, 'Audit harness dependencies', 'installed');
else bad('Audit harness dependencies', 'not installed (needed for --component audits; --url audits still work)', `npm --prefix "${HARNESS}" ci   (or rerun with --setup)`);

// 3) browser that actually starts
try {
  const { launch } = await import(pathToFileURL(join(HERE, 'lib', 'cdp.mjs')).href);
  const { page, close, browserPath } = await launch();
  const ua = await page.evaluate('navigator.userAgent');
  await close();
  row(true, 'Browser', `${browserPath} (${/(Chrome|Edg)\/[\d.]+/.exec(ua)?.[0] ?? 'ok'})`);
} catch (e) {
  bad('Browser', String(e.message).split('\n')[0], 'install Chrome or Edge, or point CHROME_PATH at a Chromium binary');
}

// 4) lint test suite
const t = spawnSync(process.execPath, [join(SKILL, 'tests', 'run-lint-tests.mjs')], { encoding: 'utf8' });
const last = (t.stdout || '').trim().split('\n').pop();
if (t.status === 0) row(true, 'Lint tests', last); else bad('Lint tests', last || 'failed to run', 'run node tests/run-lint-tests.mjs for details');

console.log(blocked ? '\nSomething above needs fixing before the audit will run.' : '\nAll good. The skill is ready.');
process.exit(blocked ? 1 : 0);
