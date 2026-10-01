// In-page audit logic. Injected by viewport-audit.mjs; defines window.__vs.
// Check IDs: C1 horizontal overflow, C2 fit, C3 text/CTA clipping, C4 above the fold, C5 type size,
// C6 width cap, C7 key-visual containment, C8 cover-crop, C9 canvas edge contact (collects canvases here,
// pixels are analysed in Node), C10 overlap, C11 empty stage, C12 legibility (text colour vs what is behind it).
(() => {
  if (window.__vs) return;
  const vs = {};
  let cfg = { contentMaxWidth: null, displayTypeMax: 120, selector: null, harness: false };

  const W = () => document.documentElement.clientWidth;
  const H = () => window.innerHeight;
  const has = (el, t) => !!(el && el.closest && el.closest(`[data-vs~="${t}"]`));
  const ignored = el => !!el.closest('[data-vs-harness]');
  const root = () => (cfg.selector && document.querySelector(cfg.selector)) || document.body;
  const inScope = el => { const r = root(); return r === el || r.contains(el); };
  const round = n => Math.round(n);
  const rectOf = r => ({ left: round(r.left), top: round(r.top), right: round(r.right), bottom: round(r.bottom), width: round(r.width), height: round(r.height) });

  function effOpacity(el) {
    let o = 1;
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === 'none') return 0;
      o *= parseFloat(cs.opacity);
      if (o < 0.01) return 0;
    }
    return getComputedStyle(el).visibility === 'hidden' ? 0 : o;
  }

  /** Nearest ancestor (or self) that is position fixed/sticky: elements in different layers may overlap by design. */
  function layerRoot(el) {
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      const p = getComputedStyle(e).position;
      if (p === 'fixed' || p === 'sticky') return e;
    }
    return null;
  }
  const inFixed = el => { for (let e = el; e && e.nodeType === 1; e = e.parentElement) if (getComputedStyle(e).position === 'fixed') return true; return false; };

  function label(el) {
    const name = el.getAttribute('data-framer-name');
    const tokens = el.getAttribute('data-vs');
    const txt = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    const path = [];
    for (let e = el.parentElement; e && e !== document.body && path.length < 2; e = e.parentElement) {
      const n = e.getAttribute('data-framer-name') || (e.id && !/^[0-9]/.test(e.id) ? '#' + e.id : '');
      if (n) path.unshift(n);
    }
    return `${el.tagName.toLowerCase()}${tokens ? `[data-vs="${tokens}"]` : ''}${name ? ` "${name}"` : ''}` +
      `${txt ? ` “${txt}${txt.length === 40 ? '…' : ''}”` : ''}${path.length ? ` in ${path.join(' > ')}` : ''}`;
  }

  function directText(el) {
    let s = '';
    for (const n of el.childNodes) if (n.nodeType === 3) s += n.textContent;
    return s.trim();
  }

  function textElements(scope) {
    const out = [];
    const seen = new Set();
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
      acceptNode: n => (n.textContent.trim().length >= 2 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
    });
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      if (!el || seen.has(el)) continue;
      seen.add(el);
      if (el.closest('script,style,noscript,template,title') || ignored(el)) continue;
      out.push(el);
    }
    return out;
  }

  /** Line boxes of the element's own text nodes, plus their union. */
  function textRects(el) {
    const lines = [];
    for (const n of el.childNodes) {
      if (n.nodeType !== 3 || !n.textContent.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      for (const r of range.getClientRects()) if (r.width >= 0.5 && r.height >= 0.5) lines.push(r);
    }
    if (!lines.length) return null;
    const u = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
    for (const r of lines) { u.left = Math.min(u.left, r.left); u.top = Math.min(u.top, r.top); u.right = Math.max(u.right, r.right); u.bottom = Math.max(u.bottom, r.bottom); }
    u.width = u.right - u.left; u.height = u.bottom - u.top;
    return { lines, union: u };
  }

  /**
   * The CSS line box of a line rect. Range.getClientRects returns the font's content area (ascent + descent),
   * which is taller than the line box whenever line-height is tight (a serif headline at 1.0 or 1.05). Two lines
   * of one headline then "overlap" by 15-25% of the font size although they are set exactly as designed.
   */
  function lineBox(el, r) {
    const lh = parseFloat(getComputedStyle(el).lineHeight); // NaN for "normal"
    if (!(lh > 0) || lh >= r.height) return r;
    const mid = (r.top + r.bottom) / 2;
    return { left: r.left, right: r.right, top: mid - lh / 2, bottom: mid + lh / 2, width: r.width, height: lh };
  }

  /** Ancestors that clip (hidden/clip) or scroll (auto/scroll), nearest first. The viewport is handled separately. */
  function clippers(el) {
    const out = [];
    for (let e = el.parentElement; e && e !== document.body && e !== document.documentElement; e = e.parentElement) {
      const cs = getComputedStyle(e);
      // display: contents has no box and clips nothing (Framer wraps pages in one with overflow: clip).
      if (cs.display === 'contents') continue;
      const clipX = cs.overflowX === 'hidden' || cs.overflowX === 'clip';
      const clipY = cs.overflowY === 'hidden' || cs.overflowY === 'clip';
      const scrollX = cs.overflowX === 'auto' || cs.overflowX === 'scroll';
      const scrollY = cs.overflowY === 'auto' || cs.overflowY === 'scroll';
      if (clipX || clipY || scrollX || scrollY) out.push({ el: e, clipX, clipY, scrollX, scrollY });
      if (cs.position === 'fixed') break;
    }
    return out;
  }

  /** How much of rect r is cut by clip rect c on the clipping axes. */
  function cutBy(r, c, onX, onY) {
    const cut = { left: 0, right: 0, top: 0, bottom: 0 };
    let outside = false;
    if (onX) {
      if (r.right <= c.left || r.left >= c.right) outside = true;
      cut.left = Math.max(0, c.left - r.left); cut.right = Math.max(0, r.right - c.right);
    }
    if (onY) {
      if (r.bottom <= c.top || r.top >= c.bottom) outside = true;
      cut.top = Math.max(0, c.top - r.top); cut.bottom = Math.max(0, r.bottom - c.bottom);
    }
    const max = Math.max(cut.left, cut.right, cut.top, cut.bottom);
    return { outside, max, cut };
  }

  /** True when el sits in a carousel/marquee track inside clipper c: an ancestor much wider than c, or translated on x. */
  function inTrack(el, c) {
    const cw = c.getBoundingClientRect().width;
    for (let e = el.parentElement; e && e !== c; e = e.parentElement) {
      if (e.getBoundingClientRect().width >= 1.5 * cw) return true;
      const t = getComputedStyle(e).transform;
      if (t && t !== 'none') {
        const m = new DOMMatrixReadOnly(t);
        if (Math.abs(m.m41) > 1) return true;
      }
    }
    return false;
  }

  /** Less than 30% of the element is visible on a clipping axis. */
  function mostlyHidden(r, cr, c) {
    const visX = Math.max(0, Math.min(r.right, cr.right) - Math.max(r.left, cr.left)) / Math.max(1, r.width);
    const visY = Math.max(0, Math.min(r.bottom, cr.bottom) - Math.max(r.top, cr.top)) / Math.max(1, r.height);
    return (c.clipX && visX < 0.3) || (c.clipY && visY < 0.3);
  }

  /** The element (or an ancestor below the clipper) is translated: typical of reveal/hover animations. */
  function movedWithin(el, clipper) {
    for (let e = el; e && e !== clipper; e = e.parentElement) {
      const t = getComputedStyle(e).transform;
      if (t && t !== 'none') {
        const m = new DOMMatrixReadOnly(t);
        if (Math.abs(m.m41) > 1 || Math.abs(m.m42) > 1) return true;
      }
    }
    return false;
  }

  const viewportRect = () => ({ left: 0, top: 0, right: W(), bottom: H() });
  const intersects = (a, b, min = 0) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > min && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > min;
  const inView = r => r.bottom > 0 && r.top < H() && r.width > 0 && r.height > 0;

  // ---------- plan: sections, scroll scenes, positions ----------

  function findSections() {
    if (cfg.harness) {
      const frame = document.getElementById('vs-frame');
      return frame ? [frame] : [];
    }
    const vw = W();
    const docH = document.documentElement.scrollHeight;
    const scope = root();
    const candidates = [scope, ...scope.querySelectorAll('*')];
    for (const min of [3, 2]) {
      for (const c of candidates) {
        if (c.getBoundingClientRect().width < 0.95 * vw) continue;
        const kids = [...c.children].filter(k => {
          const r = k.getBoundingClientRect();
          const cs = getComputedStyle(k);
          return r.width >= 0.95 * vw && r.height >= 100 && cs.position !== 'fixed' && cs.display !== 'none' && !ignored(k);
        });
        const sum = kids.reduce((a, k) => a + k.getBoundingClientRect().height, 0);
        if (kids.length >= min && sum >= 0.6 * (cfg.selector ? scope.getBoundingClientRect().height : docH)) return kids;
      }
    }
    return [];
  }

  function findScenes() {
    const out = [];
    const add = (el, how) => {
      if (!el || !inScope(el) || ignored(el) || out.some(s => s.el === el)) return;
      out.push({ el, how });
    };
    for (const el of document.querySelectorAll('[data-vs~="scroll-scene"]')) add(el, 'data-vs');
    for (const el of document.querySelectorAll('.pin-spacer')) add(el, 'gsap-pin');
    for (const el of document.body.querySelectorAll('*')) {
      if (getComputedStyle(el).position !== 'sticky') continue;
      const p = el.parentElement;
      if (!p || inFixed(el)) continue;
      // A pinned stage: a tall-enough sticky child with some scroll range in its parent
      // (Framer scroll scenes are often only 1.3–1.5 screens tall).
      const ph = p.getBoundingClientRect().height, sh = el.getBoundingClientRect().height;
      if (sh >= 0.3 * H() && ph - sh >= 0.25 * H()) add(p, 'sticky');
    }
    // Drop scenes nested inside another scene with the same scroll range.
    return out.filter(s => !out.some(o => o !== s && o.el.contains(s.el) &&
      Math.abs(o.el.getBoundingClientRect().height - s.el.getBoundingClientRect().height) < 4));
  }

  function pinnedStages(sceneEl) {
    if (sceneEl.classList.contains('pin-spacer') && sceneEl.firstElementChild) return [sceneEl.firstElementChild];
    const out = [];
    for (const el of sceneEl.querySelectorAll('*')) {
      if (getComputedStyle(el).position === 'sticky' && el.getBoundingClientRect().height >= 0.3 * H() && !out.some(o => o.contains(el))) out.push(el);
    }
    return out;
  }

  const slug = s => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32);

  vs.setup = c => { cfg = { ...cfg, ...c }; return true; };

  vs.plan = ({ sceneSteps = 5 } = {}) => {
    const docTop = el => el.getBoundingClientRect().top + scrollY;
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - H());
    const positions = [{ id: 'load', y: 0, kind: 'load' }];
    const sections = findSections();
    sections.forEach((el, i) => {
      const name = el.getAttribute('data-framer-name') || el.id || el.tagName.toLowerCase();
      positions.push({ id: `s${String(i + 1).padStart(2, '0')}-${slug(name)}`, y: Math.min(maxScroll, round(docTop(el))), kind: 'section', label: label(el) });
    });
    if (cfg.harness && sections[0]) {
      // Components taller than the window: also look at each further screenful.
      const top = docTop(sections[0]);
      const h = sections[0].getBoundingClientRect().height;
      for (let k = 1, y = top + H(); y < top + h - 0.25 * H(); k++, y += H()) {
        positions.push({ id: `part${k + 1}`, y: Math.min(maxScroll, round(y)), kind: 'section', label: `screen ${k + 1} of the component` });
      }
    }
    const scenes = findScenes();
    vs._scenes = scenes.map(s => s.el);
    scenes.forEach((s, k) => {
      const top = docTop(s.el);
      const range = Math.max(0, s.el.getBoundingClientRect().height - H());
      const name = s.el.getAttribute('data-framer-name') || '';
      for (let i = 0; i < sceneSteps; i++) {
        const pct = sceneSteps === 1 ? 0 : Math.round((i / (sceneSteps - 1)) * 100);
        positions.push({ id: `scene${k + 1}${name ? '-' + slug(name) : ''}-p${String(pct).padStart(3, '0')}`, y: Math.min(maxScroll, round(top + (range * pct) / 100)), kind: 'scene', scene: k, pct });
      }
    });
    positions.sort((a, b) => (a.kind === 'load' ? -1 : b.kind === 'load' ? 1 : a.y - b.y));
    // A section that starts at the same scroll position as an earlier one adds nothing (e.g. the hero at y=0).
    const unique = positions.filter((p, i) => p.kind !== 'section' || !positions.slice(0, i).some(q => Math.abs(q.y - p.y) <= 2));
    return {
      positions: unique,
      sections: sections.length,
      scenes: scenes.map(s => ({ how: s.how, label: label(s.el), height: round(s.el.getBoundingClientRect().height) })),
      docHeight: document.documentElement.scrollHeight,
      innerWidth, innerHeight, clientWidth: W(),
      scrollbar: innerWidth - W(),
    };
  };

  /** Scrolls gradually so scroll-linked animations (Framer Motion, GSAP) update on the way. */
  vs.scrollTo = async target => {
    const max = Math.max(0, document.documentElement.scrollHeight - H());
    target = Math.max(0, Math.min(target, max));
    const frame = () => new Promise(r => { let done = false; const fin = () => { if (!done) { done = true; r(); } }; requestAnimationFrame(() => requestAnimationFrame(fin)); setTimeout(fin, 120); });
    let y = scrollY;
    const dist = target - y;
    const step = Math.sign(dist) * Math.max(40, Math.abs(dist) / 25);
    while (Math.abs(target - y) > Math.abs(step)) { y += step; window.scrollTo(0, y); await frame(); }
    window.scrollTo(0, target);
    await frame(); await frame();
    return scrollY;
  };

  // ---------- checks ----------

  vs.check = pos => {
    const findings = [];
    const add = (check, severity, el, msg, data = {}) => findings.push({ check, severity, el: el ? label(el) : null, msg, data });
    const vw = W(), vh = H();
    const scope = root();
    const isLoad = pos.kind === 'load';

    // C1 horizontal overflow
    const sw = document.documentElement.scrollWidth;
    if (sw > vw + 1) {
      const culprits = [];
      for (const el of document.body.querySelectorAll('*')) {
        if (ignored(el)) continue;
        const r = el.getBoundingClientRect();
        if (r.right <= vw + 1 || !r.width || !r.height) continue;
        if (getComputedStyle(el).position === 'fixed') continue;
        let clipped = false;
        for (let e = el.parentElement; e && e !== document.body && e !== document.documentElement; e = e.parentElement) {
          const cs = getComputedStyle(e);
          if (cs.position === 'fixed') { clipped = true; break; }
          if (cs.display !== 'contents' && cs.overflowX !== 'visible' && e.getBoundingClientRect().right <= vw + 1) { clipped = true; break; }
        }
        if (!clipped) culprits.push(el);
      }
      const outer = culprits.filter(el => !culprits.some(o => o !== el && o.contains(el))).slice(0, 5);
      add('C1', 'error', outer[0] || null, `Page scrolls sideways: content is ${sw - vw}px wider than the window.`, {
        overflowPx: sw - vw,
        culprits: outer.map(el => ({ el: label(el), right: round(el.getBoundingClientRect().right), width: round(el.getBoundingClientRect().width) })),
      });
    }

    // C2 fit (at load) and pinned stages (during scenes)
    if (isLoad) {
      for (const el of scope.querySelectorAll('[data-vs~="fit"]')) {
        if (ignored(el) || effOpacity(el) === 0) continue;
        const h = el.getBoundingClientRect().height;
        if (h > vh + 2) add('C2', 'error', el, `Fit element is ${round(h)}px tall in a ${vh}px window (${round(h - vh)}px too tall).`, { height: round(h), viewport: vh });
      }
    }
    if (pos.kind === 'scene' && vs._scenes && vs._scenes[pos.scene]) {
      for (const st of pinnedStages(vs._scenes[pos.scene])) {
        const h = st.getBoundingClientRect().height;
        if (h > vh + 2) add('C2', 'error', st, `Pinned stage is ${round(h)}px tall in a ${vh}px window; content below ${vh}px is never visible.`, { height: round(h), viewport: vh });
      }
    }

    // Visible text: in view, and near view (a CTA pushed out of a clipped hero sits just below it)
    const near = r => r.bottom > -vh && r.top < 2 * vh && r.width > 0 && r.height > 0;
    const allTexts = textElements(scope).map(el => ({ el, tr: textRects(el) })).filter(t => t.tr && near(t.tr.union) && effOpacity(t.el) >= 0.5);
    const texts = allTexts.filter(t => inView(t.tr.union));

    // C3 clipping of text and CTAs
    const controls = [...scope.querySelectorAll('button, a[href], [role=button]')]
      .filter(el => !ignored(el) && near(el.getBoundingClientRect()) && effOpacity(el) >= 0.5)
      .map(el => ({ el, rect: el.getBoundingClientRect(), control: true }));
    const subjects = [...allTexts.map(t => ({ el: t.el, rect: t.tr.union })), ...controls];
    for (const s of subjects) {
      if (has(s.el, 'clip-ok') || s.el.closest('[aria-hidden="true"]')) continue;
      let reported = false;
      for (const c of clippers(s.el)) {
        const cr = c.el.getBoundingClientRect();
        const hard = cutBy(s.rect, cr, c.clipX, c.clipY);
        const soft = cutBy(s.rect, cr, c.scrollX, c.scrollY);
        if (hard.outside) {
          // Pushed out of the bottom/top of a tall clipped section that is in view (e.g. a CTA below a
          // 100vh hero with overflow:hidden) is a real bug. Anything else fully hidden (off-screen slides,
          // collapsed accordions, parked reveal animations) is not.
          const overlapsX = Math.min(s.rect.right, cr.right) - Math.max(s.rect.left, cr.left) > 0;
          const pushedOut = c.clipY && overlapsX && cr.height >= 0.5 * vh && inView(cr) &&
            (s.rect.top >= cr.bottom ? s.rect.top - cr.bottom : cr.top - s.rect.bottom) < vh &&
            !inTrack(s.el, c.el) && !movedWithin(s.el, c.el);
          if (pushedOut) {
            add('C3', 'error', s.el, `${s.control ? 'Button/link' : 'Text'} is completely hidden: it sits ${round(s.rect.top >= cr.bottom ? s.rect.top - cr.bottom : cr.top - s.rect.bottom)}px outside a ${round(cr.height)}px-tall overflow:hidden/clip section. The section is too short for its content at this window size.`,
              { clipper: label(c.el), clipperHeight: round(cr.height) });
          }
          reported = true; break;
        }
        if (!inView(s.rect)) { reported = true; break; }
        if (hard.max >= 2) {
          const track = inTrack(s.el, c.el);
          const reveal = !track && mostlyHidden(s.rect, cr, c) && movedWithin(s.el, c.el);
          const note = track ? ' (inside a carousel/track; mark data-vs="clip-ok" if intended)'
            : reveal ? ' (mostly hidden and moved by a transform: looks like a hover/reveal animation; mark data-vs="clip-ok" if intended)' : '';
          add('C3', track || reveal ? 'info' : 'error', s.el,
            `${s.control ? 'Button/link' : 'Text'} is cut ${round(hard.max)}px by an overflow:hidden/clip ancestor${note}.`,
            { cut: Object.fromEntries(Object.entries(hard.cut).map(([k, v]) => [k, round(v)])), clipper: label(c.el) });
          reported = true; break;
        }
        if (!soft.outside && soft.max >= 2) {
          add('C3', 'info', s.el, `Partly scrolled out of a scroll container (${round(soft.max)}px).`, { clipper: label(c.el) });
          reported = true; break;
        }
      }
      if (reported || inFixed(s.el)) continue;
      const vr = viewportRect();
      if (inView(s.rect) && (s.rect.left < -2 || s.rect.right > vw + 2) && s.rect.right > 0 && s.rect.left < vw) {
        const track = (() => { for (let e = s.el.parentElement; e && e !== document.body; e = e.parentElement) if (e.getBoundingClientRect().width >= 1.5 * vw) return true; return false; })();
        add('C3', track ? 'info' : 'error', s.el, `${s.control ? 'Button/link' : 'Text'} runs past the ${s.rect.left < 0 ? 'left' : 'right'} window edge by ${round(Math.max(-s.rect.left, s.rect.right - vr.right))}px${track ? ' (inside a track wider than the window)' : ''}.`,
          { left: round(s.rect.left), right: round(s.rect.right) });
      }
    }

    // C4 above the fold (load only)
    if (isLoad) {
      for (const el of scope.querySelectorAll('[data-vs~="above-fold"]')) {
        if (ignored(el) || effOpacity(el) === 0) continue;
        const r = el.getBoundingClientRect();
        if (r.left < -1 || r.top < -1 || r.right > vw + 1 || r.bottom > vh + 1) {
          add('C4', 'error', el, `Above-the-fold element is not fully visible on load (bottom at ${round(r.bottom)}px in a ${vh}px window).`, { rect: rectOf(r) });
        }
      }
    }

    // C7 key-visual containment
    for (const el of scope.querySelectorAll('[data-vs~="key-visual"]')) {
      if (ignored(el) || getComputedStyle(el).display === 'none') continue;
      const r = el.getBoundingClientRect();
      if (!inView(r)) continue;
      const cutL = Math.max(0, -r.left), cutR = Math.max(0, r.right - vw);
      if (cutL > 1 || cutR > 1) {
        add('C7', 'error', el, `Key visual is cut by the window edge: ${round(cutL)}px left, ${round(cutR)}px right (${round(((cutL + cutR) / r.width) * 100)}% of its width).`, { rect: rectOf(r), cutLeft: round(cutL), cutRight: round(cutR) });
        continue;
      }
      let clipped = false;
      for (const c of clippers(el)) {
        const res = cutBy(r, c.el.getBoundingClientRect(), c.clipX, c.clipY);
        if (!res.outside && res.max >= 2) {
          add('C7', 'error', el, `Key visual is clipped ${round(res.max)}px by an overflow:hidden/clip ancestor.`, { cut: Object.fromEntries(Object.entries(res.cut).map(([k, v]) => [k, round(v)])), clipper: label(c.el) });
          clipped = true; break;
        }
      }
      if (!clipped && isLoad && el.closest('[data-vs~="fit"]') && (r.top < -1 || r.bottom > vh + 1)) {
        add('C7', 'error', el, `Key visual in a fit section is not fully inside the window on load (spans ${round(r.top)}–${round(r.bottom)}px of ${vh}px).`, { rect: rectOf(r) });
      }
    }

    // C8 cover-crop estimate
    for (const el of scope.querySelectorAll('img, video')) {
      if (ignored(el) || has(el, 'bg')) continue;
      if (getComputedStyle(el).objectFit !== 'cover') continue;
      const r = el.getBoundingClientRect();
      if (!inView(r) || effOpacity(el) < 0.05) continue;
      const vis = { left: Math.max(0, r.left), top: Math.max(0, r.top), right: Math.min(vw, r.right), bottom: Math.min(vh, r.bottom) };
      if ((vis.right - vis.left) * (vis.bottom - vis.top) < 0.25 * vw * vh) continue;
      const iw = el.naturalWidth || el.videoWidth, ih = el.naturalHeight || el.videoHeight;
      if (!iw || !ih) continue;
      const ia = iw / ih, ba = r.width / r.height;
      const wFrac = ia > ba ? ba / ia : 1, hFrac = ia > ba ? 1 : ia / ba;
      if (wFrac < 0.8 || hFrac < 0.7) {
        const key = has(el, 'key-visual');
        add('C8', key ? 'error' : 'warn', el, `object-fit: cover shows ${round(wFrac * 100)}% of the ${el.tagName.toLowerCase()}'s width and ${round(hFrac * 100)}% of its height here.${key ? '' : ' Fine for a background (mark data-vs="bg"); not fine if it carries a logo, text or the main subject.'}`,
          { widthVisible: +wFrac.toFixed(3), heightVisible: +hFrac.toFixed(3), intrinsic: `${iw}x${ih}`, box: `${round(r.width)}x${round(r.height)}` });
      }
    }

    // C10 overlap (text vs text, text vs key visual) within the same layer
    const keyVisuals = [...scope.querySelectorAll('[data-vs~="key-visual"]')].filter(el => !ignored(el) && inView(el.getBoundingClientRect()));
    const ov = texts.filter(t => !has(t.el, 'overlay-ok') && !t.el.closest('[aria-hidden="true"]'));
    for (let i = 0; i < ov.length; i++) {
      for (let j = i + 1; j < ov.length; j++) {
        const A = ov[i], B = ov[j];
        if (A.el.contains(B.el) || B.el.contains(A.el)) continue;
        if (layerRoot(A.el) !== layerRoot(B.el)) continue;
        if (!intersects(A.tr.union, B.tr.union, 4)) continue;
        // Compare line boxes, not glyph content areas, so tight leading is not reported as an overlap.
        const hit = A.tr.lines.some(a => { const la = lineBox(A.el, a); return B.tr.lines.some(b => intersects(la, lineBox(B.el, b), 4)); });
        if (hit) add('C10', 'error', A.el, `Text overlaps other text: ${label(B.el)}.`, { other: label(B.el) });
      }
      for (const kv of keyVisuals) {
        if (has(kv, 'overlay-ok') || kv.contains(ov[i].el) || layerRoot(kv) !== layerRoot(ov[i].el)) continue;
        if (ov[i].tr.lines.some(l => intersects(l, kv.getBoundingClientRect(), 4))) add('C10', 'error', ov[i].el, `Text overlaps a key visual: ${label(kv)}. Mark data-vs="overlay-ok" if it is designed to sit on top.`, { other: label(kv) });
      }
    }

    // C10 (warning): a large graphic that spills out of its own container and covers text outside it,
    // e.g. a fixed-size wheel taller than its sticky stage running into the section heading above.
    for (const g of scope.querySelectorAll('svg, canvas, img, video')) {
      if (ignored(g) || has(g, 'bg') || has(g, 'overlay-ok')) continue;
      if (g.tagName.toLowerCase() === 'svg' && g.parentElement && g.parentElement.closest('svg')) continue;
      const r = g.getBoundingClientRect();
      if (r.width < 150 || r.height < 150 || !inView(r) || effOpacity(g) < 0.05) continue;
      let spilled = null;
      for (let e = g.parentElement; e && e !== document.body; e = e.parentElement) {
        if (getComputedStyle(e).display === 'contents') continue;
        const er = e.getBoundingClientRect();
        if (r.left >= er.left - 2 && r.right <= er.right + 2 && r.top >= er.top - 2 && r.bottom <= er.bottom + 2) break;
        spilled = e;
      }
      if (!spilled) continue;
      for (const t of texts) {
        if (spilled.contains(t.el) || inFixed(t.el) || has(t.el, 'overlay-ok') || t.el.closest('[aria-hidden="true"]')) continue;
        if (t.tr.lines.some(l => intersects(l, r, 4))) {
          add('C10', 'warn', t.el, `A ${round(r.width)}x${round(r.height)}px ${g.tagName.toLowerCase()} spills out of its container and covers this text. The graphic is probably sized without regard to the window height (rules 2, 4). Graphic: ${label(g)}.`, { kind: 'spill', graphic: label(g), container: label(spilled) });
          break;
        }
      }
    }

    // C12 legibility: text whose colour barely differs from what sits behind it. Catches a dropped background
    // (an invalid gradient, a missing token) that leaves light text on a white page, which no other check can see.
    // Conservative by design: when the backdrop cannot be known (gradient, image, video, canvas, blend mode) it stays silent.
    {
      const cv = document.createElement('canvas'); cv.width = cv.height = 1;
      const cx = cv.getContext('2d', { willReadFrequently: true });
      const rgba = s => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = s; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 }; };
      const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      const lum = c => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
      const over = (f, b) => ({ r: f.r * f.a + b.r * (1 - f.a), g: f.g * f.a + b.g * (1 - f.a), b: f.b * f.a + b.b * (1 - f.a), a: 1 });
      const css = c => `rgb(${round(c.r)}, ${round(c.g)}, ${round(c.b)})`;

      // Elements that paint something of their own: a sibling behind the text (image, canvas, gradient block) makes the backdrop unknown.
      const painters = [];
      for (const e of document.body.querySelectorAll('*')) {
        if (ignored(e)) continue;
        const r = e.getBoundingClientRect();
        if (r.width < 20 || r.height < 20 || !(r.bottom > 0 && r.top < vh)) continue;
        const tag = e.tagName.toLowerCase();
        const cs = getComputedStyle(e);
        const paints = tag === 'canvas' || tag === 'video' || tag === 'img' || tag === 'svg' || tag === 'picture' ||
          cs.backgroundImage !== 'none' || (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && rgba(cs.backgroundColor).a > 0.01);
        if (paints && effOpacity(e) > 0.05) painters.push({ e, r });
      }

      const backdrop = (el, pt) => {
        const layers = [];
        for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
          const cs = getComputedStyle(e);
          if (cs.mixBlendMode !== 'normal' || (cs.backdropFilter && cs.backdropFilter !== 'none')) return null;
          if (cs.backgroundImage !== 'none') return null;
          if (cs.backgroundColor === 'rgba(0, 0, 0, 0)') continue;
          const c = rgba(cs.backgroundColor);
          if (c.a > 0.01) { layers.push(c); if (c.a >= 0.99) break; }
        }
        // A dark-only colour scheme paints the page canvas dark, which we do not model.
        const scheme = getComputedStyle(document.documentElement).colorScheme;
        if (/\bdark\b/.test(scheme) && !/\blight\b/.test(scheme)) return null;
        let base = { r: 255, g: 255, b: 255, a: 1 };
        for (let i = layers.length - 1; i >= 0; i--) base = over(layers[i], base);
        for (const p of painters) {
          if (p.e.contains(el) || el.contains(p.e)) continue;
          if (pt.x >= p.r.left && pt.x <= p.r.right && pt.y >= p.r.top && pt.y <= p.r.bottom) return null;
        }
        return base;
      };

      const seenLegibility = [];
      for (const t of texts) {
        if (has(t.el, 'decor') || has(t.el, 'overlay-ok') || t.el.closest('[aria-hidden="true"]')) continue;
        // SVG text is painted with `fill`, not `color`, and the SVG can draw shapes behind it: the backdrop is unknown.
        if (t.el.closest('svg')) continue;
        const cs = getComputedStyle(t.el);
        if (cs.webkitBackgroundClip === 'text' || cs.backgroundClip === 'text') continue;
        const fg = rgba(cs.webkitTextFillColor || cs.color);
        const alpha = fg.a * effOpacity(t.el);
        if (alpha < 0.05) continue;
        const u = t.tr.union;
        const bg = backdrop(t.el, { x: Math.min(vw - 1, Math.max(1, (u.left + u.right) / 2)), y: Math.min(vh - 1, Math.max(1, (u.top + u.bottom) / 2)) });
        if (!bg) continue;
        const shown = over({ ...fg, a: alpha }, bg);
        const l1 = lum(shown), l2 = lum(bg);
        const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
        if (ratio < 3) seenLegibility.push({ t, ratio, fg: shown, bg });
      }
      seenLegibility.sort((a, b) => a.ratio - b.ratio);
      for (const s of seenLegibility.slice(0, 5)) {
        const invisible = s.ratio < 1.5;
        add('C12', invisible ? 'error' : 'warn', s.t.el,
          `${invisible ? 'Text is nearly invisible' : 'Text has low contrast'}: ${css(s.fg)} on ${css(s.bg)} is ${s.ratio.toFixed(2)}:1 (needs 3:1 at least).` +
          `${invisible ? ' A background probably failed to apply (invalid gradient or missing token). Mark data-vs="decor" only for decorative ghost text.' : ''}`,
          { ratio: +s.ratio.toFixed(2), text: css(s.fg), background: css(s.bg) });
      }
    }

    // C11 empty stage
    const stages = [];
    if (isLoad) stages.push(...[...scope.querySelectorAll('[data-vs~="fit"]')].filter(el => !ignored(el)));
    if (pos.kind === 'scene' && vs._scenes && vs._scenes[pos.scene]) stages.push(...pinnedStages(vs._scenes[pos.scene]));
    for (const st of stages) {
      const sr = st.getBoundingClientRect();
      if (sr.height < 0.6 * vh || !inView(sr)) continue;
      const u = { top: Infinity, bottom: -Infinity };
      const take = r => { if (!intersects(r, sr)) return; u.top = Math.min(u.top, Math.max(r.top, sr.top)); u.bottom = Math.max(u.bottom, Math.min(r.bottom, sr.bottom)); };
      for (const t of texts) if (st.contains(t.el)) t.tr.lines.forEach(take);
      for (const el of st.querySelectorAll('[data-vs~="key-visual"], img, video, canvas, svg')) {
        if (has(el, 'bg') || effOpacity(el) < 0.05) continue;
        const r = el.getBoundingClientRect();
        if (r.width * r.height >= 0.9 * sr.width * sr.height) continue;
        take(r);
      }
      const filled = u.bottom > u.top ? (u.bottom - u.top) / sr.height : 0;
      if (filled < 0.4) add('C11', 'warn', st, `Stage looks empty: content fills ${round(filled * 100)}% of its ${round(sr.height)}px height.`, { filled: +filled.toFixed(2) });
    }

    // Canvases for C9 (pixel analysis happens in Node)
    const canvases = [];
    [...document.querySelectorAll('canvas')].forEach((el, index) => {
      if (!inScope(el) || ignored(el) || has(el, 'bg') || effOpacity(el) < 0.05) return;
      let v = el.getBoundingClientRect();
      v = { left: Math.max(0, v.left), top: Math.max(0, v.top), right: Math.min(vw, v.right), bottom: Math.min(vh, v.bottom) };
      for (const c of clippers(el)) {
        const cr = c.el.getBoundingClientRect();
        if (c.clipX) { v.left = Math.max(v.left, cr.left); v.right = Math.min(v.right, cr.right); }
        if (c.clipY) { v.top = Math.max(v.top, cr.top); v.bottom = Math.min(v.bottom, cr.bottom); }
      }
      const area = (v.right - v.left) * (v.bottom - v.top);
      if (v.right - v.left < 40 || v.bottom - v.top < 40 || area < 0.25 * vw * vh) return;
      canvases.push({ index, el: label(el), rect: { left: round(v.left), top: round(v.top), right: round(v.right), bottom: round(v.bottom) } });
    });

    return { findings, canvases, scrollY: round(scrollY) };
  };

  /** Page-wide checks run once after load: C5 type size and C6 width cap. */
  vs.pageChecks = () => {
    const findings = [];
    const add = (check, severity, el, msg, data = {}) => findings.push({ check, severity, el: el ? label(el) : null, msg, data });
    const scope = root();
    const texts = textElements(scope).filter(el => effOpacity(el) > 0 || getComputedStyle(el).display !== 'none');

    // C5
    let maxFs = 0, maxEl = null;
    for (const el of texts) {
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs > maxFs) { maxFs = fs; maxEl = el; }
    }
    const dtm = cfg.displayTypeMax || 120;
    if (maxEl) {
      if (maxFs > 1.5 * dtm) add('C5', 'error', maxEl, `Largest text is ${round(maxFs)}px (limit ${round(1.5 * dtm)}px = 1.5 × displayTypeMax ${dtm}px).`, { maxFontSize: round(maxFs) });
      else if (maxFs > dtm) add('C5', 'warn', maxEl, `Largest text is ${round(maxFs)}px, above displayTypeMax ${dtm}px.`, { maxFontSize: round(maxFs) });
    }

    // C6
    const cmw = cfg.contentMaxWidth;
    let widest = 0, widestEl = null;
    if (cmw) {
      for (const el of texts) {
        if (!(el.matches('p,li,h1,h2,h3,h4,h5,h6,blockquote') || directText(el).length >= 40)) continue;
        if (el.closest('header,nav,footer,[role=navigation]') || has(el, 'bleed') || layerRoot(el) || effOpacity(el) < 0.05) continue;
        const tr = textRects(el);
        if (!tr) continue;
        if (tr.union.width > widest) { widest = tr.union.width; widestEl = el; }
        if (tr.union.width > cmw + 2) add('C6', 'error', el, `Text block is ${round(tr.union.width)}px wide, wider than contentMaxWidth ${cmw}px.`, { width: round(tr.union.width) });
      }
    }
    return { findings, maxFontSize: round(maxFs), widestText: widestEl ? { el: label(widestEl), width: round(widest) } : null };
  };

  /** Content column estimate for --measure. */
  vs.measure = () => {
    const vw = W();
    let minL = Infinity, maxR = -Infinity, n = 0;
    for (const el of textElements(document.body)) {
      if (!(el.matches('p,h1,h2,h3,h4,h5,h6,li,blockquote') || directText(el).length >= 20)) continue;
      if (el.closest('header,nav,footer,[role=navigation]') || layerRoot(el) || effOpacity(el) < 0.05) continue;
      const tr = textRects(el);
      if (!tr || tr.union.left < 0 || tr.union.right > vw) continue;
      minL = Math.min(minL, tr.union.left); maxR = Math.max(maxR, tr.union.right); n++;
    }
    return n ? { width: vw, blocks: n, left: round(minL), right: round(maxR), span: round(maxR - minL), symmetric: round(vw - 2 * minL) } : { width: vw, blocks: 0 };
  };

  window.__vs = vs;
})();
