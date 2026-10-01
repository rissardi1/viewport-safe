import * as React from "react"
import { addPropertyControls, ControlType } from "framer"

/**
 * Unicorn Studio scene inside an aspect-locked stage (pattern 6.3), so the height-locked scene
 * scales by the tighter axis and is never cropped.
 *
 * @vs-type fit
 * @vs-key-visual ring scene: height-locked -> aspect-locked stage
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight fixed
 */
export default function SceneHero(props) {
    const { projectId, sceneBg, style } = props
    React.useEffect(() => {
        const script = document.createElement("script")
        script.src = "https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v1.4.2/dist/unicornStudio.umd.js"
        script.onload = () => (window as any).UnicornStudio?.init()
        document.head.appendChild(script)
        return () => script.remove()
    }, [])
    return (
        <section style={{ ...style, minHeight: "100svh", display: "grid", placeItems: "center", background: sceneBg }}>
            <div
                style={{
                    width: "min(100%, calc(100svh * 1440 / 900))",
                    aspectRatio: "1440 / 900",
                    position: "relative",
                }}
            >
                <div data-us-project={projectId} style={{ position: "absolute", inset: 0 }} />
            </div>
        </section>
    )
}

addPropertyControls(SceneHero, {
    projectId: { type: ControlType.String, defaultValue: "" },
    sceneBg: { type: ControlType.Color, defaultValue: "#0b0b0c" },
})
