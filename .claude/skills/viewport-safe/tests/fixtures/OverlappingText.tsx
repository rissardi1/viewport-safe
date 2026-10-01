import * as React from "react"
import { addPropertyControls, ControlType } from "framer"

/**
 * @vs-type grow
 * @vs-design 1440x900
 * @vs-config tests/fixtures/viewport-safe.config.json
 *
 * Fixture: two text blocks drawn on top of each other, offset by less than half a line. The line boxes overlap by
 * about 28px, so C10 must still report "text overlaps other text" after the line-box fix for tight leading.
 */

interface Props {
    top: string
    bottom: string
    style?: React.CSSProperties
}

/**
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 1440
 * @framerIntrinsicHeight 400
 */
export default function OverlappingText(props: Props) {
    const { top, bottom, style } = props
    return (
        <section style={{ ...style, position: "relative", boxSizing: "border-box", height: 400, background: "#111", color: "#fff" }}>
            <p style={{ position: "absolute", left: 64, top: 100, margin: 0, font: "40px/1.2 system-ui, sans-serif" }}>{top}</p>
            <p style={{ position: "absolute", left: 64, top: 120, margin: 0, font: "40px/1.2 system-ui, sans-serif" }}>{bottom}</p>
        </section>
    )
}

OverlappingText.defaultProps = { top: "First block of text", bottom: "Second block, drawn over it" }

addPropertyControls(OverlappingText, {
    top: { type: ControlType.String, title: "Top", defaultValue: "First block of text" },
    bottom: { type: ControlType.String, title: "Bottom", defaultValue: "Second block, drawn over it" },
})
