import * as React from "react"
import { addPropertyControls, ControlType } from "framer"

/**
 * @vs-type fit
 * @vs-design 1440x900
 * @vs-key-visual product shot: cover (cropped on tall windows)
 *
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight fixed
 */
export default function ProductHero(props) {
    const { image, style } = props
    const canvasRef = React.useRef<HTMLCanvasElement>(null)
    return (
        <section style={{ ...style, position: "relative", width: "100%", height: "100%" }}>
            <img
                src={image?.src}
                alt=""
                style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover", // expect L9
                }}
            />
            <canvas // expect L9
                ref={canvasRef}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
            />
        </section>
    )
}

addPropertyControls(ProductHero, {
    image: { type: ControlType.ResponsiveImage },
})
