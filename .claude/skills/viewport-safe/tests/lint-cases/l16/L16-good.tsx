import * as React from "react"
import { addPropertyControls, ControlType } from "framer"

// Brand values copied from viewport-safe.config.json. Update both together.
const BRAND = { contentMaxWidth: 1224, gutterMin: 24, gutterMax: 64, displayTypeMax: 96, designW: 1440, designH: 900 }

/**
 * @vs-type grow
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight auto
 */
export default function ContentBlock(props) {
    const { contentMaxWidth, children, style } = props
    return (
        <section
            style={
                {
                    ...style,
                    "--vs-content-max": contentMaxWidth + "px",
                    "--vs-gutter": `clamp(${BRAND.gutterMin}px, 4vw, ${BRAND.gutterMax}px)`,
                    width: "100%",
                } as React.CSSProperties
            }
        >
            <div style={{ width: "min(100% - 2 * var(--vs-gutter), var(--vs-content-max))", marginInline: "auto" }}>
                {children}
            </div>
        </section>
    )
}

addPropertyControls(ContentBlock, {
    contentMaxWidth: { type: ControlType.Number, defaultValue: BRAND.contentMaxWidth, min: 600, max: 2400, unit: "px" },
    children: { type: ControlType.ComponentInstance },
})
