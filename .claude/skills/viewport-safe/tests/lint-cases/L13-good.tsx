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
        const tween = gsap.to(track, {
            x: () => -(track.scrollWidth - section.clientWidth),
            ease: "none",
            scrollTrigger: {
                trigger: section,
                pin: true,
                scrub: true,
                start: "top top",
                end: () => "+=" + (track.scrollWidth - section.clientWidth),
                invalidateOnRefresh: true,
            },
        })
        // A one-shot reveal: nothing size-dependent to recompute.
        const reveal = gsap.from(track.children, {
            opacity: 0,
            y: 24,
            stagger: 0.08,
            scrollTrigger: { trigger: section, start: "top 80%", toggleActions: "play none none reverse" },
        })
        // Keyword positions are measured from the trigger on every refresh.
        const marker = ScrollTrigger.create({
            trigger: section,
            start: "top top",
            end: "bottom top",
            invalidateOnRefresh: true,
            onToggle: (self) => section.classList.toggle("is-active", self.isActive),
        })
        document.fonts.ready.then(() => ScrollTrigger.refresh())
        return () => {
            tween.kill()
            reveal.kill()
            marker.kill()
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
