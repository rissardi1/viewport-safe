import * as React from "react"
import { addPropertyControls, ControlType } from "framer"

/**
 * Hero headline sized from the window width only.
 *
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight auto
 */
export default function HeroHeadline(props) {
    const { title, subtitle, subtitleSize, style } = props
    return (
        <section style={{ ...style, width: "100%", padding: "96px 24px" }}>
            <h1
                style={{
                    fontSize: "8vw", // expect L1
                    lineHeight: 1.02,
                    margin: 0,
                }}
            >
                {title}
            </h1>
            <p
                style={{
                    fontSize: subtitleSize + "vw", // expect L1
                    margin: "24px 0 0",
                }}
            >
                {subtitle}
            </p>
        </section>
    )
}

addPropertyControls(HeroHeadline, {
    title: { type: ControlType.String, defaultValue: "Built to endure." },
    subtitle: {
        type: ControlType.String,
        defaultValue: "Hospitality real estate, held for the long term.",
    },
    subtitleSize: { type: ControlType.Number, defaultValue: 1.6, step: 0.1, unit: "vw" },
})
