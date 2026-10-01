# Canvas, WebGL and embeds

WebGL, Three.js, React Three Fiber, Unicorn Studio, Spline, Rive, Lottie, background video and images. These are where the tall-window failure lives: the DOM looks perfect (the canvas is exactly window-sized, nothing overflows, no text is clipped) while the picture inside is cut at the sides.

## Contents

1. [Scaling models](#1-scaling-models)
2. [Visible fraction and the safe zone](#2-visible-fraction-and-the-safe-zone)
3. [Worked example: the collateral.com hero](#3-worked-example-the-collateralcom-hero)
4. [Fixes, in order of preference](#4-fixes-in-order-of-preference)
5. [Key-visual proxy for canvases](#5-key-visual-proxy-for-canvases)
6. [Video and images](#6-video-and-images)

---

## 1. Scaling models

Every visual follows one of these models. Name the model for each key visual in the component header (`@vs-key-visual <name>: <model> -> <fix>`).

| Model | Typical source | Breaks on |
|---|---|---|
| **fixed** | px/rem sizes | Short screens only, if the section is a `fit` section |
| **width-locked** | `vw`, `cqi`, `innerWidth`, `width: 100%` + `aspect-ratio` | Wide windows (too tall) |
| **height-locked** | `vh`/`svh`, `innerHeight`, the Three.js default camera (vertical FOV), Unicorn Studio, most WebGL scenes | **Tall windows (sides cropped or overflowing)** |
| **cover** | `object-fit: cover`, `background-size: cover`, full-bleed canvases | Both: sides cropped on tall windows, top and bottom cropped on wide windows |
| **contain** | `min(width-based, height-based)`, the contain unit (section 6.1), aspect-locked stage (section 6.3) | Nothing (the target for key visuals) |

Section numbers refer to `sizing-patterns.md`.

## 2. Visible fraction and the safe zone

**Visible fraction** of a 1440x900 (16:10) design frame rendered in each window:

| Viewport | Aspect | Height-locked: visible width | Cover: visible width x height |
|---|---|---|---|
| design 1440x900 | 1.60 | 100% | 100% x 100% |
| **uw-half 1720x1280** | **1.34** | **84.0% (8.0% lost each side)** | 84.0% x 100% |
| uw-half-stress 1720x1440 | 1.19 | 74.6% (12.7% lost each side) | 74.6% x 100% |
| qhd-half 1280x1300 | 0.98 | 61.5% (19.2% lost each side) | 61.5% x 100% |
| uw-third 1147x1280 | 0.90 | 56.0% (22.0% lost each side) | 56.0% x 100% |
| laptop-125 1536x730 | 2.10 | 100% (extra space at sides) | 100% x 76.1% |
| uw-full 3440x1280 | 2.69 | 100% (extra space at sides) | 100% x 59.5% |
| uw-29 2560x940 | 2.72 | 100% (extra space at sides) | 100% x 58.8% |

Formulas: visible width = `min(1, windowAspect / designAspect)`; visible height (cover only) = `min(1, designAspect / windowAspect)`.

**Required safe zone** (covers every required viewport): key content must sit within the **central 74.6% of the design width**, i.e. between 12.7% and 87.3%. For cover-scaled media, it must also sit within the **central 58.8% of the design height**. The collateral.com ring ends at 96% of the width, so it is cropped at both 1720x1280 and 1720x1440.

In design px (1440x900): x from 183 to 1257, and for cover media y from 185 to 715.

## 3. Worked example: the collateral.com hero

**What it is.** A full-viewport Unicorn Studio WebGL canvas. The ring scales with viewport height only, `scale = viewport height / 900`, centred (measured at 1440x900, 1720x1440 and 3440x1280). At 1440x900 the ring's right edge sits at 96% of the width: centred at about 81% with a diameter of about 30% (428px measured).

**The math.** A height-locked scene renders the 1440px frame at `1440 * s` px wide, centred, with `s = H / 900`. A design x coordinate lands on screen at:

```
screenX = W / 2 + (designX - 720) * s
ring right edge: designX = 0.96 * 1440 = 1382.4, so screenX = W / 2 + 662.4 * s
```

| Window | s | Frame width | Ring right edge | Result |
|---|---|---|---|---|
| 1440x900 | 1.000 | 1440 | 1382 | fits, 58px to spare |
| **1720x1280** | 1.422 | 2048 | 1802 | **82px past the right edge**, 13% of the 614px ring |
| 1720x1440 | 1.600 | 2304 | 1920 | **200px past**, 29% of the 691px ring |
| 3440x1280 | 1.422 | 2048 | 2662 | fits: a wider window only reveals more space at the sides |
| 1536x730 | 0.811 | 1168 | 1305 | fits |

(Other notes round the 1720x1280 figure to about 85px; the formula gives 82px.)

**Why the old checks passed it.** `scrollWidth` equals the window width (C1 passes), the canvas is exactly window-sized, and no text or button is clipped (C3 passes). Nothing looked at graphics. Now C9 (canvas edge contact) flags the cut ring at uw-half and uw-half-stress, and C7 checks a key-visual proxy if one exists.

**With the fix (aspect-locked stage).** The stage is 1720x1075 at both 1720x1280 and 1720x1440, so the scene's scale is 1075 / 900 = 1.194 (the contain unit). The ring's right edge is at 0.96 x 1720 = 1651px, 69px inside the window, and the ring is 516px wide. At 3440x1280 the stage is 2048x1280 and nothing changes. The cost is letterbox bands of 102.5px (1720x1280) and 182.5px (1720x1440) at the top and bottom, invisible when the section is painted with the scene's background colour.

To keep the ring full-bleed instead, it would have to be re-authored inside the safe zone: with a 30% diameter, its centre at no more than 72.3% of the width.

## 4. Fixes, in order of preference

### 4.1 Aspect-locked stage

Works for any embed, including ones we cannot change (Unicorn Studio, Spline, Rive, Lottie). Put the scene in a box of the design aspect ratio, contained on both axes (`sizing-patterns.md`, 6.3):

```css
.hero { min-height: 100svh; display: grid; place-items: center; background: var(--scene-bg); }
.scene-stage {
  position: relative;
  width: min(100%, calc(100svh * 1440 / 900));
  aspect-ratio: 1440 / 900;
  margin: auto;
}
.scene-stage > canvas,
.scene-stage > iframe { position: absolute; inset: 0; width: 100%; height: 100%; }
```

For a Framer scene component placed on the canvas, wrap it with the `SceneStage` component in `framer-specifics.md`, section 12. Confirm in the audit screenshots that the embed fills the stage: an embed that sizes itself from the window ignores its parent, and then only fix 4 helps.

### 4.2 Split background and key visual

The full-bleed layer holds only texture (gradient, noise, particles) and is marked `data-vs="bg"`; the key visual lives in a contained box in the layout grid, marked `data-vs="key-visual"`. The page stays full-bleed on every window and only the part whose edges matter is contained. This needs two layers: two scenes, or a scene plus an image or video.

```css
.hero { position: relative; min-height: 100svh; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: center; }
.hero-bg { position: absolute; inset: 0; z-index: 0; }
.hero-ring { position: relative; z-index: 1; width: min(100%, calc(560 * var(--vs-u))); aspect-ratio: 1 / 1; justify-self: center; }
```

### 4.3 Aspect-aware camera (Three.js / React Three Fiber)

A `PerspectiveCamera` keeps its vertical field of view, so a narrower window sees less horizontally: that is exactly height-locked scaling. Keep the design's horizontal field of view when the window is narrower than the design:

```ts
function containCamera(camera: THREE.PerspectiveCamera, w: number, h: number, designFov = 35, designAspect = 1440 / 900) {
  const aspect = w / h
  camera.aspect = aspect
  camera.fov = aspect >= designAspect
    ? designFov
    : THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(designFov) / 2) * designAspect / aspect))
  camera.updateProjectionMatrix()
}
```

| Window | Aspect | Vertical FOV | Horizontal FOV |
|---|---|---|---|
| 1440x900 | 1.60 | 35.0° | 53.5° |
| 1720x1280 | 1.34 | 41.2° | 53.5° (held) |
| 1720x1440 | 1.19 | 45.8° | 53.5° (held) |
| 3440x1280 | 2.69 | 35.0° | 80.6° (more scene at the sides) |

On narrow windows the scene gets smaller vertically instead of losing its sides; on wide windows it reveals more at the sides at the design size. Call it on every resize with the canvas's own size (`renderer.domElement.clientWidth`/`clientHeight`), not the window's. Match `designFov` to the camera's authored FOV.

In React Three Fiber, call it from an effect that depends on the canvas size:

```tsx
import * as React from "react"
import * as THREE from "three"
import { useThree } from "@react-three/fiber"

// containCamera() is the function above. Keep it in the same file: the lint (L10) looks
// for the fov update next to the R3F import.

/** Holds the design's horizontal field of view on windows narrower than the design. */
interface ContainCameraProps {
    designFov?: number
    designAspect?: number
}

export function ContainCamera({ designFov = 35, designAspect = 1440 / 900 }: ContainCameraProps) {
    // Two selectors that return stable references. A selector that builds a new object
    // re-renders this component on every store change.
    const camera = useThree(({ camera }) => camera)
    const size = useThree(({ size }) => size)

    React.useEffect(() => {
        if (camera instanceof THREE.PerspectiveCamera) {
            containCamera(camera, size.width, size.height, designFov, designAspect)
        }
    }, [camera, size.width, size.height, designFov, designAspect])

    return null
}
```

Use it inside the canvas: `<Canvas camera={{ fov: 35 }}><ContainCamera designFov={35} />…</Canvas>`. R3F updates `camera.aspect` on resize by itself; this effect runs after that and adds the FOV change. Put the `<Canvas>` in a `data-vs="key-visual"` parent only if the whole canvas is the key visual; otherwise add a proxy (section 5).

### 4.4 Author the scene inside the safe zone

In the scene editor, keep key content between 12.7% and 87.3% of the artboard width (183 to 1257 of 1440). This is the only fix when the scene must stay full-bleed and cannot be wrapped or re-cameraed. Re-check it whenever the scene is edited.

## 5. Key-visual proxy for canvases

The audit cannot see what a canvas draws, so every canvas-based key visual you build renders an invisible proxy element over the key content. C7 then checks the proxy: fully inside the window horizontally at every step it is in view, not clipped, and inside the window vertically at load in a `fit` section.

```tsx
<div ref={proxyRef} data-vs="key-visual" aria-hidden="true" style={{ position: "absolute", pointerEvents: "none" }} />
```

- Place it in the canvas's positioned parent (`position: relative`), as a sibling of the canvas.
- Keep it transparent (no background, border or content), `pointer-events: none` and `aria-hidden="true"`.
- Do **not** hide it with `opacity: 0`, `visibility: hidden` or `display: none`. The checks skip elements they consider invisible, so a hidden proxy is silently ignored and C7 passes for the wrong reason. A transparent element paints nothing anyway.
- Mark the canvas itself `data-vs="bg"` only if it really is background; otherwise leave it unmarked so C9 still samples its edges.

### 5.1 Three.js: project the bounding box

Project the key object's `THREE.Box3` corners to pixel coordinates on every resize, and on every frame where the object or camera moves:

```ts
import * as THREE from "three"

const box = new THREE.Box3()
const corner = new THREE.Vector3()
let lastRect = ""

/** Positions `proxy` over the screen-space bounds of `object`, in px of a w x h canvas box. */
function placeProxy(proxy: HTMLElement, object: THREE.Object3D, camera: THREE.Camera, w: number, h: number) {
    object.updateWorldMatrix(true, true)
    camera.updateMatrixWorld()
    box.setFromObject(object)
    if (box.isEmpty()) return

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (let i = 0; i < 8; i++) {
        corner.set(
            i & 1 ? box.max.x : box.min.x,
            i & 2 ? box.max.y : box.min.y,
            i & 4 ? box.max.z : box.min.z
        )
        corner.project(camera) // normalized device coordinates: -1..1, y up
        const x = ((corner.x + 1) / 2) * w
        const y = ((1 - corner.y) / 2) * h
        minX = Math.min(minX, x)
        maxX = Math.max(maxX, x)
        minY = Math.min(minY, y)
        maxY = Math.max(maxY, y)
    }

    const rect = `${minX.toFixed(1)},${minY.toFixed(1)},${(maxX - minX).toFixed(1)},${(maxY - minY).toFixed(1)}`
    if (rect === lastRect) return
    lastRect = rect
    proxy.style.left = `${minX}px`
    proxy.style.top = `${minY}px`
    proxy.style.width = `${maxX - minX}px`
    proxy.style.height = `${maxY - minY}px`
}
```

- `w` and `h` are the canvas's CSS size (`renderer.domElement.clientWidth`/`clientHeight`), not the drawing buffer, which is multiplied by the device pixel ratio.
- Call it after `containCamera` in the resize handler, and in the render loop only if the object or camera moves; the string compare skips the DOM write when nothing changed.
- The projected box is a little larger than the silhouette, so the check is conservative: if the box fits, the object fits.
- All corners must be in front of the camera; the key object always is.

In React Three Fiber, run it from `useFrame`, which provides the camera and the canvas size:

```tsx
import * as React from "react"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"

/** Keeps a DOM proxy over a 3D object so the audit can check it. Render inside <Canvas>. */
interface KeyVisualProxyProps {
    target: React.RefObject<THREE.Object3D | null>
    proxy: React.RefObject<HTMLDivElement | null>
}

export function KeyVisualProxy({ target, proxy }: KeyVisualProxyProps) {
    useFrame(({ camera, size }) => {
        if (target.current && proxy.current) {
            placeProxy(proxy.current, target.current, camera, size.width, size.height)
        }
    })
    return null
}
```

The proxy `<div>` lives outside `<Canvas>`, in the same positioned parent; pass its ref in.

### 5.2 Third-party embed inside an aspect-locked stage

A Unicorn Studio or Spline scene exposes no DOM for its content. Inside an aspect-locked stage the scene scales uniformly, so a key object's position in design-frame coordinates maps to the same percentages of the stage at every window size. Position the proxy in % of the stage:

```tsx
/** The key object's box in the scene editor, in design px of the BRAND frame. */
const RING = { x: 950, y: 234, w: 432, h: 432 }

const pct = (value: number, of: number) => `${(value / of) * 100}%`

const ringProxyStyle = {
    position: "absolute",
    left: pct(RING.x, BRAND.designW),
    top: pct(RING.y, BRAND.designH),
    width: pct(RING.w, BRAND.designW),
    height: pct(RING.h, BRAND.designH),
    pointerEvents: "none",
} as const
```

```tsx
<div className="scene-stage">
    <UnicornScene />
    <div data-vs="key-visual" aria-hidden="true" style={ringProxyStyle} />
</div>
```

For the collateral.com ring (centre 81%, diameter 30% of the width, assumed centred vertically; measure it in the scene editor) that is left 66%, top 26%, width 30%, height 48%. At 1720x1280 the proxy is 516x516px and ends at 96% of the 1720px stage, 69px inside the window. If the scene animates the object across the frame, use the box it sweeps over the whole animation. This only works inside a stage of the design aspect ratio: in a full-bleed embed, the percentages drift with the window's shape.

## 6. Video and images

Use `object-fit: cover` only for `data-vs="bg"` media. For key media use contain, or give the box the media's own aspect ratio (`sizing-patterns.md`, 6.4), so nothing is cropped.

What cover hides, by source aspect:

| Window | 16:10 source | 16:9 source |
|---|---|---|
| 1720x1280 | 8.0% each side | 12.2% each side |
| 1720x1440 | 12.7% each side | 16.4% each side |
| 3440x1280 | 20.2% top and bottom | 16.9% top and bottom |
| 2560x940 | 20.6% top and bottom | 17.4% top and bottom |
| 1536x730 | 12.0% top and bottom | 7.8% top and bottom |

```css
/* Background: cover is fine, and the markup says so with data-vs="bg". */
.hero-video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
/* Key media: the box has the media's aspect ratio and is bounded on both axes. */
.product-shot { display: block; width: min(100%, calc(62svh * 4 / 3)); aspect-ratio: 4 / 3; object-fit: contain; }
```

```tsx
<>
    <video className="hero-video" data-vs="bg" src={src} poster={poster} autoPlay muted loop playsInline preload="metadata" />
    <img className="product-shot" data-vs="key-visual" src={shot} alt="Product" />
</>
```

- If cover is unavoidable for key media, set `object-position` to the focal point and keep text and logos out of the outer 13% on each side (12.7% for the required matrix) and, for wide windows, out of the outer 21% at the top and bottom.
- Treat text or logos baked into a video or image as a key visual (rule 5).
- Use `preload="metadata"` (or a poster) on videos, so the intrinsic size is known when C8 estimates the crop.
- `background-size: cover` crops the same way. Keep key visuals out of CSS backgrounds: they cannot carry their own `data-vs="key-visual"` element.
