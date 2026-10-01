import * as React from "react"
import { addPropertyControls, ControlType } from "framer"

/**
 * Scales an artboard from the window width only.
 *
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight auto
 */
export default function ScaledArtboard(props) {
    const { children, style } = props
    const [width, setWidth] = React.useState(1440)

    React.useEffect(() => {
        const update = () => setWidth(window.innerWidth) // expect L7
        update()
        window.addEventListener("resize", update)
        return () => window.removeEventListener("resize", update)
    }, [])

    const scale = width / 1440
    return (
        <section style={{ ...style, width: "100%", height: 900 * scale, overflow: "hidden" }}>
            <div style={{ width: 1440, height: 900, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
                {children}
            </div>
        </section>
    )
}

addPropertyControls(ScaledArtboard, {
    children: { type: ControlType.ComponentInstance },
})
