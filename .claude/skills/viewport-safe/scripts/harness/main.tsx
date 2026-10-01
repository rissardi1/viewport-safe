import * as React from "react"
import { createRoot } from "react-dom/client"
import { getPropertyDefaults } from "./framer-stub"

declare const __VS_PROPS__: string
declare const __VS_LAYOUT__: string
declare const __VS_TYPE__: string

declare global {
    interface Window {
        __VS_READY__?: boolean
        __VS_ERROR__?: string
    }
}

/** How the component's frame is sized, like the width/height settings of a Framer instance. */
function frameStyle(layout: string): React.CSSProperties {
    if (layout === "viewport") return { width: "100%", height: "100svh", position: "relative" }
    const fixed = /^(\d+)x(\d+)$/.exec(layout)
    if (fixed) return { width: Number(fixed[1]), height: Number(fixed[2]), position: "relative", margin: "0 auto" }
    return { width: "100%", position: "relative" }
}

/** Neutral filler so the component can be scrolled into and out of view. Ignored by every check. */
function Spacer({ label }: { label: string }) {
    return (
        <div
            data-vs-harness=""
            style={{
                height: "100svh",
                display: "grid",
                placeItems: "center",
                background: "repeating-linear-gradient(45deg, #f3f3f3 0 12px, #ebebeb 12px 24px)",
                color: "#999",
                font: "13px system-ui, sans-serif",
            }}
        >
            {label}
        </div>
    )
}

class Boundary extends React.Component<{ children: React.ReactNode }, { error: string | null }> {
    state = { error: null as string | null }
    static getDerivedStateFromError(e: any) {
        return { error: String(e?.stack || e) }
    }
    componentDidCatch(e: any) {
        window.__VS_ERROR__ = String(e?.stack || e)
    }
    render() {
        if (this.state.error) {
            return (
                <pre data-vs-harness="" style={{ color: "crimson", padding: 16, whiteSpace: "pre-wrap" }}>
                    {this.state.error}
                </pre>
            )
        }
        return this.props.children
    }
}

async function main() {
    const root = createRoot(document.getElementById("root")!)
    try {
        const mod: any = await import("virtual:component")
        const Component = mod.default ?? Object.values(mod).find((v) => typeof v === "function")
        if (!Component) throw new Error("The component file has no default export")
        const props = { ...getPropertyDefaults(Component), ...JSON.parse(__VS_PROPS__) }
        const layout = __VS_LAYOUT__
        const childStyle: React.CSSProperties = layout === "fill" ? { width: "100%" } : { width: "100%", height: "100%" }
        // The component starts at the top of the page (so "on load" and "above the fold" mean what they
        // mean in production); the spacer below lets it scroll out and lets scroll scenes run to 100%.
        root.render(
            <Boundary>
                <div id="vs-frame" data-vs-type={__VS_TYPE__} style={frameStyle(layout)}>
                    <Component {...props} style={childStyle} />
                </div>
                <Spacer label="page content below" />
            </Boundary>
        )
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
        await document.fonts.ready
        if (!window.__VS_ERROR__) window.__VS_READY__ = true
    } catch (e: any) {
        window.__VS_ERROR__ = String(e?.stack || e)
        root.render(
            <pre data-vs-harness="" style={{ color: "crimson", padding: 16, whiteSpace: "pre-wrap" }}>
                {window.__VS_ERROR__}
            </pre>
        )
    }
}

main()
