import * as React from "react"
import { addPropertyControls, ControlType } from "framer"

/**
 * Stand-in for a height-locked scene: a 2D canvas ring scaled by canvas height only,
 * centred at 81% of the design width (right edge at 96%).
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
            canvas.width = canvas.clientWidth
            canvas.height = canvas.clientHeight
            const scale = canvas.height / 900 // expect L10
            ctx.clearRect(0, 0, canvas.width, canvas.height)
            ctx.strokeStyle = color
            ctx.lineWidth = 24 * scale
            ctx.beginPath()
            ctx.arc(canvas.width / 2 + 446 * scale, canvas.height / 2, 216 * scale, 0, Math.PI * 2)
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
