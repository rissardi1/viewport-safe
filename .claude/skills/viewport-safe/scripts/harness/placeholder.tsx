// Rendered when the harness is started without VS_COMPONENT (e.g. `npm run dev` by hand).
export default function Placeholder(props: { style?: React.CSSProperties }) {
    return (
        <div style={{ ...props.style, padding: 48, font: "16px system-ui" }}>
            Set VS_COMPONENT to a component path, or run viewport-audit.mjs --component &lt;file&gt;.
        </div>
    )
}
