# WS4 (Mobile & Accessibility) — BEFORE Baseline

This document records the **pre-change** state of the frankfabric site for
Workstream 4 (mobile responsiveness + accessibility). It is captured on the
`a11y/mobile-accessibility` branch, created off the merged `main`
(which already contains WS1 cold-load, WS2 quality/lighting, and WS3 motion).

FEAT-001 changes **no application code**. It only: creates the branch, confirms
the existing lint+build gate is green, adds a viewport screenshot harness
(`scripts/measure-viewports.mjs`), and captures the current mobile + a11y state
as evidence for FEAT-002/003 to improve against.

## Machine / runtime / browser

- **Node:** v22.23.2, provided only via `export PATH="/opt/toolchains/.nvm/versions/node/v22.23.2/bin:$PATH"` (bare `node` is not on PATH). **npm:** 11.4.2.
- **Browser:** Chromium bundled with playwright (`/usr/local/bin/chrome` → `/opt/playwright/chromium-1232/chrome-linux64/chrome`), launched **headless** via `playwright-core` with `--no-sandbox --use-gl=angle --use-angle=swiftshader --ignore-gpu-blocklist` (SwiftShader software ANGLE — no hardware GPU). `CHROME_PATH=/usr/local/bin/chrome`.
- **Build:** Next.js 16.2.11 (Turbopack), React 19, TypeScript, static export (`output:'export'`) served under base path `/frankfabric/`. Tailwind CSS 3.
- **Network:** OPEN_INTERNET. No new dependencies were added; `playwright-core` was already a devDependency.

## Gate output (verbatim)

### `npm run lint` — exactly one pre-existing, unrelated warning

```
> frank-cloud-fabric@0.1.0 lint
> eslint .


/projects/sandbox/frankfabric/app/layout.tsx
  20:9  warning  Custom fonts not added in `pages/_document.js` will only load for a single page. This is discouraged. See: https://nextjs.org/docs/messages/no-page-custom-font  @next/next/no-page-custom-font

✖ 1 problem (0 errors, 1 warning)
```

The single `@next/next/no-page-custom-font` warning in `app/layout.tsx` is pre-existing and unrelated to WS4. 0 errors, 0 other warnings.

### `npm run build` — clean static export, all five routes prerendered

```
> frank-cloud-fabric@0.1.0 build
> next build

▲ Next.js 16.2.11 (Turbopack)

  Creating an optimized production build ...
✓ Compiled successfully in 4.1s
  Running TypeScript ...
  Finished TypeScript in 4.2s ...
  Collecting page data using 7 workers ...
✓ Generating static pages using 7 workers (7/7) in 218ms
  Finalizing page optimization ...

Route (app)
┌ ○ /
├ ○ /_not-found
├ ○ /projects/chef-chatbot
├ ○ /projects/coach-trainer
├ ○ /projects/digital-wardrobe
└ ○ /projects/virtual-pet


○  (Static)  prerendered as static content
```

All five product routes (`/`, `/projects/chef-chatbot`, `/projects/coach-trainer`, `/projects/digital-wardrobe`, `/projects/virtual-pet`) prerender as static content; WebGL/DOM stays behind `next/dynamic {ssr:false}`.

## Viewport / horizontal-scroll table

Measured with `scripts/measure-viewports.mjs` against the built `out/` served
under `/frankfabric`, at a phone width (390×844) and a desktop width (1280×900).
For each route+width the harness compares
`document.documentElement.scrollWidth` against `window.innerWidth`;
`noHorizontalScroll` is true when `scrollWidth <= innerWidth`. Full-page PNGs and
per-width JSON reports live alongside this file as `before-*-390.*` and
`before-*-1280.*`.

| Route | Width | scrollWidth | innerWidth | noHorizontalScroll | Evidence |
|---|---|---|---|---|---|
| `/` | 390×844 | 390 | 390 | ✅ true | `before-landing-390.png/.json` |
| `/` | 1280×900 | 1280 | 1280 | ✅ true | `before-landing-1280.png/.json` |
| `/projects/chef-chatbot/` | 390×844 | 390 | 390 | ✅ true | `before-chef-390.png/.json` |
| `/projects/chef-chatbot/` | 1280×900 | 1280 | 1280 | ✅ true | `before-chef-1280.png/.json` |
| `/projects/coach-trainer/` | 390×844 | 390 | 390 | ✅ true | `before-coach-390.png/.json` |
| `/projects/coach-trainer/` | 1280×900 | 1280 | 1280 | ✅ true | `before-coach-1280.png/.json` |
| `/projects/digital-wardrobe/` | 390×844 | 390 | 390 | ✅ true | `before-wardrobe-390.png/.json` |
| `/projects/digital-wardrobe/` | 1280×900 | 1280 | 1280 | ✅ true | `before-wardrobe-1280.png/.json` |
| `/projects/virtual-pet/` | 390×844 | 390 | 390 | ✅ true | `before-pet-390.png/.json` |
| `/projects/virtual-pet/` | 1280×900 | 1280 | 1280 | ✅ true | `before-pet-1280.png/.json` |

