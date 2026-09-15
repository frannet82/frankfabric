// measure-load.mjs — cold-load measurement + fixed-camera screenshot harness.
//
// Serves a built Next.js static-export directory (default: out/) in a headless
// Chrome with the disk cache disabled, summing the transferred bytes of every
// network response so a cold, first-visit load can be measured. Waits for the
// scene <canvas> to appear and a few frames to settle, then captures a
// fixed-camera screenshot clipped to the canvas bounding box (animations
// disabled so the capture is deterministic). Writes a JSON byte report and a
// PNG per route.
//
// KEY DIFFERENCE from the tireshop reference harness: frankfabric is a Next.js
// static export served under the GitHub-Pages base path /frankfabric/ in a
// production build, so the emitted HTML references /frankfabric-prefixed asset
// URLs. This server mounts the built out/ directory at /frankfabric/ so those
// URLs resolve. There is also no window.__tireShop debug handle in frankfabric,
// so readiness is inferred from the canvas being present.
//
// Usage:
//   node scripts/measure-load.mjs --dir out --route / --label baseline-landing
//   node scripts/measure-load.mjs --dir out --route /projects/digital-wardrobe/ --label baseline-wardrobe
//
// This is a measurement tool, NOT part of the build. It requires the
// `playwright-core` devDependency and an on-machine Chrome/Chromium binary
// (resolved via the CHROME_PATH env var, default /usr/local/bin/chrome). No
// browser download is performed; if the browser cannot launch the script prints
// how to fix it and exits non-zero.

import { createServer } from 'node:http';
import { readFile, mkdir, writeFile, stat } from 'node:fs/promises';
import { extname, join, resolve, normalize } from 'node:path';

const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  const a = process.argv[i];
  if (a.startsWith('--')) args.set(a.slice(2), process.argv[++i]);
}
const DIR = resolve(args.get('dir') || 'out');
const ROUTE = args.get('route') || '/';
const LABEL = args.get('label') || 'load';
const OUT = resolve(args.get('out') || 'docs/perf');
const PORT = Number(args.get('port') || 5199);
// Optional measurement-only quality selection: 'high' | 'fast'. When set, the
// harness clicks the shared QualityToggle radio (rendered by every scene
// wrapper) AFTER the canvas mounts, so a fixed-camera screenshot of both the
// High and Fast render paths can be captured deterministically without changing
// any scene/quality CODE. The toggle only reads/writes the shared quality tier
// (components/three/quality.ts, default 'high'); this flips it as a user would.
// Omit to capture the default (High) path. Byte totals are unaffected by tier
// (no tier fetches a different asset), so the default byte report is unchanged.
const QUALITY = args.get('quality');

// The base path the production static export is served under on GitHub Pages.
// The HTML references /frankfabric/... asset URLs, so the server mounts out/
// at this prefix. Overridable for a site served at a domain root.
const BASE_PATH = (args.get('base') ?? '/frankfabric').replace(/\/$/, '');

const CHROME_PATH = process.env.CHROME_PATH || '/usr/local/bin/chrome';

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.txt': 'text/plain',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.vrm': 'application/octet-stream',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.ktx2': 'image/ktx2',
  '.bin': 'application/octet-stream',
  '.fbx': 'application/octet-stream',
  '.obj': 'text/plain',
  '.mtl': 'text/plain',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
};

