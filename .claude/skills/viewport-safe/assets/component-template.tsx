/**
 * @vs-type fit
 * @vs-design 1440x900
 * @vs-key-visual visual stage: contain -> aspect-locked stage
 * @vs-config clients/example/viewport-safe.config.json
 */
import * as React from "react"
import { addPropertyControls, ControlType, RenderTarget } from "framer"

// Viewport-safe hero starter. Before shipping:
// 1. Point @vs-config at the project's viewport-safe.config.json and copy its values
//    into BRAND (lint rule L16 compares them).
// 2. Rename PREFIX, so two components built from this file never share CSS rules.
// 3. Keep one @vs-key-visual line per visual whose edges matter, naming its scaling model.
// Patterns: references/sizing-patterns.md. Framer rules: references/framer-specifics.md.

// Brand values copied from clients/example/viewport-safe.config.json. Update both together.
const BRAND = { contentMaxWidth: 1440, gutterMin: 24, gutterMax: 64, displayTypeMax: 120, designW: 1440, designH: 900 }

/** Unique class prefix. Every selector, variable and keyframe below is scoped with it. */
const PREFIX = "vsHero"

/**
 * Sizes in design px, as drawn in the BRAND.designW x BRAND.designH frame. Each one is
 * multiplied by the contain unit, so it scales with whichever window axis is tighter.
 */
const DESIGN = {
    headline: 80,
    subheading: 22,
    copyGap: 28,
    columnGap: 64,
    /** Stage width in the design frame. Its height follows from STAGE_RATIO. */
    stage: 560,
}

/** Width / height of the visual stage. Match it to the artwork so contain leaves no bands. */
const STAGE_RATIO = "1 / 1"

/**
 * The contain unit: one design px, scaled by the tighter axis (sizing-patterns.md, 6.1).
 * Container units resolve against an ancestor container, never the element's own
 * container-type, so it is declared on the wrapper's child and used below it.
 */
const U = `min(100cqw / ${BRAND.designW}, 100svh / ${BRAND.designH})`

const P = PREFIX

// Height budget at laptop-125 (1536x730, the smallest required height): contain unit
// 0.81, so the stage is 454px and the copy about 280px, inside 730 - 2 x 32px padding.
// Width budget at uw-half (1720x1280) and uw-half-stress (1720x1440): the unit is bound
// by width (1.19), so the stage is 669px inside a 682px column and the headline 95.6px.
// Nothing takes its width from height alone.
const CSS = `
.${P}-root,
.${P}-root * {
    box-sizing: border-box;
}
.${P}-root {
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-height: 100svh;
    padding-block: clamp(48px, 10svh, 160px);
    background: var(--${P}-background);
    color: var(--${P}-text);
    font-family: Inter, system-ui, sans-serif;
}
.${P}-wrap {
    container-type: inline-size;
    width: 100%;
}
.${P}-container {
    --vs-u: ${U};
    width: min(100% - 2 * var(--vs-gutter), var(--vs-content-max));
    margin-inline: auto;
}
.${P}-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
    align-items: center;
    column-gap: clamp(24px, calc(${DESIGN.columnGap} * var(--vs-u)), 96px);
    row-gap: 40px;
}
.${P}-copy {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: clamp(16px, calc(${DESIGN.copyGap} * var(--vs-u)), 40px);
    min-width: 0;
}
.${P}-headline {
    margin: 0;
    font-size: clamp(40px, calc(${DESIGN.headline} * var(--vs-u)), ${BRAND.displayTypeMax}px);
    font-weight: 600;
    line-height: 1.02;
    letter-spacing: -0.02em;
    text-wrap: balance;
    overflow-wrap: break-word;
}
.${P}-sub {
    margin: 0;
    max-width: 34em;
    font-size: clamp(16px, calc(${DESIGN.subheading} * var(--vs-u)), 28px);
    line-height: 1.45;
    opacity: 0.8;
}
.${P}-ctas {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
}
.${P}-cta {
    display: inline-flex;
    align-items: center;
    min-height: 48px;
    padding: 12px 24px;
    border-radius: 999px;
    background: var(--${P}-accent);
    color: var(--${P}-accent-text);
    font-size: 16px;
    font-weight: 600;
    line-height: 1.2;
    text-decoration: none;
}
.${P}-stage {
    position: relative;
    justify-self: center;
    width: min(100%, calc(${DESIGN.stage} * var(--vs-u)));
    aspect-ratio: ${STAGE_RATIO};
}
.${P}-stage img,
.${P}-stage svg {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
}
.${P}-stage img {
    object-fit: contain;
}

/* Tall and half-screen windows (uw-half 1.34, uw-half-stress 1.19). The stage is bound
   by width here, so it gets an equal column; content is centred, so less padding. */
@media (max-aspect-ratio: 3/2) {
    .${P}-root {
        padding-block: clamp(32px, 6svh, 96px);
    }
    .${P}-grid {
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    }
}

/* Ultrawide windows (uw-full, uw-29, fhd, laptop-125). Height is the tight axis: stay
   side by side and spend less of the height on padding. */
@media (min-aspect-ratio: 2/1) {
    .${P}-root {
        padding-block: clamp(32px, 8svh, 120px);
    }
    .${P}-grid {
        grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
    }
}

/* Short windows (laptop-125 is 730px tall). Tighten spacing; never hide content. */
@media (max-height: 820px) {
    .${P}-root {
        padding-block: 32px;
    }
    .${P}-copy {
        gap: 16px;
    }
}

/* Narrow instances (Framer Tablet and Phone breakpoints) stack. Kept last so it wins
   over the aspect-ratio queries on tall phones. */
@container (max-width: 809px) {
    .${P}-grid {
        grid-template-columns: minmax(0, 1fr);
    }
    .${P}-stage {
        width: min(100%, 50svh);
    }
}

/* Entrance. Transform and opacity only, so the layout is identical with or without it. */
@keyframes ${P}-rise {
    from {
        opacity: 0;
        transform: translateY(16px);
    }
    to {
        opacity: 1;
        transform: none;
    }
}
@media (prefers-reduced-motion: no-preference) {
    .${P}-animate .${P}-headline,
    .${P}-animate .${P}-sub,
    .${P}-animate .${P}-ctas,
    .${P}-animate .${P}-stage {
        animation: ${P}-rise 700ms cubic-bezier(0.2, 0.7, 0.2, 1) both;
    }
    .${P}-animate .${P}-sub {
        animation-delay: 80ms;
    }
    .${P}-animate .${P}-ctas {
        animation-delay: 160ms;
    }
    .${P}-animate .${P}-stage {
        animation-delay: 120ms;
    }
}
`

