# Anti-patterns: lint IDs L1-L16

One entry per rule of `node scripts/lint-sizing.mjs <files>`: what it catches, why it breaks (with numbers at the required viewports), bad code, good code, and a legitimate suppression. Fix every error. Every remaining warning needs a justification.

| ID | Pattern | Severity | Rule |
|---|---|---|---|
| L1 | `font-size`/`fontSize` in `vw`, `cqi` or `cqw`, not inside `clamp(`/`min(` | error | 2 |
| L2 | `font-size`/`fontSize` in `vh`/`svh`/`dvh`/`lvh`, not inside a `min(`/`clamp(` that also contains a width unit (`vw`, `cqw`, `cqi`, `%`, or `var(--vs-u)`) | error | 2, 3 |
| L3 | `width`/`min-width`/`flex-basis` computed from `vh`/`svh`/`dvh` (e.g. `calc(80vh * 16 / 9)`, `120svh`), not inside `min(100%` and with no `max-width` in the same rule | error | 3 |
| L4 | `height`/`min-height` in `vh`/`svh`/`dvh` together with `aspect-ratio` in the same rule, with no `max-width` / `min(100%` | error | 3 |
| L5 | `aspect-ratio` on a `width: 100%` box with no `max-height` and no `min(` width | error | 4 |
| L6 | `height` of `100vh`/`100svh`/`100dvh`/`100lvh` (including `calc(100vh - …)` forms) together with `overflow: hidden\|clip` in the same rule | error | 8 |
| L7 | `window.innerWidth` in a file with no `innerHeight` and no `ResizeObserver`, or `window.innerHeight` with no `innerWidth` and no `ResizeObserver` | error | 9 |
| L8 | `width: 100vw` / `"100vw"` | warning | 13 |
| L9 | `object-fit: cover` / `objectFit: "cover"` in a `fit` component, or any full-bleed `<canvas>`, without `data-vs="bg"` | warning | 5 |
| L10 | Three.js / React Three Fiber camera (`PerspectiveCamera`, `<Canvas`) or a Unicorn Studio / Spline embed (`unicornstudio`, `@splinetool`) with no aspect handling (a `fov` update or an aspect-locked stage) | warning | 6 |
| L11 | Vertical `padding`/`margin`/`gap` in `vw` or `cqi` | warning | 4 |
| L12 | Any `vw`/`cqi`/`cqw`/`vh`/`svh` value in an expression with no `clamp`/`min`/`max` | warning | 2 |
| L13 | ScrollTrigger `end:` given as a static string, or no `invalidateOnRefresh: true` | warning | 9 |
| L14 | Framer component root does not spread the `style` prop | warning | Framer |
| L15 | `container-type` on the component root, or in a file whose `@framerSupportedLayoutWidth` allows `auto` | warning | 2, Framer |
| L16 | `BRAND` constant missing, or its values differ from the config | warning | 7 |

"Same rule" means the same CSS rule block or the same JS object literal.

## Suppressing a finding

Put a justification on the flagged line or the line above:

```ts
// vs-ignore L9: <reason>
```

- In TS, TSX and JS: `// vs-ignore L<n>: <reason>`.
- In CSS (`.css` files and CSS inside template strings), write the same text as a block comment, `/* vs-ignore L<n>: <reason> */`. A `//` line is not a comment in CSS: it swallows the next rule.
- The lint still lists the finding, as "justified".
- A good reason says why the failure mode cannot happen here: the bound that holds, the design intent, or the check that covers it. "Needed", "fine" or "matches the design" is not a reason.
- Errors (L1-L7) are for fixing. Suppress one only when the match is a false positive or a documented exception (the scale-to-fit artboard for L6), and say which in the reason. If you cannot explain why the code cannot fail, change the code.

---

## L1 · font-size in vw, cqi or cqw

**Error · rule 2.** `font-size`/`fontSize` in `vw`, `cqi` or `cqw`, not inside `clamp(`/`min(`.

**Catches.** `font-size: 8vw`, `fontSize: "6cqw"`, `font-size: calc(2rem + 4vw)`.

**Why it breaks.** Width-only type grows without limit on ultrawides. `8vw` is 115px at 1440x900 and 275px at 3440x1280, past the C5 failure line (1.5 x `displayTypeMax` = 180px) and usually pushing the CTAs below the fold. Container units are width units too: `6cqi` in a full-width wrapper is 206px at 3440.

```css
/* bad */
.headline { font-size: 8vw; }
```

```css
/* good: contain unit, clamped to the brand range */
.headline { font-size: clamp(40px, 80 * var(--vs-u), 120px); }
```

