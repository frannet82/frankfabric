// measure-viewports.mjs — responsive / a11y viewport screenshot harness.
//
// Sibling to measure-load.mjs. Reuses the SAME static-export server mount
// (built out/ served under BASE_PATH /frankfabric) and the SAME headless
// Chrome launch (CHROME_PATH, --no-sandbox --use-gl=angle
// --use-angle=swiftshader --ignore-gpu-blocklist) that measure-load.mjs uses,
// but instead of measuring cold-load bytes it loads a single route at TWO
// viewport sizes — a phone width (390x844) and a desktop width (1280x900) —
// takes a full-page screenshot at each, and measures whether the document
// overflows horizontally by comparing document.documentElement.scrollWidth
// against window.innerWidth (a horizontal scrollbar means the layout breaks
// out of the viewport on that width).
//
// It does NOT change measure-load.mjs and is NOT part of the build; it is a
// measurement tool that requires the `playwright-core` devDependency and an
// on-machine Chrome/Chromium binary (CHROME_PATH, default /usr/local/bin/chrome).
//
// Usage:
//   node scripts/measure-viewports.mjs --route / --label before-landing
//   node scripts/measure-viewports.mjs --route /projects/digital-wardrobe/ --label before-wardrobe --out docs/a11y
//
// Writes, under --out (default docs/a11y), per route+width:
//   <label>-390.png / <label>-390.json  (phone)
//   <label>-1280.png / <label>-1280.json (desktop)
// Each JSON captures { route, label, width, height, scrollWidth, innerWidth,
// noHorizontalScroll } plus a combined <label>.json summarising both widths.
// Exit code is 0 only when every measured width has noHorizontalScroll === true
// (and the expected canvas/ load was reached); otherwise 2, so the harness can
// gate a "no horizontal scroll" assertion in CI or a script.
//
// REDUCED-MOTION EVIDENCE FLAGS (added for WS4 FEAT-003):
//   --reduced-motion <reduce|no-preference>  (alias --emulate)
//       Calls page.emulateMedia({ reducedMotion: <value> }) BEFORE navigating so
//       the shared useReducedMotion() hook (matchMedia) reports that preference
//       and the WebGL scene motion + the @media (prefers-reduced-motion:reduce)
//       CSS rule are captured in the corresponding state. The value is recorded
//       in every JSON as `reducedMotion`.
//   --animations <disabled|allow>            (default disabled)
//       Passed to page.screenshot({ animations }). The default 'disabled' freezes
//       CSS animations for a deterministic still (used for the scroll-assertion
//       shots). Use 'allow' when you want the screenshot to capture a running CSS
//       animation frame for a visual reduce-vs-motion comparison.
//   --widths <csv>   e.g. --widths 1280  to capture a single width.
//
// Examples (reduced-motion proof, one 3D demo + landing at desktop width):
//   node scripts/measure-viewports.mjs --route /projects/virtual-pet/ \
//     --label after-pet-reduced --reduced-motion reduce --animations allow --widths 1280
//   node scripts/measure-viewports.mjs --route /projects/virtual-pet/ \
//     --label after-pet-motion  --reduced-motion no-preference --animations allow --widths 1280

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
const LABEL = args.get('label') || 'viewport';
const OUT = resolve(args.get('out') || 'docs/a11y');
const PORT = Number(args.get('port') || 5198);

// Reduced-motion emulation (WS4 FEAT-003). --reduced-motion / --emulate accepts
// 'reduce' or 'no-preference'; anything else (or unset) means "do not emulate"
// (Playwright default, which follows no-preference). Recorded in the JSON.
const RM_RAW = args.get('reduced-motion') ?? args.get('emulate') ?? null;
const REDUCED_MOTION =
  RM_RAW === 'reduce' || RM_RAW === 'no-preference' ? RM_RAW : null;

// Screenshot animation handling: 'disabled' (default, deterministic still) or
// 'allow' (capture a running CSS-animation frame for a visual comparison).
const ANIMATIONS = args.get('animations') === 'allow' ? 'allow' : 'disabled';

// The base path the production static export is served under on GitHub Pages.
// The HTML references /frankfabric/... asset URLs, so the server mounts out/
// at this prefix (identical to measure-load.mjs). Overridable for a root domain.
const BASE_PATH = (args.get('base') ?? '/frankfabric').replace(/\/$/, '');

const CHROME_PATH = process.env.CHROME_PATH || '/usr/local/bin/chrome';

