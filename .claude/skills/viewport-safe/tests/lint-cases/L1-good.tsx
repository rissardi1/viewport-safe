import * as React from "react"
import { addPropertyControls, ControlType } from "framer"

// Brand values copied from clients/example/viewport-safe.config.json. Update both together.
const BRAND = { contentMaxWidth: 1440, gutterMin: 24, gutterMax: 64, displayTypeMax: 120, designW: 1440, designH: 900 }

/**
 * @vs-type fit
 * @vs-design 1440x900
 *
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight fixed
 */
export default function HeroHeadline(props) {
    const { title, subtitle, style } = props
    return (
        <section style={{ ...style, width: "100%", height: "100%" }}>
            <div style={{ containerType: "inline-size", width: "100%" }}>
                <div
                    style={
                        {
                            "--vs-u": `min(100cqw / ${BRAND.designW}, 100svh / ${BRAND.designH})`,
                        } as React.CSSProperties
                    }
                >
                    <h1
                        style={{
                            fontSize: `clamp(40px, 80 * var(--vs-u), ${BRAND.displayTypeMax}px)`,
                            lineHeight: 1.02,
                        }}
                    >
                        {title}
                    </h1>
                    <p style={{ fontSize: "min(2vw, 24px)" }}>{subtitle}</p>
                </div>
            </div>
        </section>
    )
}

addPropertyControls(HeroHeadline, {
    title: { type: ControlType.String, defaultValue: "Built to endure." },
    subtitle: { type: ControlType.String, defaultValue: "Held for the long term." },
})
