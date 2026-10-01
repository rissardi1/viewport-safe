import * as React from "react"
import { addPropertyControls, ControlType } from "framer"

// False-positive traps taken from real components. Expect zero findings.
// An old version used font-size: 8vw and height: 100vh; overflow: hidden. Do not bring it back.

interface TrapsProps {
    padding: string
    width: number
    introLength: number
    style?: React.CSSProperties
}

const UNIT_PATTERN = /[{}]\s*(\d+)vw/g

/** Holds the chosen size on a wide screen and scales it down with the viewport. */
function fluidSize(max: number) {
    return `clamp(${Math.round(max * 0.55)}px, ${((max / 1440) * 100).toFixed(2)}vw, ${max}px)`
}

/*
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight auto
 */
export default function Traps(props: TrapsProps) {
    const { introLength, style } = props
    const scrollPx = `calc(${introLength}vh + 100%)`
    return (
        <section style={{ ...style, width: "100%", padding: "96px 24px", height: scrollPx }}>
            <p style={{ fontSize: fluidSize(24), maxWidth: 640 }}>
                Don't size this with 100vw: it's wider than the page on Windows, and 8vw type isn't contained.
            </p>
            <img
                alt=""
                src="https://example.com/still.jpg"
                sizes="(max-width: 800px) 100vw, 50vw"
                style={{ width: "100%", height: "auto" }}
            />
            <code>{String(UNIT_PATTERN)}</code>
        </section>
    )
}

addPropertyControls(Traps, {
    introLength: {
        title: "Delay length",
        type: ControlType.Number,
        defaultValue: 40,
        min: 5,
        max: 150,
        step: 5,
        unit: "vh",
        description: "Around 40vh swallows one scroll gesture.",
    },
    padding: {
        title: "Padding",
        type: ControlType.Padding,
        defaultValue: "0px 32px 0px 64px",
        description: "Use 4vw on the sides if you want it fluid.",
    },
})