`clamp(40px, 8vw, 120px)` passes L1 but still follows width only: at 1536x730 it is 120px on a 730px-tall window, where the contain unit gives 64.9px.

**Legitimate suppression.** Type relative to a small container with its own px cap:

```css
/* vs-ignore L1: card title; the card container is at most 360px wide, so 10cqi never exceeds 36px */
.card-title { font-size: 10cqi; }
```

## L2 · font-size in vh, svh, dvh or lvh

**Error · rules 2, 3.** `font-size`/`fontSize` in `vh`/`svh`/`dvh`/`lvh`, not inside a `min(`/`clamp(` that also contains a width unit (`vw`, `cqw`, `cqi`, `%`, or `var(--vs-u)`).

**Catches.** `font-size: 11vh`, and also `clamp(40px, 11vh, 160px)`: a clamp with no width unit still follows height only.

**Why it breaks.** This is the tall-window bug in type. `11vh` is 99px at 1440x900, 141px at 1720x1280 and 158px at 1720x1440: the narrow half-screen window gets bigger type than the 3440x1280 ultrawide (141px). A two-line headline wraps to three or four lines and pushes the CTAs down (C4).

```css
/* bad */
.headline { font-size: clamp(40px, 11vh, 160px); }
```

```css
/* good: 80px at design, 95.6px at 1720x1280, 113.8px at 3440x1280, 64.9px at 1536x730 */
.headline { font-size: clamp(40px, 80 * var(--vs-u), 120px); }
```

**Legitimate suppression.** Text whose long axis runs along the height:

```tsx
const sideLabel = {
    writingMode: "vertical-rl",
    // vs-ignore L2: vertical side label; its length runs along the height, so height is the right driver
    fontSize: "clamp(14px, 2svh, 24px)",
} as const
```

## L3 · width from vh, svh or dvh

**Error · rule 3.** `width`/`min-width`/`flex-basis` computed from `vh`/`svh`/`dvh` (e.g. `calc(80vh * 16 / 9)`, `120svh`), not inside `min(100%` and with no `max-width` in the same rule.

**Catches.** `width: calc(80svh * 16 / 9)`, `width: 120svh`, `flex-basis: 60svh`, `min-width: 90vh`.

**Why it breaks.** A width taken from the height gets wider as the window gets taller, whatever its actual width. `calc(80vh * 16 / 9)` is 1280px at 1440x900 (fits), 1820px at 1720x1280 (100px past the window, C1) and 2048px at 1720x1440 (328px past).

```css
/* bad */
.stage { width: calc(80svh * 16 / 9); }
```

```css
/* good: never wider than the parent */
.stage { width: min(100%, calc(80svh * 16 / 9)); }
```

**Legitimate suppression.** A track that is meant to be wider than the window:

```css
.track {
  /* vs-ignore L3: scroll track, intentionally wider than the window; its section clips it and each card is width-bounded (pattern 6.5) */
  width: calc(8 * 60svh);
}
```

## L4 · svh height plus aspect-ratio

**Error · rule 3.** `height`/`min-height` in `vh`/`svh`/`dvh` together with `aspect-ratio` in the same rule, with no `max-width` / `min(100%`.

**Catches.** `height: 80svh; aspect-ratio: 16 / 9`, where the aspect ratio turns the height into a width.

**Why it breaks.** At 1720x1280 the box is 1024px tall and therefore 1820px wide in a 1720px window; at 1720x1440 it is 2048px wide. The tall fixture (`BrokenTallHero`) fails C1 at uw-half with exactly this image.

```css
/* bad */
.video { height: 80svh; aspect-ratio: 16 / 9; }
```

```css
/* good: bounded on both axes (pattern 6.4); 1411x794 at 1720x1280 */
.video { width: min(100%, calc(62svh * 16 / 9)); aspect-ratio: 16 / 9; margin-inline: auto; }
```

**Legitimate suppression.** A portrait ratio that cannot outgrow any required window:

```css
.phone {
  /* vs-ignore L4: 9/16 phone mockup; width is at most 34svh (486px at 1720x1440), far inside every required window */
  height: 60svh;
  aspect-ratio: 9 / 16;
}
```

## L5 · full-width aspect-ratio box

**Error · rule 4.** `aspect-ratio` on a `width: 100%` box with no `max-height` and no `min(` width.

**Catches.** `width: 100%; aspect-ratio: 16 / 9` and other full-width ratio boxes.

**Why it breaks.** The wide-window bug. A full-width 16:9 box is 1935px tall at 3440x1280 (window 1280), 1440px at 2560x940, and 864px at 1536x730 (window 730). Everything after it, CTAs included, falls below the fold.

