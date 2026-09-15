// measure-frametime.mjs — in-browser frame-time measurement harness.
//
// Sibling of measure-load.mjs. Reuses the same http server (mounting the built
// static-export out/ directory under the /frankfabric base path), the same
// headless-Chrome launch args (executablePath /usr/local/bin/chrome,
// --use-gl=angle --use-angle=swiftshader --ignore-gpu-blocklist --no-sandbox),
// the same 1280x900 dpr-1 viewport, and the same canvas-mount readiness check.
//
// WHERE IT DIFFERS: instead of summing bytes + taking a fixed-camera shot, it
// waits for the scene <canvas> to mount and settle, then runs an in-page
// requestAnimationFrame timing loop for ~5s (animations are NOT disabled — we
// want the real per-frame cost of the live scene) and records per-frame deltas.
// It reports median / mean / p95 frame time (ms) and derived FPS to a JSON.
//
// The GPU in this sandbox is a SOFTWARE rasterizer (SwiftShader), so absolute
// FPS is NOT representative of real hardware. Only the RELATIVE before/after
// comparison on the same machine is meaningful. This is a measurement tool, NOT
// part of the build. It requires the `playwright-core` devDependency and an
// on-machine Chrome binary (CHROME_PATH env var, default /usr/local/bin/chrome).
//
// Usage:
//   node scripts/measure-frametime.mjs --dir out --route /projects/virtual-pet/ --label before-pet --out docs/visual
//   node scripts/measure-frametime.mjs --dir out --route /projects/coach-trainer/ --label before-coach --out docs/visual --duration 5000

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
const LABEL = args.get('label') || 'frametime';
const OUT = resolve(args.get('out') || 'docs/visual');
const PORT = Number(args.get('port') || 5198);
// Length of the rAF timing loop in ms (default ~5s of live rendering).
const DURATION = Number(args.get('duration') || 5000);
// How long to let the scene settle after the canvas mounts before timing.
const SETTLE = Number(args.get('settle') || 4000);
// Optional measurement-only quality selection: 'high' | 'fast'. When set, the
// harness clicks the shared QualityToggle radio (rendered by every scene
// wrapper) AFTER the canvas mounts, so both the High and Fast render paths can
// be measured deterministically without changing any scene/quality CODE. The
// toggle only reads/writes the shared quality tier (components/three/quality.ts,
// default 'high'); this flips it exactly as a user would. Omit to measure the
// default (High) path.
const QUALITY = args.get('quality');

// The base path the production static export is served under on GitHub Pages.
// The HTML references /frankfabric/... asset URLs, so the server mounts out/ at
// this prefix. Overridable for a site served at a domain root.
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

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
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

  const browserVersion = browser.version();

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 1,
    bypassCSP: true,
  });
  const page = await context.newPage();

  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  const routePath = ROUTE.startsWith('/') ? ROUTE : `/${ROUTE}`;
  const target = `http://localhost:${PORT}${BASE_PATH}${routePath}`;
  await page.goto(target, { waitUntil: 'load' });

  // Wait for the scene <canvas> to mount (client-only, via next/dynamic).
  const hasCanvas = await page
    .waitForSelector('canvas', { timeout: 45000, state: 'attached' })
    .then(() => true)
    .catch(() => false);

  if (!hasCanvas) {
    console.error(`No <canvas> mounted for route ${routePath}; cannot measure frame time.`);
    await browser.close();
    server.close();
    process.exit(2);
  }

  // Measurement-only: force a specific render path by clicking the shared
  // QualityToggle radio (High/Fast) the same way a user would. This changes NO
  // scene/quality code — it just drives the existing control so both paths can
  // be measured deterministically. Done before the settle so the new tier's
  // Canvas (dpr/shadows) is applied and settled before timing begins.
  let qualitySelected = null;
  if (QUALITY) {
    const wanted = String(QUALITY).toLowerCase() === 'fast' ? 'Fast' : 'High';
    const clicked = await page
      .getByRole('radio', { name: wanted, exact: true })
      .first()
      .click({ timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    if (!clicked) {
      console.error(`Could not click the "${wanted}" quality radio for ${routePath}.`);
      await browser.close();
      server.close();
      process.exit(3);
    }
    qualitySelected = wanted.toLowerCase();
  }

  // Let pose/tinting/materials/animations settle before timing.
  await page.waitForTimeout(SETTLE);

  // Run a requestAnimationFrame timing loop in-page for DURATION ms. Animations
  // are intentionally left running so we capture the true live frame cost.
  const result = await page.evaluate(async (durationMs) => {
    return await new Promise((resolveLoop) => {
      const deltas = [];
      let last = performance.now();
      const start = last;
      function tick(now) {
        deltas.push(now - last);
        last = now;
        if (now - start >= durationMs) {
          resolveLoop({ deltas, elapsed: now - start });
        } else {
          requestAnimationFrame(tick);
        }
      }
      requestAnimationFrame(tick);
    });
  }, DURATION);

  // Drop the first frame delta (warm-up / includes time since settle finished).
  const deltas = result.deltas.slice(1).filter((d) => d > 0 && d < 2000);
  const sorted = [...deltas].sort((a, b) => a - b);
  const frames = sorted.length;
  const mean = frames ? deltas.reduce((s, d) => s + d, 0) / frames : 0;
  const median = percentile(sorted, 50);
  const p95 = percentile(sorted, 95);
  const min = sorted[0] || 0;
  const max = sorted[frames - 1] || 0;
  const round = (n) => +n.toFixed(3);

  const report = {
    label: LABEL,
    dir: DIR,
    route: routePath,
    basePath: BASE_PATH,
    url: target,
    note: 'Pre-change (today) reading. Today has no quality selector, so this IS the Fast-path-equivalent baseline. GPU is a software rasterizer (SwiftShader) in headless Chrome; absolute FPS is not hardware-representative — only the relative before/after comparison on this machine is meaningful.',
    browser: browserVersion,
    chromePath: CHROME_PATH,
    glArgs: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
    viewport: { width: 1280, height: 900, deviceScaleFactor: 1 },
    settleMs: SETTLE,
    durationMs: DURATION,
    quality: qualitySelected,
    frames,
    frameTimeMs: {
      median: round(median),
      mean: round(mean),
      p95: round(p95),
      min: round(min),
      max: round(max),
    },
    fps: {
      median: round(median ? 1000 / median : 0),
      mean: round(mean ? 1000 / mean : 0),
      p95: round(p95 ? 1000 / p95 : 0),
    },
    errors: errors.slice(0, 30),
    measuredAt: new Date().toISOString(),
  };

  await mkdir(OUT, { recursive: true });
  const reportPath = join(OUT, `${LABEL}.json`);
  await writeFile(reportPath, JSON.stringify(report, null, 2));

  console.log(`\n=== frame time: ${LABEL} (${routePath}) ===`);
  console.log(`browser:      ${browserVersion}`);
  console.log(`frames:       ${frames} over ${(result.elapsed / 1000).toFixed(2)}s`);
  console.log(`frame time:   median ${report.frameTimeMs.median} ms | mean ${report.frameTimeMs.mean} ms | p95 ${report.frameTimeMs.p95} ms`);
  console.log(`fps:          median ${report.fps.median} | mean ${report.fps.mean}`);
  if (errors.length) console.log(`errors: ${errors.length} (see ${reportPath})`);
  console.log(`report:       ${reportPath}`);

  await browser.close();
  server.close();
  process.exit(frames > 0 ? 0 : 2);
}

main();
