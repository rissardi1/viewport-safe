// Vite config for the viewport-safe harness. viewport-audit.mjs sets:
//   VS_COMPONENT  absolute path of the component file to render
//   VS_PROPS      JSON props merged over the property-control defaults
//   VS_LAYOUT     fill | viewport | <W>x<H>
//   VS_TYPE       grow | fit | scroll-scene (from the @vs-type header)
import { defineConfig, type Plugin } from "vite"
import react from "@vitejs/plugin-react"
import path from "node:path"
import { existsSync } from "node:fs"
import { fileURLToPath } from "node:url"

const harnessDir = path.dirname(fileURLToPath(import.meta.url))
const component = process.env.VS_COMPONENT
    ? path.resolve(process.env.VS_COMPONENT)
    : path.join(harnessDir, "placeholder.tsx")
const componentDir = path.dirname(component)

/**
 * Components live outside the harness (in a client repo or tests/fixtures), so Node resolution
 * would not find the harness node_modules. Re-resolve their bare imports as if they were
 * imported from main.tsx.
 */
function resolveFromHarness(): Plugin {
    return {
        name: "vs-resolve-from-harness",
        enforce: "pre",
        async resolveId(source, importer, options) {
            if (!importer || source.startsWith(".") || source.startsWith("/") || source.startsWith("\0")) return null
            if (/^[a-z][a-z0-9+.-]*:/i.test(source)) return null // virtual:, https:, node:
            if (importer.includes(`${path.sep}node_modules${path.sep}`) || importer.startsWith(harnessDir)) return null
            return this.resolve(source, path.join(harnessDir, "main.tsx"), { ...options, skipSelf: true })
        },
    }
}

const optional = ["three", "@react-three/fiber", "gsap", "gsap/ScrollTrigger", "framer-motion"].filter((dep) =>
    existsSync(path.join(harnessDir, "node_modules", dep.split("/")[0]))
)

export default defineConfig({
    root: harnessDir,
    plugins: [resolveFromHarness(), react()],
    resolve: {
        alias: [
            { find: /^virtual:component$/, replacement: component },
            { find: /^framer$/, replacement: path.join(harnessDir, "framer-stub.ts") },
        ],
        dedupe: ["react", "react-dom", "framer-motion", "gsap", "three", "@react-three/fiber"],
    },
    define: {
        __VS_PROPS__: JSON.stringify(process.env.VS_PROPS || "{}"),
        __VS_LAYOUT__: JSON.stringify(process.env.VS_LAYOUT || "fill"),
        __VS_TYPE__: JSON.stringify(process.env.VS_TYPE || "grow"),
    },
    server: {
        hmr: false,
        fs: { strict: true, allow: [harnessDir, componentDir] },
    },
    optimizeDeps: {
        entries: ["main.tsx", component],
        include: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime", ...optional],
    },
    logLevel: "warn",
    clearScreen: false,
})