```css
/* bad */
.video { width: 100%; aspect-ratio: 16 / 9; }
```

```css
/* good: the width is capped by the height budget */
.video { width: min(100%, calc(62svh * 16 / 9)); aspect-ratio: 16 / 9; margin-inline: auto; }
```

Prefer the `min()` width over `max-height`: with `width: 100%` and `max-height`, the box keeps its width and the aspect ratio breaks.

**Legitimate suppression.** A box whose parent is already narrow and capped:

```css
.thumb {
  width: 100%;
  /* vs-ignore L5: thumbnail in a 3-column grid inside the 1440px content container; at most 453px wide and 255px tall */
  aspect-ratio: 16 / 9;
}
```

## L6 · full-screen height that clips

**Error · rule 8.** `height` of `100vh`/`100svh`/`100dvh`/`100lvh` (including `calc(100vh - …)` forms) together with `overflow: hidden|clip` in the same rule.

**Catches.** `height: 100vh; overflow: hidden`, `height: calc(100svh - 80px); overflow: clip`.

**Why it breaks.** Whatever does not fit is cut. At 1536x730, a hero whose content needs 820px loses its bottom 90px, usually the CTA row (C3, C4). At 3440x1280, width-driven content (an `8vw` headline is 275px per line) outgrows the fixed height.

```css
/* bad */
.hero { height: 100vh; overflow: hidden; }
```

```css
/* good: one screen is the floor, not the ceiling */
.hero { min-height: 100vh; min-height: 100svh; }
```

For a pinned stage, keep `height: 100svh` on the sticky element but move the clipping to the outer section with `overflow-x: clip` (`scroll-animation.md`, section 2).

**Legitimate suppression.** The scale-to-fit artboard, the one exception in rule 8:

```tsx
const artboardFrame = {
    position: "relative",
    // vs-ignore L6: scale-to-fit artboard (rule 11); children are scaled by min(boxW / 1440, boxH / 900), so nothing can exceed the box
    height: "100svh",
    overflow: "hidden",
} as const
```

## L7 · one-axis window reads

**Error · rule 9.** `window.innerWidth` in a file with no `innerHeight` and no `ResizeObserver`, or `window.innerHeight` with no `innerWidth` and no `ResizeObserver`.

**Catches.** Scale factors, breakpoints and layout decisions from one axis of the window.

**Why it breaks.** `scale = innerWidth / 1440` is 2.39 at 3440x1280, so a 900px composition becomes 2150px tall in a 1280px window. `scale = innerHeight / 900` is 1.6 at 1720x1440, so the 1440px frame is 2304px wide in a 1720px window: the collateral.com failure in JS. Window reads also throw during Framer's server render, run once, and ignore the component's real box (on the canvas, the window is the editor).

```ts
// bad
const scale = window.innerWidth / 1440
```

```tsx
// good: the component's own box, both axes, null until measured (pattern 6.9)
const [ref, box] = useBox<HTMLDivElement>()
const scale = box && box.w > 0 && box.h > 0 ? Math.min(box.w / BRAND.designW, box.h / BRAND.designH) : 1
```

**Legitimate suppression.** A read that no layout depends on:

```ts
// vs-ignore L7: picks the 1x or 2x texture set from screen width only; no size or scale depends on it
const textureSet = window.innerWidth > 1920 ? "2x" : "1x"
```

## L8 · 100vw

**Warning · rule 13.** `width: 100vw` / `"100vw"`.

**Catches.** Full-bleed tricks built on `100vw`, in CSS or inline styles.

**Why it breaks.** With Windows classic scrollbars (17px), `100vw` is 17px wider than the page: 1720px on a 1703px-wide page at uw-half, so the page scrolls sideways (C1) at every viewport that has a vertical scrollbar. macOS overlay scrollbars hide the bug; the audit injects a 17px scrollbar to reproduce it.

```css
/* bad */
.bleed { width: 100vw; margin-left: calc(50% - 50vw); }
```

```css
/* good: bleed from a full-width parent; in Framer, set the instance to Fill */
.bleed { width: 100%; }
```

**Legitimate suppression.** Rare. A fixed overlay that a third-party script sizes by width:

```css
.menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  /* vs-ignore L8: fixed overlay sized by the menu script, which ignores inset; fixed boxes never add page scroll width */
  width: 100vw;
}
```

Prefer `position: fixed; inset: 0` whenever you control the element.

## L9 · cover without data-vs="bg"

**Warning · rule 5.** `object-fit: cover` / `objectFit: "cover"` in a `fit` component, or any full-bleed `<canvas>`, without `data-vs="bg"`.

