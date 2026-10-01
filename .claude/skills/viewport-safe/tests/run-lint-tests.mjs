#!/usr/bin/env node
// Tests for scripts/lint-sizing.mjs. Zero dependencies: node tests/run-lint-tests.mjs
//
// Every file in tests/lint-cases/ (recursively) is linted with --json, from its own folder:
//   - L<n>-bad*   must report L<n> (unjustified) at least once;
//   - L<n>-good*  must not report L<n> at all;
//   - a comment `expect L<n> [L<m> ...]` on a line means a finding with that ID must be reported
//     on exactly that line; for each ID that has markers, the reported lines must equal the marked lines;
//   - EXTRA below adds per-case checks (exit code, forbidden IDs, suppression details).
// CLI behaviour (usage errors, output formats, directory scanning, config lookup) is tested at the end.
// Prints one PASS/FAIL line per case and exits 1 on any failure.

import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const HERE = path.dirname(fileURLToPath(import.meta.url))
const LINT = path.resolve(HERE, "../scripts/lint-sizing.mjs")
const CASES = path.join(HERE, "lint-cases")
const EXTS = new Set([".tsx", ".ts", ".jsx", ".js", ".css"])

function lint(args, cwd = CASES) {
    const r = spawnSync(process.execPath, [LINT, ...args], { cwd, encoding: "utf8" })
    let json = null
    try {
        json = JSON.parse(r.stdout)
    } catch {
        /* not JSON */
    }
    return { code: r.status, stdout: r.stdout, stderr: r.stderr, json }
}

const byId = (json, id) => json.findings.filter((f) => f.id === id)

