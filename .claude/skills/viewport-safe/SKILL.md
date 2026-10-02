---
name: viewport-safe
description: Makes web components render correctly on every window shape, including browser windows snapped to half of an ultrawide monitor (about 1720x1280), maximized ultrawides (3440x1440, 2560x1080), standard desktops, and laptops with display scaling. Use this skill whenever building, editing, porting, fixing or reviewing any Framer code component, React or HTML section, hero, full-screen or pinned section, scroll animation (GSAP, ScrollTrigger, Framer Motion), gallery, carousel, sticky layout, canvas, WebGL or Three.js scene, embed (Unicorn Studio, Spline, Rive, Lottie, background video), or anything using vh, svh, vw, aspect-ratio, object-fit or window size, even if the user does not mention monitors, screens or responsiveness.
---

# viewport-safe

Components we generate usually look right at the 1440x900 design frame and break on other window shapes. There are two opposite failure directions, and a component has to survive both:

- **Tall windows (the primary target).** A browser snapped to half of a 34" ultrawide is about **1720x1280** (aspect 1.34): narrower relative to its height than the 16:10 design. Framer still shows the Desktop layout. Anything sized from *height* (`vh`/`svh`, `innerHeight`, height-locked WebGL/Three.js/Unicorn Studio scenes, `object-fit: cover`) gets too wide: visuals are cut at the sides, content overflows sideways. The collateral.com hero ring is the real example: it runs ~85px past the right edge at 1720x1280.
- **Wide windows.** A maximized ultrawide is about **3440x1280** (2.69), a 125% laptop **1536x730**. Anything sized from *width* (`vw`, `innerWidth`, full-width `aspect-ratio` boxes) gets too tall: CTAs pushed out of clipped sections, 275px headlines.

The fix is always the same idea: size from the tighter of the two axes, cap everything, keep key visuals contained, and prove it with the audit before saying you are done.

`SKILL_DIR` below means the directory that contains this file. Scripts need Node 22+ and an installed Chrome, Edge or Chromium.

## Workflow

Follow these steps in order for every component you build, edit, port or fix.

### Step 0. Load the brand config

Find the nearest `viewport-safe.config.json`, searching upward from the component file, then from the working directory. It holds `contentMaxWidth` (content column, excluding gutters), `gutter`, `displayTypeMax`, `designFrame`, `stagingUrl` and `auditHideSelectors`.

- **Missing and you can ask:** ask once for the content max-width. If a staging URL is known, run `node SKILL_DIR/scripts/viewport-audit.mjs --url <url> --measure` first and offer the measured value. Create the file from `SKILL_DIR/assets/viewport-safe.config.example.json`.
- **Missing and nobody to ask** (evals, CI): use `--measure` if you have a URL and state the value as an assumption in the report; otherwise stop and say the config is missing. Never invent a number.

Framer code components cannot read repo files, so copy the values into a `BRAND` constant at the top of the component (lint L16 checks it matches the config):

```ts
// Brand values copied from <path>/viewport-safe.config.json. Update both together.
const BRAND = { contentMaxWidth: 1440, gutterMin: 24, gutterMax: 64, displayTypeMax: 120, designW: 1440, designH: 900 }
```

### Step 1. Classify the component and its key visuals

Write this header at the top of the file (the audit harness reads `@vs-type`):

```ts
/**
 * @vs-type fit
 * @vs-design 1440x900
 * @vs-key-visual ring scene: height-locked -> aspect-locked stage
 * @vs-config clients/example/viewport-safe.config.json
 */
```

- `grow`: content section whose height follows its content (most sections). Keep these simple: fixed px/rem type, a content container, no viewport units.
- `fit`: must fit one viewport (hero, full-screen slider, sticky stage).
- `scroll-scene`: pinned or scroll-driven (ScrollTrigger pin, sticky stacks, horizontal scroll).
- `@vs-key-visual`: one line per visual whose edges matter, with its scaling model (fixed, width-locked, height-locked, cover, contain) and how you made it safe. See `references/canvas-and-embeds.md` for the models and the safe-zone table.

### Step 2. Budget both axes (fit and scroll-scene only)

