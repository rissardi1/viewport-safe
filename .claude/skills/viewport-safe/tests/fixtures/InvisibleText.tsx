import * as React from "react"
import { addPropertyControls, ControlType } from "framer"

/**
 * @vs-type grow
 * @vs-design 1440x900
 * @vs-config tests/fixtures/viewport-safe.config.json
 *
 * Fixture: cream text on a section whose dark background declaration is invalid (a percentage inside calc() as a
 * circle radius), so the browser drops the whole declaration and the page shows white. This happened in the eval-6
 * run and every other check passed. C12 must report the text as nearly invisible.
 */

interface Props {
    headline: string
    style?: React.CSSProperties
}

const CSS = `
.it-root { box-sizing: border-box; padding: 96px 64px; color: #f4ecd8;
  background: radial-gradient(circle calc(50% + 10px) at 50% 50%, #0d2a22, #050d0a); }
.it-h { margin: 0; font: 400 96px/1.05 Georgia, serif; max-width: 1000px; }
.it-p { margin: 24px 0 0; font: 20px/1.5 system-ui, sans-serif; max-width: 560px; }
`

/**
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 1440
 * @framerIntrinsicHeight 500
 */
export default function InvisibleText(props: Props) {
    const { headline, style } = props
    return (
        <section className="it-root" style={style}>
            <style>{CSS}</style>
            <h1 className="it-h">{headline}</h1>
            <p className="it-p">You cannot read this, and no other check notices.</p>
        </section>
    )
}

InvisibleText.defaultProps = { headline: "Real gold. Held in your name." }

addPropertyControls(InvisibleText, {
    headline: { type: ControlType.String, title: "Headline", defaultValue: "Real gold. Held in your name." },
})
