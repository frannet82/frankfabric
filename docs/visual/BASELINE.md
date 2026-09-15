# WS2 Visual Quality & Lighting — BEFORE Baseline

This is the pre-change (today) baseline for the visual-quality / lighting work
on branch `visual/lighting-quality`. It captures a fixed-camera screenshot and a
frame-time reading for each of the four 3D scenes **as they render today**, so
the WS2 changes can be proven against it with numbers rather than adjectives.

There is no quality selector in frankfabric yet, so **today's rendering IS the
Fast-path-equivalent baseline**. The frame-time files below are labelled
`before-*` and are the reading to beat: the WS2 "fast" path must be **no slower
than these** numbers on the same machine.

## Machine & browser

| Property        | Value                                                         |
| --------------- | ------------------------------------------------------------- |
| Machine         | Linux sandbox, x86-64                                          |
| GPU / renderer  | **Software rasterizer — ANGLE + SwiftShader** (headless Chrome)|
| Node            | v22.23.2 (nvm)                                                |
| Browser         | Chrome for Testing 151.0.7922.10 (`/usr/local/bin/chrome`)    |
| Launch GL args  | `--use-gl=angle --use-angle=swiftshader --ignore-gpu-blocklist --no-sandbox` |
| Viewport        | 1280 × 900, deviceScaleFactor 1                               |
| Served from     | `npm run build` static export in `out/`, mounted under `/frankfabric` |

### ⚠️ Software-GL caveat (read before quoting FPS)

The sandbox has **no real GPU**; all WebGL runs through SwiftShader (CPU). The
**absolute FPS / frame-time numbers below are NOT representative of real
hardware** and should never be quoted as "the site runs at N FPS". They are only
meaningful as a **relative** before/after comparison **on this same machine**:
the WS2 Fast path must not regress against the `before-*` numbers here, and the
High path's added cost is reported relative to them too.

## How these were captured

Fixed-camera screenshots + cold-load bytes (deterministic, animations disabled):

```
node scripts/measure-load.mjs --dir out --route /projects/<route>/ --label before-<scene> --out docs/visual
```

Frame time (live scene, animations left running, ~5s requestAnimationFrame loop
after a 4s settle):

```
node scripts/measure-frametime.mjs --dir out --route /projects/<route>/ --label before-<scene>-frametime --out docs/visual
```

Both harnesses share the same http server (mounting `out/` under `/frankfabric`),
the same Chrome launch args and viewport, and the same canvas-mount readiness
check. `measure-frametime.mjs` is a new sibling added in this feature;
`measure-load.mjs` only measures bytes + screenshot.

## BEFORE screenshots (fixed camera)

| Scene    | Route                        | Screenshot                          |
| -------- | ---------------------------- | ----------------------------------- |
| Coach    | `/projects/coach-trainer/`   | `docs/visual/before-coach.png`      |
| Chef     | `/projects/chef-chatbot/`    | `docs/visual/before-chef.png`       |
| Wardrobe | `/projects/digital-wardrobe/`| `docs/visual/before-wardrobe.png`   |
| Pet      | `/projects/virtual-pet/`     | `docs/visual/before-pet.png`        |

All four routes reported `ready: true`, `hasCanvas: true`, and zero unresolved
network failures. (The harness logs a benign `/favicon.ico` 404 and aborted RSC
prefetch duplicates that resolved under the same URL — same as the WS1 harness.)

## BEFORE frame time (pre-change / Fast-path-equivalent)

Numbers are per-scene from the `before-*-frametime.json` files in this folder.
**Software-rasterized — relative comparison only.**

| Scene    | Frames (~5s) | Median (ms) | Mean (ms) | p95 (ms) | Median FPS |
| -------- | ------------ | ----------- | --------- | -------- | ---------- |
| Coach    | 61           | 83.300      | 81.692    | 116.700  | 12.01      |
| Chef     | 65           | 83.300      | 76.920    | 100.000  | 12.01      |
| Wardrobe | 46           | 100.100     | 107.965   | 266.600  | 9.99       |
| Pet      | 18           | 250.000     | 274.061   | 516.600  | 4.00       |

Full per-scene detail (min/max, browser, GL args, viewport, timestamps) lives in:

- `docs/visual/before-coach-frametime.json`
- `docs/visual/before-chef-frametime.json`
- `docs/visual/before-wardrobe-frametime.json`
- `docs/visual/before-pet-frametime.json`

## Environment / build state at capture time

- `npm run lint` — clean, **0 errors**, only the one expected pre-existing
  `@next/next/no-page-custom-font` warning in `app/layout.tsx`.
- `npm run build` — static export into `out/` succeeded; all five pages
  prerendered (`/`, `/projects/chef-chatbot`, `/projects/coach-trainer`,
  `/projects/digital-wardrobe`, `/projects/virtual-pet`).

## Note for later WS2 features (not a blocker)

`context.json` flags a discrepancy: the orchestrator briefing calls the chef a
VRM, but the code (`components/chef/ChefScene.tsx` + README) shows the chef is a
Swedish Chef **FBX** whose material is replaced with a matte
`MeshStandardMaterial` (not MToon/VRM). It still bears a skin/face texture, so
the no-blow-out tone-mapping check applies, but the MToon-specific reasoning is
wardrobe-only. Recorded here for the tone-mapping-gated features that follow.
