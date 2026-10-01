import * as React from "react"
import { addPropertyControls, ControlType, withCSS } from "framer"

// Every way a size can reach the lint: constants, template strings, concatenation,
// ternaries, quoted kebab keys and CSS strings passed to withCSS.
const FULL_HEIGHT = "100svh"
const FULL = "100vh"

/**
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight auto
 */
function FormsHero(props) {
    const { size, compact, style } = props
    return (
        <section
            className="forms-hero"
            style={{
                ...style,
                height: FULL_HEIGHT, // expect L6
                overflow: "hidden",
            }}
        >
            <h1 style={{ fontSize: `${size}vw` }}>Title</h1> {/* expect L1 */}
            <h2 style={{ fontSize: size / 2 + "vw" }}>Subtitle</h2> {/* expect L1 */}
            <p style={{ fontSize: compact ? "4vw" : "clamp(16px, 2vw, 24px)" }}>Body</p> {/* expect L1 */}
            <div style={{ "padding-top": "6vw" }} /> {/* expect L11 L12 */}
            <div style={{ height: `calc(${FULL} - 64px)`, overflowY: "hidden" }} /> {/* expect L6 */}
        </section>
    )
}

export default withCSS(FormsHero, [
    ".forms-hero { position: relative; }",
    ".forms-hero h1 { letter-spacing: -0.02em; font-size: 9vw; }", // expect L1
])

addPropertyControls(FormsHero, {
    size: { type: ControlType.Number, defaultValue: 8, unit: "vw" },
    compact: { type: ControlType.Boolean, defaultValue: false },
})
