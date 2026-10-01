import * as React from "react"
import { addPropertyControls, ControlType } from "framer"

/**
 * @vs-type fit
 * @vs-design 1440x900
 * @vs-key-visual showreel: contain -> width min(60cqw, 54svh * 16/9)
 * @vs-config tests/fixtures/viewport-safe.config.json
 *
 * Fixture: the same design as BrokenHero, following the viewport-safe rules. Must pass every
 * required viewport. Height budget at 730px (laptop-125): padding 35 + headline 98 + subheading 28
 * + showreel 394 + CTAs 52 + gaps 48 = 655px.
 */

// Brand values copied from tests/fixtures/viewport-safe.config.json. Update both together.
const BRAND = { contentMaxWidth: 1440, gutterMin: 24, gutterMax: 64, displayTypeMax: 120, designW: 1440, designH: 900 }

interface Props {
    headline: string
    subheading: string
    primaryLabel: string
    secondaryLabel: string
    contentMaxWidth: number
    style?: React.CSSProperties
}

const CSS = `
.fh-root { box-sizing: border-box; min-height: 100vh; min-height: 100svh; display: flex; flex-direction: column; justify-content: center;
  padding-block: clamp(24px, 4.8svh, 64px); background: #0f1720; color: #f5f1e8; font-family: Georgia, serif; }
.fh-wrap { container-type: inline-size; width: 100%; }
.fh-content { --vs-u: min(100cqw / ${BRAND.designW}, 100svh / ${BRAND.designH});
  width: min(100% - 2 * var(--vs-gutter), var(--vs-content-max)); margin-inline: auto;
  display: flex; flex-direction: column; gap: clamp(12px, 2.2svh, 24px); }
.fh-headline { font-size: clamp(40px, 115 * var(--vs-u), ${BRAND.displayTypeMax}px); line-height: 1.05; margin: 0; font-weight: 400; }
.fh-sub { font: 20px/1.4 system-ui, sans-serif; margin: 0; opacity: 0.8; }
.fh-reel { width: min(60cqw, calc(54svh * 16 / 9)); aspect-ratio: 16 / 9; border-radius: 8px;
  background: linear-gradient(135deg, #3b4b5f, #9a7b4f); }
.fh-ctas { display: flex; flex-wrap: wrap; gap: 12px; }
.fh-btn { display: inline-flex; align-items: center; height: 52px; padding: 0 24px; border: 1px solid #c9a24a;
  border-radius: 4px; font: 500 16px system-ui, sans-serif; text-decoration: none; }
@media (max-height: 820px) { .fh-content { gap: 12px; } }
`

/**
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 1440
 * @framerIntrinsicHeight 900
 */
export default function FixedHero(props: Props) {
    const { headline, subheading, primaryLabel, secondaryLabel, contentMaxWidth, style } = props
    const rootStyle = {
        ...style,
        "--vs-content-max": `${contentMaxWidth}px`,
        "--vs-gutter": `clamp(${BRAND.gutterMin}px, 4vw, ${BRAND.gutterMax}px)`,
    } as React.CSSProperties
    return (
        <section className="fh-root" data-vs="fit" style={rootStyle}>
            <style>{CSS}</style>
            <div className="fh-wrap">
                <div className="fh-content">
                    <h1 className="fh-headline">{headline}</h1>
                    <p className="fh-sub">{subheading}</p>
                    <div className="fh-reel" role="img" aria-label="Showreel" data-vs="key-visual" />
                    <div className="fh-ctas" data-vs="above-fold">
                        <a className="fh-btn" href="#contact" style={{ background: "#c9a24a", color: "#0f1720" }}>
                            {primaryLabel}
                        </a>
                        <a className="fh-btn" href="#work" style={{ color: "#f5f1e8" }}>
                            {secondaryLabel}
                        </a>
                    </div>
                </div>
            </div>
        </section>
    )
}

addPropertyControls(FixedHero, {
    headline: { type: ControlType.String, title: "Headline", defaultValue: "Capital, clearly." },
    subheading: {
        type: ControlType.String,
        title: "Subheading",
        defaultValue: "Strategic communications for companies raising, growing and exiting.",
    },
    primaryLabel: { type: ControlType.String, title: "Primary CTA", defaultValue: "Book a call" },
    secondaryLabel: { type: ControlType.String, title: "Secondary CTA", defaultValue: "See our work" },
    contentMaxWidth: {
        type: ControlType.Number,
        title: "Content max width",
        defaultValue: BRAND.contentMaxWidth,
        min: 960,
        max: 2400,
        step: 8,
        unit: "px",
    },
})