type ImageValue = { src?: string; srcSet?: string; alt?: string } | string | null

/** The section colours. Merged over COLOR_DEFAULTS, so a partial group still arrives complete. */
interface ColorProps {
    background: string
    text: string
    accent: string
    accentText: string
}

/** Everything the hero takes from Framer's property panel. */
interface ViewportSafeHeroProps {
    headline: string
    subheading: string
    ctaLabel: string
    ctaLink: string
    /** Shown contained, never cropped, inside the stage. Empty shows a placeholder ring. */
    image?: ImageValue
    /** Width of the content column in px, excluding gutters. Defaults to BRAND. */
    contentMaxWidth: number
    colors?: Partial<ColorProps>
    style?: React.CSSProperties
}

const CONTENT_DEFAULTS = {
    headline: "Built for every window shape",
    subheading:
        "One composition that holds on a laptop, a desktop and a browser snapped to half of an ultrawide.",
    ctaLabel: "Get started",
    ctaLink: "",
}

const COLOR_DEFAULTS: ColorProps = {
    background: "#0E0E10",
    text: "#F4F2EE",
    accent: "#E8C872",
    accentText: "#141414",
}

const useIsoLayoutEffect =
    typeof window === "undefined" ? React.useEffect : React.useLayoutEffect

/**
 * Measures an element's own box on both axes and follows it on resize (rule 9).
 *
 * Use it when JS needs the component's size: a scale-to-fit artboard, a canvas, a camera,
 * a scroll distance. It starts at null, so the static render and the first paint fall back
 * to CSS sizing or scale 1 instead of a guessed size:
 *
 *     const [ref, box] = useBox<HTMLDivElement>()
 *     const scale = box && box.w > 0 && box.h > 0
 *         ? Math.min(box.w / BRAND.designW, box.h / BRAND.designH)
 *         : 1
 *
 * The default layout needs no measuring (the contain unit does it in CSS), so it is unused
 * here. It stays module-scoped: a Framer code file should have a single default export.
 */
function useBox<T extends HTMLElement>() {
    const ref = React.useRef<T>(null)
    const [box, setBox] = React.useState<{ w: number; h: number } | null>(null)
    useIsoLayoutEffect(() => {
        const element = ref.current
        if (!element || typeof ResizeObserver === "undefined") return
        const observer = new ResizeObserver(([entry]) =>
            setBox({ w: entry.contentRect.width, h: entry.contentRect.height })
        )
        observer.observe(element)
        return () => observer.disconnect()
    }, [])
    return [ref, box] as const
}

function imageSrc(image: ImageValue | undefined) {
    return typeof image === "string" ? image : image?.src || ""
}

function imageSrcSet(image: ImageValue | undefined) {
    return typeof image === "string" ? undefined : image?.srcSet
}

function imageAlt(image: ImageValue | undefined) {
    return typeof image === "string" ? "" : image?.alt || ""
}

/**
 * Hero: headline, subheading, CTA row and a visual stage.
 *
 * A fit section: it fills one screen and its content fits 730px of height. Every
 * viewport-relative size goes through the contain unit, the stage keeps its aspect ratio
 * and the image inside it is contained, so nothing is cut at 1720x1280 and nothing is
 * pushed below the fold at 3440x1280.
 *
 * In Framer: width Fill, height Fit or Viewport. A Fixed height shorter than the window
 * lets min-height push the section past its frame.
 *
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 1440
 * @framerIntrinsicHeight 900
 */
