// Zero-dependency Chrome DevTools Protocol client.
// Launches a locally installed Chrome / Edge / Chromium in headless mode and drives one page.
// Requires Node 22+ (global WebSocket).

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const sleep = ms => new Promise(r => setTimeout(r, ms));

export function findChrome(explicit) {
  const candidates = [];
  if (explicit) candidates.push(explicit);
  if (process.env.CHROME_PATH) candidates.push(process.env.CHROME_PATH);
  if (process.platform === 'darwin') {
    candidates.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    );
  } else if (process.platform === 'win32') {
    for (const base of [process.env['PROGRAMFILES'], process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean)) {
      candidates.push(join(base, 'Google/Chrome/Application/chrome.exe'), join(base, 'Microsoft/Edge/Application/msedge.exe'));
    }
  } else {
    for (const bin of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge']) {
      for (const dir of (process.env.PATH || '').split(':')) candidates.push(join(dir, bin));
    }
  }
  const found = candidates.find(p => p && existsSync(p));
  if (!found) {
    throw new Error('No Chrome, Edge or Chromium found. Install one, or pass --chrome <path> / set CHROME_PATH.');
  }
  return found;
}

class Connection {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.listeners = new Map();
    ws.addEventListener('message', e => {
      const msg = JSON.parse(typeof e.data === 'string' ? e.data : e.data.toString());
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject, method } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(`${method}: ${msg.error.message}`));
        else resolve(msg.result);
      } else if (msg.method) {
        for (const fn of this.listeners.get(msg.method) || []) fn(msg.params || {});
      }
    });
    ws.addEventListener('close', () => {
      for (const { reject, method } of this.pending.values()) reject(new Error(`${method}: connection closed`));
      this.pending.clear();
    });
  }
  send(method, params = {}, timeoutMs = 60000) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending.has(id)) { this.pending.delete(id); reject(new Error(`${method}: timed out after ${timeoutMs}ms`)); }
      }, timeoutMs);
      this.pending.set(id, {
        method,
        resolve: v => { clearTimeout(timer); resolve(v); },
        reject: e => { clearTimeout(timer); reject(e); },
      });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  on(event, fn) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(fn);
    return () => this.listeners.get(event).delete(fn);
  }
  once(event, timeoutMs) {
    return new Promise((resolve, reject) => {
      const off = this.on(event, p => { off(); clearTimeout(t); resolve(p); });
      const t = setTimeout(() => { off(); reject(new Error(`timed out waiting for ${event}`)); }, timeoutMs);
    });
  }
}

export class Page {
  constructor(conn) {
    this.conn = conn;
    this.inflight = new Set();
    this.lastNetworkActivity = Date.now();
    conn.on('Network.requestWillBeSent', p => { this.inflight.add(p.requestId); this.lastNetworkActivity = Date.now(); });
    const done = p => { this.inflight.delete(p.requestId); this.lastNetworkActivity = Date.now(); };
    conn.on('Network.loadingFinished', done);
    conn.on('Network.loadingFailed', done);
  }
  send(method, params, timeoutMs) { return this.conn.send(method, params, timeoutMs); }

  async init() {
    await this.send('Page.enable');
    await this.send('Runtime.enable');
    await this.send('Network.enable');
  }

  async setViewport(width, height) {
    await this.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  }

  /** Runs `source` in every new document before page scripts. */
  async addInitScript(source) {
    await this.send('Page.addScriptToEvaluateOnNewDocument', { source });
  }

