#!/usr/bin/env node
// viewport-safe audit: loads a page (Framer preview/staging URL) or a single component (Vite harness)
// at every viewport in the matrix, scrolls through it, runs checks C1–C12, and writes a report
// with screenshots and side-by-side compare sheets. Zero dependencies for URL mode (Node 22+ and an
// installed Chrome/Edge/Chromium). Harness mode needs `npm --prefix scripts/harness install` once.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createServer as netServer } from 'node:net';
import { launch } from './lib/cdp.mjs';
import { decodePng, edgeContact, CONTACT_MIN } from './lib/pixels.mjs';
import { dedupe, summarize, writeReports, writeCompareSheets } from './lib/report.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const HARNESS = join(HERE, 'harness');
const CHECKS_SRC = readFileSync(join(HERE, 'lib', 'checks.js'), 'utf8');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const HELP = `Usage:
  node viewport-audit.mjs --url <url> [--selector "#hero"]           audit a Framer preview/staging page
  node viewport-audit.mjs --component <file.tsx> [--props p.json]     audit one component in the Vite harness
         [--layout fill|viewport|<W>x<H>]
  node viewport-audit.mjs --url <url> --measure                       print the content column width

Options:
  --matrix quick|required|all   viewports to run (default required; quick = design, uw-half, uw-full, laptop-125)
  --only id1,id2                run only these viewport ids
  --out <dir>                   output folder (default ./viewport-audit)
  --settle <ms>                 wait after load for animations (default 1500)
  --scroll-steps <n>            positions per scroll scene (default 5: 0/25/50/75/100%)
  --config <path>               viewport-safe.config.json (default: nearest, searching upward)
  --hide <selectors>            extra comma-separated selectors to hide (added to config auditHideSelectors)
  --chrome <path>               browser binary (default: auto-detect Chrome/Edge/Chromium, or CHROME_PATH)
  --concurrency <n>             browsers in parallel (default 2)
  --no-scrollbar                do not simulate Windows 17px scrollbars
Exit code: 0 all required viewports pass, 1 a required viewport fails, 2 setup/usage error.`;

function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { (o._ ||= []).push(a); continue; }
    const k = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) o[k] = true;
    else { o[k] = next; i++; }
  }
  return o;
}

function findUp(start, name) {
  let d = resolve(start);
  for (;;) {
    const p = join(d, name);
    if (existsSync(p)) return p;
    const up = dirname(d);
    if (up === d) return null;
    d = up;
  }
}

function fail(msg) { console.error(msg); process.exit(2); }

function readHeader(file) {
  const src = readFileSync(file, 'utf8');
  const type = /@vs-type\s+(grow|fit|scroll-scene)/.exec(src)?.[1] || null;
  const design = /@vs-design\s+(\d+)x(\d+)/.exec(src);
  return { type, design: design ? { width: +design[1], height: +design[2] } : null };
}

const freePort = () => new Promise((res, rej) => {
  const s = netServer();
  s.unref();
  s.on('error', rej);
  s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => res(port)); });
});

async function startHarness(componentAbs, { props, layout, type }) {
  const viteDir = join(HARNESS, 'node_modules', 'vite');
  if (!existsSync(viteDir)) fail(`Harness dependencies are missing. Run once:\n  npm --prefix "${HARNESS}" install`);
  const pkg = JSON.parse(readFileSync(join(viteDir, 'package.json'), 'utf8'));
  let entry = pkg.exports?.['.'] ?? pkg.module ?? pkg.main;
  while (entry && typeof entry === 'object') entry = entry.import ?? entry.default;
  const { createServer } = await import(pathToFileURL(join(viteDir, entry)).href);
  process.env.VS_COMPONENT = componentAbs;
  process.env.VS_PROPS = JSON.stringify(props || {});
  process.env.VS_LAYOUT = layout;
  process.env.VS_TYPE = type || 'grow';
  const port = await freePort();
  const server = await createServer({
    configFile: join(HARNESS, 'vite.config.ts'), root: HARNESS, logLevel: 'error', clearScreen: false,
    server: { port, strictPort: true, host: '127.0.0.1' },
  });
  await server.listen();
  return { url: `http://127.0.0.1:${port}/`, close: () => server.close() };
}