**Observation on "horizontal scroll":** No route overflows horizontally at
either width — `scrollWidth == innerWidth` everywhere, so the strict
`scrollWidth <= innerWidth` assertion already passes on the BEFORE baseline. The
mobile concern for FEAT-002/003 is therefore **not** a document-level horizontal
scrollbar but **layout cramping at 390px**: on the demo routes the stage/canvas
and the control panel share the small viewport, so the 390×844 full-page
screenshots (`before-*-390.png`) show the panel and canvas competing for
vertical space rather than the comfortable `md:flex-row`/`lg:grid` two-column
layout seen at 1280×900 (`before-*-1280.png`). Improvements should preserve the
already-passing no-horizontal-scroll property while relieving that cramping.

## Current keyboard / focus / reduced-motion / canvas-aria state (from code)

### (a) sr-only labels / focus rings / aria-live already present

- **Chef** (`components/chef/ChefChatbot.tsx`): has `sr-only` labels, `focus:` focus rings, and an `aria-live` log region (`role="log"` at line 205).
- **Coach** (`components/coach/CoachChatbot.tsx`): same — `sr-only`, `focus:` rings, `aria-live` log (`role="log"` at line 209).
- **Virtual Pet** (`components/pet/VirtualPet.tsx`): has `sr-only` labels, `focus:` rings, `aria-live`, and stat bars exposed as `role="progressbar"` with `aria-valuenow/min/max` (line 267).
- **Shared infra:** `components/three/SceneLoader.tsx` uses `role="status"` + `aria-live` for the load fallback; `components/three/QualityToggle.tsx` is a `role="radiogroup"` of `role="radio"` options with focus styling.
- **Wardrobe** (`components/WardrobeBuilder.tsx`): has a `role="radiogroup"`/`role="radio"` option group (lines 398/407) but **no** `sr-only` label and **no** `aria-live` region (grep count 0), unlike chef/coach/pet.

### (b) Scene `<Canvas>` ARIA — wardrobe is the gap

- `components/chef/ChefScene.tsx` → `<Canvas role="img" aria-label="3D chef avatar">` (lines 743–744).
- `components/coach/CoachScene.tsx` → `<Canvas role="img" aria-label="3D coach avatar">` (lines 576–577).
- `components/pet/PetScene.tsx` → `<Canvas role="img" aria-label="3D virtual pet dog">` (lines 585–586).
- `components/wardrobe/WardrobeScene.tsx` → `<Canvas>` (line 725) has **NEITHER** `role` **NOR** `aria-label`. This is the one scene canvas missing an accessible name/role.

### (c) No reduced-motion handling anywhere — all motion runs unconditionally

There is **no** `prefers-reduced-motion` media query (0 matches in `.tsx`/`.ts`/`.css`) and **no** `window.matchMedia` usage anywhere in the repo (0 matches). As a result every motion source runs unconditionally, regardless of the user's OS "reduce motion" preference:

- **Camera nudges** — `CameraRig` motion in chef/coach/wardrobe reacting to focus / `lastChange`.
- **Idle + ambient particle motion** — avatar idle bob/sway and ambient particles in `useFrame` (e.g. ChefScene wisps, wardrobe motes).
- **Wardrobe autoRotate** — `components/wardrobe/WardrobeScene.tsx` sets `const autoRotate = animation === "rest"` (line 721) and passes `autoRotate` + `autoRotateSpeed={0.6}` to `OrbitControls` (lines 817–818), so the model spins whenever the scene is at rest.
- **Landing-page CSS animations** — `app/page.tsx` uses `animate-scan`, `animate-emberPulse`, `animate-ticker`, `animate-marquee`, and `animate-ringSpin` (plus `animate-floatY` defined in `tailwind.config.ts`), all running continuously with no gate.

FEAT-002/003 must **gate/scale** these motions under `prefers-reduced-motion`
without rewriting the pinned pose/transform/camera-framing constants (per the
workstream constraints), add an accessible name to the wardrobe canvas, and
bring the wardrobe controls' sr-only/aria-live labelling in line with the other
three widgets — while keeping the no-horizontal-scroll property intact.

## Harness

`scripts/measure-viewports.mjs` is a sibling of `scripts/measure-load.mjs`. It
reuses the same `node:http` static-export server mount (built `out/` under
`BASE_PATH` `/frankfabric`) and the same headless Chrome launch, but loads one
`--route` at both 390×844 and 1280×900, waits for the scene `<canvas>` (or a
plain load for the landing page), takes a **full-page** screenshot at each
width, measures `scrollWidth` vs `innerWidth`, and writes a PNG + JSON per width
(plus a combined summary JSON) under `--out` (default `docs/a11y`). It exits 0
only when every measured width has `noHorizontalScroll === true`. It is a
measurement tool, not part of the build, and does not modify `measure-load.mjs`.

Reproduce:

```
export PATH="/opt/toolchains/.nvm/versions/node/v22.23.2/bin:$PATH"
export CHROME_PATH=/usr/local/bin/chrome
npm run build
node scripts/measure-viewports.mjs --route / --label before-landing --out docs/a11y
node scripts/measure-viewports.mjs --route /projects/chef-chatbot/ --label before-chef --out docs/a11y
node scripts/measure-viewports.mjs --route /projects/coach-trainer/ --label before-coach --out docs/a11y
node scripts/measure-viewports.mjs --route /projects/digital-wardrobe/ --label before-wardrobe --out docs/a11y
node scripts/measure-viewports.mjs --route /projects/virtual-pet/ --label before-pet --out docs/a11y
```
