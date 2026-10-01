# Sizing patterns

Copy-paste patterns for rules 1-13. Each one gives the problem, the bad code with its numbers at the required viewports, the good code, and why it works.

Numbers assume a full-width component, no scrollbar and a 1440x900 design frame unless stated. With the audit's simulated 17px classic scrollbar, `100%` and `100cqw` are 17px smaller than the window; `vw` is not (that gap is rule 13).

| Viewport | Size | Aspect | Which axis binds the contain unit |
|---|---|---|---|
| design | 1440x900 | 1.60 | both (scale 1) |
| **uw-half** (primary) | **1720x1280** | **1.34** | **width (1.194)** |
| uw-half-stress | 1720x1440 | 1.19 | width (1.194) |
| uw-full | 3440x1280 | 2.69 | height (1.422) |
| laptop-125 | 1536x730 | 2.10 | height (0.811) |

## Contents

- [6.1 Contain unit](#61-contain-unit): the base of every viewport-relative size
- [6.2 Display type](#62-display-type)
- [6.3 Aspect-locked stage](#63-aspect-locked-stage): the main fix for height-locked scenes
- [6.4 Media box on both axes](#64-media-box-on-both-axes)
- [6.5 Height-sized cards with a width bound](#65-height-sized-cards-with-a-width-bound)
- [6.6 Full-screen section](#66-full-screen-section)
- [6.7 Content container](#67-content-container)
- [6.8 Window-shape media queries](#68-window-shape-media-queries)
- [6.9 Scale-to-fit with useBox](#69-scale-to-fit-with-usebox)
- [Symptom lookup](#symptom-lookup)

---

## 6.1 Contain unit

**Problem.** Every viewport unit follows one axis. Width units (`vw`, `cqw`, `cqi`) blow up on ultrawides; height units (`vh`, `svh`) blow up on tall windows such as uw-half. Whichever axis you pick is wrong for half the matrix.

**Bad.** An 80px design headline converted to one axis:

```css
/* width-only: 80px at 1440 wide */
.headline-w { font-size: 5.556vw; }
/* height-only: 80px at 900 tall */
.headline-h { font-size: 8.889svh; }
```

| | 1440x900 | 1720x1280 | 1720x1440 | 3440x1280 | 1536x730 |
|---|---|---|---|---|---|
| `5.556vw` | 80 | 95.6 | 95.6 | **191.1** | 85.3 |
| `8.889svh` | 80 | **113.8** | **128.0** | 113.8 | 64.9 |

**Good.**

```css
/* Inner wrapper, NOT the Framer root (see framer-specifics.md). Needs a definite width. */
.vs-wrap { container-type: inline-size; width: 100%; }
/* 1 design px, scaled by whichever axis is tighter */
.vs-wrap > * { --vs-u: min(100cqw / 1440, 100svh / 900); }
```

Use it as `N * var(--vs-u)`, where N is the size in design px, and clamp every use:

```css
.headline { font-size: clamp(40px, 80 * var(--vs-u), 120px); }
```

Tested in Chrome with that 80px design headline:

| Viewport | Bound by | Result |
|---|---|---|
| 1440x900 | — | 80px |
| 1720x1280 | width | 95.6px |
| 1720x1440 | width | 95.6px |
| 3440x1280 | height | 113.8px |
| 1536x730 | height | 64.9px |

**Why.** `min()` picks the tighter axis, so the composition scales the way a contained image does: never wider than its box, never taller than the window. The clamp keeps text readable on small windows and caps it at `displayTypeMax` on huge ones.

How it resolves:

- `cqw` resolves against the nearest *ancestor* container, never the element's own `container-type`. That is why `--vs-u` is declared on the wrapper's children, not on the wrapper.
- Unregistered custom properties inherit as text, so `cqw` is resolved where `var(--vs-u)` is used. Every descendant of the wrapper gets the right value. (If you ever register `--vs-u` with `@property` as a `<length>`, it resolves where it is declared; declaring it on the children is still correct.)
- Outside any container, `cqw` falls back to small-viewport units. The value still works but then ignores the scrollbar and the component's real width (on the Framer canvas it becomes the editor window).
- Container units are still width units. `cqw` alone is not a fix; only the `min()` with `svh` is.

### From TSX inline styles

Framer components often set styles inline. Build the expression from `BRAND` instead of literal 1440/900:

```tsx
const BRAND = { contentMaxWidth: 1440, gutterMin: 24, gutterMax: 64, displayTypeMax: 120, designW: 1440, designH: 900 }

const U = `min(100cqw / ${BRAND.designW}, 100svh / ${BRAND.designH})`

// Option A: inline the expression on any element inside the container wrapper.
const headlineStyle = {
    fontSize: `clamp(40px, calc(80 * ${U}), ${BRAND.displayTypeMax}px)`,
}

// Option B: declare --vs-u once, one level below the wrapper, and use var() further down.
// Objects that hold custom properties need the cast.
const unitScope = { "--vs-u": U } as React.CSSProperties
const subStyle = { fontSize: "clamp(16px, calc(22 * var(--vs-u)), 28px)" }

const markup = (
    <div style={{ containerType: "inline-size", width: "100%" }}>
        <div style={unitScope}>
            <h1 style={headlineStyle}>Headline</h1>
            <p style={subStyle}>Subheading</p>
        </div>
    </div>
)
```

Keep the definition and its uses on different elements: never put `--vs-u` (or any `cq` value) on the element that has `container-type`, and don't define `--vs-u` and read it in the same inline style object. Define it on the wrapper's child and use it in that child's descendants, or inline `U` directly.

---

## 6.2 Display type

**Problem.** Giant headlines sized from one axis. Height-sized type on a tall window gets big relative to the width, wraps into extra lines and pushes the CTAs down. Width-sized type on an ultrawide gets taller than the fold allows.

**Bad.**

```css
/* height-only */
.headline { font-size: 11vh; }
/* width-only */
.headline-wide { font-size: 8vw; }
```

| | 1440x900 | 1720x1280 | 1720x1440 | 3440x1280 | 1536x730 |
|---|---|---|---|---|---|
| `11vh` | 99 | **140.8** | **158.4** | 140.8 | 80.3 |
| `8vw` | 115.2 | 137.6 | 137.6 | **275.2** | 122.9 |
| contain unit | 80 | 95.6 | 95.6 | 113.8 | 64.9 |

At 1720x1280, `11vh` is 1.42x the design size on a window only 1.19x wider, so a two-line headline becomes three or four lines. At 3440x1280, `8vw` is 275px, past the audit's failure line of 1.5 x `displayTypeMax` = 180px (C5).

**Good.**

```css
/* contained and clamped; the max comes from BRAND.displayTypeMax */
.headline { font-size: clamp(40px, 80 * var(--vs-u), 120px); line-height: 1.02; text-wrap: balance; }
```

```tsx
const headlineStyle = {
    fontSize: `clamp(40px, calc(80 * var(--vs-u)), ${BRAND.displayTypeMax}px)`,
    lineHeight: 1.02,
}
```

**Why.** The contain unit keeps the headline in proportion to the tighter axis, and the clamp keeps it inside the brand range. Only display type (headlines, big numbers) scales this way. Body text, labels, buttons and UI stay in px/rem with breakpoints (rule 1). Note that `clamp(40px, 8vw, 120px)` satisfies the lint but still follows width only: at 1536x730 it gives 120px on a 730px-tall window, where the contain unit gives 64.9px.

---

## 6.3 Aspect-locked stage

**Problem.** Height-locked scenes (Unicorn Studio, Spline, the Three.js default camera, most WebGL) draw the 1440x900 design frame scaled by `height / 900`, centred. On any window narrower than 16:10 the sides of the frame fall outside the window. The DOM looks fine (the canvas is exactly window-sized), so only a pixel or proxy check catches it.

**Bad.** A full-bleed, height-locked scene:

```css
.hero { position: relative; min-height: 100svh; }
.hero > canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
```

| Window | Scene scale | Rendered frame width | Frame lost |
|---|---|---|---|
| 1440x900 | 1.000 | 1440 | none |
| **1720x1280** | 1.422 | 2048 | **164px each side (8.0%)** |
| 1720x1440 | 1.600 | 2304 | 292px each side (12.7%) |
| 3440x1280 | 1.422 | 2048 | none, 696px of spare space each side |
| 1536x730 | 0.811 | 1168 | none, 184px of spare space each side |

**Good.**

```css
/* The scene keeps its design aspect ratio and is contained on both axes, so a height-locked
   scene inside it scales by the tighter axis and is never cropped.
   Tested: 1720x1075 at 1720x1280, 2048x1280 at 3440x1280. */
.scene-stage {
  width: min(100%, calc(100svh * 1440 / 900));
  aspect-ratio: 1440 / 900;
  margin: auto;
}
/* Paint the section with the scene's background colour so the letterbox bands are invisible. */
.hero { min-height: 100svh; display: grid; place-items: center; background: var(--scene-bg); }
```

Make the stage the positioning box for the scene and anything overlaid on it:

```css
.scene-stage { position: relative; }
.scene-stage > canvas,
.scene-stage > iframe { position: absolute; inset: 0; width: 100%; height: 100%; }
```

| Window | Stage | Bands (scene background) |
|---|---|---|
| 1440x900 | 1440x900 | none |
| 1720x1280 | 1720x1075 | 102.5px top and bottom |
| 1720x1440 | 1720x1075 | 182.5px top and bottom |
| 3440x1280 | 2048x1280 | 696px each side |
| 1536x730 | 1168x730 | 184px each side |

From TSX:

```tsx
const stageStyle = {
    position: "relative",
    width: `min(100%, calc(100svh * ${BRAND.designW} / ${BRAND.designH}))`,
    aspectRatio: `${BRAND.designW} / ${BRAND.designH}`,
    margin: "auto",
} as const
```

If other content in the section must share the height (a heading above the stage), subtract it from the height term: `width: min(100%, calc((100svh - 160px) * 1440 / 900))`.

**Why.** Inside the stage the scene always sees the design shape, so its own height-locked scaling becomes `stage height / 900 = min(W / 1440, H / 900)`: the contain unit again. Nothing is cropped at any window shape; the cost is letterbox bands, which disappear when the section has the scene's background colour.

The alternative is to split the scene: a full-bleed `data-vs="bg"` layer (texture, gradient) plus the key visual in its own contained box inside the grid. See `canvas-and-embeds.md` for both.

---

## 6.4 Media box on both axes

**Problem.** A video or image box that takes one dimension from the window and the other from its aspect ratio grows without limit along the second axis.

**Bad.**

```css
/* bad (wide): width-driven height */
.video { width: 100%; aspect-ratio: 16 / 9; }
```

```css
/* bad (tall): height-driven width */
.video { height: 80svh; aspect-ratio: 16 / 9; }
```

| | 1440x900 | 1720x1280 | 1720x1440 | 3440x1280 | 1536x730 |
|---|---|---|---|---|---|
| `width: 100%` (height) | 810 | 968 | 968 | **1935 in a 1280 window** | **864 in a 730 window** |
| `height: 80svh` (width) | 1280 | **1820 in a 1720 window** | **2048 in a 1720 window** | 1820 | 1038 |

The tall version overflows by 100px at uw-half and 328px at uw-half-stress (C1).

**Good.**

```css
/* capped on both axes */
.video { width: min(100%, calc(62svh * 16 / 9)); aspect-ratio: 16 / 9; margin-inline: auto; }
```

| | 1440x900 | 1720x1280 | 1720x1440 | 3440x1280 | 1536x730 |
|---|---|---|---|---|---|
| box (full-width parent) | 992x558 | 1411x794 | 1587x893 | 1411x794 | 805x453 |

**Why.** The width is the smaller of the available width and the width the height budget allows; the aspect ratio then derives a height that can never exceed that budget. Pick N (here 62svh) from the height budget: it is what is left after the heading, text, CTAs and padding. Inside a content container, `100%` binds first (1440 at uw-half-stress, so 1440x810). Keep the media's own aspect ratio on the box, or use `object-fit: contain`, so nothing inside is cropped.

---

## 6.5 Height-sized cards with a width bound

**Problem.** In galleries and fit sections, sizing cards by height keeps a row inside one screen. But the width follows from the aspect ratio, so on tall windows svh-sized cards get wider: the track gets longer, and a landscape card can end up wider than the window.

**Bad.**

```css
.card { aspect-ratio: 16 / 10; height: 80svh; flex: none; }
```

| | 1440x900 | 1720x1280 | 1720x1440 | 3440x1280 | 1536x730 |
|---|---|---|---|---|---|
| card | 1152x720 | 1638x1024 | **1843x1152, 123px wider than the window** | 1638x1024 | 934x584 |

At 1720x1280 the card is already wider than the window minus its 64px gutters (1592px). At 1720x1440 no scroll position shows a whole card.

**Good.**

```css
/* Height from svh, capped by px AND by the width it would produce. Width follows from the aspect ratio. */
.card { aspect-ratio: 3 / 4; height: min(70svh, 640px, calc(85cqw * 4 / 3)); flex: none; }
```

| Portrait 3/4 card | 1440x900 | 1720x1280 | 1720x1440 | 3440x1280 | 1536x730 |
|---|---|---|---|---|---|
| card | 473x630 | 480x640 | 480x640 | 480x640 | 383x511 |

The same shape for the landscape card:

```css
.card-wide { aspect-ratio: 16 / 10; height: min(80svh, 720px, calc(85cqw * 10 / 16)); flex: none; }
```

This gives 1152x720 at 1720x1440, and 975x609 at 1147x1280 (uw-third), where the `cqw` bound binds.

**Why.** Three caps, one per failure: `svh` keeps the card inside the window height, `px` keeps it card-sized on big screens, and `N cqw * h / w` turns the width limit into a height limit through the aspect ratio, so one card is never wider than 85% of the container. Put `container-type: inline-size` on the section wrapper (window-wide), never on the scrolling track: the track is thousands of px wide, so `85cqw` of the track bounds nothing.

The same rule in JS, from a real `Arch_Reveal_Section` component: the arch height comes from the pinned viewport height and is capped by the width it would produce.

```ts
const archH = Math.min((size.h * archSize) / 100, (frameW * 0.62) / archRatio)
```

On the live site (`archSize` 42) that is 604.8px tall at 1720x1440 (0.42 x 1440), about 756px wide, and it fits.

---

## 6.6 Full-screen section

**Problem.** A fixed-height, clipping section cuts whatever does not fit. On short windows that is the CTA row; on ultrawides it is width-driven content that grew taller than the section.

**Bad.**

```css
.hero { height: 100vh; overflow: hidden; }
```

At 1536x730, a hero whose content needs 820px loses its bottom 90px, usually the CTAs (C3 clipping, C4 above the fold). At 3440x1280 an `8vw` headline (275px per line) outgrows the section and is cut. `100vh` can also be taller than the visible area where browser UI overlaps it.

**Good.**

```css
.hero { min-height: 100vh; min-height: 100svh; padding-block: clamp(48px, 10svh, 160px); }
```

| | 1440x900 | 1720x1280 | 1720x1440 | 3440x1280 | 1536x730 |
|---|---|---|---|---|---|
| padding-block | 90 | 128 | 144 | 128 | 73 |

Add `box-sizing: border-box` so the padding stays inside the 100svh.

**Why.** `min-height` makes one screen a floor, not a ceiling: the section fills the window and grows when content needs more, so nothing is ever clipped. The `100vh` line is the fallback for browsers without `svh`. For a `fit` component this is the safety net, not a licence to overflow: the content must still fit the 730px height budget. The only exception is the scale-to-fit stage (6.9), whose content is scaled into the box.

---

## 6.7 Content container

**Problem.** Framer's Desktop breakpoint stretches to any width. A component whose text column is `width: 100%` or `90vw` gets 3000px lines on an ultrawide. Native Framer layers held up in testing because they cap their width; code components must do it themselves.

**Bad.**

```css
.container { width: 90vw; margin-inline: auto; }
```

That is 3096px at 3440x1280 and 1548px at 1720x1280. Both exceed a 1440 `contentMaxWidth` (C6 fails above 1442), and `vw` also ignores the scrollbar.

**Good.**

```css
/* Set on the component root's style from BRAND:
   --vs-content-max: 1440px; --vs-gutter: clamp(24px, 4vw, 64px) */
.container { width: min(100% - 2 * var(--vs-gutter), var(--vs-content-max)); margin-inline: auto; }
```

| | 1440x900 | 1720x1280 | 1720x1440 | 3440x1280 | 1536x730 |
|---|---|---|---|---|---|
| gutter | 57.6 | 64 | 64 | 64 | 61.4 |
| content column | 1325 | 1440 | 1440 | 1440 | 1413 |

In Framer code components, expose `contentMaxWidth` as a Number property control with default `BRAND.contentMaxWidth`, and set the variables on the root:

```tsx
export default function Section(props: SectionProps) {
    const { contentMaxWidth = BRAND.contentMaxWidth, style } = props
    const rootStyle = {
        width: "100%",
        ...style,
        "--vs-content-max": `${contentMaxWidth}px`,
        "--vs-gutter": `clamp(${BRAND.gutterMin}px, 4vw, ${BRAND.gutterMax}px)`,
    } as React.CSSProperties
    return <section style={rootStyle}>{/* .container inside */}</section>
}

addPropertyControls(Section, {
    contentMaxWidth: {
        title: "Content width",
        type: ControlType.Number,
        defaultValue: BRAND.contentMaxWidth,
        min: 600,
        max: 2400,
        step: 8,
        unit: "px",
    },
})
```

**Why.** `contentMaxWidth` is the brand's text column excluding gutters, so the component lines up with native layers on every window. Backgrounds and media may bleed full width; text and UI stay in the container. Mark intentional full-width text (a marquee, a giant outline word) `data-vs="bleed"` so C6 skips it.

---

## 6.8 Window-shape media queries

**Problem.** Framer breakpoints are width-only: 1720x1280 and 3440x1280 both get the Desktop layout. Only the component can react to the window's shape.

| Query | Required viewports it matches |
|---|---|
| `(max-aspect-ratio: 3/2)` | uw-half 1.34, uw-half-stress 1.19 |
| `(min-aspect-ratio: 2/1)` | uw-full 2.69, uw-29 2.72, laptop-125 2.10, fhd 2.02 |
| `(max-height: 820px)` | laptop-125 (730 tall) |
| none of them | design 1.60, mbp-14 1.76, qhd 1.97 |

**Bad.** Hiding content to make it fit, or reading the window width in JS:

```css
@media (max-height: 820px) { .hero-sub { display: none; } }
```

Laptop users at 125% scaling lose the subheading; a JS `innerWidth` check also duplicates Framer's breakpoints and ignores height (L7).

**Good.**

```css
/* Tall / half-screen: key visual shrinks by width, content centres vertically, less top padding */
@media (max-aspect-ratio: 3/2) {
  .hero { align-content: center; padding-block: clamp(32px, 6svh, 96px); }
  .hero-visual { width: min(100%, 45cqw, 60svh); }
}
/* Ultrawide: side-by-side, reduce vertical padding */
@media (min-aspect-ratio: 2/1) { .hero { grid-template-columns: 1.1fr 1fr; align-items: center; } }
/* Short screens: tighten spacing, never hide content */
@media (max-height: 820px) { .hero { padding-block: 32px; gap: 16px; } }
```

**Why.** These three queries cover both extremes of the required matrix (aspect 1.19 to 2.72, height down to 730). Order matters: laptop-125 matches both the ultrawide and the short query, so keep the short query last and its spacing wins. The `45cqw` in `.hero-visual` needs the element to sit inside the container wrapper. Use media queries for the window's shape and `@container` queries on the wrapper for the component's own width (for example `@container (max-width: 809px)` to stack on Framer's Tablet and Phone breakpoints); put the container query last so it wins on tall phones, which also match `max-aspect-ratio: 3/2`.

---

## 6.9 Scale-to-fit with useBox

**Problem.** Fixed art-directed artboards (illustration-like compositions with absolutely positioned parts) cannot reflow; they have to scale as one piece. JS that scales from the window follows one axis, and JS that guesses a size before measuring renders blank or wrong on the first paint and in Framer's static render.

**Bad.**

```ts
// One axis: 2.39 at 3440x1280, so the 900px artboard is 2150px tall in a 1280px window.
// It also throws during the server render, where there is no window.
const scale = window.innerWidth / 1440
```

```ts
// Guessed initial state: scale 0 until measured, so the static render is empty.
const [box, setBox] = React.useState({ w: 0, h: 0 })
```

**Good.**

```tsx
const useIsoLayoutEffect = typeof window === "undefined" ? React.useEffect : React.useLayoutEffect

function useBox<T extends HTMLElement>() {
    const ref = React.useRef<T>(null)
    const [box, setBox] = React.useState<{ w: number; h: number } | null>(null)
    useIsoLayoutEffect(() => {
        const el = ref.current
        if (!el || typeof ResizeObserver === "undefined") return
        const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }))
        ro.observe(el)
        return () => ro.disconnect()
    }, [])
    return [ref, box] as const
}
// Render at scale 1 until measured, so the static render and first paint are never blank:
// const scale = box && box.w > 0 && box.h > 0 ? Math.min(box.w / BRAND.designW, box.h / BRAND.designH) : 1
```

A complete artboard, using `BRAND` for the design size:

```tsx
function Artboard(props: { children?: React.ReactNode }) {
    const [ref, box] = useBox<HTMLDivElement>()
    const scale =
        box && box.w > 0 && box.h > 0
            ? Math.min(box.w / BRAND.designW, box.h / BRAND.designH)
            : 1
    return (
        <div
            ref={ref}
            data-vs="fit"
            style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}
        >
            <div
                style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    width: BRAND.designW,
                    height: BRAND.designH,
                    transform: `translate(-50%, -50%) scale(${scale})`,
                }}
            >
                {props.children}
            </div>
        </div>
    )
}
```

The artboard's parent needs a definite height: a `100svh` section, or a Framer instance set to Fill or Viewport height. Measure the component's own box, never the window; in Framer, `ResizeObserver` also follows the canvas frame, which the window does not.

**Why.** `min(boxW / 1440, boxH / 900)` is the contain rule in JS: the artboard fits on both axes in any box. Starting at `null` and rendering at scale 1 means the server render and first paint show the design instead of nothing. The layout effect is swapped for `useEffect` on the server, where `useLayoutEffect` warns. This is the one place where a fixed height with `overflow: hidden` is right (the exception in rule 8), because the content is scaled to fit the box.

Prefer the CSS contain unit when you can: sizing every part of the artboard as `calc(N * var(--vs-u))` is scale-to-fit without JS, correct in the static render, and keeps text crisp. Use `useBox` when the composition is opaque (an inline SVG, a canvas, a layer tree you cannot restyle) or when JS needs the numbers (a camera, a scroll distance).

**Worked example: retrofitting a large existing component (the Collateral flywheel).** The component was a 3,800-line pinned scene: a 464px SVG wheel plus a 540px text column, all in fixed px, inside a `100vh` sticky stage. It also had a width-only "wide tier" (≥2400px) that forced a 760px wheel into a `64vh` stage. Rewriting every size as `calc(N * var(--vs-u))` was not realistic, so:

1. Measure the component width and the sticky stage height with one `ResizeObserver` (state starts `null`, so the scale starts at 1).
2. Compute `s = clamp(0.8, min(width / 1320, stageHeight / 900), 1.5)`, snapping to 1 within 2%.
3. Wrap the wheel and text in one group laid out at design size (`width: ${100 / s}%` of the stage), and give it `transform: scale(s)` with `transform-origin: 50% 50%`. Widen the stage's max-width by `s` so the scaled group fits exactly.
4. Skip the width-only wide tier while scaling is on. Leave `data-fw-tier` off so its `!important` CSS cannot match.
5. Put it behind a "Scale With Window" property control (default on), with Design Width/Height and Min/Max Scale controls, so designers can tune or revert it per instance.

Result on the live site:

| Window | Before | After |
|---|---|---|
| 1440x900 | — | identical |
| 1720x1280 | stage 32% filled | 1.3x larger, 37% filled (a side-by-side group on a tall window is width-bound; filling more needs a stacked layout for tall windows) |
| 2560x940 | wheel overflowed its stage into the heading | fits |
| 1536x730 | tight | fits with room |

Anchor the width term to the composition's own width plus margins (1320 for a 1200px group). With 1440, the half-screen gain was only 1.19x, because the group is narrower than the window it was designed in.

---

## Symptom lookup

| Symptom | Likely cause | Pattern |
|---|---|---|
| Sides of a visual cut at 1720x1280 | height-locked scene or `object-fit: cover` | 6.3, `canvas-and-embeds.md` |
| Horizontal scroll at uw-half | width from `vh`/`svh` | 6.4, 6.5 |
| Horizontal scroll everywhere on Windows | `width: 100vw` | use `100%` (rule 13) |
| Huge headline on a half-screen window | `font-size` in `vh` | 6.1, 6.2 |
| Huge headline on an ultrawide | `font-size` in `vw` | 6.1, 6.2 |
| CTA cut or below the fold at 1536x730 | fixed height, clipping, or `vw` padding | 6.6, 6.8 |
| 3000px text lines at 3440 | no content cap | 6.7 |
| Blank first paint or static render | measured state starts at 0 | 6.9 |
| Section looks empty at 1720x1440 | everything width-bound, lots of spare height | 6.8 (centre content, rebalance columns) |
| Pinned composition small at 1720x1280, overflowing at 2560x940 | fixed-px group in a vh stage, width-only tiers | 6.9 worked example (contain-scale the group) |