function initScript(css) {
  return `(() => {
    const css = ${JSON.stringify(css)};
    const add = () => {
      if (!document.documentElement || document.getElementById('__vs_style')) return;
      const s = document.createElement('style'); s.id = '__vs_style'; s.textContent = css;
      (document.head || document.documentElement).appendChild(s);
    };
    add();
    document.addEventListener('DOMContentLoaded', add);
  })()`;
}

async function loadPage(page, vp, ctx) {
  await page.goto('about:blank');
  await page.setViewport(vp.width, vp.height);
  await page.goto(ctx.url);
  await page.networkIdle({ quietMs: 800, timeoutMs: 12000 });
  await page.evaluate(`Promise.race([document.fonts.ready.then(() => 1), new Promise(r => setTimeout(r, 5000))])`);
  await page.evaluate(`new Promise(r => { const t0 = Date.now(); const tick = () => { if ([...document.images].every(i => i.complete) || Date.now() - t0 > 6000) r(1); else setTimeout(tick, 100); }; tick(); })`);
  if (ctx.harness) {
    const state = await page.evaluate(`new Promise(r => { const t0 = Date.now(); const tick = () => { if (window.__VS_READY__) r('ready'); else if (window.__VS_ERROR__) r('error: ' + window.__VS_ERROR__); else if (Date.now() - t0 > 20000) r('timeout'); else setTimeout(tick, 100); }; tick(); })`);
    if (state !== 'ready') throw new Error(`Harness could not render the component (${state.slice(0, 600)})`);
  }
  await sleep(ctx.settle);
  await page.evaluate(CHECKS_SRC);
  await page.evaluate(c => window.__vs.setup(c), ctx.checkCfg);
}

async function auditViewport(page, vp, ctx) {
  const screensDir = join(ctx.outDir, 'screens', vp.id);
  mkdirSync(screensDir, { recursive: true });
  const result = { ...vp, screensDir, findings: [], positions: [], pageErrors: [] };
  const offErr = page.conn.on('Runtime.exceptionThrown', p => {
    if (result.pageErrors.length < 5) result.pageErrors.push((p.exceptionDetails?.exception?.description || p.exceptionDetails?.text || '').split('\n')[0]);
  });
  try {
    await loadPage(page, vp, ctx);
    const plan = await page.evaluate(o => window.__vs.plan(o), { sceneSteps: ctx.sceneSteps });
    result.plan = { sections: plan.sections, scenes: plan.scenes, docHeight: plan.docHeight, scrollbar: plan.scrollbar };
    for (const pos of plan.positions) {
      await page.evaluate(y => window.__vs.scrollTo(y), pos.y);
      if (pos.kind !== 'load') await sleep(ctx.posSettle);
      // Check twice, 700ms apart, and keep only findings present both times: layout bugs are stable,
      // elements caught mid-animation (logo cyclers, reveals, sliders) are not.
      const first = await page.evaluate(p => window.__vs.check(p), pos);
      await sleep(700);
      const res = await page.evaluate(p => window.__vs.check(p), pos);
      const seen = new Set(first.findings.map(f => `${f.check}|${f.severity}|${f.el}`));
      for (const f of res.findings) {
        if (seen.has(`${f.check}|${f.severity}|${f.el}`)) result.findings.push({ ...f, position: pos.id });
      }
      if (pos.kind === 'load') {
        const pc = await page.evaluate(() => window.__vs.pageChecks());
        for (const f of pc.findings) result.findings.push({ ...f, position: 'page' });
        result.maxFontSize = pc.maxFontSize;
        result.widestText = pc.widestText;
      }
      const file = join(screensDir, `${pos.id}.jpg`);
      writeFileSync(file, await page.screenshot({ format: 'jpeg', quality: 70 }));
      const entry = { id: pos.id, kind: pos.kind, y: pos.y, scrollY: res.scrollY, screenshot: file, canvases: [] };
      if (res.canvases.length) {
        // Look at the canvases' own pixels: hide everything else (text on top of a scene is not the scene
        // touching its edge). visibility does not change layout. Animated scenes move, so sample three
        // frames and keep the strongest contact per side.
        await page.evaluate(`(() => { const s = document.createElement('style'); s.id = '__vs_canvas_only';
          s.textContent = 'html *:not(canvas){visibility:hidden !important} canvas{visibility:visible !important}';
          document.head.appendChild(s); return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); })()`);
        const frames = [];
        for (let k = 0; k < 3; k++) {
          if (k) await sleep(350);
          frames.push(decodePng(await page.screenshot({ format: 'png' })));
        }
        await page.evaluate(`document.getElementById('__vs_canvas_only')?.remove()`);
        for (const c of res.canvases) {
          const contact = { left: 0, right: 0, top: 0, bottom: 0 };
          for (const img of frames) {
            const e = edgeContact(img, c.rect);
            for (const side in contact) contact[side] = Math.max(contact[side], e[side]);
          }
          entry.canvases.push({ ...c, contact });
        }
      }
      result.positions.push(entry);
    }
  } catch (e) {
    result.error = e.message;
  } finally {
    offErr();
  }
  return result;
}

