import * as React from "react"
import { addPropertyControls, ControlType } from "framer"

/**
 * @vs-type grow
 * @vs-design 1440x900
 * @vs-key-visual ring: height-locked (this file is the stand-in embed itself)
 *
 * Offline stand-in for a third-party WebGL embed such as Unicorn Studio or Spline, used by the
 * viewport-safe fixtures and evals. It fills its box and scales its artwork by the box HEIGHT only,
 * like a Three.js camera with a fixed vertical field of view. The ring is drawn on a 1440x900
 * artboard with its centre at 81% of the width and its right edge at 96%, like the collateral.com
 * hero, so any box narrower than 16:10 crops its right side. Like a real embed, it exposes no DOM
 * for what it draws. Do not change this file: fix the component that places it.
 */

const DESIGN_W = 1440
const DESIGN_H = 900
const RING = { cx: 0.81 * DESIGN_W, cy: 0.5 * DESIGN_H, r: 216 }
const BARS = 24

interface Props {
    background: string
    ringColor: string
    style?: React.CSSProperties
}

export default function HeightLockedScene(props: Props) {
    const { background, ringColor, style } = props
    const ref = React.useRef<HTMLCanvasElement>(null)

    React.useEffect(() => {
        const canvas = ref.current
        if (!canvas) return
        const draw = () => {
            const w = canvas.clientWidth
            const h = canvas.clientHeight
            if (!w || !h) return
            const dpr = Math.min(2, window.devicePixelRatio || 1)
            canvas.width = Math.round(w * dpr)
            canvas.height = Math.round(h * dpr)
            const ctx = canvas.getContext("2d")
            if (!ctx) return
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
            ctx.fillStyle = background
            ctx.fillRect(0, 0, w, h)
            // Height-locked: one artboard px = h / 900 CSS px, artboard centred in the box.
            const s = h / DESIGN_H
            const cx = w / 2 + (RING.cx - DESIGN_W / 2) * s
            const cy = h / 2 + (RING.cy - DESIGN_H / 2) * s
            ctx.fillStyle = ringColor
            for (let i = 0; i < BARS; i++) {
                ctx.save()
                ctx.translate(cx, cy)
                ctx.rotate((i / BARS) * Math.PI * 2)
                ctx.fillRect(RING.r * s * 0.62, -RING.r * s * 0.07, RING.r * s * 0.38, RING.r * s * 0.14)
                ctx.restore()
            }
        }
        draw()
        const ro = new ResizeObserver(draw)
        ro.observe(canvas)
        return () => ro.disconnect()
    }, [background, ringColor])

    return (
        <canvas
            ref={ref}
            role="img"
            aria-label="Decorative ring scene"
            style={{ display: "block", width: "100%", height: "100%", ...style }}
        />
    )
}

addPropertyControls(HeightLockedScene, {
    background: { type: ControlType.Color, title: "Background", defaultValue: "#0d2a22" },
    ringColor: { type: ControlType.Color, title: "Ring", defaultValue: "#c9a24a" },
})
