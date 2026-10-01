#!/usr/bin/env node
// viewport-safe: static sizing lint (L1-L16). Node 22+, no dependencies.
//
//   node lint-sizing.mjs <file-or-dir> [...] [--config <path>] [--json] [--quiet]
//
// Scans .tsx .ts .jsx .js .css (directories recursively; node_modules, dist and .git are skipped):
//   - CSS files;
//   - CSS inside JS strings and template literals (<style>{`...`}</style>, withCSS arrays, css`...`);
//   - JS style objects (style={{ fontSize: "8vw" }}, fontSize: `${x}vw`, size + "vw").
// camelCase JS keys are normalised to kebab-case. "Same rule" = the innermost {...} block holding the
// declaration (a CSS rule or a JS object literal). Simple `const X = "..."` string constants are
// resolved when a style value refers to them (height: FULL_HEIGHT).
//
// Suppression (a reason is required): on the same line, or in the comment line(s) directly above,
//   // vs-ignore L9: full-bleed texture, no key content
//   /* vs-ignore L6: pinned stage, content sized from the measured box */
//   {/* vs-ignore L8, L12: reason */}
// Justified findings are still listed (justified: true) but do not affect the exit code.
//
// Output: one line per finding `path:line  L<n>  rule <r>  <severity>  <message>`, then a summary.
//   --json   prints { files, findings: [{ file, line, id, rule, severity, message, justified,
//            justification }], errors, warnings, justified } (counts exclude justified findings)
//   --quiet  prints only unjustified errors
// Exit code: 1 if any unjustified error, 0 otherwise, 2 on usage errors.

import fs from "node:fs"
import path from "node:path"
import process from "node:process"

// ---------------------------------------------------------------------------------------------
// Rule table (plan section 10.1)
// ---------------------------------------------------------------------------------------------

const RULES = {
    L1: { rule: "2", severity: "error" },
    L2: { rule: "2,3", severity: "error" },
    L3: { rule: "3", severity: "error" },
    L4: { rule: "3", severity: "error" },
    L5: { rule: "4", severity: "error" },
    L6: { rule: "8", severity: "error" },
    L7: { rule: "9", severity: "error" },
    L8: { rule: "13", severity: "warning" },
    L9: { rule: "5", severity: "warning" },
    L10: { rule: "6", severity: "warning" },
    L11: { rule: "4", severity: "warning" },
    L12: { rule: "2", severity: "warning" },
    L13: { rule: "9", severity: "warning" },
    L14: { rule: "Framer", severity: "warning" },
    L15: { rule: "2,Framer", severity: "warning" },
    L16: { rule: "7", severity: "warning" },
}

const EXTENSIONS = new Set([".tsx", ".ts", ".jsx", ".js", ".css"])
const SKIP_DIRS = new Set(["node_modules", "dist", ".git"])
const MAX_FILE_BYTES = 3 * 1024 * 1024

// Reference windows used in messages.
const TALL = [1720, 1280] // uw-half, primary target
const WIDE = [3440, 1280] // uw-full
const SHORT = [1536, 730] // laptop-125

// Placeholder number for interpolated / computed JS values (`${x}vw` -> "1.23456vw").
const PH = "1.23456"

// ---------------------------------------------------------------------------------------------
// Units and CSS value helpers
// ---------------------------------------------------------------------------------------------