/** C9: a canvas edge that shows content here but not at the design baseline is probably cropped. */
function canvasEdgeFindings(results, baselineId) {
  const base = results.find(r => r.id === baselineId);
  for (const vp of results) {
    if (vp.id === baselineId) continue;
    for (const pos of vp.positions) {
      for (const c of pos.canvases) {
        const bp = base?.positions.find(p => p.id === pos.id);
        let bc = bp?.canvases.find(x => x.index === c.index);
        if (!bc && bp?.canvases.length) bc = [...bp.canvases].sort((a, b) => (b.rect.right - b.rect.left) * (b.rect.bottom - b.rect.top) - (a.rect.right - a.rect.left) * (a.rect.bottom - a.rect.top))[0];
        for (const side of ['left', 'right', 'top', 'bottom']) {
          const share = c.contact[side];
          if (share < CONTACT_MIN) continue;
          const baseShare = bc?.contact[side];
          if (baseShare !== undefined && baseShare >= CONTACT_MIN) continue;
          vp.findings.push({
            check: 'C9', severity: 'warn', el: c.el, position: pos.id,
            msg: baseShare === undefined
              ? `Canvas content touches the ${side} edge (${Math.round(share * 100)}% of the edge strip) and there is no design-viewport baseline to compare. Check the compare sheet.`
              : `Canvas content touches the ${side} edge here (${Math.round(share * 100)}% of the edge strip) but not at ${baselineId}: the scene is probably cropped at this window shape. Use an aspect-locked stage, an aspect-aware camera, or keep key content in the safe zone.`,
            data: { side, share: +share.toFixed(3), baseline: baseShare === undefined ? null : +baseShare.toFixed(3) },
          });
        }
      }
    }
  }
}

/** A graphic that already spills over text at the design size is part of the design, not a window-shape bug. */
function demoteDesignSpills(results, baselineId) {
  const base = results.find(r => r.id === baselineId);
  if (!base) return;
  const key = f => `${f.check}|${f.el}`;
  const atDesign = new Set(base.findings.filter(f => f.data?.kind === 'spill').map(key));
  for (const vp of results) {
    for (const f of vp.findings) {
      if (f.data?.kind === 'spill' && atDesign.has(key(f))) {
        f.severity = 'info';
        f.msg += ' Also happens at the design size, so it is probably intended.';
      }
    }
  }
}

