import * as React from "react"
import { addPropertyControls, ControlType } from "framer"
import HeightLockedScene from "./HeightLockedScene.tsx"

// Fixture (tall direction): mirrors the collateral.com hero. A height-locked WebGL-style scene fills
// the hero, the headline is sized in vh, and the showreel below is sized from height. It passes at
// 1440x900 but breaks when the browser is snapped to half an ultrawide (1720x1280, 1720x1440):
// the ring is cut at the right edge and the 80svh-tall 16:9 showreel is wider than the window.
// Do not fix this file: it must keep failing.

interface Props {
    headline: string
    subheading: string
    ctaLabel: string
    style?: React.CSSProperties
}

/**
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 1440
 * @framerIntrinsicHeight 1900
 */
export default function BrokenTallHero(props: Props) {
    const { headline, subheading, ctaLabel, style } = props
    return (
        <div style={{ ...style, background: "#0d2a22", color: "#f3efe4", fontFamily: "Georgia, serif" }}>
            <section style={{ position: "relative", minHeight: "100vh", display: "flex", alignItems: "center" }}>
                <div style={{ position: "absolute", inset: 0 }}>
                    <HeightLockedScene background="#0d2a22" ringColor="#c9a24a" />
                </div>
                <div style={{ position: "relative", padding: "0 64px", maxWidth: 640 }}>
                    <h1 style={{ fontSize: "11vh", lineHeight: 1.04, margin: "0 0 24px", fontWeight: 400 }}>{headline}</h1>
                    <p style={{ font: "20px/1.45 system-ui, sans-serif", margin: "0 0 32px", opacity: 0.85 }}>{subheading}</p>
                    <a
                        href="#contact"
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            height: 52,
                            padding: "0 24px",
                            background: "#c9a24a",
                            color: "#0d2a22",
                            borderRadius: 4,
                            font: "500 16px system-ui, sans-serif",
                            textDecoration: "none",
                        }}
                    >
                        {ctaLabel}
                    </a>
                </div>
            </section>
            <section style={{ padding: "96px 0" }}>
                <div
                    role="img"
                    aria-label="Showreel"
                    style={{
                        height: "80svh",
                        aspectRatio: "16 / 9",
                        margin: "0 auto",
                        borderRadius: 12,
                        background: "linear-gradient(135deg, #1f4d3f, #c9a24a)",
                    }}
                />
            </section>
        </div>
    )
}

addPropertyControls(BrokenTallHero, {
    headline: { type: ControlType.String, title: "Headline", defaultValue: "Strategic communications for growth" },
    subheading: {
        type: ControlType.String,
        title: "Subheading",
        defaultValue: "Position your business to win the capital, customers and credibility that compound into value.",
    },
    ctaLabel: { type: ControlType.String, title: "CTA", defaultValue: "Explore the platform" },
})
