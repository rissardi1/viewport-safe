import * as React from "react"
import { addPropertyControls, ControlType } from "framer"

/**
 * @vs-type grow
 * @vs-design 1440x900
 * @vs-config tests/fixtures/viewport-safe.config.json
 *
 * Fixture: numbers drawn as SVG <text> in front of filled circles on a dark section, like the flywheel wheel. SVG text
 * is painted with `fill`, not `color`, and the SVG draws shapes behind it, so the backdrop is unknown. C12 must stay
 * silent. Regression test for a false positive the first C12 gave on the real flywheel component.
 */

interface Props {
    label: string
    style?: React.CSSProperties
}

/**
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 1440
 * @framerIntrinsicHeight 400
 */
export default function SvgLabels(props: Props) {
    const { label, style } = props
    return (
        <section style={{ ...style, boxSizing: "border-box", padding: "64px", background: "#001a16", color: "#f4ecd8" }}>
            <svg width="320" height="160" viewBox="0 0 320 160" role="img" aria-label={label}>
                <circle cx="60" cy="80" r="44" fill="#d9b25a" />
                <circle cx="160" cy="80" r="44" fill="#d9b25a" />
                <circle cx="260" cy="80" r="44" fill="#d9b25a" />
                <text x="60" y="88" textAnchor="middle" fontSize="28">01</text>
                <text x="160" y="88" textAnchor="middle" fontSize="28">02</text>
                <text x="260" y="88" textAnchor="middle" fontSize="28">03</text>
            </svg>
            <p style={{ margin: "24px 0 0", font: "20px/1.5 system-ui, sans-serif" }}>{label}</p>
        </section>
    )
}

SvgLabels.defaultProps = { label: "Three steps" }

addPropertyControls(SvgLabels, {
    label: { type: ControlType.String, title: "Label", defaultValue: "Three steps" },
})