**Catches.** Media or canvases that crop on some window shape without saying they are background.

**Why it breaks.** Cover crops by the window's shape. A 16:10 image loses 8% of each side at 1720x1280 and 12.7% at 1720x1440, and 20% at the top and bottom at 3440x1280. A logo, product or ring in that image loses its edges. A full-bleed height-locked canvas is the collateral.com ring: 82px past the edge at 1720x1280.

```tsx
// bad: a key product shot, cropped by cover
<img src={shot} alt="Product" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
```

```tsx
// good: key media contained and marked; background media marked as background
<>
    <img src={shot} alt="Product" data-vs="key-visual" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
    <video src={loop} data-vs="bg" autoPlay muted loop playsInline style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
</>
```

**Legitimate suppression.** Cropping that is the design:

```tsx
// vs-ignore L9: 48px round avatars; cropping to a circle is the design and no edge matters
const avatar = { width: 48, height: 48, borderRadius: "50%", objectFit: "cover" } as const
```

## L10 · 3D or embed with no aspect handling

**Warning · rule 6.** Three.js / React Three Fiber camera (`PerspectiveCamera`, `<Canvas`) or a Unicorn Studio / Spline embed (`unicornstudio`, `@splinetool`) with no aspect handling (a `fov` update or an aspect-locked stage).

**Catches.** Scenes that use the default height-locked projection.

**Why it breaks.** A perspective camera keeps its vertical field of view, so narrower windows lose the sides: 8% of the design width on each side at 1720x1280 and 12.7% at 1720x1440. Unicorn Studio and Spline scenes placed full-bleed behave the same way.

```ts
// bad: the Three.js default, which is height-locked
camera.aspect = w / h
camera.updateProjectionMatrix()
```

```ts
// good: hold the design's horizontal FOV on narrow windows (canvas-and-embeds.md, 4.4)
containCamera(camera, w, h, 35, BRAND.designW / BRAND.designH)
```

For embeds, put the scene in an aspect-locked stage (`sizing-patterns.md`, 6.3).

**Legitimate suppression.** A scene with no key object:

```ts
// vs-ignore L10: particle-field background (data-vs="bg"); every part is interchangeable, so cropping the sides is invisible
const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100)
```

## L11 · vertical spacing in vw or cqi

**Warning · rule 4.** Vertical `padding`/`margin`/`gap` in `vw` or `cqi`.

**Catches.** `padding-block: 8vw`, `padding-top: 5vw`, `margin-bottom: 4cqi`, `gap: 3vw` in a column.

**Why it breaks.** Height taken from width. `padding-block: 8vw` is 275px top and bottom at 3440x1280, 550px of a 1280px window; 205px each at 2560x940 (410 of 940); 123px each at 1536x730 (246 of 730).

```css
/* bad */
.hero { padding-block: 8vw; }
```

```css
/* good: vertical spacing from the height, clamped */
.hero { padding-block: clamp(48px, 10svh, 160px); }
```

`clamp(16px, calc(32 * var(--vs-u)), 48px)` also works.

**Legitimate suppression.** A gap that only acts horizontally:

```css
.logo-row {
  display: flex;
  /* vs-ignore L11: single-row flex strip that never wraps, so gap only acts horizontally */
  gap: clamp(12px, 2cqi, 32px);
}
```

Prefer `column-gap` there, which the lint does not flag.

## L12 · unbounded viewport or container unit

**Warning · rule 2.** Any `vw`/`cqi`/`cqw`/`vh`/`svh` value in an expression with no `clamp`/`min`/`max`.

**Catches.** Offsets, transforms and sizes that follow one window axis without limits, such as `left: 10vw`, `translate: 0 -20vh`, `width: 90vw`. A height sized in `svh` (`min-height: 100svh`, a scroll length) follows the axis it sizes and is not what this rule is after.

**Why it breaks.** Unbounded values drift away from everything that is contained. `left: 10vw` is 144px at 1440x900 and 344px at 3440x1280, so a label moves away from a visual that stopped growing. A parallax `translate: 0 -20vh` moves an element 180px at 1440x900 but 288px at 1720x1440, on a window only 1.19x wider, so it can slide over the headline.

```css
/* bad */
.label { position: absolute; left: 10vw; translate: 0 -20vh; }
```

```css
/* good: position in the stage's own coordinates, or bound the value */
.label { position: absolute; left: clamp(24px, 10vw, 160px); translate: 0 clamp(-160px, -20vh, -48px); }
```

**Legitimate suppression.** A start value that is never shown at rest:

```css
.sheet-enter {
  /* vs-ignore L12: off-screen start of the entrance transition; it animates to 0 and is never seen at rest */
  translate: 0 100vh;
}
```

