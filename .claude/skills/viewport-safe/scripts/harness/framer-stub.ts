// Minimal stand-in for the "framer" package so code components render outside Framer.
// Records property controls so the harness can render components with their default props.
export * from "framer-motion"

type Controls = Record<string, any>

const controlsByComponent = new WeakMap<object, Controls>()

export function addPropertyControls(component: any, controls: Controls) {
    if (component) controlsByComponent.set(component, { ...(controlsByComponent.get(component) || {}), ...controls })
}

export function getPropertyControls(component: any): Controls {
    return controlsByComponent.get(component) || {}
}

function defaultsOf(controls: Controls): Record<string, any> {
    const out: Record<string, any> = {}
    for (const [key, control] of Object.entries(controls)) {
        if (!control || typeof control !== "object") continue
        if (control.type === "Object" && control.controls) {
            out[key] = { ...defaultsOf(control.controls), ...(control.defaultValue || {}) }
        } else if ("defaultValue" in control) {
            out[key] = control.defaultValue
        } else if (control.type === "Array") {
            out[key] = []
        }
    }
    return out
}

/** Default props from the component's property controls. */
export function getPropertyDefaults(component: any): Record<string, any> {
    return defaultsOf(getPropertyControls(component))
}

/** ControlType.Number === "Number", ControlType.Object === "Object", and so on. */
export const ControlType: any = new Proxy({}, { get: (_target, key) => (typeof key === "string" ? key : undefined) })

export const RenderTarget = {
    canvas: "CANVAS",
    export: "EXPORT",
    thumbnail: "THUMBNAIL",
    preview: "PREVIEW",
    current: () => "PREVIEW",
    hasRestrictions: () => false,
}

export const useIsStaticRenderer = () => false
export const useIsOnFramerCanvas = () => false

const injected = new Set<string>()

/** Framer's withCSS: injects the CSS once and returns the component unchanged. */
export function withCSS<T>(component: T, css: string | string[]): T {
    const text = Array.isArray(css) ? css.join("\n") : css
    if (typeof document !== "undefined" && !injected.has(text)) {
        injected.add(text)
        const style = document.createElement("style")
        style.textContent = text
        document.head.appendChild(style)
    }
    return component
}