async function runPool(items, n, fn) {
  const queue = [...items];
  const out = [];
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (queue.length) { const it = queue.shift(); out.push(await fn(it)); }
  }));
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || (!args.url && !args.component)) { console.log(HELP); process.exit(args.help ? 0 : 2); }
  if (Number(process.versions.node.split('.')[0]) < 22) fail('Node 22 or newer is required (for the built-in WebSocket).');

  const matrixFile = JSON.parse(readFileSync(join(HERE, 'viewports.json'), 'utf8'));
  const componentAbs = args.component ? resolve(String(args.component)) : null;
  if (componentAbs && !existsSync(componentAbs)) fail(`Component not found: ${componentAbs}`);

  const configPath = args.config ? resolve(String(args.config))
    : (componentAbs && findUp(dirname(componentAbs), 'viewport-safe.config.json')) || findUp(process.cwd(), 'viewport-safe.config.json');
  if (args.config && !existsSync(configPath)) fail(`Config not found: ${configPath}`);
  // Windows PowerShell 5.1 writes JSON with a UTF-8 BOM; JSON.parse rejects it, so strip it.
  const config = configPath ? JSON.parse(readFileSync(configPath, 'utf8').replace(/^﻿/, '')) : null;
  if (!config) console.warn('No viewport-safe.config.json found: C6 (width cap) is skipped and C5 uses displayTypeMax 120.');

  const hide = [...(config?.auditHideSelectors || []), ...(args.hide ? String(args.hide).split(',') : [])].map(s => s.trim()).filter(Boolean);
  const css = [
    args['no-scrollbar'] ? '' : '::-webkit-scrollbar{width:17px;height:17px;background:#f0f0f0}::-webkit-scrollbar-thumb{background:#c1c1c1;border:3px solid #f0f0f0}',
    hide.length ? `${hide.join(',')}{display:none !important}` : '',
  ].join('\n');

  const header = componentAbs ? readHeader(componentAbs) : { type: null, design: null };
  // fit components get a 100svh frame (like a Framer instance set to 100vh); scroll scenes and grow sections size themselves.
  const layout = String(args.layout || (header.type === 'fit' ? 'viewport' : 'fill'));
  const props = args.props ? JSON.parse(readFileSync(resolve(String(args.props)), 'utf8').replace(/^﻿/, '')) : {};
  const settle = Number(args.settle ?? 1500);
  const chromePath = args.chrome ? String(args.chrome) : undefined;

  let harness = null;
  let url = args.url ? String(args.url) : null;
  if (componentAbs) {
    harness = await startHarness(componentAbs, { props, layout, type: header.type });
    url = harness.url;
  }

  // --measure: content column width at three widths
  if (args.measure) {
    const { page, close } = await launch({ chromePath });
    const rows = [];
    try {
      for (const vp of [{ id: 'design', width: 1440, height: 900 }, { id: 'uw-half', width: 1720, height: 1280 }, { id: 'uw-full', width: 3440, height: 1280 }]) {
        await loadPage(page, vp, { url, settle, harness: !!harness, checkCfg: {} });
        rows.push({ ...vp, ...(await page.evaluate(() => window.__vs.measure())) });
      }
    } finally { await close(); if (harness) await harness.close(); }
    console.log('viewport     text span (left–right)   symmetric column');
    for (const r of rows) console.log(`${(r.id + ' ' + r.width + 'x' + r.height).padEnd(26)} ${r.blocks ? `${r.left}–${r.right} (${r.span}px)`.padEnd(24) : 'no text found'.padEnd(24)} ${r.blocks ? r.symmetric + 'px' : ''}`);
    const widest = rows[rows.length - 1];
    if (widest.blocks) console.log(`\nSuggested contentMaxWidth: ${Math.round(widest.symmetric / 8) * 8} (content column at ${widest.width}px wide, assuming it is centred)`);
    process.exit(0);
  }

  const matrix = String(args.matrix || 'required');
  let vps = matrixFile.viewports;
  if (args.only) {
    const ids = String(args.only).split(',').map(s => s.trim());
    const unknown = ids.filter(id => !vps.some(v => v.id === id));
    if (unknown.length) fail(`Unknown viewport id(s): ${unknown.join(', ')}`);
    vps = vps.filter(v => ids.includes(v.id));
  } else if (matrix === 'quick') vps = vps.filter(v => v.quick);
  else if (matrix === 'required') vps = vps.filter(v => v.required);
  else if (matrix !== 'all') fail(`Unknown --matrix ${matrix}`);

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outDir = resolve(String(args.out || 'viewport-audit'), stamp);
  mkdirSync(join(outDir, 'compare'), { recursive: true });

  const ctx = {
    url, outDir, settle, harness: !!harness,
    posSettle: Math.max(400, Math.round(settle / 3)),
    sceneSteps: Number(args['scroll-steps'] ?? 5),
    checkCfg: {
      contentMaxWidth: config?.contentMaxWidth ?? null,
      displayTypeMax: config?.displayTypeMax ?? 120,
      selector: args.selector ? String(args.selector) : (harness ? '#vs-frame' : null),
      harness: !!harness,
    },
  };

  const target = componentAbs ? `${basename(componentAbs)} (harness, layout ${layout}${header.type ? `, @vs-type ${header.type}` : ''})` : url;
  console.log(`Auditing ${target} at ${vps.length} viewport(s) → ${outDir}`);

  let browserPath = '';
  try {
    // Warm up the harness once so Vite finishes dependency optimisation before measuring.
    if (harness) {
      const { page, close, browserPath: bp } = await launch({ chromePath });
      browserPath = bp;
      try { await loadPage(page, { width: 1440, height: 900 }, { ...ctx, settle: 0 }); }
      catch (e) { await close(); throw e; }
      await close();
    }

    const workers = Math.max(1, Number(args.concurrency ?? 2));
    const runOne = async vp => {
      const { page, close, browserPath: bp } = await launch({ chromePath });
      browserPath = bp;
      try {
        await page.addInitScript(initScript(css));
        return await auditViewport(page, vp, ctx);
      } finally { await close(); }
    };
    const results = await runPool(vps, workers, async vp => {
      const t0 = Date.now();
      let r = await runOne(vp);
      // Heavy pages (WebGL, video) can starve a browser when several run at once: retry a timeout once.
      if (r.error && /timed out/.test(r.error)) {
        console.log(`  ${vp.id.padEnd(15)} timed out, retrying once…`);
        r = await runOne(vp);
      }
      console.log(`  ${vp.id.padEnd(15)} ${vp.width}x${vp.height}  ${r.error ? 'ERROR ' + r.error : `${r.positions.length} positions, ${((Date.now() - t0) / 1000).toFixed(0)}s`}`);
      return r;
    });
    const ordered = vps.map(v => results.find(r => r.id === v.id));

    canvasEdgeFindings(ordered, matrixFile.baseline);
    demoteDesignSpills(ordered, matrixFile.baseline);
    for (const vp of ordered) {
      vp.findings = dedupe(vp.findings);
      vp.summary = summarize(vp);
    }

    const run = {
      target, mode: harness ? 'harness' : 'url', url, selector: args.selector || null, matrix: args.only ? `only ${args.only}` : matrix,
      date: new Date().toISOString(), configPath, config, browser: browserPath,
      scrollbarSimulated: !args['no-scrollbar'] && ordered.some(v => (v.plan?.scrollbar ?? 0) >= 15),
      primary: matrixFile.primary, compareColumns: matrixFile.compare.filter(id => ordered.some(v => v.id === id)),
      viewports: ordered, compareSheets: [],
    };
    run.requiredFailed = ordered.filter(v => v.required && !v.summary.pass).map(v => v.id);
    run.pass = run.requiredFailed.length === 0;

    const { page, close } = await launch({ chromePath });
    try {
      const cols = run.compareColumns.length >= 2 ? run.compareColumns : ordered.map(v => v.id);
      run.compareColumns = cols;
      run.compareSheets = await writeCompareSheets(page, outDir, run, cols);
    } finally { await close(); }

    writeReports(outDir, run);

    console.log('');
    for (const vp of ordered) {
      const s = vp.summary;
      console.log(`${vp.id === run.primary ? '*' : ' '} ${vp.id.padEnd(15)} ${`${vp.width}x${vp.height}`.padEnd(10)} ${vp.error ? 'ERROR' : s.pass ? 'PASS ' : 'FAIL '}  errors: ${s.errorChecks.join(',') || '-'}  warnings: ${s.warnChecks.join(',') || '-'}${vp.required ? '' : '  (optional)'}`);
    }
    console.log(`\n${run.pass ? 'PASS' : 'FAIL'}: ${run.pass ? 'all required viewports pass' : `required viewports failing: ${run.requiredFailed.join(', ')}`}`);
    console.log(`Report: ${join(outDir, 'report.md')}`);
    console.log(`Compare sheets (review each): ${join(outDir, 'compare')}/`);
    process.exitCode = run.pass ? 0 : 1;
  } finally {
    if (harness) await harness.close();
  }
}

main().catch(e => { console.error(e.stack || e.message); process.exit(2); });
