import * as React from "react"
import { addPropertyControls, ControlType } from "framer"

/**
 * @vs-type grow
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight auto
 */
export default function ContentBlock(props) { // expect L16
    const { children, style } = props
    return (
        <section style={{ ...style, width: "100%" }}>
            <div style={{ width: "min(100% - 48px, 1224px)", marginInline: "auto" }}>{children}</div>
        </section>
    )
}

addPropertyControls(ContentBlock, {
    children: { type: ControlType.ComponentInstance },
})
