import * as React from "react"
import { addPropertyControls, ControlType } from "framer"

// Fixture (wide direction): a hero written the way generated components usually are. Type, padding
// and the video are sized from the window WIDTH, and the section clips at 100vh. It fits at 1440x900,
// but on wide windows (3440x1280, 2560x940) and short laptops (1536x730) the headline balloons and
// the CTAs are pushed out of the clipped section. Do not fix this file: it must keep failing.

interface Props {
    headline: string
    subheading: string
    primaryLabel: string
    secondaryLabel: string
    style?: React.CSSProperties
}

/**
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight fixed
 * @framerIntrinsicWidth 1440
 * @framerIntrinsicHeight 900
 */
export default function BrokenHero(props: Props) {
    const { headline, subheading, primaryLabel, secondaryLabel, style } = props
    return (
        <section
            style={{
                ...style,
                height: "100vh",
                overflow: "hidden",
                boxSizing: "border-box",
                padding: "3vw 6vw",
                display: "flex",
                flexDirection: "column",
                gap: "1.4vw",
                background: "#0f1720",
                color: "#f5f1e8",
                fontFamily: "Georgia, serif",
            }}
        >
            <h1 style={{ fontSize: "8vw", lineHeight: 1.05, margin: 0, fontWeight: 400 }}>{headline}</h1>
            <p style={{ fontSize: 20, lineHeight: 1.4, margin: 0, opacity: 0.8, fontFamily: "system-ui" }}>{subheading}</p>
            <div style={{ width: "60%" }}>
                <div
                    role="img"
                    aria-label="Showreel"
                    style={{
                        width: "100%",
                        aspectRatio: "16 / 9",
                        borderRadius: 8,
                        background: "linear-gradient(135deg, #3b4b5f, #9a7b4f)",
                    }}
                />
            </div>
            <div style={{ display: "flex", gap: 12 }}>
                <a href="#contact" style={buttonStyle("#c9a24a", "#0f1720")}>{primaryLabel}</a>
                <a href="#work" style={buttonStyle("transparent", "#f5f1e8")}>{secondaryLabel}</a>
            </div>
        </section>
    )
}

function buttonStyle(background: string, color: string): React.CSSProperties {
    return {
        display: "inline-flex",
        alignItems: "center",
        height: 52,
        padding: "0 24px",
        background,
        color,
        border: "1px solid #c9a24a",
        borderRadius: 4,
        font: "500 16px system-ui",
        textDecoration: "none",
    }
}

addPropertyControls(BrokenHero, {
    headline: { type: ControlType.String, title: "Headline", defaultValue: "Capital, clearly." },
    subheading: {
        type: ControlType.String,
        title: "Subheading",
        defaultValue: "Strategic communications for companies raising, growing and exiting.",
    },
    primaryLabel: { type: ControlType.String, title: "Primary CTA", defaultValue: "Book a call" },
    secondaryLabel: { type: ControlType.String, title: "Secondary CTA", defaultValue: "See our work" },
})
