import * as React from "react"
import { addPropertyControls, ControlType } from "framer"

/**
 * @vs-type grow
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight auto
 */
export default function StatBand(props) { // expect L14
    const { stats, color } = props
    return (
        <section
            style={{
                width: "100%",
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                gap: 24,
                color,
            }}
        >
            {stats.map((s) => (
                <div key={s.label}>
                    <strong style={{ fontSize: 56, lineHeight: 1 }}>{s.value}</strong>
                    <span style={{ display: "block", fontSize: 16 }}>{s.label}</span>
                </div>
            ))}
        </section>
    )
}

addPropertyControls(StatBand, {
    color: { type: ControlType.Color, defaultValue: "#181716" },
    stats: {
        type: ControlType.Array,
        control: {
            type: ControlType.Object,
            controls: { value: { type: ControlType.String }, label: { type: ControlType.String } },
        },
    },
})
