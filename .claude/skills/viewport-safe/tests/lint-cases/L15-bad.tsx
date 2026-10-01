import * as React from "react"
import { addPropertyControls, ControlType } from "framer"

/**
 * @vs-type grow
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight auto
 */
export default function FluidCard(props) {
    const { title, style } = props
    return (
        <div
            className="fluid-card"
            style={{
                ...style,
                containerType: "inline-size", // expect L15
                width: "100%",
            }}
        >
            <style>{`
                .fluid-card__inner { container-type: inline-size; } /* expect L15 */
                .fluid-card__title { font-size: clamp(20px, 5cqi, 40px); }
            `}</style>
            <div className="fluid-card__inner">
                <h3 className="fluid-card__title">{title}</h3>
            </div>
        </div>
    )
}

addPropertyControls(FluidCard, {
    title: { type: ControlType.String, defaultValue: "Palazzo Example" },
})