export default function ViewportSafeHero(props: ViewportSafeHeroProps) {
    const {
        headline = CONTENT_DEFAULTS.headline,
        subheading = CONTENT_DEFAULTS.subheading,
        ctaLabel = CONTENT_DEFAULTS.ctaLabel,
        ctaLink = CONTENT_DEFAULTS.ctaLink,
        // ResponsiveImage has no defaultValue in Framer, so the default lives here.
        image = null,
        contentMaxWidth = BRAND.contentMaxWidth,
        style,
    } = props
    const colors = { ...COLOR_DEFAULTS, ...props.colors }

    // The canvas renders one still frame: skip the entrance there, keep the layout identical.
    const isCanvas = RenderTarget.current() === RenderTarget.canvas

    const src = imageSrc(image)

    // Defaults before the spread, so Framer's width and height win; brand values after it.
    const rootStyle = {
        width: "100%",
        ...style,
        "--vs-content-max": `${contentMaxWidth}px`,
        // 4vw is gutter.fluid in the config.
        "--vs-gutter": `clamp(${BRAND.gutterMin}px, 4vw, ${BRAND.gutterMax}px)`,
        [`--${P}-background`]: colors.background,
        [`--${P}-text`]: colors.text,
        [`--${P}-accent`]: colors.accent,
        [`--${P}-accent-text`]: colors.accentText,
    } as React.CSSProperties

    return (
        <section
            className={isCanvas ? `${P}-root` : `${P}-root ${P}-animate`}
            data-vs="fit"
            style={rootStyle}
        >
            {/* Injected raw: a server render would escape the CSS text. It is a constant
                from this file, never user input. */}
            <style dangerouslySetInnerHTML={{ __html: CSS }} />
            <div className={`${P}-wrap`}>
                <div className={`${P}-container`}>
                    <div className={`${P}-grid`}>
                        <div className={`${P}-copy`}>
                            <h1 className={`${P}-headline`}>{headline}</h1>
                            <p className={`${P}-sub`}>{subheading}</p>
                            <div className={`${P}-ctas`} data-vs="above-fold">
                                <a className={`${P}-cta`} href={ctaLink || "#"}>
                                    {ctaLabel}
                                </a>
                            </div>
                        </div>
                        <div className={`${P}-stage`} data-vs="key-visual">
                            {src ? (
                                <img
                                    alt={imageAlt(image)}
                                    src={src}
                                    srcSet={imageSrcSet(image)}
                                    // The stage never exceeds half of the content column.
                                    sizes={`${Math.ceil(contentMaxWidth / 2)}px`}
                                />
                            ) : (
                                <svg aria-hidden="true" viewBox="0 0 100 100">
                                    <circle
                                        cx="50"
                                        cy="50"
                                        r="38"
                                        fill="none"
                                        stroke={colors.accent}
                                        strokeWidth="8"
                                    />
                                </svg>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}

addPropertyControls(ViewportSafeHero, {
    headline: {
        title: "Headline",
        type: ControlType.String,
        defaultValue: CONTENT_DEFAULTS.headline,
        displayTextArea: true,
    },
    subheading: {
        title: "Subheading",
        type: ControlType.String,
        defaultValue: CONTENT_DEFAULTS.subheading,
        displayTextArea: true,
    },
    ctaLabel: {
        title: "CTA label",
        type: ControlType.String,
        defaultValue: CONTENT_DEFAULTS.ctaLabel,
    },
    ctaLink: {
        title: "CTA link",
        type: ControlType.Link,
        defaultValue: CONTENT_DEFAULTS.ctaLink,
    },
    image: {
        title: "Image",
        type: ControlType.ResponsiveImage,
        description:
            "Contained in the stage, never cropped. Empty shows a placeholder ring.",
    },
    contentMaxWidth: {
        title: "Content width",
        type: ControlType.Number,
        defaultValue: BRAND.contentMaxWidth,
        min: 600,
        max: 2400,
        step: 8,
        unit: "px",
        description:
            "Width of the content column, excluding gutters. Defaults to the brand config.",
    },
    colors: {
        title: "Colors",
        type: ControlType.Object,
        controls: {
            background: {
                title: "Background",
                type: ControlType.Color,
                defaultValue: COLOR_DEFAULTS.background,
            },
            text: {
                title: "Text",
                type: ControlType.Color,
                defaultValue: COLOR_DEFAULTS.text,
            },
            accent: {
                title: "Accent",
                type: ControlType.Color,
                defaultValue: COLOR_DEFAULTS.accent,
                description: "CTA background and the placeholder ring.",
            },
            accentText: {
                title: "Accent text",
                type: ControlType.Color,
                defaultValue: COLOR_DEFAULTS.accentText,
            },
        },
    },
})
