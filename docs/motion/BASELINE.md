# WS3 Motion & Interactivity — BEFORE Baseline

This file is the **BEFORE** evidence for Workstream 3 (Motion & Interactivity)
on branch `motion/interactivity`. It captures the state of the site **before**
any WS3 motion/interactivity code lands, so the WS3 AFTER numbers (produced in
FEAT-004) can be proven against it with **numbers and images, not adjectives**.

The load-bearing gate for WS3 is: **the Fast-path frame time must not regress**
against the medians in this file. New camera moves, clickable props, and ambient
life are additive; heavier ambient motion is High-only so Fast stays flat.

This baseline lives under `docs/motion/` and does **not** touch `docs/perf/`
(WS1 load evidence) or `docs/visual/` (WS2 quality/lighting evidence), which are
left untouched.

## Git state this baseline was taken at

| Property           | Value                                                  |
| ------------------ | ------------------------------------------------------ |
| Branch measured on | `motion/interactivity` (freshly cut off `main`)        |
| `main` HEAD SHA    | `68adeb786acf30363998f03a13f0d959f06f7c58` (`68adeb7`) |
| `main` HEAD subject| Merge pull request #26 from frannet82/visual/lighting-quality (WS1 perf + WS2 visual/lighting already merged) |

`motion/interactivity` was cut off `main` at the SHA above with **no source
changes** at the time of measurement, so these numbers describe merged `main`.

## Machine & browser

| Property        | Value                                                          |
| --------------- | -------------------------------------------------------------- |
| Machine         | Linux sandbox, x86-64                                          |
| GPU / renderer  | **Software rasterizer — ANGLE + SwiftShader** (headless Chrome, no real GPU) |
| Node            | v22.23.2 (nvm, `/opt/toolchains/.nvm/versions/node/v22.23.2/bin`) |
| Browser         | Chrome for Testing **151.0.7922.10** (`/usr/local/bin/chrome`) |
| Launch GL args  | `--use-gl=angle --use-angle=swiftshader --ignore-gpu-blocklist --no-sandbox` |
| Viewport        | 1280 × 900, deviceScaleFactor 1                               |
| Served from     | `npm run build` static export in `out/`, mounted under `/frankfabric` |

### ⚠️ Software-GL caveat (read before quoting FPS)

The sandbox has **no real GPU**; all WebGL runs through SwiftShader on the CPU.
The **absolute frame-time / FPS numbers below are NOT representative of real
hardware** and must never be quoted as "the site runs at N FPS". They are only
meaningful as a **relative** before/after comparison **on this same machine**:
the WS3 Fast path must not regress against the Fast medians here. On the heaviest
scenes (pet, wardrobe) the frame counts are low, so the tail percentiles carry
software-rasterizer noise — the **median** is the stable signal to compare.

## Build gate (all green on `motion/interactivity`)

- `npm run lint` → clean except the single pre-existing, expected
  `@next/next/no-page-custom-font` warning in `app/layout.tsx` (0 errors, 0
  other warnings).
- `npm run build` → static export into `out/` succeeds; all five pages
  prerender: `/`, `/projects/chef-chatbot`, `/projects/coach-trainer`,
  `/projects/digital-wardrobe`, `/projects/virtual-pet`.

`out/`, `.next/`, `node_modules/`, and `assets-src/` are gitignored and are
**never** committed. Only the `docs/motion/` evidence is committed.

## How to reproduce

```sh
# 1. Node 22 on PATH (not on PATH by default in this sandbox)
export PATH=/opt/toolchains/.nvm/versions/node/v22.23.2/bin:$PATH
node -v   # -> v22.23.2

# 2. From the repo root
cd /projects/sandbox/frankfabric
npm install

# 3. On the motion/interactivity branch, off main @ 68adeb7
git checkout main && git checkout -b motion/interactivity   # (already done)

# 4. Build gate
npm run lint     # only the known no-page-custom-font warning
npm run build    # static export into out/, all five routes prerender

# 5. BEFORE fixed-camera screenshots + cold-load byte reports (default/High path)
node scripts/measure-load.mjs --dir out --route /projects/chef-chatbot/     --label before-chef     --out docs/motion
node scripts/measure-load.mjs --dir out --route /projects/coach-trainer/    --label before-coach    --out docs/motion
node scripts/measure-load.mjs --dir out --route /projects/virtual-pet/      --label before-pet      --out docs/motion
node scripts/measure-load.mjs --dir out --route /projects/digital-wardrobe/ --label before-wardrobe --out docs/motion

# 6. BEFORE frame time — Fast (regression gate) AND High for each scene
for pair in chef:chef-chatbot coach:coach-trainer pet:virtual-pet wardrobe:digital-wardrobe; do
  name="${pair%%:*}"; route="${pair##*:}"
  for q in fast high; do
    node scripts/measure-frametime.mjs --dir out --route /projects/$route/ \
      --label before-$name-$q-frametime --out docs/motion --quality $q
  done
done
```

