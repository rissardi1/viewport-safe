import * as React from "react"
import { addPropertyControls, ControlType } from "framer"
import HeightLockedScene from "./HeightLockedScene.tsx"

/**
 * @vs-type grow
 * @vs-design 1440x900
 * @vs-key-visual ring scene: height-locked -> aspect-locked stage (1440/900, contained by both axes)
 * @vs-key-visual showreel: contain -> width min(100%, 80svh * 16/9)
 * @vs-config tests/fixtures/viewport-safe.config.json
 *
 * Fixture: the same design as BrokenTallHero, following the viewport-safe rules. Must pass every
 * required viewport. The scene keeps its 16:10 design shape inside a stage that fits both window
 * axes, so the height-locked ring is never cropped; the section is painted in the scene's
 * background colour so the letterbox bands are invisible.
 */

// Brand values copied from tests/fixtures/viewport-safe.config.json. Update both together.
const BRAND = { contentMaxWidth: 1440, gutterMin: 24, gutterMax: 64, displayTypeMax: 120, designW: 1440, designH: 900 }

// Where the ring sits on the scene's 1440x900 artboard, as % of the stage (for the key-visual proxy).
const RING_BOX = { left: "66%", top: "26%", width: "30%", height: "48%" }

interface Props {
    headline: string
    subheading: string
    ctaLabel: string
    sceneBackground: string
    ringColor: string
    contentMaxWidth: number
    style?: React.CSSProperties
}

const CSS = `
.fth-root { background: var(--fth-bg); color: #f3efe4; font-family: Georgia, serif; }
.fth-hero { display: grid; grid-template-columns: 1fr; grid-template-rows: minmax(100vh, auto); grid-template-rows: minmax(100svh, auto);
  place-items: center; min-height: 100vh; min-height: 100svh; }
.fth-stage { grid-area: 1 / 1; position: relative; width: min(100%, calc(100svh * ${BRAND.designW} / ${BRAND.designH}));
  aspect-ratio: ${BRAND.designW} / ${BRAND.designH}; }
.fth-proxy { position: absolute; pointer-events: none; }
.fth-wrap { grid-area: 1 / 1; position: relative; width: 100%; container-type: inline-size; }
.fth-content { --vs-u: min(100cqw / ${BRAND.designW}, 100svh / ${BRAND.designH});
  width: min(100% - 2 * var(--vs-gutter), var(--vs-content-max)); margin-inline: auto; }
.fth-text { max-width: 40%; }
.fth-headline { font-size: clamp(40px, 88 * var(--vs-u), ${BRAND.displayTypeMax}px); line-height: 1.04; margin: 0 0 24px; font-weight: 400; }
.fth-sub { font: 20px/1.45 system-ui, sans-serif; margin: 0 0 32px; opacity: 0.85; }
.fth-cta { display: inline-flex; align-items: center; height: 52px; padding: 0 24px; background: #c9a24a; color: #0d2a22;
  border-radius: 4px; font: 500 16px system-ui, sans-serif; text-decoration: none; }
.fth-reel-section { padding: clamp(48px, 9svh, 96px) var(--vs-gutter); }
.fth-reel { width: min(100%, calc(80svh * 16 / 9)); aspect-ratio: 16 / 9; margin: 0 auto; border-radius: 12px;
  background: linear-gradient(135deg, #1f4d3f, #c9a24a); }
@media (max-aspect-ratio: 3/2) { .fth-text { max-width: 44%; } }
@media (max-height: 820px) { .fth-headline { margin-bottom: 16px; } .fth-sub { margin-bottom: 20px; } }
`

/**
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 1440
 * @framerIntrinsicHeight 1900
 */
export default function FixedTallHero(props: Props) {
    const { headline, subheading, ctaLabel, sceneBackground, ringColor, contentMaxWidth, style } = props
    const rootStyle = {
        ...style,
        "--fth-bg": sceneBackground,
        "--vs-content-max": `${contentMaxWidth}px`,
        "--vs-gutter": `clamp(${BRAND.gutterMin}px, 4vw, ${BRAND.gutterMax}px)`,
    } as React.CSSProperties
    return (
        <div className="fth-root" style={rootStyle}>
            <style>{CSS}</style>
            <section className="fth-hero" data-vs="fit">
                <div className="fth-stage">
                    <HeightLockedScene background={sceneBackground} ringColor={ringColor} />
                    <div className="fth-proxy" data-vs="key-visual" aria-hidden="true" style={RING_BOX} />
                </div>
                <div className="fth-wrap">
                    <div className="fth-content">
                        <div className="fth-text">
                            <h1 className="fth-headline">{headline}</h1>
                            <p className="fth-sub">{subheading}</p>
                            <div data-vs="above-fold">
                                <a className="fth-cta" href="#contact">
                                    {ctaLabel}
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
            <section className="fth-reel-section">
                <div className="fth-reel" role="img" aria-label="Showreel" data-vs="key-visual" />
            </section>
        </div>
    )
}

addPropertyControls(FixedTallHero, {
    headline: { type: ControlType.String, title: "Headline", defaultValue: "Strategic communications for growth" },
    subheading: {
        type: ControlType.String,
        title: "Subheading",
        defaultValue: "Position your business to win the capital, customers and credibility that compound into value.",
    },
    ctaLabel: { type: ControlType.String, title: "CTA", defaultValue: "Explore the platform" },
    sceneBackground: { type: ControlType.Color, title: "Scene background", defaultValue: "#0d2a22" },
    ringColor: { type: ControlType.Color, title: "Ring", defaultValue: "#c9a24a" },
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
