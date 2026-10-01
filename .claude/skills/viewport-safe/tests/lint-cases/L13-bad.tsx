import * as React from "react"
import { addPropertyControls, ControlType } from "framer"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(ScrollTrigger)

/**
 * @vs-type scroll-scene
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight auto
 */
export default function HorizontalGallery(props) {
    const { cards, style } = props
    const sectionRef = React.useRef<HTMLDivElement>(null)
    const trackRef = React.useRef<HTMLDivElement>(null)

    React.useLayoutEffect(() => {
        const section = sectionRef.current
        const track = trackRef.current
        if (!section || !track) return
        // Measured once: wrong as soon as the window is resized.
        const distance = track.scrollWidth - section.clientWidth
        const tween = gsap.to(track, {
            x: -distance,
            ease: "none",
            scrollTrigger: { // expect L13
                trigger: section,
                pin: true,
                scrub: true,
                end: `+=${distance}`, // expect L13
            },
        })
        const pin = ScrollTrigger.create({ // expect L13
            trigger: section,
            start: "top top",
            end: "+=" + track.scrollWidth, // expect L13
        })
        return () => {
            tween.kill()
            pin.kill()
        }
    }, [])

    return (
        <section ref={sectionRef} style={{ ...style, width: "100%", overflow: "hidden" }}>
            <div ref={trackRef} style={{ display: "flex", gap: 24, width: "max-content" }}>
                {cards}
            </div>
        </section>
    )
}

addPropertyControls(HorizontalGallery, {
    cards: { type: ControlType.Array, control: { type: ControlType.ComponentInstance } },
})
