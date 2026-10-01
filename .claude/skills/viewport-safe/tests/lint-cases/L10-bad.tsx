import * as React from "react"
import { addPropertyControls, ControlType } from "framer"
import { Canvas } from "@react-three/fiber" // expect L10

function Ring({ color }) {
    return (
        <mesh rotation={[0.4, 0, 0]}>
            <torusGeometry args={[1.2, 0.18, 32, 128]} />
            <meshStandardMaterial color={color} metalness={1} roughness={0.25} />
        </mesh>
    )
}

/**
 * Gold ring hero. The default camera keeps the vertical field of view, so the ring's sides
 * crop on windows narrower than 16:10.
 *
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight fixed
 */
export default function RingHero(props) {
    const { color, style } = props
    return (
        <section style={{ ...style, position: "relative", width: "100%", height: "100%" }}>
            <Canvas camera={{ fov: 35, position: [0, 0, 6] }} style={{ position: "absolute", inset: 0 }}>
                <ambientLight intensity={0.6} />
                <directionalLight position={[3, 4, 5]} />
                <Ring color={color} />
            </Canvas>
        </section>
    )
}

addPropertyControls(RingHero, {
    color: { type: ControlType.Color, defaultValue: "#c9a45c" },
})
