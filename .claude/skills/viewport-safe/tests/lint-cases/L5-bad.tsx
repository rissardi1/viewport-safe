import * as React from "react"
import { addPropertyControls, ControlType } from "framer"

/**
 * Full-width showreel. At 3440x1280 the 16:9 box is 1935px tall.
 *
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight auto
 */
export default function ShowreelVideo(props) {
    const { src, poster, style } = props
    return (
        <div style={{ ...style, width: "100%" }}>
            <video
                src={src}
                poster={poster}
                autoPlay
                muted
                loop
                playsInline
                style={{
                    width: "100%",
                    aspectRatio: 16 / 9, // expect L5
                    objectFit: "cover",
                    display: "block",
                }}
            />
        </div>
    )
}

addPropertyControls(ShowreelVideo, {
    src: { type: ControlType.File, allowedFileTypes: ["mp4", "webm"] },
    poster: { type: ControlType.Image },
})
