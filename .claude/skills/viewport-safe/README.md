# viewport-safe

A Claude Code skill that makes the components we build for Framer sites survive every window shape. The primary target is a browser snapped to **half of a 34" ultrawide (about 1720x1280)**, where most generated components broke; it also covers maximized ultrawides (3440x1280, 2560x940), standard desktops and scaled laptops (1536x730).

It gives the agent a workflow (classify, budget both axes, sizing rules), a static lint, and a browser audit that screenshots the component at every viewport, runs 12 checks and writes side-by-side compare sheets.

## Install

- **Project skill** (shared with the team): keep this folder at `<repo>/.claude/skills/viewport-safe/`. Claude Code picks it up for anyone working in that repo.
- **Personal skill** (every project on your machine): symlink or copy it to `~/.claude/skills/viewport-safe/`.

Requirements:

- Node 22 or newer.
- Google Chrome, Microsoft Edge or Chromium installed (found automatically; override with `--chrome <path>` or `CHROME_PATH`).
- For harness mode only (auditing a single `.tsx` component), install the harness once:

  ```bash
  npm --prefix .claude/skills/viewport-safe/scripts/harness install
  ```

URL mode needs no npm install at all.

## Brand config

Each client project has a `viewport-safe.config.json` (copy `assets/viewport-safe.config.example.json`). The skill and the scripts find the nearest one, searching upward from the component file, then from the working directory. To measure the content width of an existing site:

```bash
node .claude/skills/viewport-safe/scripts/viewport-audit.mjs --url https://your-site.framer.app --measure
```

## Run the audit by hand

A Framer preview, staging or branch-preview URL:

```bash
node .claude/skills/viewport-safe/scripts/viewport-audit.mjs --url https://your-site.framer.app --matrix required
```

One component file in the harness (renders it with its property-control defaults):

```bash
node .claude/skills/viewport-safe/scripts/viewport-audit.mjs --component path/to/Component.tsx --matrix quick
```

Useful options: `--selector "#hero"` (scope to one section), `--only uw-half,design`, `--matrix all`, `--hide ".cookie-banner"`, `--out <dir>`. Run with `--help` for the full list.

The report lands in `./viewport-audit/<timestamp>/`:

- `report.md` and `report.json`: pass/fail per viewport (uw-half first) and every finding with the element it is about.
- `screens/<viewport>/`: a screenshot per scroll position.
- `compare/`: one sheet per position with design | uw-half | uw-half-stress | uw-full | uw-29 | laptop-125 side by side. **Look at these**: the checks catch a lot, but a human (or the agent) looking at the sheets catches the rest.

Add `viewport-audit/` to `.gitignore`.

## Test your own window size by hand

In Chrome DevTools: device toolbar (Cmd/Ctrl+Shift+M), add a custom device (Settings → Devices) of 1720 x 1280 with device pixel ratio 1 and type Desktop, set zoom to "Fit to window", and reload after each size change.

To learn the real size of someone's window, have them run this bookmarklet in their usual arrangement:

```
javascript:alert(innerWidth+' x '+innerHeight+' @ '+devicePixelRatio+'x')
```

Then update `uw-half` / `uw-full` in `scripts/viewports.json`.

## Lint

```bash
node .claude/skills/viewport-safe/scripts/lint-sizing.mjs src/components/
```

Exit code 1 on errors. Keep a warning with a reason: `// vs-ignore L9: full-bleed texture, nothing important near the edges`. Every ID is explained in `references/anti-patterns.md`.

## Self-tests

```bash
node .claude/skills/viewport-safe/tests/run-lint-tests.mjs
node .claude/skills/viewport-safe/tests/run-audit-fixtures.mjs   # C10 false-positive and C12 legibility regressions, needs Chrome
node .claude/skills/viewport-safe/scripts/viewport-audit.mjs --component .claude/skills/viewport-safe/tests/fixtures/BrokenTallHero.tsx --matrix required   # must FAIL at uw-half and uw-half-stress only
node .claude/skills/viewport-safe/scripts/viewport-audit.mjs --component .claude/skills/viewport-safe/tests/fixtures/FixedTallHero.tsx --matrix required    # must PASS
```

`BrokenHero.tsx` must fail on the wide/short viewports (uw-full, uw-29, laptop-125) and `FixedHero.tsx` must pass everything.

## Layout

```
SKILL.md                 workflow, rules, checks, tokens (what the agent reads first)
references/              sizing patterns, Framer specifics, scroll animation, canvas & embeds, anti-patterns
assets/                  component template, example brand config
scripts/lint-sizing.mjs  static lint (L1–L16), zero dependencies
scripts/viewport-audit.mjs + lib/   browser audit (C1–C12), zero dependencies in URL mode
scripts/harness/         Vite page that renders one component
scripts/viewports.json   the viewport matrix
tests/                   fixtures, lint cases, evals
```

## Wiring it into a project

The skill only helps when it is loaded, and it is loaded from its description alone. Two things make that more reliable:

1. **`CLAUDE.md` at the project root** with a short instruction to load `viewport-safe` before touching code components, scroll scenes, embeds or section sizing. Claude Code reads `CLAUDE.md`; `AGENTS.md` (in the handoff) is for Codex and other agents.
2. **A PostToolUse hook** that lints every Framer component right after it is written:

```json
{ "hooks": { "PostToolUse": [ { "matcher": "Edit|Write|MultiEdit", "hooks": [ {
  "type": "command",
  "command": "[ ! -f \"${CLAUDE_PROJECT_DIR}/.claude/skills/viewport-safe/scripts/hook-lint.mjs\" ] || node \"${CLAUDE_PROJECT_DIR}/.claude/skills/viewport-safe/scripts/hook-lint.mjs\"",
  "timeout": 20, "statusMessage": "viewport-safe lint" } ] } ] } }
```

`scripts/hook-lint.mjs` only reacts to `.tsx`/`.jsx` files that import from `"framer"` (or have a `@vs-type` header), skips `node_modules` and this skill's own broken fixtures, never blocks, and reports findings as additional context. A clean lint is not proof of safety: the audit and the compare sheets are still required.
