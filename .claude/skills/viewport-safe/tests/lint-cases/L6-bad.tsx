import * as React from "react"
import { addPropertyControls, ControlType } from "framer"

/**
 * Full-screen hero that clips on short windows (730px at laptop-125).
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
                    height: 100svh; /* expect L6 */
                    overflow: hidden;
                    display: grid;
                    place-items: center;
                }
            `}</style>
            <div
                style={{
                    height: "calc(100vh - 64px)", // expect L6
                    overflow: "clip",
                    display: "flex",
                    alignItems: "center",
                }}
            >
                <h1 style={{ fontSize: 72, margin: 0 }}>{title}</h1>
            </div>
        </section>
    )
}

addPropertyControls(FullScreenHero, {
    title: { type: ControlType.String, defaultValue: "Built to endure." },
})