// The two viewport sizes to capture: a phone portrait width and a desktop width.
// --widths <csv> narrows this (e.g. --widths 1280 for a single desktop shot).
const ALL_VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1280, height: 900 },
];
const WIDTH_FILTER = (args.get('widths') || '')
  .split(',')
  .map((s) => Number(s.trim()))
  .filter((n) => Number.isFinite(n) && n > 0);
const VIEWPORTS = WIDTH_FILTER.length
  ? ALL_VIEWPORTS.filter((v) => WIDTH_FILTER.includes(v.width))
  : ALL_VIEWPORTS;

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
// production HTML's /frankfabric/... URLs map onto files in out/ (identical to
// measure-load.mjs's serve()).
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

  const routePath = ROUTE.startsWith('/') ? ROUTE : `/${ROUTE}`;
  const target = `http://localhost:${PORT}${BASE_PATH}${routePath}`;
  const isLanding = routePath === '/';

  await mkdir(OUT, { recursive: true });

  const perWidth = [];
  let allOk = true;

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
      bypassCSP: true,
    });
    const page = await context.newPage();

    // Emulate the OS reduced-motion preference BEFORE navigating so the shared
    // useReducedMotion() hook (matchMedia) reports it at first render and the
    // WebGL scene motion gate + the CSS @media rule are captured accordingly.
    if (REDUCED_MOTION) {
      await page.emulateMedia({ reducedMotion: REDUCED_MOTION });
    }

    await page.goto(target, { waitUntil: 'load' });

    // Wait for the scene <canvas> (client-only via next/dynamic). The landing
    // page has no canvas, so its successful load counts as ready.
    const hasCanvas = await page
      .waitForSelector('canvas', { timeout: 45000, state: 'attached' })
      .then(() => true)
      .catch(() => false);

    // Give the layout / large 3D assets time to settle before measuring.
    await page.waitForTimeout(hasCanvas ? 4000 : 2000);

    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
    }));

    const noHorizontalScroll = metrics.scrollWidth <= metrics.innerWidth;
    const ready = (hasCanvas || isLanding);
    if (!noHorizontalScroll || !ready) allOk = false;

    const shot = join(OUT, `${LABEL}-${vp.width}.png`);
    await page.screenshot({ path: shot, animations: ANIMATIONS, fullPage: true });

    const widthReport = {
      label: LABEL,
      route: routePath,
      url: target,
      basePath: BASE_PATH,
      reducedMotion: REDUCED_MOTION ?? 'not-emulated',
      screenshotAnimations: ANIMATIONS,
      width: vp.width,
      height: vp.height,
      hasCanvas,
      ready,
      scrollWidth: metrics.scrollWidth,
      innerWidth: metrics.innerWidth,
      clientWidth: metrics.clientWidth,
      noHorizontalScroll,
      screenshot: shot,
      measuredAt: new Date().toISOString(),
    };
    await writeFile(join(OUT, `${LABEL}-${vp.width}.json`), JSON.stringify(widthReport, null, 2));
    perWidth.push(widthReport);

    console.log(
      `  ${routePath} @ ${vp.width}x${vp.height}: scrollWidth=${metrics.scrollWidth} innerWidth=${metrics.innerWidth} ` +
        `noHorizontalScroll=${noHorizontalScroll} hasCanvas=${hasCanvas} -> ${shot}`,
    );

    await context.close();
  }

  const summary = {
    label: LABEL,
    route: routePath,
    url: target,
    basePath: BASE_PATH,
    reducedMotion: REDUCED_MOTION ?? 'not-emulated',
    screenshotAnimations: ANIMATIONS,
    widths: perWidth.map((w) => ({
      width: w.width,
      height: w.height,
      scrollWidth: w.scrollWidth,
      innerWidth: w.innerWidth,
      noHorizontalScroll: w.noHorizontalScroll,
    })),
    allNoHorizontalScroll: perWidth.every((w) => w.noHorizontalScroll),
    measuredAt: new Date().toISOString(),
  };
  const summaryPath = join(OUT, `${LABEL}.json`);
  await writeFile(summaryPath, JSON.stringify(summary, null, 2));

  console.log(`\n=== viewports: ${LABEL} (${routePath}) ===`);
  for (const w of perWidth) {
    console.log(
      `  ${w.width}x${w.height}: scrollWidth ${w.scrollWidth} <= innerWidth ${w.innerWidth} ? ${w.noHorizontalScroll}`,
    );
  }
  console.log(`summary:      ${summaryPath}`);

  await browser.close();
  server.close();
  process.exit(allOk ? 0 : 2);
}

main();