const H_UNITS = new Set(["vh", "svh", "dvh", "lvh"])
const UNIT_RE = /(?<![\w.#])(\d*\.?\d+)(svh|dvh|lvh|vh|svw|dvw|lvw|vw|cqi|cqw)(?![\w-])/g
const VSU_RE = /var\(\s*--vs-u\s*[,)]/
const BOUND_RE = /\b(?:clamp|min|max)\(/i
const V100W_RE = /(?<![\w.])100(?:svw|dvw|lvw|vw)(?![\w-])/

function unitHits(text) {
    const out = []
    for (const m of text.matchAll(UNIT_RE)) {
        out.push({ index: m.index, unit: m[2], axis: H_UNITS.has(m[2]) ? "h" : "w" })
    }
    return out
}
const hasAxis = (text, axis) => unitHits(text).some((h) => h.axis === axis)

/** Every function call in a CSS value: { name, start (index of "("), end (index of ")") }. */
function callRanges(text) {
    const calls = []
    const stack = []
    for (let i = 0; i < text.length; i++) {
        const c = text[i]
        if (c === "(") {
            let j = i
            while (j > 0 && /[\w-]/.test(text[j - 1])) j--
            stack.push({ name: text.slice(j, i).toLowerCase(), start: i, end: text.length })
        } else if (c === ")") {
            const call = stack.pop()
            if (call) calls.push({ ...call, end: i })
        }
    }
    return calls.concat(stack)
}
const enclosing = (calls, idx) => calls.filter((c) => c.start < idx && idx < c.end)
const argsOf = (text, call) => text.slice(call.start + 1, call.end)
const isMinOrClamp = (c) => c.name === "min" || c.name === "clamp"

/** Evaluates a simple CSS length expression to px for one window size, or null. */
function evaluate(text, W, H) {
    if (!text || text.includes(PH)) return null
    let t = text.replace(UNIT_RE, (m, n, u) => String((parseFloat(n) * (H_UNITS.has(u) ? H : W)) / 100))
    t = t.replace(/(\d*\.?\d+)px\b/g, "$1").replace(/(\d*\.?\d+)rem\b/g, (m, n) => String(parseFloat(n) * 16))
    const toks = t.match(/\d*\.?\d+(?:e[+-]?\d+)?|[a-z][a-z-]*\(|[()+\-*/,]|\S+/gi) || []
    let p = 0
    const peek = () => toks[p]
    const next = () => toks[p++]
    const expr = () => {
        let v = term()
        while (peek() === "+" || peek() === "-") v = next() === "+" ? v + term() : v - term()
        return v
    }
    const term = () => {
        let v = factor()
        while (peek() === "*" || peek() === "/") v = next() === "*" ? v * factor() : v / factor()
        return v
    }
    const factor = () => {
        const tok = next()
        if (tok === undefined) throw new Error("end")
        if (tok === "-") return -factor()
        if (tok === "+") return factor()
        if (/^\d*\.?\d+(?:e[+-]?\d+)?$/i.test(tok)) return parseFloat(tok)
        const fn = tok.toLowerCase()
        if (tok === "(" || fn === "calc(") {
            const v = expr()
            if (next() !== ")") throw new Error(")")
            return v
        }
        if (fn === "min(" || fn === "max(" || fn === "clamp(") {
            const args = [expr()]
            while (peek() === ",") {
                next()
                args.push(expr())
            }
            if (next() !== ")") throw new Error(")")
            if (fn === "min(") return Math.min(...args)
            if (fn === "max(") return Math.max(...args)
            if (args.length !== 3) throw new Error("clamp")
            return Math.max(args[0], Math.min(args[1], args[2]))
        }
        throw new Error("token")
    }
    try {
        const v = expr()
        return p === toks.length && Number.isFinite(v) ? Math.round(v) : null
    } catch {
        return null
    }
}

function show(text, max = 48) {
    const t = text.split(PH).join("${…}").replace(/\s+/g, " ").trim()
    return t.length > max ? t.slice(0, max - 1) + "…" : t
}

function parseRatio(decl) {
    const cands = decl.branches.map((b) => b.text).concat([decl.raw || ""])
    for (const c of cands) {
        const m = /^\s*["'`]?\s*(\d*\.?\d+)\s*(?:\/\s*(\d*\.?\d+))?\s*["'`]?\s*$/.exec(c)
        if (m) return { value: parseFloat(m[1]) / (m[2] ? parseFloat(m[2]) : 1), text: m[2] ? `${m[1]} / ${m[2]}` : m[1] }
    }
    return null
}

/** Splits a CSS value at top-level whitespace (outside parentheses). */
function topLevelTokens(text) {
    const out = []
    let depth = 0
    let cur = ""
    for (const c of text.trim()) {
        if (c === "(") depth++
        else if (c === ")") depth--
        if (/\s/.test(c) && depth === 0) {
            if (cur) out.push(cur)
            cur = ""
        } else cur += c
    }
    if (cur) out.push(cur)
    return out
}

// ---------------------------------------------------------------------------------------------
// CSS property names (JS keys are only analysed when they name a CSS property)
// ---------------------------------------------------------------------------------------------

const CSS_PROP_RE = new RegExp(
    "^(?:" +
        [
            "width", "height", "(?:min|max)-(?:width|height|inline-size|block-size)", "inline-size", "block-size",
            "margin(?:-[a-z-]+)?", "padding(?:-[a-z-]+)?", "gap", "row-gap", "column-gap", "grid(?:-[a-z-]+)?",
            "top", "right", "bottom", "left", "inset(?:-[a-z-]+)?", "font(?:-[a-z-]+)?", "line-height",
            "letter-spacing", "word-spacing", "text-[a-z-]+", "flex(?:-[a-z-]+)?", "align-[a-z-]+",
            "justify-[a-z-]+", "place-[a-z-]+", "aspect-ratio", "object-fit", "object-position",
            "overflow(?:-[a-z-]+)?", "position", "z-index", "display", "visibility", "opacity", "box-sizing",
            "box-shadow", "transform(?:-[a-z-]+)?", "translate", "rotate", "perspective(?:-[a-z-]+)?",
            "border(?:-[a-z-]+)?", "outline(?:-[a-z-]+)?", "background(?:-[a-z-]+)?", "mask(?:-[a-z-]+)?",
            "filter", "backdrop-filter", "clip-path", "container(?:-[a-z-]+)?", "scroll-[a-z-]+", "columns",
            "column-[a-z-]+", "shape-[a-z-]+", "offset-[a-z-]+", "contain(?:-[a-z-]+)?",
        ].join("|") +
        ")$"
)

function isCssProp(prop) {
    if (prop.startsWith("--")) return true
    return CSS_PROP_RE.test(prop.replace(/^-(?:webkit|moz|ms|o)-/, ""))
}

function toKebab(key) {
    if (key.startsWith("--")) return key
    if (key.includes("-")) return key.toLowerCase()
    let k = key.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase())
    if (k.startsWith("ms-")) k = "-" + k
    return k
}

// ---------------------------------------------------------------------------------------------
// JS scanner: marks every character as code, comment or string, and records literals
// ---------------------------------------------------------------------------------------------

const CODE = 0
const COMMENT = 1
const STR = 2
const REGEX_PREV = "(,=:[!&|?{;+-*%~^"
const REGEX_WORDS = new Set(["return", "typeof", "case", "do", "else", "in", "of", "void", "yield", "await", "delete", "instanceof", "new"])

function scanJs(src) {
    const n = src.length
    const mask = new Uint8Array(n)
    const literals = []
    const stack = [{ type: "code", depth: 0, expr: null }]
    let lastSig = -1
    let i = 0
    while (i < n) {
        const top = stack[stack.length - 1]
        const ch = src[i]
        if (top.type === "tpl") {
            if (ch === "\\") {
                mask[i] = STR
                if (i + 1 < n) mask[i + 1] = STR
                i += 2
                continue
            }
            if (ch === "`") {
                mask[i] = STR
                top.lit.parts.push({ type: "text", start: top.partStart, end: i })
                top.lit.end = i + 1
                stack.pop()
                lastSig = i
                i++
                continue
            }
            if (ch === "$" && src[i + 1] === "{") {
                mask[i] = STR
                mask[i + 1] = STR
                top.lit.parts.push({ type: "text", start: top.partStart, end: i })
                const expr = { type: "expr", start: i + 2, end: n }
                top.lit.parts.push(expr)
                stack.push({ type: "code", depth: 0, expr })
                lastSig = i + 1
                i += 2
                continue
            }
            mask[i] = STR
            i++
            continue
        }
        if (ch === "/" && src[i + 1] === "/") {
            while (i < n && src[i] !== "\n") mask[i++] = COMMENT
            continue
        }
        if (ch === "/" && src[i + 1] === "*") {
            const close = src.indexOf("*/", i + 2)
            const stop = close < 0 ? n : close + 2
            for (; i < stop; i++) if (src[i] !== "\n") mask[i] = COMMENT
            continue
        }
        if (ch === '"' || ch === "'") {
            // JS quotes cannot span lines: an unmatched quote on its line is JSX text (Don't).
            let j = i + 1
            let ok = false
            while (j < n) {
                const c = src[j]
                if (c === "\\") {
                    j += 2
                    continue
                }
                if (c === "\n") break
                if (c === ch) {
                    ok = true
                    break
                }
                j++
            }
            if (ok) {
                for (let k = i; k <= j; k++) mask[k] = STR
                literals.push({ kind: ch, start: i, end: j + 1, parts: [{ type: "text", start: i + 1, end: j }] })
                lastSig = j
                i = j + 1
                continue
            }
            lastSig = i
            i++
            continue
        }
        if (ch === "`") {
            mask[i] = STR
            const lit = { kind: "`", start: i, end: n, parts: [] }
            literals.push(lit)
            stack.push({ type: "tpl", lit, partStart: i + 1 })
            i++
            continue
        }
        if (ch === "/") {
            const prev = lastSig >= 0 ? src[lastSig] : ""
            let regexOk = lastSig < 0 || REGEX_PREV.includes(prev)
            if (!regexOk && /[A-Za-z_$]/.test(prev)) {
                let s = lastSig
                while (s > 0 && /[\w$]/.test(src[s - 1])) s--
                regexOk = REGEX_WORDS.has(src.slice(s, lastSig + 1))
            }
            if (regexOk) {
                let j = i + 1
                let inClass = false
                let found = -1
                while (j < n && src[j] !== "\n") {
                    const c = src[j]
                    if (c === "\\") {
                        j += 2
                        continue
                    }
                    if (c === "[") inClass = true
                    else if (c === "]") inClass = false
                    else if (c === "/" && !inClass) {
                        found = j
                        break
                    }
                    j++
                }
                if (found > i + 1) {
                    let end = found + 1
                    while (end < n && /[a-z]/i.test(src[end])) end++
                    for (let k = i; k < end; k++) mask[k] = STR
                    lastSig = end - 1
                    i = end
                    continue
                }
            }
        }
        if (ch === "{") top.depth++
        else if (ch === "}") {
            if (top.expr && top.depth === 0) {
                mask[i] = STR
                top.expr.end = i
                stack.pop()
                stack[stack.length - 1].partStart = i + 1
                lastSig = i
                i++
                continue
            }
            top.depth--
        }
        if (ch !== " " && ch !== "\t" && ch !== "\n" && ch !== "\r") lastSig = i
        i++
    }
    for (const frame of stack) {
        if (frame.type === "tpl" && frame.lit.end === n) frame.lit.parts.push({ type: "text", start: frame.partStart, end: n })
    }
    return { mask, literals }
}

// ---------------------------------------------------------------------------------------------
// File context
// ---------------------------------------------------------------------------------------------

function lineStarts(src) {
    const starts = [0]
    for (let i = 0; i < src.length; i++) if (src[i] === "\n") starts.push(i + 1)
    return starts
}

function lineOf(ctx, off) {
    const s = ctx.starts
    let lo = 0
    let hi = s.length - 1
    while (lo < hi) {
        const mid = (lo + hi + 1) >> 1
        if (s[mid] <= off) lo = mid
        else hi = mid - 1
    }
    return lo + 1
}

function addDecl(ctx, decl) {
    ctx.decls.push(decl)
    decl.block.decls.push(decl)
}

function newBlock(ctx, kind, line) {
    const block = { id: ctx.blocks.length + 1, kind, line, decls: [], spreads: [] }
    ctx.blocks.push(block)
    return block
}

// --- literals and constants ------------------------------------------------------------------

function literalText(ctx, lit, depth = 0) {
    if (depth === 0 && ctx.litCache.has(lit)) return ctx.litCache.get(lit)
    const { src } = ctx
    let out = ""
    if (lit.kind !== "`") out = src.slice(lit.parts[0].start, lit.parts[0].end)
    else {
        for (const part of lit.parts) {
            if (part.type === "text") out += src.slice(part.start, part.end)
            else {
                const expr = src.slice(part.start, part.end)
                const newlines = expr.replace(/[^\n]/g, "") // keep line numbers of CSS-in-JS stable
                const id = expr.trim()
                let rep = null
                if (depth < 4 && /^[A-Za-z_$][\w$]*$/.test(id)) rep = resolveConst(ctx, id, depth + 1)
                out += newlines + (rep == null ? PH : rep.replace(/\r?\n/g, " "))
            }
        }
    }
    if (depth === 0) ctx.litCache.set(lit, out)
    return out
}

function resolveConst(ctx, name, depth = 1) {
    const lit = ctx.consts.get(name)
    return lit ? literalText(ctx, lit, depth) : null
}

/** `const NAME = "..."` / `const NAME = `...`` declared exactly once in the file. */
function buildConsts(ctx) {
    const { src } = ctx
    const seen = new Map()
    const re = /\b(const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=\n]+)?=(?![=>])\s*/g
    for (const m of src.matchAll(re)) {
        if (ctx.mask[m.index] !== CODE) continue
        const at = m.index + m[0].length
        const lit = m[1] === "const" ? ctx.litByStart.get(at) : null
        const simple = lit && /^[ \t]*(?:as\s+const[ \t]*)?(?:;|\r?\n|\)|$)/.test(src.slice(lit.end, lit.end + 40))
        if (!seen.has(m[2])) seen.set(m[2], [])
        seen.get(m[2]).push(simple ? lit : null)
    }
    const out = new Map()
    for (const [name, list] of seen) if (list.length === 1 && list[0]) out.set(name, list[0])
    return out
}

// --- walking JS ranges while skipping literals ------------------------------------------------

function isWsOrComment(ctx, i) {
    return ctx.mask[i] === COMMENT || /\s/.test(ctx.src[i])
}

function trimRange(ctx, a, b) {
    while (a < b && isWsOrComment(ctx, a)) a++
    while (b > a && isWsOrComment(ctx, b - 1)) b--
    return [a, b]
}

/** Splits [s, e) at depth-0 code operators, skipping literals. */
function splitTop(ctx, s, e, ops) {
    const { src, mask } = ctx
    const out = []
    let depth = 0
    let start = s
    for (let i = s; i < e; i++) {
        const lit = ctx.litByStart.get(i)
        if (lit) {
            i = lit.end - 1
            continue
        }
        if (mask[i] !== CODE) continue
        const c = src[i]
        if (c === "(" || c === "[" || c === "{") {
            depth++
            continue
        }
        if (c === ")" || c === "]" || c === "}") {
            depth--
            continue
        }
        if (depth !== 0) continue
        for (const op of ops) {
            if (!src.startsWith(op, i)) continue
            if (op === "?" && ((src[i + 1] === "." && !/\d/.test(src[i + 2] || "")) || src[i + 1] === "?")) continue
            if (op === ":" && src[i + 1] === ":") continue
            if (op === "+" && (src[i + 1] === "+" || src[i + 1] === "=" || src[i - 1] === "+")) continue
            out.push([start, i])
            start = i + op.length
            i += op.length - 1
            break
        }
    }
    out.push([start, e])
    return out
}

function closeOf(ctx, open) {
    const { src, mask } = ctx
    let depth = 0
    for (let i = open; i < src.length; i++) {
        const lit = ctx.litByStart.get(i)
        if (lit) {
            i = lit.end - 1
            continue
        }
        if (mask[i] !== CODE) continue
        const c = src[i]
        if (c === "(" || c === "[" || c === "{") depth++
        else if (c === ")" || c === "]" || c === "}") {
            depth--
            if (depth === 0) return i
        }
    }
    return -1
}

// --- JS style values -> analysable branches ----------------------------------------------------

function valueBranches(ctx, s, e, guard = 0) {
    ;[s, e] = trimRange(ctx, s, e)
    if (s >= e || guard > 12) return []
    const { src, mask } = ctx
    if (src[s] === "{" && mask[s] === CODE) return [] // nested object: analysed as its own block
    if (/^(?:function\b|async\b)/.test(src.slice(s, s + 9))) return []
    if (splitTop(ctx, s, e, ["=>"]).length > 1) return [] // arrow function
    if ((src[s] === "(" || src[s] === "[") && mask[s] === CODE && closeOf(ctx, s) === e - 1) {
        if (src[s] === "(") return valueBranches(ctx, s + 1, e - 1, guard + 1)
        return splitTop(ctx, s + 1, e - 1, [","]).flatMap(([a, b]) => valueBranches(ctx, a, b, guard + 1))
    }
    const parts = splitTop(ctx, s, e, ["??", "||", "&&", "?", ":"])
    if (parts.length > 1) return parts.flatMap(([a, b]) => valueBranches(ctx, a, b, guard + 1))
    const branch = buildBranch(ctx, s, e)
    return branch ? [branch] : []
}

function buildBranch(ctx, s, e) {
    let text = ""
    let hasString = false
    for (let [a, b] of splitTop(ctx, s, e, ["+"])) {
        ;[a, b] = trimRange(ctx, a, b)
        if (a >= b) continue
        const lit = ctx.litByStart.get(a)
        if (lit && (lit.end === b || /^\s+as\s+const\s*$/.test(ctx.src.slice(lit.end, b)))) {
            text += literalText(ctx, lit)
            hasString = true
            continue
        }
        const word = ctx.src.slice(a, b)
        if (/^[A-Za-z_$][\w$]*$/.test(word)) {
            const resolved = resolveConst(ctx, word)
            if (resolved != null) {
                text += resolved
                hasString = true
                continue
            }
        }
        text += PH
    }
    return hasString ? { text } : null
}

// --- JS blocks -----------------------------------------------------------------------------

function pairBraces(ctx) {
    const pairs = []
    const stack = []
    const { src, mask } = ctx
    for (let i = 0; i < src.length; i++) {
        if (mask[i] !== CODE) continue
        if (src[i] === "{") stack.push(i)
        else if (src[i] === "}") {
            const open = stack.pop()
            if (open !== undefined) pairs.push([open, i])
        }
    }
    return pairs
}

function extractJsBlocks(ctx) {
    const { src, mask } = ctx
    for (const [open, close] of ctx.pairs) {
        const block = newBlock(ctx, "js", lineOf(ctx, open))
        block.open = open
        block.close = close
        let depth = 0
        let segStart = open + 1
        const segs = []
        for (let i = open + 1; i < close; i++) {
            const lit = ctx.litByStart.get(i)
            if (lit) {
                i = lit.end - 1
                continue
            }
            if (mask[i] !== CODE) continue
            const c = src[i]
            if (c === "(" || c === "[" || c === "{") depth++
            else if (c === ")" || c === "]" || c === "}") depth--
            else if (depth === 0 && (c === "," || c === ";")) {
                segs.push([segStart, i])
                segStart = i + 1
            }
        }
        segs.push([segStart, close])
        for (const [s, e] of segs) parseEntry(ctx, block, s, e)
    }
}

function parseEntry(ctx, block, s, e) {
    const { src, mask } = ctx
    let p = s
    while (p < e && isWsOrComment(ctx, p)) p++
    if (p >= e) return
    if (mask[p] === CODE && src.startsWith("...", p)) {
        block.spreads.push(src.slice(p + 3, e).replace(/\s+/g, ""))
        return
    }
    let key
    let q
    const lit = ctx.litByStart.get(p)
    if (lit && lit.kind !== "`") {
        key = src.slice(lit.parts[0].start, lit.parts[0].end)
        q = lit.end
    } else {
        const re = /[A-Za-z_$][\w$]*/y
        re.lastIndex = p
        const m = re.exec(src)
        if (!m || mask[p] !== CODE) return
        key = m[0]
        q = p + key.length
    }
    while (q < e && (src[q] === " " || src[q] === "\t")) q++
    if (src[q] !== ":" || mask[q] !== CODE || src[q + 1] === ":") return
    const prop = toKebab(key)
    if (!isCssProp(prop)) return
    addDecl(ctx, {
        prop,
        line: lineOf(ctx, p),
        block,
        branches: valueBranches(ctx, q + 1, e),
        raw: src.slice(q + 1, e).trim(),
    })
}

// --- CSS text (CSS files and CSS inside JS literals) --------------------------------------------

function looksLikeCss(text) {
    if (!text.includes("{") || !text.includes("}")) return false
    for (const m of text.matchAll(/(?:^|[{;\s])(-{0,2}[A-Za-z][\w-]*)\s*:\s*[^;{}]+[;}]/g)) {
        const prop = m[1].startsWith("--") ? m[1] : m[1].toLowerCase()
        if (isCssProp(prop)) return true
    }
    return false
}

function blankCssComments(text) {
    return text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
}

function parseCss(ctx, text, baseLine) {
    const t = blankCssComments(text)
    const newlines = []
    for (let i = 0; i < t.length; i++) if (t[i] === "\n") newlines.push(i)
    const lineAt = (off) => {
        let lo = 0
        let hi = newlines.length
        while (lo < hi) {
            const mid = (lo + hi) >> 1
            if (newlines[mid] < off) lo = mid + 1
            else hi = mid
        }
        return baseLine + lo
    }
    const root = { root: true }
    const stack = [root]
    let segStart = 0
    let paren = 0
    const flush = (s, e) => {
        const top = stack[stack.length - 1]
        if (top === root) return
        const m = /^(\s*)(-{0,2}[A-Za-z][\w-]*)\s*:([\s\S]*)$/.exec(t.slice(s, e))
        if (!m) return
        const prop = m[2].startsWith("--") ? m[2] : m[2].toLowerCase()
        const value = m[3].replace(/!\s*important\s*$/i, "").trim()
        if (!value) return
        addDecl(ctx, { prop, line: lineAt(s + m[1].length), block: top, branches: [{ text: value }], raw: value })
    }
    for (let i = 0; i < t.length; i++) {
        const c = t[i]
        if (c === '"' || c === "'") {
            let j = i + 1
            while (j < t.length && t[j] !== c && t[j] !== "\n") j += t[j] === "\\" ? 2 : 1
            if (t[j] === c) i = j
            continue
        }
        if (c === "(") paren++
        else if (c === ")") paren = Math.max(0, paren - 1)
        if (paren > 0) continue
        if (c === "{") {
            const lead = /^\s*/.exec(t.slice(segStart, i))[0].length
            const block = newBlock(ctx, "css", lineAt(segStart + lead))
            block.prelude = t.slice(segStart, i).trim()
            stack.push(block)
            segStart = i + 1
        } else if (c === ";") {
            flush(segStart, i)
            segStart = i + 1
        } else if (c === "}") {
            flush(segStart, i)
            if (stack.length > 1) stack.pop()
            segStart = i + 1
        }
    }
}

// ---------------------------------------------------------------------------------------------
// Config (L16 and the design frame used in messages)
// ---------------------------------------------------------------------------------------------

const CONFIG_NAME = "viewport-safe.config.json"
const configDirCache = new Map()
const configFileCache = new Map()

function findConfigUp(dir) {
    let d = path.resolve(dir)
    const visited = []
    let found = null
    for (;;) {
        if (configDirCache.has(d)) {
            found = configDirCache.get(d)
            break
        }
        visited.push(d)
        const candidate = path.join(d, CONFIG_NAME)
        if (fs.existsSync(candidate)) {
            found = candidate
            break
        }
        const up = path.dirname(d)
        if (up === d) break
        d = up
    }
    for (const v of visited) configDirCache.set(v, found)
    return found
}

function loadConfig(file) {
    if (configFileCache.has(file)) return configFileCache.get(file)
    let result
    try {
        result = { file, data: JSON.parse(fs.readFileSync(file, "utf8").replace(/^﻿/, "")) }
    } catch (err) {
        result = { file, error: err.message }
    }
    configFileCache.set(file, result)
    return result
}

const BRAND_FIELDS = [
    ["contentMaxWidth", (c) => c.contentMaxWidth],
    ["gutterMin", (c) => c.gutter?.min],
    ["gutterMax", (c) => c.gutter?.max],
    ["displayTypeMax", (c) => c.displayTypeMax],
    ["designW", (c) => c.designFrame?.width],
    ["designH", (c) => c.designFrame?.height],
]

// ---------------------------------------------------------------------------------------------
// Suppressions
// ---------------------------------------------------------------------------------------------

function parseSuppressions(lines) {
    const out = new Map()
    lines.forEach((text, i) => {
        let idx = text.indexOf("vs-ignore")
        while (idx >= 0) {
            const rest = text.slice(idx + 9)
            const m = /^\s+(L\d+(?:\s*,\s*L\d+)*)/i.exec(rest)
            if (m) {
                const ids = m[1].split(/\s*,\s*/).map((s) => s.toUpperCase())
                const after = rest.slice(m[0].length)
                const colon = /^\s*:/.exec(after)
                const reason = colon ? after.slice(colon[0].length).replace(/\*\/[\s\S]*$/, "").trim() : ""
                if (!out.has(i + 1)) out.set(i + 1, [])
                out.get(i + 1).push({ ids, reason, valid: /[A-Za-z0-9]/.test(reason) })
            }
            idx = text.indexOf("vs-ignore", idx + 9)
        }
    })
    return out
}

function commentOnlyLines(src, isComment) {
    const set = new Set()
    let line = 1
    let sawComment = false
    let sawOther = false
    for (let i = 0; i <= src.length; i++) {
        const c = src[i]
        if (i === src.length || c === "\n") {
            if (sawComment && !sawOther) set.add(line)
            line++
            sawComment = false
            sawOther = false
            continue
        }
        if (c === " " || c === "\t" || c === "\r") continue
        if (isComment(i)) sawComment = true
        else if (c !== "{" && c !== "}") sawOther = true
    }
    return set
}

// ---------------------------------------------------------------------------------------------
// Analysis of one file
// ---------------------------------------------------------------------------------------------

function analyzeFile(file, src, options) {
    const isCss = path.extname(file).toLowerCase() === ".css"
    const ctx = {
        file,
        src,
        isCss,
        lines: src.split(/\r?\n/),
        starts: lineStarts(src),
        decls: [],
        blocks: [],
        findings: [],
        seen: new Set(),
        litCache: new Map(),
    }

    let isComment
    if (isCss) {
        ctx.code = blankCssComments(src)
        const cmask = new Uint8Array(src.length)
        for (const m of src.matchAll(/\/\*[\s\S]*?\*\//g)) cmask.fill(1, m.index, m.index + m[0].length)
        isComment = (i) => cmask[i] === 1
        parseCss(ctx, src, 1)
    } else {
        const scan = scanJs(src)
        ctx.mask = scan.mask
        ctx.literals = scan.literals
        ctx.litByStart = new Map(scan.literals.map((l) => [l.start, l]))
        let code = ""
        for (let i = 0; i < src.length; i++) code += scan.mask[i] === COMMENT ? " " : src[i]
        ctx.code = code
        isComment = (i) => scan.mask[i] === COMMENT
        ctx.consts = buildConsts(ctx)
        ctx.pairs = pairBraces(ctx)
        ctx.pairMap = new Map(ctx.pairs)
        extractJsBlocks(ctx)
        for (const lit of scan.literals) {
            const text = literalText(ctx, lit)
            if (looksLikeCss(text)) parseCss(ctx, text, lineOf(ctx, lit.start + 1))
        }
    }

    // Config and design frame.
    let config = null
    if (options.config) config = options.config
    else {
        const found = findConfigUp(path.dirname(file)) || findConfigUp(process.cwd())
        if (found) {
            const loaded = loadConfig(found)
            if (loaded.error) {
                if (!options.warnedConfigs.has(found)) {
                    options.warnedConfigs.add(found)
                    process.stderr.write(`lint-sizing: ignoring ${found}: ${loaded.error}\n`)
                }
            } else config = loaded
        }
    }
    const DW = Number(config?.data?.designFrame?.width) || 1440
    const DH = Number(config?.data?.designFrame?.height) || 900
    ctx.design = [DW, DH]

    const report = (id, line, key, message, severity) => {
        const dedupe = `${id}|${line}|${key}`
        if (ctx.seen.has(dedupe)) return
        ctx.seen.add(dedupe)
        ctx.findings.push({ id, line, message, severity: severity || RULES[id].severity })
    }

    checkDeclarations(ctx, report)
    checkFile(ctx, report, config)
    checkL12(ctx, report)

    // Suppressions.
    const sup = parseSuppressions(ctx.lines)
    const commentLines = commentOnlyLines(src, isComment)
    for (const f of ctx.findings) {
        const cands = [f.line]
        for (let l = f.line - 1; l >= 1 && commentLines.has(l); l--) cands.push(l)
        let reason = null
        let emptyReason = false
        for (const l of cands) {
            for (const s of sup.get(l) || []) {
                if (!s.ids.includes(f.id)) continue
                if (s.valid && reason == null) {
                    reason = s.reason
                    // A reason that continues on the comment lines below it, up to the finding.
                    for (let k = l + 1; k < f.line && commentLines.has(k); k++) {
                        const more = ctx.lines[k - 1].replace(/^\s*\{?\s*(?:\/\/+|\/\*+|\*+)?/, "").replace(/\*\/\s*\}?\s*$/, "").trim()
                        if (more && !more.includes("vs-ignore")) reason += " " + more
                    }
                }
                if (!s.valid) emptyReason = true
            }
        }
        f.justified = reason != null
        f.justification = reason
        if (!f.justified && emptyReason) f.message += ` (vs-ignore ${f.id} found without a reason, so it does not count)`
    }
    return ctx.findings
}

// ---------------------------------------------------------------------------------------------
// Declaration rules: L1-L6, L8, L9 (cover), L11, L15
// ---------------------------------------------------------------------------------------------

const L3_PROPS = new Set(["width", "min-width", "flex-basis", "inline-size", "min-inline-size"])
const L4_PROPS = new Set(["height", "min-height", "block-size", "min-block-size"])
const L8_PROPS = new Set(["width", "min-width", "max-width", "inline-size", "min-inline-size", "max-inline-size"])
const L11_WHOLE = new Set([
    "padding-top", "padding-bottom", "padding-block", "padding-block-start", "padding-block-end",
    "margin-top", "margin-bottom", "margin-block", "margin-block-start", "margin-block-end", "row-gap",
    "grid-row-gap",
])
const L11_FIRST = new Set(["padding", "margin", "gap", "grid-gap"])
const isAuto = (d) => d.branches.length > 0 && d.branches.every((b) => /^\s*auto\s*$/.test(b.text))

function checkDeclarations(ctx, report) {
    const [DW, DH] = ctx.design
    const vsType = /@vs-type\s+([\w-]+)/.exec(ctx.src)?.[1] || null
    const fullHeight = /(?<![\w.])100(?:vh|svh|dvh|lvh)(?![\w-])/.test(ctx.code)
    const coverApplies = vsType ? vsType === "fit" || vsType === "scroll-scene" : fullHeight
    const layoutWidth = /@framerSupportedLayoutWidth\s+(any-prefer-fixed|any|auto)\b/.exec(ctx.src)?.[1] || null

    for (const d of ctx.decls) {
        const P = d.prop
        const block = d.block
        const has = (...props) => block.decls.some((x) => props.includes(x.prop))

        // L5: aspect-ratio on a width: 100% box, height not capped.
        if (P === "aspect-ratio" && !isAuto(d)) {
            const full = block.decls.some((x) => x.prop === "width" && x.branches.some((b) => b.text.trim() === "100%"))
            const capped =
                has("max-height", "max-block-size") ||
                block.decls.some((x) => (x.prop === "height" || x.prop === "block-size") && !isAuto(x))
            if (full && !capped) {
                const r = parseRatio(d)
                const h = r ? Math.round(WIDE[0] / r.value) : null
                report("L5", d.line, P,
                    `aspect-ratio ${r ? r.text : show(d.raw)} on a width: 100% box takes its height from window width` +
                        (h ? `: ${h}px tall at ${WIDE[0]}x${WIDE[1]}` : "") +
                        `. Use width: min(100%, calc(62svh * ratio)) or add a max-height in svh (rule 4).`)
            }
        }

        // L15: container-type on the root (next to the style spread) or in a Fit-width component.
        if (P === "container-type" || (P === "container" && d.branches.some((b) => /\b(?:inline-size|size)\b/.test(b.text)))) {
            if (block.spreads.some((s) => /^(?:props\.)?style$/.test(s))) {
                report("L15", d.line, P,
                    "container-type on the component root (next to ...style): the root cannot use its own cqw and Fit width collapses it to 0. Move it to an inner wrapper with width: 100% (rule 2, Framer).")
            } else if (layoutWidth) {
                report("L15", d.line, P,
                    `container-type in a component with @framerSupportedLayoutWidth ${layoutWidth}: Fit width collapses inline-size containment to 0. Use @framerSupportedLayoutWidth fixed (rule 2, Framer).`)
            }
        }

        for (const { text } of d.branches) {
            const hits = unitHits(text)
            const calls = hits.length ? callRanges(text) : []
            const v = show(text)

            // L1 / L2: font-size from one axis.
            if (P === "font-size" || P === "font") {
                for (const h of hits) {
                    const enc = enclosing(calls, h.index)
                    const design = evaluate(text, DW, DH)
                    const n = design != null ? design : "N"
                    if (h.axis === "w" && !enc.some(isMinOrClamp)) {
                        const px = evaluate(text, ...WIDE)
                        report("L1", d.line, P,
                            `font-size ${v} grows with window width only` + (px != null ? `: ${px}px at ${WIDE[0]}x${WIDE[1]}` : "") +
                                `. Use clamp(min, ${n} * var(--vs-u), max) (rule 2).`)
                    }
                    if (h.axis === "h") {
                        const ok = enc.some((c) => isMinOrClamp(c) && (hasAxis(argsOf(text, c), "w") || /%/.test(argsOf(text, c)) || VSU_RE.test(argsOf(text, c))))
                        if (!ok) {
                            const px = evaluate(text, ...TALL)
                            report("L2", d.line, P,
                                `font-size ${v} grows with window height only` + (px != null ? `: ${px}px at ${TALL[0]}x${TALL[1]}` : "") +
                                    `. Use clamp(min, ${n} * var(--vs-u), max) (rule 2).`)
                        }
                    }
                }
            }

            // L3: width from height.
            if (L3_PROPS.has(P) && !has("max-width", "max-inline-size")) {
                const bad = hits.some((h) => h.axis === "h" && !enclosing(calls, h.index).some((c) => isMinOrClamp(c) && (/%/.test(argsOf(text, c)) || hasAxis(argsOf(text, c), "w") || VSU_RE.test(argsOf(text, c)))))
                if (bad) {
                    const px = evaluate(text, ...TALL)
                    const over = px != null && px > TALL[0] ? `, ${px - TALL[0]}px wider than the window` : ""
                    report("L3", d.line, P,
                        `${P} ${v} comes from window height` + (px != null ? `: ${px}px at ${TALL[0]}x${TALL[1]}${over}` : "") +
                            `. Cap it: min(100%, …) or add max-width: 100% (rule 3).`)
                }
            }

            // L4: height from height + aspect-ratio => width from height.
            if (L4_PROPS.has(P)) {
                const ar = block.decls.find((x) => x.prop === "aspect-ratio" && !isAuto(x))
                const widthCapped =
                    has("max-width", "max-inline-size") ||
                    block.decls.some((x) => (x.prop === "width" || x.prop === "inline-size") && x.branches.some((b) => /\bmin\(\s*100%/.test(b.text)))
                if (ar && !widthCapped) {
                    const bad = hits.some((h) => h.axis === "h" && !enclosing(calls, h.index).some((c) => isMinOrClamp(c) && (hasAxis(argsOf(text, c), "w") || VSU_RE.test(argsOf(text, c)))))
                    if (bad) {
                        const r = parseRatio(ar)
                        const hpx = evaluate(text, ...TALL)
                        const w = r && hpx != null ? Math.round(hpx * r.value) : null
                        report("L4", d.line, P,
                            `${P} ${v} with aspect-ratio ${r ? r.text : show(ar.raw)} takes its width from window height` +
                                (w != null ? `: ${w}px wide at ${TALL[0]}x${TALL[1]}` : "") +
                                `. Size the width instead: width: min(100%, calc(Nsvh * ratio)) (rule 3).`)
                    }
                }
            }

            // L6: full-height box that clips.
            if (P === "height") {
                const t = text.trim()
                if (/^100(?:svh|dvh|lvh|vh)$/.test(t) || /^calc\(\s*100(?:svh|dvh|lvh|vh)(?![\w-])/.test(t)) {
                    const ov = block.decls
                        .filter((x) => /^overflow(?:-[xy])?$/.test(x.prop))
                        .flatMap((x) => x.branches.map((b) => /\b(hidden|clip)\b/.exec(b.text)?.[1]))
                        .find(Boolean)
                    if (ov) {
                        const sticky = block.decls.some((x) => x.prop === "position" && x.branches.some((b) => /sticky/.test(b.text)))
                        if (sticky) {
                            report("L6", d.line, P,
                                `Pinned stage: height ${v} with overflow: ${ov}. Fine only if everything inside is sized from the measured box on both axes; check laptop-125 and uw-half, then justify with vs-ignore L6 (rule 8).`,
                                "warning")
                        } else {
                            report("L6", d.line, P,
                                `height ${v} with overflow: ${ov} clips content on short windows (${SHORT[0]}x${SHORT[1]}). Use min-height: 100svh and let the section grow (rule 8).`)
                        }
                    }
                }
            }

            // L8: 100vw as a width.
            if (L8_PROPS.has(P) && V100W_RE.test(text)) {
                const effect = P.startsWith("max-") ? "so the cap still lets the box overflow" : "and causes horizontal scroll"
                report("L8", d.line, P,
                    `${P} ${v} is about 17px wider than the page with Windows scrollbars ${effect}. Use 100% (rule 13).`)
            }

            // L9: object-fit: cover in a fit / full-height component.
            if (P === "object-fit" && text.trim() === "cover" && coverApplies && !dataVsNear(ctx, d.line, ["bg"])) {
                const lost = Math.round((1 - Math.min(1, TALL[0] / TALL[1] / (DW / DH))) * 100)
                report("L9", d.line, P,
                    `object-fit: cover in a ${vsType || "full-height"} component crops ${lost}% of the width at ${TALL[0]}x${TALL[1]}. Use contain for key media, or mark a background data-vs="bg" (rule 5).`)
            }

            // L11: vertical spacing from width.
            if (L11_WHOLE.has(P) || L11_FIRST.has(P)) {
                const seg = L11_WHOLE.has(P) ? text : topLevelTokens(text)[0] || ""
                if (hasAxis(seg, "w") && !hasAxis(seg, "h") && !VSU_RE.test(seg)) {
                    const px = evaluate(seg, ...WIDE)
                    const label = L11_FIRST.has(P) ? `${P} ${show(seg)} (vertical part)` : `${P} ${v}`
                    report("L11", d.line, P,
                        `${label} is vertical spacing from window width` + (px != null ? `: ${px}px at ${WIDE[0]}x${WIDE[1]}` : "") +
                            `. Use clamp(min, N * var(--vs-u), max) or svh (rule 4).`)
                }
            }
        }
    }
}

// ---------------------------------------------------------------------------------------------
// L12: unbounded viewport units (runs last so it does not repeat L1/L2/L3/L8 on the same line)
// ---------------------------------------------------------------------------------------------

// Height units are expected in vertical sizes and offsets. Also exempt: row tracks (a grid row of
// minmax(100svh, auto) is a min-height) and a height-based cap on a width (the rule-4 fix).
const L12_H_EXEMPT_RE = /^(?:height|min-height|max-height|block-size|min-block-size|max-block-size|top|bottom|inset(?:-[a-z-]+)?|scroll-margin(?:-[a-z-]+)?|scroll-padding(?:-[a-z-]+)?|grid-template-rows|grid-auto-rows|max-width|max-inline-size)$/

function checkL12(ctx, report) {
    const taken = new Set(ctx.findings.filter((f) => ["L1", "L2", "L3", "L8"].includes(f.id)).map((f) => f.line))
    for (const d of ctx.decls) {
        if (taken.has(d.line)) continue
        const P = d.prop
        for (const { text } of d.branches) {
            const bounded = BOUND_RE.test(text)
            const v = show(text)
            if (!bounded && hasAxis(text, "w")) {
                const px = evaluate(text, ...WIDE)
                report("L12", d.line, P,
                    `${P} ${v} is unbounded` + (px != null ? `: ${px}px at ${WIDE[0]}x${WIDE[1]}` : "") +
                        `. Bound it with clamp(min, …, max) or use var(--vs-u) (rule 2).`)
            } else if (!bounded && hasAxis(text, "h") && !L12_H_EXEMPT_RE.test(P) && !P.startsWith("--")) {
                const px = evaluate(text, ...TALL)
                report("L12", d.line, P,
                    `${P} ${v} follows window height only` + (px != null ? `: ${px}px at ${TALL[0]}x${TALL[1]}` : "") +
                        `. Bound it with clamp(min, …, max) or use var(--vs-u) (rule 2).`)
            } else if (P === "font-size" && VSU_RE.test(text) && !/\bclamp\(/i.test(text)) {
                report("L12", d.line, P,
                    `font-size ${v} uses var(--vs-u) without clamp(). Use clamp(min, N * var(--vs-u), max) (rule 2).`)
            }
        }
    }
}

// ---------------------------------------------------------------------------------------------
// File-level rules: L7, L9 (canvas), L10, L13, L14, L16
// ---------------------------------------------------------------------------------------------

function hasDataVs(text, tokens) {
    for (const m of text.matchAll(/data-vs\s*[~|^$*]?=\s*\{?\s*(["'`])([^"'`]*)\1/g)) {
        const toks = m[2].trim().split(/\s+/)
        if (tokens.some((t) => toks.includes(t))) return true
    }
    return false
}

function dataVsNear(ctx, line, tokens, span = 5) {
    const from = Math.max(1, line - span)
    const to = Math.min(ctx.lines.length, line + span)
    for (let l = from; l <= to; l++) if (hasDataVs(ctx.lines[l - 1], tokens)) return true
    return false
}

function firstMatchLine(ctx, re) {
    const m = re.exec(ctx.code)
    return m ? lineOf(ctx, m.index) : null
}

function exportLine(ctx) {
    return firstMatchLine(ctx, /\bexport\s+default\b/) || firstMatchLine(ctx, /\baddPropertyControls\b/) || 1
}

function checkFile(ctx, report, config) {
    const { code, src } = ctx
    const [DW, DH] = ctx.design
    const tallLoss = Math.round(((1 - Math.min(1, TALL[0] / TALL[1] / (DW / DH))) / 2) * 100)

    // L7: one-axis window reads.
    const hasRO = /\bResizeObserver\b/.test(code)
    const hasIW = /\binnerWidth\b/.test(code)
    const hasIH = /\binnerHeight\b/.test(code)
    if (!hasRO && hasIW !== hasIH) {
        const [name, other] = hasIW ? ["innerWidth", "innerHeight"] : ["innerHeight", "innerWidth"]
        for (const m of code.matchAll(new RegExp(`\\b${name}\\b`, "g"))) {
            report("L7", lineOf(ctx, m.index), name,
                `window.${name} is read without ${other} or a ResizeObserver, so the layout ignores the other axis. Measure the component box on both axes with ResizeObserver (rule 9).`)
        }
    }

    if (ctx.isCss) return

    // L9: <canvas> without a data-vs role.
    for (const m of code.matchAll(/<canvas\b/g)) {
        let depth = 0
        let end = m.index
        for (let i = m.index; i < code.length; i++) {
            const c = code[i]
            if (c === "{") depth++
            else if (c === "}") depth--
            else if (c === ">" && depth <= 0) {
                end = i
                break
            }
        }
        const line = lineOf(ctx, m.index)
        const tag = src.slice(m.index, end + 1)
        if (!hasDataVs(tag, ["bg", "key-visual"]) && !dataVsNear(ctx, line, ["bg", "key-visual"])) {
            report("L9", line, "canvas",
                `<canvas> without a data-vs role: add data-vs="bg" if it is a full-bleed texture, or data-vs="key-visual" plus a proxy element if its edges matter (rule 5).`)
        }
    }

    // L10: 3D scenes and embeds without aspect handling.
    const imported = (pkg) => new RegExp(`(?:\\bfrom\\s*|\\bimport\\s*\\(?\\s*|\\brequire\\s*\\(\\s*)["'\`]${pkg}`)
    const triggers = [
        [/\bPerspectiveCamera\b/, "Three.js PerspectiveCamera"],
        [imported("@react-three/fiber"), "React Three Fiber scene"],
        [/<Canvas\b/, "React Three Fiber <Canvas>"],
        [/unicorn\.?studio/i, "Unicorn Studio embed"],
        [imported("@splinetool/"), "Spline embed"],
        [/<spline-viewer\b/, "Spline embed"],
    ]
    let hit = null
    for (const [re, label] of triggers) {
        const m = re.exec(code)
        if (m && (!hit || m.index < hit.index)) hit = { index: m.index, label }
    }
    // Also: a plain canvas whose drawing scale comes from height only (e.g. scale = canvas.height / 900).
    if (!hit && /getContext\s*\(/.test(code)) {
        const hScale = /\b(?:\w*height|h)\b\s*\/\s*(?:\d{3,4}(?:\.\d+)?\b|[\w.]*design[\w.]*)/i.exec(code)
        const wScale = /\b(?:\w*width|w)\b\s*\/\s*(?:\d{3,4}(?:\.\d+)?\b|[\w.]*design[\w.]*)/i.test(code)
        if (hScale && !wScale) hit = { index: hScale.index, label: "Canvas drawing scaled from height only" }
    }
    if (hit) {
        const containScale = [...code.matchAll(/\bMath\.min\s*\(/g)].some((m) => {
            const open = m.index + m[0].length - 1
            const close = closeOf(ctx, open)
            if (close < 0) return false
            const args = code.slice(open + 1, close).split(",")
            return args.some((a) => /(?:width|\bw)\b\s*\//i.test(a)) && args.some((a) => /(?:height|\bh)\b\s*\//i.test(a))
        })
        const stage = ctx.blocks.some(
            (b) =>
                b.decls.some((x) => x.prop === "aspect-ratio") &&
                b.decls.some((x) => (x.prop === "width" || x.prop === "inline-size") && x.branches.some((br) => /\bmin\(\s*100%/.test(br.text)))
        )
        const handled =
            /\b[Cc]ontainCamera\b/.test(code) || (/\.fov\s*=(?!=)/.test(code) && /aspect/i.test(code)) || stage || containScale
        if (!handled) {
            report("L10", lineOf(ctx, hit.index), "scene",
                `${hit.label} with no aspect handling is height-locked: the sides crop ${tallLoss}% each at ${TALL[0]}x${TALL[1]}. Use containCamera(), or an aspect-locked stage: width: min(100%, calc(100svh * ${DW} / ${DH})); aspect-ratio: ${DW} / ${DH} (rule 6).`)
        }
    }

    // L13: ScrollTrigger distances.
    if (/\bScrollTrigger\b/.test(code)) {
        for (const m of code.matchAll(/\bend\s*:\s*/g)) {
            if (ctx.mask[m.index] !== CODE) continue
            const lit = ctx.litByStart.get(m.index + m[0].length)
            if (!lit) continue // arrow function, function or identifier
            const concat = /^\s*\+/.test(src.slice(lit.end))
            const interpolated = lit.kind === "`" && lit.parts.some((p) => p.type === "expr")
            const numeric = /\d/.test(literalText(ctx, lit).replace(/\d*\.?\d+%/g, ""))
            if (concat || interpolated || numeric) {
                report("L13", lineOf(ctx, m.index), "end",
                    `ScrollTrigger end ${show(src.slice(lit.start, concat ? lit.end + 30 : lit.end).split(/[,\n]/)[0], 40)} is computed once and goes stale after resize. Use end: () => "+=" + (track.scrollWidth - section.clientWidth) (rule 9).`)
            }
        }
        for (const m of code.matchAll(/\bScrollTrigger\s*\.\s*create\s*\(\s*\{|\bscrollTrigger\s*:\s*\{/g)) {
            if (ctx.mask[m.index] !== CODE) continue
            const open = m.index + m[0].length - 1
            const close = ctx.pairMap.get(open)
            if (close == null) continue
            const body = code.slice(open, close + 1)
            if (/\binvalidateOnRefresh\s*:\s*true\b/.test(body)) continue
            if (!/\b(?:pin|scrub|end)\s*:/.test(body)) continue // simple toggle reveal: nothing to recompute
            report("L13", lineOf(ctx, m.index), "invalidate",
                `ScrollTrigger config without invalidateOnRefresh: true, so its values are not recomputed on refresh. Add invalidateOnRefresh: true (rule 9).`)
        }
    }

    // L14 / L16: Framer code components.
    // A Framer code component: Framer import, an addPropertyControls(...) call (not its definition)
    // or layout annotations, and it renders JSX.
    const isFramer =
        (/from\s+["']framer["']/.test(code) || /(?<!function\s+)\baddPropertyControls\s*\(/.test(code) || /@framerSupportedLayout/.test(src)) &&
        /(?:\breturn|=>)\s*\(?\s*<[A-Za-z]/.test(code)
    if (!isFramer) return

    const spreadsStyle =
        /\.\.\.\s*(?:props\s*\.\s*)?style\b(?!\s*[.[])/.test(code) ||
        /\bstyle\s*=\s*\{\s*(?:props\s*\.\s*)?style\s*\}/.test(code) ||
        /\{\s*\.\.\.\s*(?:props|rest|restProps|otherProps|others)\s*\}/.test(code)
    if (!spreadsStyle) {
        report("L14", exportLine(ctx), "style",
            "Framer component root does not spread the style prop, so size and position set in Framer are lost. Use style={{ ...style, … }} on the root element (Framer).")
    }

    if (config?.data) {
        const cfgName = path.relative(process.cwd(), config.file) || config.file
        const expected = BRAND_FIELDS.map(([k, get]) => [k, get(config.data)]).filter(([, v]) => typeof v === "number")
        const bm = /\bconst\s+BRAND\b[^=]*=\s*/.exec(code)
        const open = bm ? bm.index + bm[0].length : -1
        if (!bm || code[open] !== "{" || !ctx.pairMap.has(open)) {
            const sample = expected.map(([k, v]) => `${k}: ${v}`).join(", ")
            report("L16", exportLine(ctx), "brand",
                `BRAND constant missing. Copy it from ${cfgName}: const BRAND = { ${sample} } (rule 7).`)
        } else {
            const body = src.slice(open + 1, ctx.pairMap.get(open))
            const found = new Map()
            for (const m of body.matchAll(/([A-Za-z_$][\w$]*)\s*:\s*([^,}\n]+)/g)) found.set(m[1], m[2].trim())
            const diffs = []
            for (const [k, v] of expected) {
                if (!found.has(k)) diffs.push(`${k} missing (config ${v})`)
                else if (Number(found.get(k)) !== v) diffs.push(`${k} ${found.get(k)} (config ${v})`)
            }
            if (diffs.length) {
                report("L16", lineOf(ctx, bm.index), "brand",
                    `BRAND differs from ${cfgName}: ${diffs.join(", ")}. Update both together (rule 7).`)
            }
        }
    }
}

// ---------------------------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------------------------

const USAGE = "Usage: node lint-sizing.mjs <file-or-dir> [...] [--config <path>] [--json] [--quiet]"

function collectFiles(target, out) {
    const stat = fs.statSync(target)
    if (stat.isDirectory()) {
        const entries = fs.readdirSync(target, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))
        for (const e of entries) {
            const full = path.join(target, e.name)
            if (e.isDirectory()) {
                if (!SKIP_DIRS.has(e.name)) collectFiles(full, out)
            } else if ((e.isFile() || e.isSymbolicLink()) && EXTENSIONS.has(path.extname(e.name).toLowerCase())) {
                try {
                    if (fs.statSync(full).isFile()) out.push(full)
                } catch {
                    /* broken link */
                }
            }
        }
    } else if (stat.isFile()) {
        const ext = path.extname(target).toLowerCase()
        if (EXTENSIONS.has(ext) || ext === ".mjs" || ext === ".cjs") out.push(target)
        else process.stderr.write(`lint-sizing: skipping ${target} (unsupported extension)\n`)
    }
}

function displayPath(file) {
    const rel = path.relative(process.cwd(), file)
    return rel && !rel.startsWith("..") && !path.isAbsolute(rel) ? rel : file
}

function main(argv) {
    const args = { paths: [], config: null, json: false, quiet: false }
    const usage = (msg) => {
        process.stderr.write(`lint-sizing: ${msg}\n${USAGE}\n`)
        return 2
    }
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i]
        if (a === "--json") args.json = true
        else if (a === "--quiet" || a === "-q") args.quiet = true
        else if (a === "--config") {
            const v = argv[++i]
            if (!v || v.startsWith("--")) return usage("--config needs a path")
            args.config = v
        } else if (a.startsWith("--config=")) args.config = a.slice(9)
        else if (a === "--help" || a === "-h") {
            process.stdout.write(USAGE + "\n")
            return 0
        } else if (a.startsWith("-")) return usage(`unknown option ${a}`)
        else args.paths.push(a)
    }
    if (!args.paths.length) return usage("no file or directory given")

    const options = { config: null, warnedConfigs: new Set() }
    if (args.config) {
        const file = path.resolve(args.config)
        if (!fs.existsSync(file)) return usage(`config not found: ${args.config}`)
        const loaded = loadConfig(file)
        if (loaded.error) return usage(`config ${args.config} is not valid JSON: ${loaded.error}`)
        options.config = loaded
    }

    const files = []
    for (const p of args.paths) {
        const full = path.resolve(p)
        if (!fs.existsSync(full)) return usage(`not found: ${p}`)
        collectFiles(full, files)
    }

    const findings = []
    let scanned = 0
    for (const file of [...new Set(files)]) {
        let src
        try {
            if (fs.statSync(file).size > MAX_FILE_BYTES) {
                process.stderr.write(`lint-sizing: skipping ${displayPath(file)} (larger than 3 MB)\n`)
                continue
            }
            src = fs.readFileSync(file, "utf8")
        } catch (err) {
            process.stderr.write(`lint-sizing: cannot read ${displayPath(file)}: ${err.message}\n`)
            continue
        }
        scanned++
        for (const f of analyzeFile(file, src, options)) {
            findings.push({
                file: displayPath(file),
                line: f.line,
                id: f.id,
                rule: RULES[f.id].rule,
                severity: f.severity,
                message: f.message,
                justified: f.justified,
                justification: f.justification,
            })
        }
    }
    findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || Number(a.id.slice(1)) - Number(b.id.slice(1)))

    const errors = findings.filter((f) => !f.justified && f.severity === "error").length
    const warnings = findings.filter((f) => !f.justified && f.severity === "warning").length
    const justified = findings.filter((f) => f.justified).length

    if (args.json) {
        process.stdout.write(JSON.stringify({ files: scanned, findings, errors, warnings, justified }, null, 2) + "\n")
    } else {
        const lines = []
        for (const f of findings) {
            if (args.quiet && (f.justified || f.severity !== "error")) continue
            lines.push(
                `${f.file}:${f.line}  ${f.id}  rule ${f.rule}  ${f.severity}  ${f.message}` + (f.justified ? `  [justified: ${f.justification}]` : "")
            )
        }
        if (!args.quiet) {
            lines.push(
                `viewport-safe lint: ${scanned} file${scanned === 1 ? "" : "s"}, ${errors} error${errors === 1 ? "" : "s"}, ${warnings} warning${warnings === 1 ? "" : "s"}, ${justified} justified.`
            )
        }
        if (lines.length) process.stdout.write(lines.join("\n") + "\n")
    }
    return errors > 0 ? 1 : 0
}

process.exitCode = main(process.argv.slice(2))