## L13 · static ScrollTrigger end

**Warning · rule 9.** ScrollTrigger `end:` given as a static string, or no `invalidateOnRefresh: true`.

**Catches.** `end: "+=3000"`, `end: "+=" + track.scrollWidth` evaluated once, and triggers without `invalidateOnRefresh: true`.

**Why it breaks.** The scroll distance depends on the window. An 8-card track sized from `svh` is 3948px at 1440x900 and 6216px at 1720x1440, so a static end finishes the pin early on one and late on the other. Without `invalidateOnRefresh`, function values are computed once, and snapping the window from maximized to half leaves the old distance.

```ts
// bad
ScrollTrigger.create({ trigger: section, pin: true, start: "top top", end: "+=3000" })
```

```ts
// good
ScrollTrigger.create({
    trigger: section,
    pin: true,
    start: "top top",
    end: () => "+=" + (track.scrollWidth - section.clientWidth),
    invalidateOnRefresh: true,
})
```

**Legitimate suppression.** A scroll length that is pacing, not geometry:

```ts
ScrollTrigger.create({
    trigger: section,
    pin: true,
    start: "top top",
    // vs-ignore L13: six-line text reveal; the scroll distance is a pacing choice and depends on no size
    end: "+=2400",
    invalidateOnRefresh: true,
})
```

## L14 · root does not spread style

**Warning · Framer.** Framer component root does not spread the `style` prop.

**Catches.** Roots that ignore `props.style` or spread it on an inner element.

**Why it breaks.** Framer passes the instance's size through `style`. Without the spread, Fill, Fixed and Viewport height never reach the DOM: an instance set to Fill on the 3440px Desktop breakpoint renders at its content width, and a `fit` hero set to Viewport height ignores it. The canvas and the site then disagree.

```tsx
// bad
return <section className="hero" style={{ minHeight: "100svh" }} />
```

```tsx
// good: defaults before the spread, invariants after it
return <section className="hero" style={{ width: "100%", ...style, position: "relative" }} />
```

**Legitimate suppression.** The root element is not a box:

```tsx
// vs-ignore L14: root is a context provider; style is spread on its only child, the section
return <HeroContext.Provider value={ctx}><section style={{ width: "100%", ...style }} /></HeroContext.Provider>
```

## L15 · container-type in the wrong place

**Warning · rules 2, Framer.** `container-type` on the component root, or in a file whose `@framerSupportedLayoutWidth` allows `auto`.

**Catches.** `containerType: "inline-size"` on the root element, and container units in components that can be set to Fit width.

**Why it breaks.** The root cannot query itself, so its `cqw` resolves against whatever Framer wraps it in, or the editor window on the canvas. With Fit width (`auto`), inline-size containment gives the box no intrinsic width: it collapses to 0px and the component disappears.

```tsx
// bad
/**
 * @framerSupportedLayoutWidth any
 */
export default function Hero(props: HeroProps) {
    return <section style={{ ...props.style, containerType: "inline-size" }} />
}
```

```tsx
// good: an inner wrapper, and a width annotation without auto
/**
 * @framerSupportedLayoutWidth fixed
 */
export default function Hero(props: HeroProps) {
    return (
        <section style={{ width: "100%", ...props.style }}>
            <div style={{ containerType: "inline-size", width: "100%" }} />
        </section>
    )
}
```

**Legitimate suppression.** An annotation kept for existing instances, after checking them:

```ts
// vs-ignore L15: stays any-prefer-fixed so existing instances keep their settings; every instance on the site is Fill (checked in Framer)
```

## L16 · BRAND missing or drifted

**Warning · rule 7.** `BRAND` constant missing, or its values differ from the config.

**Catches.** Components with hardcoded max widths or gutters, and `BRAND` blocks that were not updated with the config.

**Why it breaks.** The component stops lining up with the brand. With `contentMaxWidth: 1600` against a config of 1440, text lines are 1592px at 1720x1280 and 1600px at 3440x1280, both failing C6 (more than 1442px), and the column no longer matches the native Framer layers around it.

```ts
// bad: a guessed value, not the config's
const MAX_WIDTH = 1600
```

```ts
// good: copied from the config, in exactly this format
// Brand values copied from clients/example/viewport-safe.config.json. Update both together.
const BRAND = { contentMaxWidth: 1440, gutterMin: 24, gutterMax: 64, displayTypeMax: 120, designW: 1440, designH: 900 }
```

**Legitimate suppression.** A component with no brand-dependent size:

```ts
// vs-ignore L16: brand-neutral spacer utility; it has no widths, gutters or type sizes
```