- **Height:** list heading, text, CTAs, media and padding with how each is bounded. Everything must fit in **730px** of height (laptop-125). Decide what shrinks first.
- **Width, the tall-window check:** at **1720x1280 and 1720x1440**, list everything sized from height and confirm it still fits the width. Height-locked or cover visuals keep key content within the central 74.6% of the design width, or go in an aspect-locked stage.

### Step 3. Write the code with the rules below

Read the reference that matches the work before writing it:

| Building | Read |
|---|---|
| Any viewport-relative size, hero, media, cards, containers | `references/sizing-patterns.md` |
| A Framer code component (annotations, BRAND, container queries, canvas vs preview) | `references/framer-specifics.md` |
| Fixing sizes on a live Framer page through the agent API / DSL (aspect ratio, units, breakpoint inheritance, masks) | `references/framer-specifics.md`, section 14 |
| GSAP ScrollTrigger, sticky stacks, horizontal galleries, Framer Motion scroll | `references/scroll-animation.md` |
| Canvas, WebGL, Three.js/R3F, Unicorn Studio, Spline, Rive, Lottie, video | `references/canvas-and-embeds.md` |
| Fixing a lint finding | `references/anti-patterns.md` (one entry per L-id) |

Starting a new Framer component? Copy `SKILL_DIR/assets/component-template.tsx`: it already has the header, BRAND block, style spreading, container wrapper, contain unit, `data-vs` tokens and window-shape media queries.

### Step 4. Lint

```bash
node SKILL_DIR/scripts/lint-sizing.mjs <changed files>
```

Fix every error. A warning you keep needs a reason on the same line or the line above: `// vs-ignore L9: full-bleed texture, nothing important near the edges`.

A clean lint does not mean the component is safe. A composition built entirely in fixed px inside a 100vh pinned stage lints clean yet sits small in an empty stage at 1720x1280. The Collateral flywheel did exactly this. Only the audit (C11) and the compare sheets catch it. The fix there was rule 11: measure the stage on both axes and scale the whole group by `min(stageW / W0, stageH / 900)`. Anchor `W0` to the composition's own width plus margins (1320 for a 1200px group), not to the window width, so 1440x900 stays 1:1 and only tall windows gain size.

### Step 5. Audit

```bash
# while iterating (design, uw-half, uw-full, laptop-125)
node SKILL_DIR/scripts/viewport-audit.mjs --component <file.tsx> --matrix quick --out <project>/viewport-audit
# before reporting done
node SKILL_DIR/scripts/viewport-audit.mjs --component <file.tsx> --matrix required --out <project>/viewport-audit
# a Framer preview or staging page (optionally scoped to one section)
node SKILL_DIR/scripts/viewport-audit.mjs --url <url> [--selector "#hero"] --matrix required
```

- Harness mode needs its dependencies once: `npm --prefix SKILL_DIR/scripts/harness install`. It renders the component with its property-control defaults (`--props file.json` overrides), at the top of a page with filler below. `@vs-type fit` gets a 100svh frame; `grow` and `scroll-scene` get a full-width auto-height frame (`--layout` overrides).
- If the harness cannot render the component (it imports `https://framer.com/m/...` modules or Framer APIs the stub lacks), audit the Framer preview URL instead.
- Fixing an existing live page? Run URL mode with `--matrix quick` before changing anything so the report shows before and after.
- Fix and rerun until every required viewport passes. After 5 iterations, stop and report the remaining failures honestly.

What the checks mean and the usual fix:

