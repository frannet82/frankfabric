# Workstream 1 — Load Weight & Runtime Perf: AFTER (FEAT-003)

This file records the **post-optimization** numbers after the full workstream-1
work: **FEAT-002** (WebP asset compression) + **FEAT-003** (JS code-splitting /
on-demand loading / `useProgress` progress UI). It is measured the same way, on
the same machine/browser, as `BASELINE.md`, so the before/after is apples to
apples.

Re-run any route with:

```
npm run build
node scripts/measure-load.mjs --dir out --route <route> --label after-<route>
```

## Machine / runtime measured on

Identical to the baseline capture:

- **Host:** Linux sandbox (containerized), x86-64.
- **Node:** v22.23.2.
- **Browser:** Google Chrome for Testing **151.0.7922.10**, headless, via
  `playwright-core` (`executablePath=/usr/local/bin/chrome`).
- **GPU:** software rasterizer — ANGLE + SwiftShader
  (`--use-gl=angle --use-angle=swiftshader --ignore-gpu-blocklist --no-sandbox`).
- **Viewport:** 1280×900, deviceScaleFactor 1.

## Build gate (all green)

- `npm run lint` → clean except the single, pre-existing, expected
  `@next/next/no-page-custom-font` warning in `app/layout.tsx` (0 errors).
- `npm run build` → static export into `out/` succeeds; all five pages prerender
  (`/`, `/projects/chef-chatbot`, `/projects/coach-trainer`,
  `/projects/digital-wardrobe`, `/projects/virtual-pet`).

## Largest JS chunk (the FEAT-003 code-split win)

The three/@react-three/@pixiv-three-vrm-heavy chunk was **statically preloaded by
the Digital Wardrobe page** at baseline because `components/WardrobeBuilder.tsx`
imported the `OPTIONS` *runtime value* directly from the three-heavy
`WardrobeScene` module. FEAT-003 moved `OPTIONS` + the shared types into a new
zero-three module `components/wardrobe/wardrobeOptions.ts`, so the wardrobe page
no longer drags that module graph into its static bundle.

| Metric | Baseline | After | Change |
|--------|---------:|------:|-------:|
| Largest JS chunk **referenced by any prerendered page HTML** (raw) | 913,347 B | **203,384 B** | **−77.7 %** |
| Largest JS chunk **referenced by any prerendered page HTML** (gzip) | 238,951 B | **63,950 B** | **−73.2 %** |

The ~913 KB three chunk still exists in the build (now ~922 KB raw / ~242 KB
gzip, one copy per dynamically-imported scene bundle) but is **no longer
referenced by any prerendered `index.html`** — it loads **only** when a 3D scene
is actually mounted via `next/dynamic { ssr:false }`. Verified:

```
# no prerendered HTML references the biggest chunk
grep -rl <biggest-chunk>.js out/**/*.html  ->  (no matches)
# every route's largest *statically referenced* chunk is now 203,384 B
```

## Per-route cold-load transferred bytes (before → after)

Cold load = first-visit, empty cache; sum of every response body transferred.
All routes: `ready=true`, `unresolvedFailures=[]`.

| Route | Path | Baseline | After | Change |
|-------|------|---------:|------:|-------:|
| Landing | `/` | 1,157,888 B (1.158 MB) | **1,158,117 B (1.158 MB)** | ~flat (no 3D bytes either way) |
| Digital Wardrobe | `/projects/digital-wardrobe/` | 18,671,336 B (18.671 MB) | **9,241,579 B (9.242 MB)** | **−50.5 %** |
| Chef Chatbot | `/projects/chef-chatbot/` | 2,571,811 B (2.572 MB) | **2,581,387 B (2.581 MB)** | ~flat* |
| Coach Trainer | `/projects/coach-trainer/` | 2,431,115 B (2.431 MB) | **2,440,696 B (2.441 MB)** | ~flat* |
| Virtual Pet | `/projects/virtual-pet/` | 14,327,684 B (14.328 MB) | **9,854,000 B (9.854 MB)** | **−31.2 %** |

*Chef and coach are ~flat because FEAT-002 deliberately **left their external
FBX/OBJ textures uncompressed** (documented in FEAT-002 findings: the WebP win
there is small in absolute terms and is not reproducible from the repeatable
GLB/VRM script — it would require editing `coach.mtl` / `ChefScene.tsx`
`TEXTURE_URL`). Their weight is dominated by the FBX/OBJ **geometry**, which the
texture policy does not touch. FEAT-003 does not change asset bytes on any route;
its win is the JS chunk and the deferred-loading behavior below.

### Landing loads ZERO 3D-model bytes

`after-landing.json` `byType` has **no `.vrm` and no `.glb`** entry
(`.vrm`+`.glb` = 0 bytes). The heavy three code and every model stay behind the
`ssr:false` dynamic scene wrappers, so the landing page ships none of it.

### Wardrobe loads only the DEFAULT look; other garments are on-demand

The wardrobe cold load fetches exactly the **6 default VRMs** — the initial
styled look — and none of the other ~30 garments:

```
body.vrm (945,716) · eyes/regulareyes.vrm (318,904) · head/short.vrm (427,604)
chest/shirt.vrm (162,364) · legs/cargopants.vrm (247,200) · feet/sneakers.vrm (146,448)
```

The other garment VRMs still load **only when their option is selected** (via
`<Garment url=…>` in `lib/vrm/transplant.tsx`) — FEAT-003 confirmed this and did
**not** add any eager `useGLTF.preload` of the full garment set.

## Per-scene screenshot diff vs baseline

See `DIFF.md` in this directory for the full method + numbers. Summary: all four
scenes render **identically** to baseline (same framing, colors, tone mapping,
tint constants). The small per-pixel deltas on wardrobe and pet are pure
**animation-phase silhouette drift** (the wardrobe turntable auto-rotate and the
pet's always-on idle breathing bob land on a slightly different frame at capture
time); the **color-distribution total-variation distance is ~0 for every scene**,
which proves no tone-mapping / exposure / tint / texture change occurred.

## After artifacts in this directory

- `after-landing.{json,png}`
- `after-wardrobe.{json,png}`
- `after-chef.{json,png}`
- `after-coach.{json,png}`
- `after-pet.{json,png}`
- `DIFF.md` (per-scene before/after screenshot diff metrics)