The `--quality high|fast` flag is a **measurement-only** driver: it clicks the
shared `QualityToggle` radio (the exact control a user sees) after the canvas
mounts. It changes **no** scene/quality rendering code — it only flips the
existing tier before timing.

## BEFORE cold-load bytes + readiness (fixed-camera capture)

Every route reported `ready: true` with `unresolvedFailures: []` (the `errors`
entries are benign aborted duplicate fetches / `/favicon.ico` 404s that the
harness reconciles against successful loads). Byte totals are independent of the
quality tier (no tier fetches a different asset).

| Scene    | Route                        | Total load | Screenshot            | Load JSON              |
| -------- | ---------------------------- | ---------- | --------------------- | ---------------------- |
| Chef     | `/projects/chef-chatbot/`    | 2.60 MB    | `before-chef.png`     | `before-chef.json`     |
| Coach    | `/projects/coach-trainer/`   | 2.46 MB    | `before-coach.png`    | `before-coach.json`    |
| Pet      | `/projects/virtual-pet/`     | 9.87 MB    | `before-pet.png`      | `before-pet.json`      |
| Wardrobe | `/projects/digital-wardrobe/`| 8.27 MB    | `before-wardrobe.png` | `before-wardrobe.json` |

## BEFORE frame time — median (ms), Fast + High per scene

These are the numbers FEAT-004's AFTER table is compared against directly. Lower
is better. **Fast must not regress** in WS3; the High column is the reference for
any added High-only ambient motion.

| Scene    | Fast median (ms) | Fast mean / p95 (ms) | Fast frames | High median (ms) | High mean / p95 (ms) | High frames |
| -------- | ---------------- | -------------------- | ----------- | ---------------- | -------------------- | ----------- |
| Chef     | **66.7**         | 74.88 / 150.0        | 67          | 83.3             | 86.44 / 100.0        | 59          |
| Coach    | **83.3**         | 77.34 / 100.1        | 64          | 83.4             | 91.21 / 150.0        | 55          |
| Pet      | **183.3**        | 190.38 / 383.3       | 26          | 283.3            | 286.10 / 566.6       | 18          |
| Wardrobe | **83.3**         | 85.03 / 150.0        | 59          | 116.7            | 119.44 / 133.4       | 42          |

Per-scene JSON: `before-<scene>-fast-frametime.json` and
`before-<scene>-high-frametime.json` for `chef`, `coach`, `pet`, `wardrobe`.

### Cross-reference with the WS2 Fast baseline (`docs/visual/AFTER.md`)

These BEFORE numbers are pre-WS3 on the same scenes, so they should sit in the
same ballpark as the WS2 Fast/High medians recorded in `docs/visual/` (measured
on the same machine/browser). They match closely, confirming a stable baseline:

| Scene    | WS3 BEFORE Fast | WS2 Fast (`after-*-fast-frametime.json`) | WS3 BEFORE High | WS2 High (`after-*-high-frametime.json`) |
| -------- | --------------- | ---------------------------------------- | --------------- | ---------------------------------------- |
| Chef     | 66.7            | 66.7                                     | 83.3            | 83.3                                     |
| Coach    | 83.3            | 83.3                                     | 83.4            | 83.4                                     |
| Pet      | 183.3           | 183.3                                    | 283.3           | 300.0                                    |
| Wardrobe | 83.3            | 83.3                                     | 116.7           | 116.7                                    |

The small pet-High delta (283.3 vs 300.0) is expected software-rasterizer noise
on the heaviest scene with the fewest sampled frames; the medians are otherwise
identical, confirming this WS3 baseline reflects merged `main` faithfully.
