# Workstream 1 — Load Weight & Runtime Perf: BASELINE

This file records the **pre-optimization** baseline for frankfabric, captured before
any production source or `public/` asset was changed. It is the reference the
FEAT-002 (asset compression) and FEAT-003 (code-splitting / on-demand loading /
progress UI) work is measured against.

All numbers below were produced by `scripts/measure-load.mjs` against the current
`main`-derived build on branch `perf/load-weight-runtime`. Re-run any route with:

```
npm run build
node scripts/measure-load.mjs --dir out --route <route> --label <label>
```

The harness serves the static export `out/` under the `/frankfabric/` GitHub Pages
base path (the production HTML references `/frankfabric/...` URLs), disables the
disk cache, sums the transferred bytes of every network response, and captures a
fixed-camera PNG of each scene `<canvas>` (animations disabled) once it has
settled. `ready=true` means every asset the route requested resolved successfully
under the base path (aborted duplicate in-flight fetches that also returned 200,
and the browser's implicit `/favicon.ico` probe, are not counted as failures).

## Machine / runtime measured on

- **Host:** Linux sandbox (containerized), x86-64.
- **Node:** v22.23.2.
- **Browser:** Google Chrome for Testing **151.0.7922.10**, headless, driven via
  `playwright-core` (devDependency, measurement-only — never shipped to the
  browser) using `executablePath=/usr/local/bin/chrome`
  (`/opt/playwright/chromium-1232/chrome-linux64/chrome`).
- **GPU:** software rasterizer — ANGLE + SwiftShader
  (`--use-gl=angle --use-angle=swiftshader --ignore-gpu-blocklist --no-sandbox`).
- **Viewport:** 1280×900, deviceScaleFactor 1.

## Build gate at baseline (all green)

- `npm run lint` → clean except the **single, pre-existing, expected**
  `@next/next/no-page-custom-font` warning in `app/layout.tsx` (0 errors).
- `npm run build` → static export into `out/` succeeds; all five pages prerender
  (`/`, `/projects/chef-chatbot`, `/projects/coach-trainer`,
  `/projects/digital-wardrobe`, `/projects/virtual-pet`).

## Per-route cold-load transferred bytes

Cold load = first-visit, empty cache. Byte totals are the sum of every response
body transferred over the wire (raw, as served — the static export is not
pre-gzipped, so these are effectively raw sizes).

| Route | Path | Cold-load transferred | Canvas | ready | Screenshot |
|-------|------|----------------------:|:------:|:-----:|------------|
| Landing | `/` | **1,157,888 B (1.158 MB)** | no (CSS/SVG + 1 small mp4) | yes | `baseline-landing.png` |
| Digital Wardrobe | `/projects/digital-wardrobe/` | **18,671,336 B (18.671 MB)** | yes | yes | `baseline-wardrobe.png` |
| Chef Chatbot | `/projects/chef-chatbot/` | **2,571,811 B (2.572 MB)** | yes | yes | `baseline-chef.png` |
| Coach Trainer | `/projects/coach-trainer/` | **2,431,115 B (2.431 MB)** | yes | yes | `baseline-coach.png` |
| Virtual Pet | `/projects/virtual-pet/` | **14,327,684 B (14.328 MB)** | yes | yes | `baseline-pet.png` |

Notable per-route asset weight (from the `byType` breakdown in each JSON report):

- **Wardrobe (18.7 MB):** `.vrm` 11.687 MB (base drophunter `body.vrm` alone is
  5.05 MB, plus eyes + the default hair/shirt/pants/shoes garment VRMs), `.fbx`
  2.570 MB (idle/animation clips), `.png` 2.246 MB, `.js` 1.754 MB. This route is
  the worst offender — see the JS chunk note below, it statically preloads the
  ~913 KB three chunk.
- **Pet (14.3 MB):** dominated by `schnauzer.glb` = 12,462,120 B (12.46 MB) with
  its texture **embedded** in the GLB.
- **Chef (2.57 MB) / Coach (2.43 MB):** FBX/OBJ + textures; smallest 3D routes.
- **Landing (1.16 MB):** no 3D assets at all — `.js` ~0.5 MB, one small hero mp4,
  a hero jpg, one webfont. Slight run-to-run variation comes from mp4 range
  requests.

## Largest JS chunk

- **File:** `out/_next/static/chunks/<hash>.js` (the three/@react-three-heavy
  chunk; content is emitted under several hashes, one per consumer).
- **Raw:** **913,347 bytes**
- **Gzip:** **238,951 bytes** (≈ the 238,953 figure recorded in task context;
  1–2 byte difference is `gzip` tool/level rounding).
- **Who pulls it:** it is **preloaded by the Digital Wardrobe page only**
  (`out/projects/digital-wardrobe/index.html` references `3spa3a6p4vdyu.js`).
  `components/WardrobeBuilder.tsx` statically imports the `OPTIONS` runtime value
  from the three-heavy `WardrobeScene` module, which drags that whole module graph
  into the wardrobe page's static bundle. Breaking that static value-import is the
  FEAT-003 lever to stop the ~913 KB chunk being preloaded on the wardrobe route.

## `public/` per-directory breakdown (on disk)

```
61M   public                     (total)
56M   public/models              (total)
 38M    public/models/characters/drophunter    (wardrobe VRMs)
 17M    public/models/characters/schnauzer     (pet GLB + dead PNG, see below)
632K    public/models/characters/swedish-chef  (chef FBX + texture)
608K    public/models/characters/coach         (coach OBJ + MTL + textures)
2.5M  public/animations          (idle / walking / waving FBX)
2.3M  public/wardrobe            (thumbnails)
284K  public/images
100K  public/videos
```

## Dead asset (do NOT ship, safe to remove in FEAT-002)

- **`public/models/characters/schnauzer/RETOPO_COL_2k_0.png` = 4,884,566 B
  (4.66 MiB / ~4.7 MB).**
- **UNREFERENCED at runtime.** The only mention of the name in source is an
  explanatory comment in `components/pet/PetScene.tsx`; the pet scene loads
  `schnauzer.glb`, which **embeds its own texture in the GLB buffer**
  (single material `MAT_RETOPO`, `images[0]` has no `uri`). The standalone PNG is
  never fetched — confirmed by the pet route report: the only schnauzer asset it
  transfers is `schnauzer.glb` (12,462,120 B). This file is pure dead weight in
  the repo.

## Baseline artifacts in this directory

- `baseline-landing.{json,png}`
- `baseline-wardrobe.{json,png}`
- `baseline-chef.{json,png}`
- `baseline-coach.{json,png}`
- `baseline-pet.{json,png}`

Each `*.json` records `totalBytes`, `totalMB`, `byType` (by extension), the full
per-resource list (url, bytes, status, type), the `ready`/`hasCanvas` flags,
`unresolvedFailures`, and any console/network errors. Each `*.png` is the
fixed-camera screenshot of that route's scene canvas at rest.