// Per-case extra checks. Each returns a list of problems (strings).
const EXTRA = {
    "L1-bad.tsx": (r) => [
        ...(r.code === 1 ? [] : [`exit ${r.code}, expected 1`]),
        ...(byId(r.json, "L12").length ? ["L12 repeated on a line already reported as L1"] : []),
    ],
    "L2-bad.css": (r) => (r.code === 1 ? [] : [`exit ${r.code}, expected 1`]),
    "L3-bad.css": (r) => [
        ...(byId(r.json, "L12").length ? ["L12 repeated on a line already reported as L3"] : []),
        ...(byId(r.json, "L3").some((f) => /1820px at 1720x1280/.test(f.message)) ? [] : ["L3 message lacks the 1820px at 1720x1280 figure"]),
    ],
    "L4-bad.css": (r) => (byId(r.json, "L4").some((f) => /1820px wide at 1720x1280/.test(f.message)) ? [] : ["L4 message lacks 1820px wide"]),
    "L5-bad.tsx": (r) => (byId(r.json, "L5").some((f) => /1935px tall at 3440x1280/.test(f.message)) ? [] : ["L5 message lacks 1935px tall"]),
    "L6-bad.tsx": (r) => [
        ...(r.code === 1 ? [] : [`exit ${r.code}, expected 1`]),
        ...(byId(r.json, "L6").every((f) => f.severity === "error") ? [] : ["L6 should be an error outside sticky stages"]),
    ],
    "L7-bad.tsx": (r) => (r.code === 1 ? [] : [`exit ${r.code}, expected 1`]),
    "L8-bad.css": (r) => [
        ...(r.code === 0 ? [] : [`exit ${r.code}, expected 0 (warnings only)`]),
        ...(byId(r.json, "L8").every((f) => f.severity === "warning") ? [] : ["L8 must be a warning"]),
    ],
    "L9-good.tsx": (r) => (r.json.findings.length === 0 ? [] : [`expected no findings, got ${summary(r.json)}`]),
    "L10-good.tsx": (r) => (r.json.findings.length === 0 ? [] : [`expected no findings, got ${summary(r.json)}`]),
    "L10-good-stage.tsx": (r) => (r.json.findings.length === 0 ? [] : [`expected no findings, got ${summary(r.json)}`]),
    "L10-good-canvas2d.tsx": (r) => (r.json.findings.length === 0 ? [] : [`expected no findings, got ${summary(r.json)}`]),
    "L14-bad.tsx": (r) => (r.code === 0 ? [] : [`exit ${r.code}, expected 0`]),
    "L14-good.tsx": (r) => (r.json.findings.length === 0 ? [] : [`expected no findings, got ${summary(r.json)}`]),
    "L15-bad-root.tsx": (r) => (byId(r.json, "L15").some((f) => /component root/.test(f.message)) ? [] : ["root-spread L15 message missing"]),
    "L15-good.tsx": (r) => (r.json.findings.length === 0 ? [] : [`expected no findings, got ${summary(r.json)}`]),
    "l16/L16-bad.tsx": (r) => {
        const msg = byId(r.json, "L16")[0]?.message || ""
        const out = []
        if (!/contentMaxWidth 1440 \(config 1224\)/.test(msg)) out.push("L16 message does not name contentMaxWidth")
        if (!/gutterMax 80 \(config 64\)/.test(msg)) out.push("L16 message does not name gutterMax")
        if (/gutterMin|displayTypeMax|designW|designH/.test(msg)) out.push("L16 names fields that match the config")
        return out
    },
    "l16/L16-good.tsx": (r) => (r.json.findings.length === 0 ? [] : [`expected no findings, got ${summary(r.json)}`]),
    "l16/L16-missing.tsx": (r) => (byId(r.json, "L16").some((f) => /BRAND constant missing/.test(f.message)) ? [] : ["missing-BRAND warning not reported"]),
    "traps-good.tsx": (r) => [
        ...(r.json.findings.length === 0 ? [] : [`expected no findings, got ${summary(r.json)}`]),
        ...(r.code === 0 ? [] : [`exit ${r.code}, expected 0`]),
    ],
    "suppression.tsx": (r) => {
        const out = []
        const l8 = byId(r.json, "L8")
        const justified = l8.filter((f) => f.justified)
        const open = l8.filter((f) => !f.justified)
        if (l8.length !== 3) out.push(`expected 3 L8 findings, got ${l8.length}`)
        if (justified.length !== 2) out.push(`expected 2 justified L8, got ${justified.length}`)
        if (!justified.some((f) => f.justification === "the page root clips overflow-x, so the extra 17px never scrolls")) out.push("line-above justification text not captured")
        if (!justified.some((f) => f.justification === "decorative hairline, clipped by the section")) out.push("same-line /* */ justification text not captured")
        if (open.length !== 1) out.push("the empty-reason vs-ignore must not suppress")
        else if (!/without a reason/.test(open[0].message)) out.push("empty-reason finding does not explain why it still counts")
        if (open[0] && (open[0].justified !== false || open[0].justification !== null)) out.push("unjustified finding must have justified: false, justification: null")
        const l6 = byId(r.json, "L6")
        if (!(l6.length === 1 && l6[0].justified && l6[0].severity === "error")) out.push("multi-line vs-ignore L6 above the line did not justify the error")
        if (r.code !== 0) out.push(`exit ${r.code}, expected 0: a justified error must not fail the run`)
        if (r.json.errors !== 0 || r.json.justified !== 3 || r.json.warnings !== 1) out.push(`counts errors=${r.json.errors} warnings=${r.json.warnings} justified=${r.json.justified}, expected 0/1/3`)
        return out
    },
    "suppression.css": (r) => {
        const l1 = byId(r.json, "L1")
        const out = []
        if (l1.filter((f) => f.justified).length !== 1) out.push("the reasoned /* vs-ignore L1: … */ above the rule should justify one L1")
        if (l1.filter((f) => !f.justified).length !== 1) out.push("a vs-ignore without ':' and reason must not suppress")
        if (r.code !== 1) out.push(`exit ${r.code}, expected 1`)
        return out
    },
    "forms.tsx": (r) => (r.code === 1 ? [] : [`exit ${r.code}, expected 1`]),
}

function summary(json) {
    return json.findings.map((f) => `${f.id}@${f.line}`).join(", ") || "none"
}

function listCases(dir) {
    const out = []
    for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        const full = path.join(dir, e.name)
        if (e.isDirectory()) out.push(...listCases(full))
        else if (EXTS.has(path.extname(e.name))) out.push(full)
    }
    return out
}

function markers(src) {
    const out = new Map() // id -> Set(lines)
    src.split(/\r?\n/).forEach((text, i) => {
        const m = /\bexpect((?:\s+L\d+)+)/.exec(text)
        if (!m) return
        for (const id of m[1].trim().split(/\s+/)) {
            if (!out.has(id)) out.set(id, new Set())
            out.get(id).add(i + 1)
        }
    })
    return out
}

