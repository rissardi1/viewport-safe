import * as React from "react"
import { addPropertyControls, ControlType } from "framer"

/**
 * The same ring, scaled by whichever axis is tighter (contain), so it is never cropped.
 *
 * @vs-type fit
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight fixed
 */
export default function RingCanvas(props) {
    const { color, style } = props
    const ref = React.useRef<HTMLCanvasElement>(null)
    React.useEffect(() => {
        const canvas = ref.current
        const ctx = canvas?.getContext("2d")
        if (!canvas || !ctx) return
        const draw = () => {
            const w = (canvas.width = canvas.clientWidth)
            const h = (canvas.height = canvas.clientHeight)
            const scale = Math.min(w / 1440, h / 900)
            ctx.clearRect(0, 0, w, h)
            ctx.strokeStyle = color
            ctx.lineWidth = 24 * scale
            ctx.beginPath()
            ctx.arc(w / 2 + 300 * scale, h / 2, 216 * scale, 0, Math.PI * 2)
            ctx.stroke()
        }
        draw()
        const ro = new ResizeObserver(draw)
        ro.observe(canvas)
        return () => ro.disconnect()
    }, [color])
    return (
        <section style={{ ...style, position: "relative", width: "100%", height: "100%" }}>
            <canvas data-vs="key-visual" ref={ref} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
        </section>
    )
}

addPropertyControls(RingCanvas, {
    color: { type: ControlType.Color, defaultValue: "#c9a45c" },
})
