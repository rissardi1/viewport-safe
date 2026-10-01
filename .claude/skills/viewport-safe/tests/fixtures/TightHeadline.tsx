import * as React from "react"
import { addPropertyControls, ControlType } from "framer"

/**
 * @vs-type grow
 * @vs-design 1440x900
 * @vs-config tests/fixtures/viewport-safe.config.json
 *
 * Fixture: a display headline with tight leading (line-height 1.0), split into one block span per sentence, in a
 * serif face on a valid gradient background. This is ordinary typography. It must produce no C10 (the line boxes
 * touch but do not overlap, even though the font's content areas do) and no C12 (the backdrop is a gradient, so it
 * is unknown and skipped). Regression test for the C10 false positive found in the eval-6 baseline.
 */

interface Props {
    first: string
    second: string
    style?: React.CSSProperties
}

/**
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 1440
 * @framerIntrinsicHeight 600
 */
export default function TightHeadline(props: Props) {
    const { first, second, style } = props
    return (
        <section
            style={{
                ...style,
                boxSizing: "border-box",
                padding: "96px 64px",
                background: "linear-gradient(135deg, #0d2a22, #050d0a)",
                color: "#f4ecd8",
            }}
        >
            <h1 style={{ margin: 0, maxWidth: 1000, font: "400 112px/1.0 Georgia, 'Times New Roman', serif" }}>
                <span style={{ display: "block" }}>{first}</span>
                <span style={{ display: "block" }}>{second}</span>
            </h1>
            <p style={{ margin: "32px 0 0", maxWidth: 560, font: "20px/1.5 system-ui, sans-serif", opacity: 0.85 }}>
                Serialised bars, vaulted and insured in Zurich.
            </p>
        </section>
    )
}

TightHeadline.defaultProps = { first: "Real gold.", second: "Held in your name." }

addPropertyControls(TightHeadline, {
    first: { type: ControlType.String, title: "First line", defaultValue: "Real gold." },
    second: { type: ControlType.String, title: "Second line", defaultValue: "Held in your name." },
})