| Check | Fails when | Usual fix |
|---|---|---|
| C1 overflow | page scrolls sideways (a 17px Windows scrollbar is simulated) | rule 3 (width from height), rule 13 (`100vw`) |
| C2 fit | a `fit` element or pinned stage is taller than the window | height budget, contain unit, rule 8 |
| C3 clipping | text/CTA cut or pushed out of an `overflow: hidden` section | rule 8, height budget |
| C4 above the fold | an `above-fold` element is not fully visible on load | height budget |
| C5 type | largest text > `displayTypeMax` (warn) or > 1.5x (error) | clamp with BRAND.displayTypeMax |
| C6 width cap | a text block is wider than `contentMaxWidth` | rule 7 |
| C7 key visual | a `key-visual` is cut by the window or a clipping ancestor | rules 5, 6 |
| C8 cover-crop | `object-fit: cover` hides a large share of a big image/video | contain it, or mark `data-vs="bg"` |
| C9 canvas edge | canvas content touches an edge that it does not touch at 1440x900 | aspect-locked stage, contain camera |
| C10 overlap | text overlaps text or a key visual (error); a big graphic spills out of its container over text (warning, info if it also happens at 1440x900) | layout, rules 2/4, or `overlay-ok` when designed |
| C11 empty stage | a fit/pinned stage is less than 40% filled (warning) | contain unit so content grows on tall windows |
| C12 legibility | text colour is under 3:1 against what is behind it (error under 1.5:1, when it is nearly invisible). Judges text only on flat backgrounds; over a gradient, image, video or canvas, and for text inside an SVG, it stays silent | fix the background or colour token that failed to apply; `data-vs="decor"` only for decorative ghost text |

The audit checks each position twice, 0.7s apart, and keeps only stable findings, so animations caught mid-move do not count. It cannot judge everything; that is Step 6.

### Step 6. Review the screenshots

Open every sheet in `<out>/<run>/compare/` with the Read tool. Columns: design | uw-half | uw-half-stress | uw-full | uw-29 | laptop-125. For each sheet write one line: what differs between window shapes, and whether anything is cut off, overlapping, oddly empty or oddly huge. **Anything visibly broken is a failure even if every check passed.** Fix it and rerun.

**Canvas, WebGL and embed heroes: the screenshot is the only check.** The audit cannot see inside a canvas. The live collateral.com hero passed every check at 1720x1440 (`PASS`, no errors, no warnings) while the 3D ring was cut at the right edge; only the screenshot showed it. For anything drawn in a canvas or an embed (Unicorn Studio, Spline, Rive, Lottie, Three.js), open the 1720x1280 and 1720x1440 screenshots and check, by eye, that the key visual is whole and that no hard line cuts through the scene (a glow, a stripe pattern or a floor reflection that stops at the canvas edge). Also check at the animation's widest pose: a rotating mark is narrowest edge-on and widest face-on, so look at more than one frame.

### Step 7. Report

End your answer with this table (uw-half first), then the visual-review notes. Never say a component is done without it.

```markdown
| Viewport | Size | Result | Failing checks | Warnings | Screenshot |
|---|---|---|---|---|---|
| uw-half (primary) | 1720x1280 | PASS | — | — | viewport-audit/<run>/screens/uw-half/load.jpg |
| design | 1440x900 | PASS | — | — | … |
| … one row per viewport in the run … |

Visual review:
- load: ring fully visible at every shape; letterbox bands match the hero background.
- part2: showreel contained at uw-half (1411px wide in a 1703px window).
```

## The rules

