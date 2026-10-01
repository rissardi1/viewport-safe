// Report writing: report.json, report.md and side-by-side compare sheets.
import { writeFileSync, existsSync, rmSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

const CHECK_NAMES = {
  C1: 'horizontal overflow', C2: 'fit', C3: 'text/CTA clipping', C4: 'above the fold', C5: 'type size',
  C6: 'width cap', C7: 'key-visual containment', C8: 'cover-crop', C9: 'canvas edge contact', C10: 'overlap', C11: 'empty stage', C12: 'legibility',
};

/** Groups repeated findings (same check + element + severity) and keeps the positions where they appeared. */
export function dedupe(findings) {
  const map = new Map();
  for (const f of findings) {
    const key = `${f.check}|${f.severity}|${f.el}|${f.msg.replace(/\d+(\.\d+)?/g, '#')}`;
    if (!map.has(key)) map.set(key, { ...f, positions: [] });
    const g = map.get(key);
    if (f.position && !g.positions.includes(f.position)) g.positions.push(f.position);
  }
  return [...map.values()];
}

export function summarize(vp) {
  const errors = vp.findings.filter(f => f.severity === 'error');
  const warns = vp.findings.filter(f => f.severity === 'warn');
  const infos = vp.findings.filter(f => f.severity === 'info');
  const ids = list => [...new Set(list.map(f => f.check))].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
  return { pass: errors.length === 0 && !vp.error, errors, warns, infos, errorChecks: ids(errors), warnChecks: ids(warns) };
}

export function writeReports(outDir, run) {
  writeFileSync(join(outDir, 'report.json'), JSON.stringify(run, null, 2));
  const L = [];
  const rel = p => relative(outDir, p);
  L.push(`# Viewport audit: ${run.target}`, '');
  L.push(`- Date: ${run.date}`);
  L.push(`- Mode: ${run.mode}${run.selector ? ` (scoped to \`${run.selector}\`)` : ''}, matrix: ${run.matrix}`);
  L.push(`- Config: ${run.configPath || 'none found'}${run.config ? ` (contentMaxWidth ${run.config.contentMaxWidth ?? '?'}, displayTypeMax ${run.config.displayTypeMax ?? '?'})` : ''}`);
  L.push(`- Browser: ${run.browser}; Windows-style 17px scrollbar simulated: ${run.scrollbarSimulated ? 'yes' : 'no'}`);
  L.push(`- Overall: **${run.pass ? 'PASS' : 'FAIL'}** (${run.requiredFailed.length ? `required viewports failing: ${run.requiredFailed.join(', ')}` : 'all required viewports pass'})`, '');

  L.push('| Viewport | Size | Required | Result | Errors | Warnings | Screenshots |');
  L.push('|---|---|---|---|---|---|---|');
  for (const vp of run.viewports) {
    const s = vp.summary;
    const name = vp.id === run.primary ? `**${vp.id}** (primary)` : vp.id;
    L.push(`| ${name} | ${vp.width}x${vp.height} | ${vp.required ? 'yes' : 'no'} | ${vp.error ? 'ERROR' : s.pass ? 'PASS' : 'FAIL'} | ${s.errorChecks.join(', ') || '—'} | ${s.warnChecks.join(', ') || '—'} | ${rel(vp.screensDir)}/ |`);
  }
  L.push('');

  L.push('## Findings', '');
  for (const vp of run.viewports) {
    const s = vp.summary;
    if (vp.error) { L.push(`### ${vp.id} (${vp.width}x${vp.height})`, '', `- Audit error: ${vp.error}`, ''); continue; }
    if (!s.errors.length && !s.warns.length) continue;
    L.push(`### ${vp.id} (${vp.width}x${vp.height})`, '');
    for (const f of [...s.errors, ...s.warns]) {
      const where = f.positions.length ? ` (at ${f.positions.slice(0, 4).join(', ')}${f.positions.length > 4 ? ` +${f.positions.length - 4}` : ''})` : '';
      L.push(`- **${f.check} ${CHECK_NAMES[f.check]} — ${f.severity}**${where}: ${f.msg}${f.el ? ` Element: ${f.el}` : ''}`);
      if (f.data?.culprits?.length) for (const c of f.data.culprits) L.push(`  - wider element: ${c.el} (right edge ${c.right}px, width ${c.width}px)`);
    }
    L.push('');
  }
  const infoCount = run.viewports.reduce((a, vp) => a + vp.summary.infos.length, 0);
  if (infoCount) {
    L.push('## Info (not failures)', '');
    for (const vp of run.viewports) for (const f of vp.summary.infos.slice(0, 8)) L.push(`- ${vp.id} ${f.check}: ${f.msg}${f.el ? ` Element: ${f.el}` : ''}`);
    L.push('');
  }

  L.push('## Page facts', '');
  L.push('| Viewport | Sections | Scroll scenes | Positions | Max font | Widest text |');
  L.push('|---|---|---|---|---|---|');
  for (const vp of run.viewports) {
    if (!vp.plan) continue;
    L.push(`| ${vp.id} | ${vp.plan.sections} | ${vp.plan.scenes.length} | ${vp.positions.length} | ${vp.maxFontSize ?? '—'}px | ${vp.widestText ? `${vp.widestText.width}px` : '—'} |`);
  }
  L.push('');

  L.push('## Compare sheets: review every one', '');
  L.push(`Columns: ${run.compareColumns.join(' | ')}. Open each file and note what is cut off, overlapping or empty.`, '');
  for (const c of run.compareSheets) L.push(`- ${rel(c.file)} (${c.id})`);
  L.push('', '## Visual review', '', '_Write one line per compare sheet here or in your final answer: what differs between viewports, and whether anything is cut, overlapping or looks empty._', '');
  writeFileSync(join(outDir, 'report.md'), L.join('\n'));
}

/** Renders one side-by-side sheet per position id using the browser page (no image library needed). */
export async function writeCompareSheets(page, outDir, run, columns) {
  const byId = new Map();
  for (const vp of run.viewports) for (const p of vp.positions || []) {
    if (!p.screenshot) continue;
    if (!byId.has(p.id)) byId.set(p.id, {});
    byId.get(p.id)[vp.id] = { file: p.screenshot, w: vp.width, h: vp.height };
  }
  const sheets = [];
  const H = 330;
  for (const [id, shots] of byId) {
    const cols = columns.filter(c => shots[c]);
    if (cols.length < 2) continue;
    const cells = cols.map(c => {
      const s = shots[c];
      const w = Math.round((s.w * H) / s.h);
      return `<figure style="margin:0;width:${w}px"><figcaption>${c} · ${s.w}x${s.h}</figcaption><img src="${pathToFileURL(s.file).href}" style="width:${w}px;height:${H}px;display:block;outline:1px solid #999"></figure>`;
    });
    const html = `<!doctype html><html><body style="margin:0;padding:10px;background:#fff;font:600 14px system-ui,sans-serif;color:#111">
<div style="margin:0 0 8px">${id}</div><div style="display:flex;gap:14px;align-items:flex-start;width:max-content">${cells.join('')}</div></body></html>`;
    const htmlPath = join(outDir, 'compare', `${id}.html`);
    writeFileSync(htmlPath, html);
    const totalW = cols.reduce((a, c) => a + Math.round((shots[c].w * H) / shots[c].h), 0) + 14 * (cols.length - 1) + 20;
    await page.setViewport(Math.max(400, totalW), H + 60);
    await page.goto(pathToFileURL(htmlPath).href);
    await page.evaluate(() => Promise.all([...document.images].map(i => i.decode().catch(() => null))));
    const buf = await page.fullPageScreenshot({ format: 'jpeg', quality: 80 });
    const file = join(outDir, 'compare', `${id}.jpg`);
    writeFileSync(file, buf);
    if (existsSync(htmlPath)) rmSync(htmlPath);
    sheets.push({ id, file, columns: cols });
  }
  return sheets;
}