  /**
   * Evaluates a function (or expression string) in the page. Function arguments are passed as JSON.
   * Returns the value by value; throws on page exceptions.
   */
  async evaluate(fnOrExpr, ...args) {
    const expression = typeof fnOrExpr === 'function'
      ? `(${fnOrExpr.toString()})(${args.map(a => JSON.stringify(a)).join(',')})`
      : fnOrExpr;
    const res = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, 120000);
    if (res.exceptionDetails) {
      const d = res.exceptionDetails;
      throw new Error(`Page error: ${d.exception?.description || d.text}`);
    }
    return res.result?.value;
  }

  async goto(url, { timeoutMs = 45000 } = {}) {
    const loaded = this.conn.once('Page.loadEventFired', timeoutMs).catch(() => null);
    const nav = await this.send('Page.navigate', { url });
    if (nav.errorText) throw new Error(`Navigation to ${url} failed: ${nav.errorText}`);
    await loaded;
  }

  /** Waits until no request has started or finished for `quietMs` (or until `timeoutMs`). */
  async networkIdle({ quietMs = 800, timeoutMs = 10000 } = {}) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (Date.now() - this.lastNetworkActivity >= quietMs && this.inflight.size <= 2) return true;
      await sleep(100);
    }
    return false;
  }

  async screenshot({ format = 'jpeg', quality = 70 } = {}) {
    const params = { format, captureBeyondViewport: false };
    if (format === 'jpeg') params.quality = quality;
    const res = await this.send('Page.captureScreenshot', params, 60000);
    return Buffer.from(res.data, 'base64');
  }

  /** Screenshot of the whole document (used for compare sheets, not for audited pages). */
  async fullPageScreenshot({ format = 'jpeg', quality = 80 } = {}) {
    const { contentSize } = await this.send('Page.getLayoutMetrics');
    const res = await this.send('Page.captureScreenshot', {
      format, quality, captureBeyondViewport: true,
      clip: { x: 0, y: 0, width: Math.ceil(contentSize.width), height: Math.ceil(contentSize.height), scale: 1 },
    }, 120000);
    return Buffer.from(res.data, 'base64');
  }
}

/**
 * Launches the browser and returns { page, close }.
 * The first page target of the browser is used as the audited page (it is treated as visible,
 * so requestAnimationFrame and scroll-driven animations run normally).
 */
export async function launch(opts = {}) {
  try {
    return await launchOnce(opts);
  } catch (e) {
    // A busy machine can make startup slow; one retry covers it.
    if (/DevTools port|No page target|Could not connect/.test(e.message)) return launchOnce(opts);
    throw e;
  }
}

async function launchOnce({ chromePath, extraArgs = [] } = {}) {
  const bin = findChrome(chromePath);
  const profile = mkdtempSync(join(tmpdir(), 'viewport-safe-'));
  const args = [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--mute-audio', '--disable-extensions',
    '--force-color-profile=srgb', ...extraArgs, 'about:blank',
  ];
  const proc = spawn(bin, args, { stdio: 'ignore' });
  let exited = false;
  proc.on('exit', () => { exited = true; });

  // Chrome writes the chosen port to DevToolsActivePort in the profile folder.
  const portFile = join(profile, 'DevToolsActivePort');
  let port;
  for (let i = 0; i < 300 && !port; i++) {
    if (exited) throw new Error(`Browser exited during startup: ${bin}`);
    if (existsSync(portFile)) {
      // On Windows Chrome can still hold the file while writing it (EBUSY/EPERM); treat as not ready yet.
      try {
        const [p] = readFileSync(portFile, 'utf8').split('\n');
        if (p) port = Number(p);
      } catch { /* locked, read again on the next tick */ }
    }
    if (!port) await sleep(100);
  }
  if (!port) { proc.kill(); throw new Error('Browser did not open a DevTools port within 30s'); }

  // Find the initial page target. Create the WebSocket only once the endpoint is known,
  // and attach the open listener immediately (attaching it later can miss the event and hang).
  let wsUrl;
  for (let i = 0; i < 100 && !wsUrl; i++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      wsUrl = targets.find(t => t.type === 'page')?.webSocketDebuggerUrl;
    } catch { /* not ready yet */ }
    if (!wsUrl) await sleep(100);
  }
  if (!wsUrl) { proc.kill(); throw new Error('No page target found in the browser'); }
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', () => reject(new Error('Could not connect to the browser')), { once: true });
  });

  const page = new Page(new Connection(ws));
  await page.init();

  const close = async () => {
    try { ws.close(); } catch { /* ignore */ }
    proc.kill();
    await sleep(200);
    // Chrome can keep profile files locked for a moment after it exits on Windows.
    try { rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { /* ignore */ }
  };
  return { page, close, browserPath: bin };
}
