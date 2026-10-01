#!/usr/bin/env node
// Installs viewport-safe into ANOTHER workspace (project level) or for your whole user account.
//
//   node scripts/install.mjs --target <workspace folder>    project level (default target: current folder)
//   node scripts/install.mjs --user                         every Claude Code session on this machine
//
// Options: --force (overwrite an existing install), --skip-npm (do not install the audit harness dependencies)
//
// It copies the skill, adds the lint hook to settings.json, adds the instructions to CLAUDE.md, and installs the
// harness dependencies. Everything is idempotent: running it twice changes nothing the second time.
// If you cloned this repo to work INSIDE it, you do not need this script (see README, option A).
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC_SKILL = join(REPO, '.claude', 'skills', 'viewport-safe');
const BEGIN = '<!-- viewport-safe:begin -->';

const args = process.argv.slice(2);
const flag = n => args.includes(n);
const val = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const user = flag('--user');
const force = flag('--force');
const skipNpm = flag('--skip-npm');
const target = resolve(val('--target') || process.cwd());

const say = m => console.log(m);
const fail = m => { console.error(`\nERROR: ${m}`); process.exit(1); };

if (Number(process.versions.node.split('.')[0]) < 22) fail(`Node 22 or newer is required (you have ${process.versions.node}).`);
if (!existsSync(join(SRC_SKILL, 'SKILL.md'))) fail(`Skill not found at ${SRC_SKILL}. Run this script from a full clone of the repo.`);

const base = user ? join(homedir(), '.claude') : join(target, '.claude');
const destSkill = join(base, 'skills', 'viewport-safe');
const settingsPath = join(base, 'settings.json');
const claudeMdPath = user ? join(base, 'CLAUDE.md') : join(target, 'CLAUDE.md');

if (!user && !existsSync(target)) fail(`Target folder does not exist: ${target}`);
if (!user && resolve(target) === REPO) fail('The target is this repo itself. It already has the skill; just open Claude Code here.');
say(`Installing viewport-safe ${user ? 'for the current user' : `into ${target}`}`);

// 1) skill files
if (existsSync(destSkill) && !force) {
  say(`- skill: already installed at ${destSkill} (use --force to overwrite)`);
} else {
  mkdirSync(destSkill, { recursive: true });
  cpSync(SRC_SKILL, destSkill, { recursive: true, force: true, filter: p => !/[\\/](node_modules|viewport-audit)([\\/]|$)/.test(p) });
  say(`- skill: copied to ${destSkill}`);
}

// 2) lint hook in settings.json
const hookScript = join(destSkill, 'scripts', 'hook-lint.mjs').replace(/\\/g, '/');
const command = user
  ? `node "${hookScript}"`
  : '[ ! -f "${CLAUDE_PROJECT_DIR}/.claude/skills/viewport-safe/scripts/hook-lint.mjs" ] || node "${CLAUDE_PROJECT_DIR}/.claude/skills/viewport-safe/scripts/hook-lint.mjs"';
const entry = { matcher: 'Edit|Write|MultiEdit', hooks: [{ type: 'command', command, timeout: 20, statusMessage: 'viewport-safe lint' }] };
let settings = {};
if (existsSync(settingsPath)) {
  try { settings = JSON.parse(readFileSync(settingsPath, 'utf8').replace(/^﻿/, '') || '{}'); }
  catch {
    say(`- hook: could NOT read ${settingsPath} (invalid JSON), so it was left untouched. Add this entry to hooks.PostToolUse yourself:\n${JSON.stringify(entry, null, 2)}`);
    settings = null;
  }
}
if (settings) {
  settings.hooks = settings.hooks || {};
  settings.hooks.PostToolUse = settings.hooks.PostToolUse || [];
  const has = settings.hooks.PostToolUse.some(e => (e.hooks || []).some(h => /viewport-safe[\\/]scripts[\\/]hook-lint\.mjs/.test(h.command || '')));
  if (has) say('- hook: already registered');
  else {
    settings.hooks.PostToolUse.push(entry);
    mkdirSync(dirname(settingsPath), { recursive: true });
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
    say(`- hook: registered in ${settingsPath}`);
  }
}

// 3) instructions in CLAUDE.md
const section = readFileSync(join(REPO, 'CLAUDE.md'), 'utf8').trim();
const current = existsSync(claudeMdPath) ? readFileSync(claudeMdPath, 'utf8') : '';
if (current.includes(BEGIN)) say('- CLAUDE.md: already has the viewport-safe section');
else {
  mkdirSync(dirname(claudeMdPath), { recursive: true });
  writeFileSync(claudeMdPath, (current ? current.replace(/\s*$/, '\n\n') : '') + section + '\n');
  say(`- CLAUDE.md: ${current ? 'section appended to' : 'created at'} ${claudeMdPath}`);
}

// 4) brand configs (project level only; never overwrites)
if (!user) {
  const dir = join(target, 'viewport-safe-configs');
  if (!existsSync(dir)) {
    cpSync(join(REPO, 'configs'), dir, { recursive: true });
    say(`- configs: example brand files copied to ${dir}`);
  } else say('- configs: viewport-safe-configs already exists, left as is');
}

// 5) audit harness dependencies
const harness = join(destSkill, 'scripts', 'harness');
if (skipNpm) say('- harness: skipped (--skip-npm). Run later: npm --prefix "' + harness + '" ci');
else if (existsSync(join(harness, 'node_modules', 'vite'))) say('- harness: dependencies already installed');
else {
  say('- harness: installing dependencies (about a minute)...');
  // One command string through the shell: works for npm.cmd on Windows without the args-with-shell deprecation.
  const r = spawnSync(`npm ${existsSync(join(harness, 'package-lock.json')) ? 'ci' : 'install'} --prefix "${harness}"`, { stdio: 'inherit', shell: true });
  if (r.status !== 0) say('  npm failed. Run it yourself: npm --prefix "' + harness + '" ci');
}

say('\nDone. Check the setup with:\n  node "' + join(destSkill, 'scripts', 'doctor.mjs').replace(/\\/g, '/') + '"\nThen open Claude Code in ' + (user ? 'any folder' : target) + '. Restart it if it was already open.');
