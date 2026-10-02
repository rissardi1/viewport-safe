# Framer specifics

How Framer code components size, render and break, and what that means for viewport-safe code. `assets/component-template.tsx` applies all of it; start from there.

Scope: code components and embedded scenes. Native Framer layers built in the editor held up at 1720x1440 and 3440x1280 on both live sites (they cap their own width), so they are out of scope.

## Contents

1. [Spread `style` on the root](#1-spread-style-on-the-root)
2. [Layout annotations](#2-layout-annotations)
3. [Breakpoints are width-only](#3-breakpoints-are-width-only)
4. [`fit` components: height `any`, measure the box](#4-fit-components-height-any-measure-the-box)
5. [Container queries: an inner wrapper, never the root](#5-container-queries-an-inner-wrapper-never-the-root)
6. [Brand values: the `BRAND` constant](#6-brand-values-the-brand-constant)
7. [Canvas vs preview](#7-canvas-vs-preview)
8. [RenderTarget](#8-rendertarget)
9. [Static rendering](#9-static-rendering)
10. [The Desktop breakpoint stretches](#10-the-desktop-breakpoint-stretches)
11. [No duplicated breakpoints](#11-no-duplicated-breakpoints)
12. [Third-party scene components are height-locked](#12-third-party-scene-components-are-height-locked)
13. [File and import rules](#13-file-and-import-rules)
14. [Sizing through the agent API (DSL) and breakpoint inheritance](#14-sizing-through-the-agent-api-dsl-and-breakpoint-inheritance)

---

## 1. Spread `style` on the root

Framer sizes an instance by passing its width and height through the `style` prop (`"100%"` for Fixed and Fill, nothing for Fit). If the root does not spread it, Fill, Fixed and Viewport sizing never reach the DOM and the canvas stops matching the site (lint L14).

Put defaults before the spread so Framer's values win, and invariants after it:

```tsx
export default function Hero(props: HeroProps) {
    const { style } = props
    return (
        <section
            data-vs="fit"
            style={{
                width: "100%",
                ...style,
                position: "relative",
            }}
        />
    )
}
```

Keep the root `position: relative`, never `fixed`. Do not force `height` after the spread: it overrides the designer's choice.

## 2. Layout annotations

Set them in the `/** */` block directly above the exported component. Values: `any`, `auto`, `fixed`, `any-prefer-fixed`.

```ts
/**
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 1200
 * @framerIntrinsicHeight 800
 */
```

Pick them from the `@vs-type`:

| `@vs-type` | Width | Height | Why |
|---|---|---|---|
| `grow` | `any-prefer-fixed`, or `fixed` if it uses container units | `auto` | height follows content |
| `fit` | `fixed` | `any` | designer can pick Fit, Fixed, Fill or Viewport height |
| `scroll-scene` | `fixed` | `auto` | the component sets its own scroll length |

Set the intrinsic size to the design frame (`1440` x `900`) for `fit` components, so a fresh instance on the canvas matches the frame the audit compares against.

## 3. Breakpoints are width-only

Framer picks a breakpoint from the width alone, so it never knows the window's shape:

| Window | Breakpoint shown | Aspect |
|---|---|---|
| 1720x1280 | Desktop | 1.34 |
| 1280x1300 (half QHD) | Desktop | 0.98 |
| 1147x1280 (ultrawide thirds) | Tablet (with a default 810–1199 Tablet range) | 0.90 |

The Desktop layout was designed at 1.6:1 and is shown at 1.34:1 on the manager's half-screen window. The code component is the only thing that can react to the shape: use aspect-ratio media queries (`sizing-patterns.md`, 6.8) or the measured box (6.9).

## 4. `fit` components: height `any`, measure the box

`fit` components (heroes, pinned stages, full-screen sliders) should support `@framerSupportedLayoutHeight any`, so the designer can set Fill or a viewport height in Framer. When JS needs the height, measure the root box with `useBox` (6.9) instead of trusting `100vh` or reading the window.

The template's root has `min-height: 100svh`. Set the instance to Fit or Viewport height. A Fixed height shorter than the window lets the min-height push the section past its Framer frame, over the next section.

## 5. Container queries: an inner wrapper, never the root

Put `container-type: inline-size` on an **inner wrapper** with `width: 100%`, never on the root:

- The root cannot use its own `cqw`/`cqi`: container units resolve against an ancestor container, which for the root is whatever Framer wraps it in, or the viewport.
- If the instance is set to Fit width, inline-size containment gives the wrapper no intrinsic width and it collapses to 0: the whole component disappears.
- For components that use container units, set `@framerSupportedLayoutWidth fixed` (Fixed and Fill). Confirm in your Framer version that Fill is still offered.

```tsx
const U = `min(100cqw / ${BRAND.designW}, 100svh / ${BRAND.designH})`

/**
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 1440
 * @framerIntrinsicHeight 900
 */
export default function Hero(props: HeroProps) {
    return (
        <section data-vs="fit" style={{ width: "100%", ...props.style, position: "relative" }}>
            <div style={{ containerType: "inline-size", width: "100%" }}>
                <div style={{ "--vs-u": U } as React.CSSProperties}>
                    {/* everything in here can use var(--vs-u) */}
                </div>
            </div>
        </section>
    )
}
```

Lint L15 warns on `container-type` on the root, or in a file whose width annotation allows `auto`.

## 6. Brand values: the `BRAND` constant

Framer code components cannot read files from the repo at runtime, and there is no global stylesheet for them. Copy the values from the project's `viewport-safe.config.json` into the component when you write it, in exactly this format:

```ts
// Brand values copied from clients/example/viewport-safe.config.json. Update both together.
const BRAND = { contentMaxWidth: 1440, gutterMin: 24, gutterMax: 64, displayTypeMax: 120, designW: 1440, designH: 900 }
```

| Config field | `BRAND` key |
|---|---|
| `contentMaxWidth` | `contentMaxWidth` |
| `gutter.min`, `gutter.max` | `gutterMin`, `gutterMax` |
| `displayTypeMax` | `displayTypeMax` |
| `designFrame.width`, `designFrame.height` | `designW`, `designH` |
| `gutter.fluid` | not in `BRAND`: write it into the `--vs-gutter` clamp |

Lint L16 warns when `BRAND` is missing or drifts from the config. `BRAND` feeds property-control defaults (so a designer can change `contentMaxWidth` per instance) and CSS variables on the root style:

```tsx
const rootStyle = {
    width: "100%",
    ...style,
    "--vs-content-max": `${contentMaxWidth}px`,
    "--vs-gutter": `clamp(${BRAND.gutterMin}px, 4vw, ${BRAND.gutterMax}px)`,
} as React.CSSProperties
```

`contentMaxWidth` here is the prop, defaulting to `BRAND.contentMaxWidth` (see `sizing-patterns.md`, 6.7, for the control).

## 7. Canvas vs preview

Viewport units inside a code component on the Framer canvas refer to the **editor window**, not the breakpoint frame. On a 1440 frame in a 1000px-tall editor, `100svh` is 1000, whatever the frame's height. The canvas can look right while the site is wrong, and the other way round.

- Always verify on the Preview or staging URL: `node scripts/viewport-audit.mjs --url <url> --matrix quick`.
- Where possible, size from the component's own box. `cqw` is the wrapper's real width on the canvas too, which is one more reason to prefer it over `vw`.

## 8. RenderTarget

Use `RenderTarget.current() === RenderTarget.canvas` to disable scroll listeners and heavy animation on the canvas, but keep the layout identical: toggle a class or skip an effect, never return a different tree.

```tsx
const isCanvas = RenderTarget.current() === RenderTarget.canvas

React.useEffect(() => {
    if (isCanvas) return
    const onScroll = () => {
        /* scroll-driven work */
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
}, [isCanvas])

const className = isCanvas ? "hero" : "hero hero-animate"
```

Scroll-driven components have no scroll on the canvas. Give them a "Canvas preview" Enum control that picks the stage to show (our `Arch_Reveal_Section` does this), so designers can check every state in the editor.

## 9. Static rendering

Framer pre-renders pages to HTML on the server, with no `window` and no layout. Anything that depends on measurement must render sensibly before it measures.

- Start measured state at `null` and render the design at scale 1, or size with the CSS contain unit, which needs no measurement at all (6.1, 6.9).
- Guard layout effects: `const useIsoLayoutEffect = typeof window === "undefined" ? React.useEffect : React.useLayoutEffect`.
- Guard `window`, `document` and `ResizeObserver` access inside effects, never at render time.
- Inject a component's `<style>` block with `dangerouslySetInnerHTML`. React's server renderer can HTML-escape a `<style>` element's text children (React 18 does), which breaks `>` selectors and quoted font names in the pre-rendered HTML. Use it only for constant CSS from your own file.

## 10. The Desktop breakpoint stretches

The Desktop breakpoint renders at any width up to 3440 and beyond. The component must cap its own content (rule 7, `sizing-patterns.md`, 6.7); do not assume Framer will. Native layers inherit a max width from the page; code components do not.

## 11. No duplicated breakpoints

Do not hardcode a `window.innerWidth` check that duplicates Framer breakpoints.

```ts
// Bad: runs once, reads one axis, throws during the server render, and disagrees with
// Framer at the edges (1147x1280 shows Framer's Tablet layout at aspect 0.90).
const isTablet = window.innerWidth < 1200
```

Let Framer's breakpoint variants handle width. Inside the component, handle shape and own size with CSS media and container queries, or the measured box (`useBox`).

## 12. Third-party scene components are height-locked

Unicorn Studio and Spline components placed full-bleed with Fill or `100vh` must be treated as height-locked until measured. The collateral.com hero ring is exactly this: a full-viewport Unicorn Studio canvas that scales by `height / 900` and runs about 82px past the right edge at 1720x1280 (worked example in `canvas-and-embeds.md`).

If the scene is the section background, an aspect-locked *section* (the section itself is only as tall as the scene, `canvas-and-embeds.md` 4.2) needs no wrapper component at all: set the aspect ratio and a Max Height on the section frame in Framer. It also avoids the hard edge a letterboxed stage leaves across a scene with a glow or pattern.

To put an existing Framer scene component inside an aspect-locked stage, wrap it in a small code component that takes it as a component instance:

```tsx
import * as React from "react"
import { addPropertyControls, ControlType } from "framer"

// Brand values copied from clients/example/viewport-safe.config.json. Update both together.
const BRAND = { contentMaxWidth: 1440, gutterMin: 24, gutterMax: 64, displayTypeMax: 120, designW: 1440, designH: 900 }

/** A scene component (Unicorn Studio, Spline) held at the design aspect ratio. */
interface SceneStageProps {
    scene?: React.ReactElement<{ style?: React.CSSProperties }>
    background: string
    style?: React.CSSProperties
}

/**
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 1440
 * @framerIntrinsicHeight 900
 */
export default function SceneStage(props: SceneStageProps) {
    const { scene, background = "#000000", style } = props
    return (
        <section
            data-vs="fit"
            style={{
                width: "100%",
                ...style,
                position: "relative",
                display: "grid",
                placeItems: "center",
                minHeight: "100svh",
                background,
            }}
        >
            <div
                data-vs="key-visual"
                style={{
                    position: "relative",
                    width: `min(100%, calc(100svh * ${BRAND.designW} / ${BRAND.designH}))`,
                    aspectRatio: `${BRAND.designW} / ${BRAND.designH}`,
                }}
            >
                {scene &&
                    React.cloneElement(scene, {
                        style: {
                            ...scene.props.style,
                            position: "absolute",
                            inset: 0,
                            width: "100%",
                            height: "100%",
                        },
                    })}
            </div>
        </section>
    )
}

addPropertyControls(SceneStage, {
    scene: { title: "Scene", type: ControlType.ComponentInstance },
    background: {
        title: "Background",
        type: ControlType.Color,
        defaultValue: "#000000",
        description: "Use the scene's own background colour so the letterbox bands disappear.",
    },
})
```

Check in the audit screenshots that the scene fills the stage. If the embed sizes itself from the window rather than its parent, no wrapper can constrain it: re-author the scene inside the safe zone instead (fix 4.5 in `canvas-and-embeds.md`). Here the whole stage is the key visual; to check a specific object in the scene, add a proxy (`canvas-and-embeds.md`, section 5).

## 13. File and import rules

- One default export per code file, written as a named `function`. Keep hooks such as `useBox` and helpers module-scoped: Framer's code-component rules call for a single default export.
- Imports: `react`, `react-dom`, `framer`, `framer-motion`. Other packages (GSAP, three) come in as URL imports, for example `https://esm.sh/gsap@3.13.0`.
- The audit harness resolves bare `gsap`/`three` imports from its own `node_modules` and loads `https://esm.sh/...` natively. `https://framer.com/m/...` modules only work in URL mode: `node scripts/viewport-audit.mjs --url <framer preview URL> --matrix quick`.
- `ControlType.ResponsiveImage` has no `defaultValue`; set the default while destructuring props. Give every other control a `defaultValue` so the canvas never renders blank.
- `data-vs` tokens (`fit`, `scroll-scene`, `above-fold`, `key-visual`, `bg`, `bleed`, `clip-ok`, `overlay-ok`) are harmless in production. Add them while building; the audit selects them with `[data-vs~="token"]`.

## 14. Sizing through the agent API (DSL) and breakpoint inheritance

Findings from fixing the live Collateral home page with `framer.agent.applyChanges`. They apply to any layer on a Framer page, not only code components.

**Replicas inherit everything from the Desktop breakpoint.** Tablet, Phone and Desktop Large are replicas of the Desktop (primary) breakpoint. Anything set on the Desktop node reaches them unless they override it, and that includes `visible`, `aspectRatio`, `maxHeight` and masks. Two consequences:

- Hiding a layer on Desktop (`visible="false"`) hides it on Tablet and Phone too. When a replacement only exists on Desktop, set `visible="true"` on the replica ids (`<breakpointId><originalId>`, for example `T97sWI4qFHxhIkwIGl`). Forgetting this removed a section title from the phone layout.
- Before changing a Desktop size, freeze the replicas that must not change (set the same width and height explicitly on them), then change Desktop. Check every breakpoint afterwards with `framer.agent.serialize({ id: bp + originalId, depth: 0 }, { pagePath })`.

**Aspect ratio.**

- `aspectRatio` is rejected with "Width and height must not be auto or fit-image". Set both to fixed values (`width="100%" height="100%"`); Framer then derives the height from the width, so `width="100%" height="100%" aspectRatio="1.6" maxHeight="100%"` is a box that is as tall as its width allows but never taller than its parent.
- The ratio cannot be cleared with DSL (`""`, `null`, `none` and `0` are all rejected). Clear it with the plugin API: `await (await framer.getNode(id)).setAttributes({ aspectRatio: null })`. The same call clears `maxHeight`.

**Units.** Heights take `px`, `vh`, `%`, `fr` and `auto`; widths take `px`, `%`, `fr` and `auto`. `height="62.5vw"` is silently rewritten to `62.5vh`, so a width-derived height can only come from `aspectRatio`.

**Masks.** `masks.0.mask="linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 10%, rgba(0,0,0,1) 90%, rgba(0,0,0,0) 100%)"` fades a frame or instance. Clear it on a replica with `masks.0.mask=null`.

**Component controls.**

- The DSL key is the camel-cased control *title*, not the property name: a control titled "Title: Gap" is `$control__titleGap`, not `$control__sectionGap`. Read the real keys back with `serialize` before writing.
- Nested object controls (`ControlType.Object`, for example a `wheel` group with `sizePhone`) cannot be written with the DSL ("Cannot apply `$control__wheel`"). When a designer needs a per-breakpoint value, add a top-level number control (`phoneWheelSize`, `phoneItemGap`) where `0` means "use the old value".
- Values are per instance, so the Desktop, Desktop Large, Tablet and Phone instances can differ even though they share one component. Use that for per-breakpoint tuning instead of branching on `window.innerWidth`.

**React types.** `textWrap: "balance"` is missing from some `CSSProperties` versions. Add it as `...({ textWrap: "balance" } as any)`, or the Framer typecheck reports new errors.

**Verify with a preview, not with the canvas.** The agent API does not render. After every size change, ask for a republish and measure the published page (`viewport-audit.mjs --url`, plus a screenshot per required viewport). A branch preview URL is built from the branch name and id, so ask for it instead of guessing.