let failures = 0
let passes = 0
function result(name, problems, detail = "") {
    if (problems.length) {
        failures++
        console.log(`FAIL  ${name}`)
        for (const p of problems) console.log(`        - ${p}`)
    } else {
        passes++
        console.log(`PASS  ${name}${detail ? `  (${detail})` : ""}`)
    }
}

// ---------------------------------------------------------------------------------------------
// 1. Case files
// ---------------------------------------------------------------------------------------------

const files = listCases(CASES)
const covered = { bad: new Set(), good: new Set() }

for (const file of files) {
    const rel = path.relative(CASES, file).split(path.sep).join("/")
    const base = path.basename(file)
    const r = lint(["--json", base], path.dirname(file))
    const problems = []
    if (!r.json) {
        result(rel, [`no JSON output (exit ${r.code}): ${r.stderr.trim() || r.stdout.trim()}`])
        continue
    }
    if (r.code !== (r.json.errors > 0 ? 1 : 0)) problems.push(`exit ${r.code} does not match ${r.json.errors} unjustified error(s)`)

    const named = /^(L\d+)-(bad|good)/.exec(base)
    if (named) {
        const [, id, kind] = named
        covered[kind].add(id)
        const hits = byId(r.json, id)
        if (kind === "bad" && !hits.some((f) => !f.justified)) problems.push(`expected ${id}, got ${summary(r.json)}`)
        if (kind === "good" && hits.length) problems.push(`must not report ${id}, got ${hits.map((f) => `${f.id}@${f.line}`).join(", ")}`)
    }

    for (const [id, lines] of markers(fs.readFileSync(file, "utf8"))) {
        const got = new Set(byId(r.json, id).map((f) => f.line))
        const missing = [...lines].filter((l) => !got.has(l))
        const extra = [...got].filter((l) => !lines.has(l))
        if (missing.length) problems.push(`${id} expected on line(s) ${missing.join(", ")}, got ${summary(r.json)}`)
        if (extra.length) problems.push(`${id} reported on unmarked line(s) ${extra.join(", ")}`)
    }

    if (EXTRA[rel]) problems.push(...EXTRA[rel](r))
    result(rel, problems, summary(r.json))
}

const allIds = Array.from({ length: 16 }, (_, i) => `L${i + 1}`)
result(
    "coverage: one bad and one good case per ID",
    allIds.flatMap((id) => [
        ...(covered.bad.has(id) ? [] : [`no ${id}-bad case`]),
        ...(covered.good.has(id) ? [] : [`no ${id}-good case`]),
    ])
)
for (const id of Object.keys(EXTRA)) {
    if (!fs.existsSync(path.join(CASES, id))) result(`EXTRA entry ${id}`, ["case file does not exist"])
}

// ---------------------------------------------------------------------------------------------
// 2. CLI behaviour
// ---------------------------------------------------------------------------------------------

{
    const checks = [
        [[], 2, "no arguments"],
        [["--bogus", "L1-bad.tsx"], 2, "unknown option"],
        [["does-not-exist.tsx"], 2, "missing path"],
        [["L1-bad.tsx", "--config"], 2, "--config without a value"],
        [["L1-bad.tsx", "--config", "nope.json"], 2, "--config that does not exist"],
    ]
    for (const [args, code, label] of checks) {
        const r = lint(args)
        result(`cli: ${label} -> exit ${code}`, r.code === code ? [] : [`exit ${r.code}`])
    }
}

{
    const r = lint(["L2-bad.css"])
    const lines = r.stdout.trim().split("\n")
    const problems = []
    if (!/^L2-bad\.css:3 {2}L2 {2}rule 2,3 {2}error {2}font-size 11vh grows with window height only: 141px at 1720x1280\. Use clamp\(min, 99 \* var\(--vs-u\), max\) \(rule 2\)\.$/.test(lines[0]))
        problems.push(`unexpected first line: ${lines[0]}`)
    if (!/^viewport-safe lint: 1 file, 2 errors, 0 warnings, 0 justified\.$/.test(lines[lines.length - 1])) problems.push(`unexpected summary: ${lines[lines.length - 1]}`)
    result("cli: human output format", problems)
}

