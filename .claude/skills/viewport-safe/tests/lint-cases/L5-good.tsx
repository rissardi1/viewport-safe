import * as React from "react"
import { addPropertyControls, ControlType } from "framer"

/**
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight auto
 */
export default function ShowreelVideo(props) {
    const { src, poster, still, style } = props
    return (
        <div style={{ ...style, width: "100%", display: "grid", gap: 32 }}>
            <video
                src={src}
                poster={poster}
                autoPlay
                muted
                loop
                playsInline
                style={{
                    width: "min(100%, calc(62svh * 16 / 9))",
                    aspectRatio: "16 / 9",
                    marginInline: "auto",
                    display: "block",
                }}
            />
            <img
                alt=""
                src={still?.src}
                style={{
                    width: "100%",
                    aspectRatio: 4 / 3,
                    maxHeight: "70svh",
                    objectFit: "contain",
                }}
            />
        </div>
    )
}

addPropertyControls(ShowreelVideo, {
    src: { type: ControlType.File, allowedFileTypes: ["mp4", "webm"] },
    poster: { type: ControlType.Image },
    still: { type: ControlType.ResponsiveImage },
})
