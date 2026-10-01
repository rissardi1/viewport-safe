# Agent instructions

## Viewport-safe components (all agents: Claude Code, Codex, others)

Every Framer code component, React/HTML section, hero, scroll animation, gallery, sticky/pinned layout, canvas/WebGL scene or embed must follow `.claude/skills/viewport-safe/SKILL.md`. Read it before building or editing one. The short version:

- **Primary target: a browser snapped to half a 34" ultrawide, 1720x1280.** Also test 3440x1280, 2560x940, 1536x730 and the 1440x900 design size.
- Never size type, media or spacing from one axis. Use the contain unit `min(100cqw / 1440, 100svh / 900)`, clamped; fixed px/rem everywhere else.
- Nothing gets its width from height alone (vh/svh, innerHeight, height-locked 3D scenes, `object-fit: cover`), and nothing gets its height from width alone (vw, innerWidth, full-width aspect-ratio).
- Key visuals (rings, logos, product shots, 3D objects) are contained, never cropped: aspect-locked stage or aspect-aware camera. Mark them `data-vs="key-visual"`.
- Full-screen sections use `min-height: 100svh`, never `height: 100vh` with `overflow: hidden`. Never `width: 100vw`.
- Content sits in a container capped at the brand `contentMaxWidth` from `viewport-safe.config.json` (copied into a `BRAND` constant in the component).
- Before saying a component is done:
  - run `node .claude/skills/viewport-safe/scripts/lint-sizing.mjs <files>`;
  - run `node .claude/skills/viewport-safe/scripts/viewport-audit.mjs --component <file>` (or `--url <preview url>`) with `--matrix required`;
  - review the compare sheets;
  - report the viewport table with uw-half as the first row.
