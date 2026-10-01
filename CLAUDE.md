<!-- viewport-safe:begin -->
# Window shapes: load the `viewport-safe` skill

Before writing or editing any of these, load the `viewport-safe` skill (`.claude/skills/viewport-safe/SKILL.md`) and follow its workflow:

- a Framer code component, or a hero, full-screen or pinned section;
- a scroll animation (GSAP / ScrollTrigger / Framer Motion), gallery, carousel or sticky layout;
- anything with canvas, WebGL, video or an embed (Unicorn Studio, Spline, Rive, Lottie);
- a page-level fix that sets a section or code-component instance height or width (`vh`, `vw`, fixed px, `auto`).

Load it **alongside** the `framer` skill. It does not replace it, and it has no setup step, so do not wait on the Framer setup to load it.

Why: the primary target is a browser snapped to half of a 34" ultrawide (about 1720x1280), plus very wide and short windows. Things that look right at 1440x900 break there: sizes that follow only the window height or only its width, height-locked 3D scenes, and instance heights fixed in `vh`.

How it is enforced:

- A hook lints every Framer `.tsx` right after it is written and reports findings back. A clean lint is **not** proof the component is safe.
- Before calling a component or page fix done, run `node .claude/skills/viewport-safe/scripts/viewport-audit.mjs` (`--component <file>` or `--url <preview>`, `--matrix required`), review the compare sheets, and report the viewport table with `uw-half` as the first row.
- The audit cannot see everything (for example text over gradients or images, or a pinned stack that collapses). Looking at the screenshots is part of the check.
- New components take their brand numbers from a `viewport-safe.config.json` (content width, headline cap). Brand files live in `configs/`; if none fits, ask once or measure the live site with `--measure`.
<!-- viewport-safe:end -->
