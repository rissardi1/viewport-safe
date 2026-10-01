import * as React from "react"
import { addPropertyControls, ControlType } from "framer"

/**
 * Fixed / Fill width only, but the container is the root itself: the root cannot use its own
 * cqi, so the title falls back to viewport units.
 *
 * @vs-type grow
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight auto
 */
export default function FluidCard(props) {
    const { title, style } = props
    return (
        <div style={{ ...props.style, containerType: "inline-size", width: "100%" }}> {/* expect L15 */}
            <h3 style={{ fontSize: "clamp(20px, 5cqi, 40px)", margin: 0 }}>{title}</h3>
        </div>
    )
}

addPropertyControls(FluidCard, {
    title: { type: ControlType.String, defaultValue: "Palazzo Example" },
})
