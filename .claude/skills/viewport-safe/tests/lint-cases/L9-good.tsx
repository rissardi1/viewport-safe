import * as React from "react"
import { addPropertyControls, ControlType } from "framer"

/**
 * @vs-type fit
 * @vs-design 1440x900
 * @vs-key-visual product shot: contain, in a box with the media's aspect ratio
 *
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight fixed
 */
export default function ProductHero(props) {
    const { backdrop, product, style } = props
    const canvasRef = React.useRef<HTMLCanvasElement>(null)
    return (
        <section style={{ ...style, position: "relative", width: "100%", height: "100%" }}>
            <img
                data-vs="bg"
                src={backdrop?.src}
                alt=""
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
            />




            <div
                data-vs="key-visual"
                style={{ width: "min(100%, calc(62svh * 16 / 9))", aspectRatio: "16 / 9", margin: "auto" }}
            >
                <img src={product?.src} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            </div>




            <canvas data-vs="bg" ref={canvasRef} style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />
        </section>
    )
}

addPropertyControls(ProductHero, {
    backdrop: { type: ControlType.ResponsiveImage },
    product: { type: ControlType.ResponsiveImage },
})
