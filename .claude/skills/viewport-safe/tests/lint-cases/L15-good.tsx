import * as React from "react"
import { addPropertyControls, ControlType } from "framer"

/**
 * Container units are used, so the component supports Fixed and Fill width only.
 *
 * @vs-type grow
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight auto
 */
export default function FluidCard(props) {
    const { title, style } = props
    return (
        <div style={{ ...style, position: "relative" }}>
            <div style={{ containerType: "inline-size", width: "100%" }}>
                <h3 style={{ fontSize: "clamp(20px, 5cqi, 40px)", margin: 0 }}>{title}</h3>
            </div>
        </div>
    )
}

addPropertyControls(FluidCard, {
    title: { type: ControlType.String, defaultValue: "Palazzo Example" },
})