{
    const r = lint(["--quiet", "L8-bad.css", "L2-bad.css"])
    const lines = r.stdout.trim().split("\n")
    const problems = []
    if (lines.length !== 2 || !lines.every((l) => /  error  /.test(l))) problems.push(`--quiet printed: ${JSON.stringify(r.stdout)}`)
    if (r.code !== 1) problems.push(`exit ${r.code}, expected 1`)
    result("cli: --quiet prints only errors", problems)
}

{
    const r = lint(["--json", "suppression.tsx"])
    const problems = []
    const keys = r.json ? Object.keys(r.json).sort().join(",") : ""
    if (keys !== "errors,files,findings,justified,warnings") problems.push(`top-level keys: ${keys}`)
    const f = r.json?.findings?.[0]
    const fkeys = f ? Object.keys(f).sort().join(",") : ""
    if (fkeys !== "file,id,justification,justified,line,message,rule,severity") problems.push(`finding keys: ${fkeys}`)
    if (r.json?.files !== 1) problems.push(`files = ${r.json?.files}, expected 1`)
    result("cli: --json shape", problems)
}

// Temporary folders for directory scanning and config lookup (removed afterwards).
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vs-lint-test-"))
try {
    const bad = ".hero { font-size: 8vw; }\n"
    for (const rel of ["a.css", "sub/b.tsx", "node_modules/pkg/c.css", "dist/d.css", ".git/e.css", "notes.md"]) {
        fs.mkdirSync(path.dirname(path.join(tmp, "scan", rel)), { recursive: true })
        fs.writeFileSync(path.join(tmp, "scan", rel), rel.endsWith(".tsx") ? `const s = { fontSize: "8vw" }\n` : bad)
    }
    const r = lint(["--json", "scan"], tmp)
    const files = new Set((r.json?.findings || []).map((f) => f.file.split(path.sep).join("/")))
    const problems = []
    if (r.json?.files !== 2) problems.push(`scanned ${r.json?.files} files, expected 2`)
    if (!(files.has("scan/a.css") && files.has("scan/sub/b.tsx")) || files.size !== 2) problems.push(`findings in ${[...files].join(", ")}`)
    result("cli: directories are scanned recursively, skipping node_modules, dist, .git", problems)

    // No config anywhere up the tree (file dir or cwd): L16 is skipped silently.
    fs.mkdirSync(path.join(tmp, "noconfig"))
    fs.copyFileSync(path.join(CASES, "l16", "L16-missing.tsx"), path.join(tmp, "noconfig", "L16-missing.tsx"))
    const hasAncestorConfig = (() => {
        for (let d = path.join(tmp, "noconfig"); ; d = path.dirname(d)) {
            if (fs.existsSync(path.join(d, "viewport-safe.config.json"))) return true
            if (path.dirname(d) === d) return false
        }
    })()
    if (hasAncestorConfig) result("config: L16 skipped when no config exists", [], "skipped: a config exists above the temp folder")
    else {
        const r2 = lint(["--json", "noconfig/L16-missing.tsx"], tmp)
        result("config: L16 skipped when no config exists", byId(r2.json, "L16").length || r2.stderr ? [`got ${summary(r2.json)} ${r2.stderr}`] : [])
    }

    // --config overrides the lookup.
    const r3 = lint(["--json", "noconfig/L16-missing.tsx", "--config", path.join(CASES, "l16", "viewport-safe.config.json")], tmp)
    result("config: --config <path> is used for L16", byId(r3.json, "L16").length === 1 ? [] : [`got ${summary(r3.json)}`])

    // A config in the current directory is found when none sits above the file.
    fs.mkdirSync(path.join(tmp, "cwd"))
    fs.copyFileSync(path.join(CASES, "l16", "viewport-safe.config.json"), path.join(tmp, "cwd", "viewport-safe.config.json"))
    const r4 = lint(["--json", path.join(tmp, "noconfig", "L16-missing.tsx")], path.join(tmp, "cwd"))
    result("config: falls back to the nearest config from the cwd", hasAncestorConfig || byId(r4.json, "L16").length === 1 ? [] : [`got ${summary(r4.json)}`])
} finally {
    fs.rmSync(tmp, { recursive: true, force: true })
}

console.log(`\n${passes} passed, ${failures} failed`)
process.exitCode = failures ? 1 : 0
