# Scroll animation

Rules for GSAP ScrollTrigger, sticky layouts and Framer Motion scroll effects. The common thread: every distance and size is measured from the component on both axes and recomputed when the window changes, and whatever is pinned is itself a `fit` element.

Tag the outer section `data-vs="scroll-scene"` and the pinned stage `data-vs="fit"`. The audit checks scroll scenes at 0%, 25%, 50%, 75% and 100% of their range, scrolling there gradually so GSAP and Framer Motion are in their real state.

## Contents

1. [ScrollTrigger distances are functions](#1-scrolltrigger-distances-are-functions)
2. [Pinned content is a fit element](#2-pinned-content-is-a-fit-element)
3. [Horizontal galleries](#3-horizontal-galleries)
4. [Sticky stacks](#4-sticky-stacks)
5. [Scroll lengths in vh](#5-scroll-lengths-in-vh)
6. [Framer Motion: measure the box](#6-framer-motion-measure-the-box)
7. [Refresh after fonts and images](#7-refresh-after-fonts-and-images)

---

## 1. ScrollTrigger distances are functions

ScrollTrigger distances must be functions, recalculated on refresh, and measured from the component, not the window:

```ts
ScrollTrigger.create({
  trigger: section,
  pin: true,
  start: "top top",
  end: () => "+=" + (track.scrollWidth - section.clientWidth),
  invalidateOnRefresh: true,
})
```

**Why.** The track's length depends on the window. Cards sized from `svh` without a px cap are 473px wide at 1440x900 and 756px at 1720x1440, so an 8-card track is 3948px or 6216px long. A static `end: "+=3000"` ends the pin too early on one window and too late on the other. A function evaluated once goes stale when the manager snaps the window from maximized to half: `invalidateOnRefresh: true` makes ScrollTrigger call it again on every refresh (lint L13).

A complete horizontal gallery in a Framer code component. In Framer, import GSAP from a URL (`https://esm.sh/gsap@3.13.0` and `https://esm.sh/gsap@3.13.0/ScrollTrigger`); the bare imports below are what the audit harness resolves.

```tsx
import * as React from "react"
import { RenderTarget } from "framer"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger)

const useIsoLayoutEffect = typeof window === "undefined" ? React.useEffect : React.useLayoutEffect

/** A pinned row of cards that scrolls sideways as the page scrolls down. */
interface GalleryProps {
    children?: React.ReactNode
    style?: React.CSSProperties
}

/**
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight auto
 */
export default function Gallery(props: GalleryProps) {
    const sectionRef = React.useRef<HTMLElement>(null)
    const trackRef = React.useRef<HTMLDivElement>(null)
    const isCanvas = RenderTarget.current() === RenderTarget.canvas

    useIsoLayoutEffect(() => {
        const section = sectionRef.current
        const track = trackRef.current
        if (isCanvas || !section || !track) return
        const ctx = gsap.context(() => {
            gsap.to(track, {
                x: () => -(track.scrollWidth - section.clientWidth),
                ease: "none",
                scrollTrigger: {
                    trigger: section,
                    pin: true,
                    start: "top top",
                    end: () => "+=" + (track.scrollWidth - section.clientWidth),
                    scrub: true,
                    invalidateOnRefresh: true,
                },
            })
        }, section)
        return () => ctx.revert()
    }, [isCanvas])

    return (
        // The wrapper holds GSAP's pin spacer, so its height is the whole scroll range.
        <div
            data-vs="scroll-scene"
            style={{ width: "100%", ...props.style, position: "relative", overflowX: "clip" }}
        >
            <section ref={sectionRef} className="gallery" data-vs="fit">
                <div ref={trackRef} className="gallery-track">
                    {props.children}
                </div>
            </section>
        </div>
    )
}
```

- The tween's `x` is a function for the same reason as `end`.
- `data-vs="scroll-scene"` goes on the wrapper, which contains the pin spacer GSAP inserts, so the audit sees the full scroll range. The pinned section is the `fit` stage.
- `gsap.context` + `revert()` removes the pin spacer and inline styles on unmount, which Framer does often while editing. On the canvas no trigger is created and the first cards show in place.
- `pin: true` re-parents the section into a spacer. In Framer, `position: sticky` (section 6) avoids that; use GSAP pinning when you need its pin spacing or snapping.

## 2. Pinned content is a fit element

The pinned stage must be bounded on both axes, like a hero: it is checked against the window height at every scroll step (C2), and its key visuals must stay inside the window (C7).

```css
.scene { position: relative; overflow-x: clip; }
.scene-pin {
  position: sticky;
  top: 0;
  height: 100svh;
  display: grid;
  place-items: center;
}
.scene-visual { width: min(100%, calc(70svh * 16 / 10)); aspect-ratio: 16 / 10; }
```

- Give the outer `.scene` the scroll length (inline, from the measured distance) and the pin a height of `100svh`.
- Clip horizontal overflow on the outer section with `overflow-x: clip`, not on the pin with `overflow: hidden`. `clip` does not create a scroll container, so `position: sticky` keeps working, and the pin avoids the `height: 100svh` + `overflow: hidden` pattern (rule 8, lint L6). Any ancestor with `overflow: hidden` breaks the sticky pin.
- Size everything inside with the contain unit, an aspect-locked stage, or pattern 6.4, so the stage content fits 730px (laptop-125) and never takes its width from height alone.

## 3. Horizontal galleries

Card height comes from `svh` with a px maximum **and** a width bound (pattern 6.5); card width comes from the aspect ratio.

```css
/* The window-wide pinned section is the container, never the track. */
.gallery { container-type: inline-size; min-height: 100svh; display: flex; align-items: center; }
.gallery-track {
  display: flex;
  gap: 24px;
  width: max-content;
  padding-inline: clamp(24px, 4vw, 64px);
}
.gallery-card { aspect-ratio: 3 / 4; height: min(70svh, 640px, calc(85cqw * 4 / 3)); flex: none; }
```

| 8 cards, 24px gaps | 1440x900 | 1720x1280 | 1720x1440 | 3440x1280 | 1536x730 |
|---|---|---|---|---|---|
| card | 473x630 | 480x640 | 480x640 | 480x640 | 383x511 |
| track (cards + gaps) | 3948 | 4008 | 4008 | 4008 | 3234 |

On tall windows, svh-sized cards get wider, so the track gets longer. The bound keeps a single card from exceeding the window width. Put `container-type` on the section, not the track: `85cqw` of a 4000px track bounds nothing. The track's cards are partly outside the section on purpose; the audit reports them as C3 info, not failures.

## 4. Sticky stacks

Each sticky card gets `max-height: calc(100svh - <top offset> - <margin>)`, so a card is never taller than the space it sticks in. With a staggered stack, the top offset includes the stagger:

```css
.stack-card {
  position: sticky;
  top: calc(96px + var(--i, 0) * 16px);
  max-height: min(calc(100svh - 96px - var(--i, 0) * 16px - 32px), 880px);
  display: flex;
  flex-direction: column;
}
.stack-card img { flex: 1 1 auto; min-height: 0; width: 100%; object-fit: contain; }
```

Set `--i` per card (`style={{ "--i": index } as React.CSSProperties}`). At 1536x730 the first card is at most 602px tall and the fifth (`--i: 4`, top 160px) 538px, so both end 32px above the bottom of the window. The 880px cap keeps cards card-sized on 1440px-tall windows. The media inside shrinks (`min-height: 0`, `contain`) instead of overflowing when the card hits its max height. Mark the stack section `data-vs="scroll-scene"`.

## 5. Scroll lengths in vh

Scroll lengths in `vh` grow with window height. A real arch reveal uses `calc(576px + 332vh)`:

| | 1440x900 | 1720x1280 | 1720x1440 | 1536x730 |
|---|---|---|---|---|
| scroll length | 3564 | 4826 | 5357 | 3000 |

That is fine as long as the pinned content stays bounded: the length is pacing, not layout. What must not grow with the height is anything the viewer sees, such as a card width or a headline.

## 6. Framer Motion: measure the box

`useScroll` / `useTransform` values that depend on size must be recalculated on resize: store the measured box in state, fed by a `ResizeObserver` on the component's own elements, never by `window.innerWidth`.

```tsx
import * as React from "react"
import { motion, useScroll, useTransform } from "framer-motion"

const useIsoLayoutEffect = typeof window === "undefined" ? React.useEffect : React.useLayoutEffect

/** A horizontal track driven by vertical scroll. */
interface ScrollTrackProps {
    children?: React.ReactNode
    style?: React.CSSProperties
}

/**
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight auto
 */
export default function ScrollTrack(props: ScrollTrackProps) {
    const sectionRef = React.useRef<HTMLDivElement>(null)
    const pinRef = React.useRef<HTMLDivElement>(null)
    const trackRef = React.useRef<HTMLDivElement>(null)
    // How far the track travels. 0 until measured, so the static render shows the first cards.
    const [distance, setDistance] = React.useState(0)

    useIsoLayoutEffect(() => {
        const pin = pinRef.current
        const track = trackRef.current
        if (!pin || !track || typeof ResizeObserver === "undefined") return
        const measure = () => setDistance(Math.max(0, track.scrollWidth - pin.clientWidth))
        measure()
        const observer = new ResizeObserver(measure)
        observer.observe(pin)
        observer.observe(track)
        return () => observer.disconnect()
    }, [])

    const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] })
    const x = useTransform(scrollYProgress, (p) => -p * distance)

    return (
        // Clip sideways here, not on the pin: overflow-x: clip keeps position: sticky working.
        <div style={{ width: "100%", ...props.style, position: "relative", overflowX: "clip" }}>
            <div ref={sectionRef} data-vs="scroll-scene" style={{ height: `calc(100svh + ${distance}px)` }}>
                <div
                    ref={pinRef}
                    data-vs="fit"
                    style={{
                        position: "sticky",
                        top: 0,
                        height: "100svh",
                        display: "flex",
                        alignItems: "center",
                        containerType: "inline-size",
                    }}
                >
                    <motion.div ref={trackRef} style={{ x, display: "flex", gap: 24, width: "max-content" }}>
                        {props.children}
                    </motion.div>
                </div>
            </div>
        </div>
    )
}
```

- The distance is `track.scrollWidth - pin.clientWidth`, from the component's own boxes, so it is right at every window size and follows window snaps, font loads and image loads (all of them resize the track, which the observer sees).
- The section is `100svh + distance` tall, so the scroll range is exactly the travel. With `offset: ["start start", "end end"]`, progress runs 0 to 1 over that range.
- The pin is the window-wide container, so cards inside can use the pattern 6.5 width bound.
- `useTransform` with a function re-reads `distance` on every render, so the new measurement takes effect immediately.

## 7. Refresh after fonts and images

Always call `ScrollTrigger.refresh()` after fonts load (`document.fonts.ready`) and after images inside pinned areas load. Both change the track length and the pin's position after the triggers were first measured.

```ts
function refreshWhenLoaded(section: HTMLElement) {
    const images = Array.from(section.querySelectorAll("img")).filter((img) => !img.complete)
    const loaded = images.map(
        (img) =>
            new Promise<void>((resolve) => {
                img.addEventListener("load", () => resolve(), { once: true })
                img.addEventListener("error", () => resolve(), { once: true })
            })
    )
    Promise.all([document.fonts.ready, ...loaded]).then(() => ScrollTrigger.refresh())
}
```

Call it inside the layout effect, after the triggers are created. Framer Motion needs no refresh call: the `ResizeObserver` in section 6 picks up the same changes. ScrollTrigger also refreshes on window resize by itself; the function values and `invalidateOnRefresh` are what make that refresh produce the right numbers.
