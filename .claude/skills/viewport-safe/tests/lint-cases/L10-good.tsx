import * as React from "react"
import { addPropertyControls, ControlType } from "framer"
import { Canvas, useThree } from "@react-three/fiber"
import * as THREE from "three"

/** Keeps the design's horizontal field of view when the window is narrower than the design. */
function containCamera(camera: THREE.PerspectiveCamera, w: number, h: number, designFov = 35, designAspect = 1440 / 900) {
    const aspect = w / h
    camera.aspect = aspect
    camera.fov =
        aspect >= designAspect
            ? designFov
            : THREE.MathUtils.radToDeg(2 * Math.atan((Math.tan(THREE.MathUtils.degToRad(designFov) / 2) * designAspect) / aspect))
    camera.updateProjectionMatrix()
}

function ContainedCamera() {
    const { camera, size } = useThree()
    React.useEffect(() => {
        containCamera(camera as THREE.PerspectiveCamera, size.width, size.height)
    }, [camera, size.width, size.height])
    return null
}

/**
 * @vs-type fit
 * @vs-key-visual ring: height-locked -> contain camera
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight fixed
 */
export default function RingHero(props) {
    const { color, style } = props
    return (
        <section style={{ ...style, position: "relative", width: "100%", height: "100%" }}>
            <Canvas camera={{ fov: 35, position: [0, 0, 6] }} style={{ position: "absolute", inset: 0 }}>
                <ContainedCamera />
                <ambientLight intensity={0.6} />
                <mesh>
                    <torusGeometry args={[1.2, 0.18, 32, 128]} />
                    <meshStandardMaterial color={color} metalness={1} roughness={0.25} />
                </mesh>
            </Canvas>
        </section>
    )
}

addPropertyControls(RingHero, {
    color: { type: ControlType.Color, defaultValue: "#c9a45c" },
})