1. **Fixed sizes first.** Type, spacing and UI use px/rem with breakpoints, inside a content container. Viewport-relative sizing is opt-in, only for compositions that must feel like one screen (heroes, pinned stages, key visuals). → sizing-patterns 6.2, 6.7
2. **When scaling with the viewport, contain; never follow one axis.** Use the contain unit `--vs-u: min(100cqw / DESIGN_W, 100svh / DESIGN_H)` and clamp every use. Never size type, media or spacing with `vw`, `cqi`/`cqw`, or `vh`/`svh` alone. Container units are still width units. → 6.1
3. **Nothing gets its width from height alone (tall-window rule, the main fix).** Any width that comes from `vh`/`svh`/`dvh`, `innerHeight`, or `aspect-ratio` on a height-sized box is capped with `min(100%, …)` or `max-width: 100%`. → 6.4, 6.5
4. **Nothing gets its height from width alone (wide-window rule).** Any height that comes from `vw`, `innerWidth`, or `aspect-ratio` on a full-width box is capped: a height/max-height in `svh`, or width `min(100%, calc(Nsvh * ratio))`. → 6.4
5. **Key visuals stay inside the safe zone.** Anything whose edges matter (logo marks, rings, product shots, illustrations, 3D objects, text inside images or video) is contained, never cropped. `object-fit: cover` and full-bleed canvases are for backgrounds only. Mark key visuals `data-vs="key-visual"`, backgrounds `data-vs="bg"`. → canvas-and-embeds 2, 6
6. **Canvas, 3D and embeds are aspect-aware.** Height-locked scenes crop the sides on every window narrower than the design. Put them in an aspect-locked stage, or adjust the camera for aspect, or keep all key content inside the central 74.6% of the design width. Give canvas key visuals a DOM proxy so C7 can see them. → canvas-and-embeds 4, 5
7. **Content container has the brand max-width** (`BRAND.contentMaxWidth`). Backgrounds and media may bleed; text and UI do not. → 6.7
8. **Full-screen sections grow, they do not clip.** `min-height: 100svh`, never `height: 100vh|svh|dvh|lvh` with `overflow: hidden|clip`, except the scale-to-fit stage (rule 11). → 6.6
9. **JS measures the component's own box on both axes** (ResizeObserver) and recomputes on resize. Never read only one of `innerWidth`/`innerHeight`. → scroll-animation, 6.9
10. **Handle both extreme window shapes explicitly:** `@media (max-aspect-ratio: 3/2)` for tall/half-screen windows, `@media (min-aspect-ratio: 2/1)` for ultrawides, `@media (max-height: 820px)` for short screens. Adjust layout and spacing; do not hide content. → 6.8
11. **Scale-to-fit for fixed artboards.** Render at design size and scale by `min(boxW / DESIGN_W, boxH / DESIGN_H)`. Prefer the CSS contain unit; with JS, render at scale 1 until the box is measured. → 6.9
12. **No clipped text or CTAs; above-the-fold content stays above the fold** at every required viewport.
13. **Never size with `100vw`.** With Windows classic scrollbars it is ~17px wider than the page and causes sideways scroll. Use `100%`.
14. **A section holding a height-locked visual may take its height from its width, capped by the window.** Prefer this to a `100vh` section with letterbox bands: `height = min(100svh, width / ratio)`. The scene fills the section, the section is shorter on tall windows, and nothing is cut. Pick a ratio slightly *below* the design ratio (1.55 for a 1.6 design) so the design frame stays exactly `100svh` once a 15-17px scrollbar takes width away. → canvas-and-embeds 4.2
15. **Scale-to-fit code measures settled sizes.** When a scale depends on the height of content that animates (accordions, cross-fading text), latch only heights that have stopped changing (about 450ms of no resize). Latching the largest height ever seen makes the whole composition shrink the first time two blocks are open at once during a transition. → sizing-patterns 6.9

## `data-vs` tokens

Space-separated in one attribute (`data-vs="fit key-visual"`); harmless in production.

| Token | Put it on | Used by |
|---|---|---|
| `fit` | the section that must fit one viewport | C2, C7, C11 |
| `scroll-scene` | the tall scroll container of a pinned/scroll-driven scene | scroll steps, C2 |
| `above-fold` | hero CTA row and key text | C4 |
| `key-visual` | main image/video/stage, or the transparent proxy over a canvas subject | C7, C8, C10 |
| `bg` | backgrounds that may be cropped (cover images, textures, full-bleed canvases) | skips C8, C9 |
| `bleed` | text that is meant to run full width (marquees, giant wordmarks) | skips C6 |
| `clip-ok` | carousels, marquees and reveal masks that clip on purpose | skips C3 |
| `overlay-ok` | text designed to sit on a visual | skips C10, C12 |
| `decor` | decorative ghost text (huge outline words, watermarks) that is meant to be faint | skips C12 |

## Viewports

Required: **uw-half 1720x1280 (primary)**, design 1440x900, uw-half-stress 1720x1440, uw-full 3440x1280, uw-full-f11 3440x1440, uw-29 2560x940, qhd 2560x1300, qhd-1440 2560x1440, fhd 1920x950, laptop-125 1536x730, mbp-14 1512x860. The team's monitors are usually 1440px high, so the three 1440-high sizes (1720x1440, 3440x1440, 2560x1440) matter on every project: they are where a section sized from the window height grows taller than its content. Optional (`--matrix all`): suw-49, qhd-half, uw-third (shows Framer's Tablet breakpoint), mba-13, small, tablet-l. The list lives in `SKILL_DIR/scripts/viewports.json`; sizes are usable browser area, not monitor resolution.