// Serve the built directory, stripping the /frankfabric base-path prefix so the
// production HTML's /frankfabric/... URLs map onto files in out/.
function serve(root) {
  const server = createServer(async (req, res) => {
    try {
      let p = decodeURIComponent(req.url.split('?')[0]);
      // Strip the base path so /frankfabric/foo -> /foo (out/foo).
      if (BASE_PATH && (p === BASE_PATH || p.startsWith(`${BASE_PATH}/`))) {
        p = p.slice(BASE_PATH.length) || '/';
      }
      if (p === '/' || p.endsWith('/')) p += 'index.html';
      const file = normalize(join(root, p));
      if (!file.startsWith(root)) {
        res.writeHead(403).end('forbidden');
        return;
      }
      const body = await readFile(file);
      res.writeHead(200, {
        'content-type': MIME[extname(file)] || 'application/octet-stream',
        'content-length': body.length,
        'cache-control': 'no-store',
      });
      res.end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  return new Promise((res) => server.listen(PORT, () => res(server)));
}

async function main() {
  try {
    await stat(join(DIR, 'index.html'));
  } catch {
    console.error(`No index.html in ${DIR}. Run \`npm run build\` first.`);
    process.exit(1);
  }

  let chromium;
  try {
    ({ chromium } = await import('playwright-core'));
  } catch {
    console.error('playwright-core is not installed. Run: npm install --save-dev playwright-core');
    process.exit(1);
  }

  const server = await serve(DIR);
  let browser;
  try {
    browser = await chromium.launch({
      executablePath: CHROME_PATH,
      args: [
        '--no-sandbox',
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--ignore-gpu-blocklist',
      ],
    });
  } catch (err) {
    console.error('Could not launch Chrome:', err.message);
    console.error(
      `Set CHROME_PATH to a Chrome/Chromium binary (currently: ${CHROME_PATH}). No download is performed.`,
    );
    server.close();
    process.exit(1);
  }

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 1,
    bypassCSP: true,
  });
  const page = await context.newPage();
  // Disk cache off so every asset counts, the way a first-time visitor sees it.
  const cdp = await context.newCDPSession(page).catch(() => null);
  if (cdp) {
    await cdp.send('Network.enable').catch(() => {});
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true }).catch(() => {});
  }

  const byType = {};
  const resources = [];
  let total = 0;
  // Track which URLs eventually returned a successful (2xx) response, so an
  // aborted duplicate request (ERR_ABORTED on teardown of an in-flight second
  // fetch for an asset that already loaded) is not miscounted as a failure.
  const succeeded = new Set();
  const strip = (u) => u.replace(`http://localhost:${PORT}`, '');
  page.on('response', async (resp) => {
    const req = resp.request();
    let bytes = 0;
    try {
      const buf = await resp.body();
      bytes = buf.length;
    } catch {
      const len = resp.headers()['content-length'];
      bytes = len ? Number(len) : 0;
    }
    total += bytes;
    const url = req.url();
    if (resp.status() >= 200 && resp.status() < 400) succeeded.add(strip(url));
    const ext = extname(url.split('?')[0]) || `[${req.resourceType()}]`;
    byType[ext] = (byType[ext] || 0) + bytes;
    resources.push({
      url: strip(url),
      bytes,
      status: resp.status(),
      type: req.resourceType(),
    });
  });

  const errors = [];
  const hardFailures = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('requestfailed', (r) => {
    const u = strip(r.url());
    const why = r.failure()?.errorText || '';
    errors.push(`requestfailed ${u}: ${why}`);
    // Only a hard failure if the same URL never succeeded. A duplicate request
    // aborted while the real one already returned 200 is benign.
    hardFailures.push({ url: u, why });
  });
  page.on('response', (r) => {
    if (r.status() >= 400) {
      errors.push(`http ${r.status()} ${strip(r.url())}`);
      hardFailures.push({ url: strip(r.url()), why: `http ${r.status()}` });
    }
  });
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  // Normalise the route onto the served base path.
  const routePath = ROUTE.startsWith('/') ? ROUTE : `/${ROUTE}`;
  const target = `http://localhost:${PORT}${BASE_PATH}${routePath}`;
  await page.goto(target, { waitUntil: 'load' });

  // Wait for the scene <canvas> to exist (the 3D component is client-only and
  // mounted via next/dynamic). The landing page has no canvas, so treat its
  // successful load as ready too.
  const hasCanvas = await page
    .waitForSelector('canvas', { timeout: 45000, state: 'attached' })
    .then(() => true)
    .catch(() => false);

  // Measurement-only: force a specific render path by clicking the shared
  // QualityToggle radio (High/Fast) the same way a user would, so a fixed-camera
  // screenshot of each path can be captured. This changes NO scene/quality code.
  let qualitySelected = null;
  if (hasCanvas && QUALITY) {
    const wanted = String(QUALITY).toLowerCase() === 'fast' ? 'Fast' : 'High';
    const clicked = await page
      .getByRole('radio', { name: wanted, exact: true })
      .first()
      .click({ timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    if (!clicked) {
      console.error(`Could not click the "${wanted}" quality radio for ${routePath}.`);
    } else {
      qualitySelected = wanted.toLowerCase();
    }
  }

  // Settle a few frames so pose/tinting/materials are applied before the shot.
  // 3D routes pull several MB of VRM/GLB, so give large assets time to finish
  // before we screenshot and tear down (a premature teardown aborts in-flight
  // duplicate fetches, which is why we reconcile against `succeeded` below).
  await page.waitForTimeout(hasCanvas ? 4000 : 2000);

  // Ready = the document loaded, the expected canvas is present (or this is a
  // canvas-less route), and every resource that failed was retried/loaded
  // successfully under the same URL (no genuinely missing asset).
  const unresolved = hardFailures.filter(
    (f) => !succeeded.has(f.url) && !f.url.endsWith('/favicon.ico'),
  );
  const ready = (hasCanvas || routePath === '/') && unresolved.length === 0;

  await mkdir(OUT, { recursive: true });
  const shot = join(OUT, `${LABEL}.png`);
  const box = hasCanvas ? await page.locator('canvas').first().boundingBox() : null;
  await page.screenshot({
    path: shot,
    animations: 'disabled',
    clip: box || undefined,
    fullPage: !box,
  });

  const report = {
    label: LABEL,
    dir: DIR,
    route: routePath,
    basePath: BASE_PATH,
    url: target,
    ready,
    hasCanvas,
    quality: qualitySelected,
    unresolvedFailures: unresolved,
    errors: errors.slice(0, 30),
    viewport: { width: 1280, height: 900 },
    totalBytes: total,
    totalMB: +(total / 1e6).toFixed(3),
    byType,
    resources: resources.sort((a, b) => b.bytes - a.bytes),
    measuredAt: new Date().toISOString(),
  };
  const reportPath = join(OUT, `${LABEL}.json`);
  await writeFile(reportPath, JSON.stringify(report, null, 2));

  console.log(`\n=== cold load: ${LABEL} (${routePath}) ===`);
  console.log(`ready:        ${ready}`);
  console.log(`hasCanvas:    ${hasCanvas}`);
  console.log(`total bytes:  ${total} (${report.totalMB} MB)`);
  console.log('by type:');
  for (const [k, v] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(10)} ${(v / 1e6).toFixed(3)} MB`);
  }
  if (errors.length) console.log(`errors: ${errors.length} (see ${reportPath})`);
  console.log(`screenshot:   ${shot}`);
  console.log(`report:       ${reportPath}`);

  await browser.close();
  server.close();
  process.exit(ready ? 0 : 2);
}

main();
