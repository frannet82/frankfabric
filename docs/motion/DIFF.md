# WS3 Motion & Interactivity — BEFORE vs AFTER (frame-time diff)

Compact BEFORE-vs-AFTER frame-time comparison for Workstream 3. Full context,
routing proofs, byte budget, and stills are in `docs/motion/AFTER.md`; the BEFORE
numbers and reproduction steps are in `docs/motion/BASELINE.md`.

## Machine & browser (same for BEFORE and AFTER)

- **Machine:** Linux sandbox, x86-64.
- **GPU / renderer:** software rasterizer — **ANGLE + SwiftShader** (headless
  Chrome, no real GPU).
- **Browser:** Chrome for Testing **151.0.7922.10** (`/usr/local/bin/chrome`).
- **Node:** v22.23.2. **Viewport:** 1280 × 900, dpr 1.
- **GL args:** `--use-gl=angle --use-angle=swiftshader --ignore-gpu-blocklist --no-sandbox`.

> ⚠️ Software-GL: absolute FPS is **not** hardware-representative. Only the
> **relative** before/after delta on this machine is meaningful. The **median**
> is the stable signal; tail percentiles on the low-frame-count heavy scenes
> (pet, wardrobe) carry rasterizer noise.

## Median frame time (ms) — lower is better

Source JSON: `before-<scene>-<q>-frametime.json` vs
`after-<scene>-<q>-frametime.json`.

| Scene    | Fast BEFORE | Fast AFTER | Fast Δ | High BEFORE | High AFTER | High Δ |
| -------- | ----------- | ---------- | ------ | ----------- | ---------- | ------ |
| Chef     | 66.7        | **66.7**   | 0.0    | 83.3        | 83.3       | 0.0    |
| Coach    | 83.3        | **83.3**   | 0.0    | 83.4        | 83.5       | +0.1   |
| Pet      | 183.3       | **183.3**  | 0.0    | 283.3       | 283.3      | 0.0    |
| Wardrobe | 83.3        | **83.3**   | 0.0    | 116.7       | 116.7      | 0.0    |

## Verdict

- **Fast path — the load-bearing WS3 gate:** every scene's AFTER Fast median is
  **identical** to BEFORE (Δ = 0.0 ms). **No Fast regression on any scene.**
- **High path:** flat within software-GL noise. The only non-zero delta is
  coach-High +0.1 ms — a single-frame quantisation step at ~54 sampled frames,
  not a real regression.
- **Why:** every heavier ambient element (steam / floor shimmer / dust / atelier
  motes) is gated to `quality==='high'`; the Fast path runs only the tiny
  pre-existing variant. The engine-driven camera nudges and clickable props are
  cheap enough to run on both tiers. See `AFTER.md` for the High-vs-Fast particle
  counts and the per-interaction routing proofs.

## Byte budget (cold load, MB) — no new assets

| Scene    | BEFORE | AFTER | Δ      |
| -------- | ------ | ----- | ------ |
| Chef     | 2.600  | 2.605 | +5 KB  |
| Coach    | 2.460  | 2.464 | +4 KB  |
| Pet      | 9.873  | 9.877 | +4 KB  |
| Wardrobe | 8.267  | 8.271 | +4 KB  |

Deltas are code inside the already-split scene chunk; `git diff --stat` shows
**zero** changes under `public/` or `assets-src/` (all props/ambient are
procedural / in-memory). WS1 byte budget respected on every scene.
