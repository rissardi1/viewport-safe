import * as React from "react"
import { addPropertyControls, ControlType } from "framer"

/**
 * Full-screen sections grow, they do not clip (pattern 6.6).
 *
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight auto
 */
export default function FullScreenHero(props) {
    const { title, style } = props
    return (
        <section className="vs-hero" style={{ ...style, width: "100%" }}>
            <style>{`
                .vs-hero {
                    min-height: 100vh;
                    min-height: 100svh;
                    overflow: hidden;
                    padding-block: clamp(48px, 10svh, 160px);
                }
            `}</style>
            <div style={{ height: "100svh", display: "grid", placeItems: "center" }}>
                <h1 style={{ fontSize: 72, margin: 0 }}>{title}</h1>
            </div>
            <div style={{ minHeight: "100svh", overflow: "clip" }} />
        </section>
    )
}

addPropertyControls(FullScreenHero, {
    title: { type: ControlType.String, defaultValue: "Built to endure." },
})
