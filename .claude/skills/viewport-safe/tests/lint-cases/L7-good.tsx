import * as React from "react"
import { addPropertyControls, ControlType } from "framer"

const DESIGN_W = 1440
const DESIGN_H = 900

const useIsoLayoutEffect = typeof window === "undefined" ? React.useEffect : React.useLayoutEffect

function useBox<T extends HTMLElement>() {
    const ref = React.useRef<T>(null)
    const [box, setBox] = React.useState<{ w: number; h: number } | null>(null)
    useIsoLayoutEffect(() => {
        const el = ref.current
        if (!el) return
        const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }))
        ro.observe(el)
        return () => ro.disconnect()
    }, [])
    return [ref, box] as const
}

/**
 * @vs-type fit
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight fixed
 */
export default function ScaledArtboard(props) {
    const { children, style } = props
    const [ref, box] = useBox<HTMLDivElement>()
    // Render at scale 1 until measured, so the static render is never blank.
    const scale = box && box.w > 0 && box.h > 0 ? Math.min(box.w / DESIGN_W, box.h / DESIGN_H) : 1
    return (
        <section ref={ref} style={{ ...style, width: "100%", height: "100%", display: "grid", placeItems: "center" }}>
            <div style={{ width: DESIGN_W, height: DESIGN_H, transform: `scale(${scale})` }}>{children}</div>
        </section>
    )
}

addPropertyControls(ScaledArtboard, {
    children: { type: ControlType.ComponentInstance },
})
