import * as React from "react"
import { addPropertyControls, ControlType } from "framer"

/**
 * Suppression semantics:
 *  - a reasoned vs-ignore on the line above, or on the same line, justifies the finding;
 *  - a vs-ignore with an empty reason does not count;
 *  - a justified error does not affect the exit code.
 *
 * @vs-type grow
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight auto
 */
export default function FullBleedMarquee(props) {
    const { items, style } = props
    return (
        <section style={{ ...style, position: "relative", width: "100%" }}>
            <div
                style={{
                    // vs-ignore L8: the page root clips overflow-x, so the extra 17px never scrolls
                    width: "100vw", // expect L8
                    display: "flex",
                }}
            >
                {items}
            </div>
            <div
                style={{
                    // vs-ignore L8:
                    width: "100vw", // expect L8
                    height: 1,
                }}
            />
            <div style={{ width: "100vw" /* vs-ignore L8: decorative hairline, clipped by the section */ }} /> {/* expect L8 */}
            <div
                style={{
                    // vs-ignore L6: pinned stage; everything inside is sized
                    // from the measured stage box on both axes
                    height: "100vh", // expect L6
                    overflow: "hidden",
                }}
            />
        </section>
    )
}

addPropertyControls(FullBleedMarquee, {
    items: { type: ControlType.Array, control: { type: ControlType.ComponentInstance } },
})
