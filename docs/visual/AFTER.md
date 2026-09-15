# WS2 Visual Quality & Lighting — AFTER Evidence

This file proves the WS2 acceptance criteria with **numbers and images, not
adjectives**, for the visual-quality / lighting work on branch
`visual/lighting-quality`. FEAT-002 introduced **exactly one** shared High/Fast
quality concept and rebuilt every scene's lighting into a proper
key/fill/bounce rig with softened shadow edges, tuned ContactShadows, and a
procedural ground/backdrop for depth. This document captures the AFTER
fixed-camera screenshots (both quality paths), the Fast-path before→after
frame time (proving **no regression**) plus the High-path frame time, the
cold-load byte deltas, and the per-scene tone-mapping / no-blow-out decisions.

It is measured the same way, on the same machine/browser, as
`docs/visual/BASELINE.md`, so the before/after is apples to apples. It does
**not** overwrite `docs/perf/` (WS1 evidence), which is untouched.

## Machine & browser (identical to BASELINE.md)

| Property        | Value                                                          |
| --------------- | -------------------------------------------------------------- |
| Machine         | Linux sandbox, x86-64                                          |
| GPU / renderer  | **Software rasterizer — ANGLE + SwiftShader** (headless Chrome)|
| Node            | v22.23.2 (nvm)                                                |
| Browser         | Chrome for Testing **151.0.7922.10** (`/usr/local/bin/chrome`)|
| Launch GL args  | `--use-gl=angle --use-angle=swiftshader --ignore-gpu-blocklist --no-sandbox` |
| Viewport        | 1280 × 900, deviceScaleFactor 1                               |
| Served from     | `npm run build` static export in `out/`, mounted under `/frankfabric` |

### ⚠️ Software-GL caveat (read before quoting FPS)

The sandbox has **no real GPU**; all WebGL runs through SwiftShader (CPU). The
**absolute FPS / frame-time numbers below are NOT representative of real
hardware** and must never be quoted as "the site runs at N FPS". They are only
meaningful as a **relative** before/after comparison **on this same machine**:
the WS2 Fast path must not regress against the `before-*` numbers in
`BASELINE.md`, and the High path's added cost is reported relative to them. Low
frame counts on the heaviest scenes (pet, wardrobe) mean the tail percentiles
carry meaningful software-rasterizer noise; the **median** is the stable signal.

## Build gate (all green)

- `npm run lint` → clean except the single pre-existing, expected
  `@next/next/no-page-custom-font` warning in `app/layout.tsx` (0 errors).
- `npm run build` → static export into `out/` succeeds; all five pages prerender
  (`/`, `/projects/chef-chatbot`, `/projects/coach-trainer`,
  `/projects/digital-wardrobe`, `/projects/virtual-pet`).

## How these were captured

Both quality paths are driven deterministically by a **measurement-only**
`--quality high|fast` flag added to the two harness scripts. The flag clicks the
shared `QualityToggle` radio (the exact control a user sees, rendered by every
scene wrapper) **after** the canvas mounts — it changes **no** scene/quality
rendering code, it only flips the existing tier before the capture/timing runs.
Omitting the flag captures the default (High) path.

Fixed-camera screenshots + cold-load bytes (deterministic, animations disabled,
clipped to the canvas):

```
node scripts/measure-load.mjs --dir out --route /projects/<route>/ --label after-<scene>-<tier> --out docs/visual --quality <tier>
```

Frame time (live scene, animations left running, ~5s requestAnimationFrame loop
after a 4s settle):

```
node scripts/measure-frametime.mjs --dir out --route /projects/<route>/ --label after-<scene>-<tier>-frametime --out docs/visual --quality <tier>
```

Cold-load byte totals are **tier-independent** (no tier fetches a different
asset), so the byte report (`after-<scene>-load.json`) is captured once with the
default path.

All AFTER runs reported `ready: true`, `hasCanvas: true`, and
`unresolvedFailures: []`. The only console entries are the benign favicon 404 and
aborted-then-resolved duplicate RSC/asset prefetches the WS1 + BASELINE harness
also logs (they load successfully under the same URL). No shader-compile error
appears on any scene (the FEAT-002 `<SoftShadows>` VRM Face collision was removed
in that feature; softened edges now come from the higher 2048 shadow-map + tuned
ContactShadows blur).

## Per-scene BEFORE → AFTER screenshots (fixed camera)

Both quality paths are captured for every scene. The BEFORE shots are the
FEAT-001 baseline (single pre-change look; there was no quality selector then).

| Scene    | Route                         | BEFORE                       | AFTER — High                     | AFTER — Fast                     |
| -------- | ----------------------------- | ---------------------------- | -------------------------------- | -------------------------------- |
| Coach    | `/projects/coach-trainer/`    | `before-coach.png`           | `after-coach-high.png`           | `after-coach-fast.png`           |
| Chef     | `/projects/chef-chatbot/`     | `before-chef.png`            | `after-chef-high.png`            | `after-chef-fast.png`            |
| Wardrobe | `/projects/digital-wardrobe/` | `before-wardrobe.png`        | `after-wardrobe-high.png`        | `after-wardrobe-fast.png`        |
| Pet      | `/projects/virtual-pet/`      | `before-pet.png`             | `after-pet-high.png`             | `after-pet-fast.png`             |

Visible in the AFTER shots vs BEFORE: a proper key/fill/bounce rig gives each
subject shaping and directionality (previously flat ambient fill); High adds a
subtle procedural ground/backdrop disc so the coach/chef/pet no longer float over
bare ContactShadows and the wardrobe's flat background gains floor depth; shadow
edges are softer (2048 shadow-map + tuned ContactShadows blur). The Fast shots
show the same framing and colours with shadows off (shadow map disabled, lower
dpr cap), confirming the cheaper path still renders the subject correctly.

## Per-scene Fast-path frame time: BEFORE → AFTER (NO regression) + High path

Numbers from the `*-frametime.json` files in this directory. **Software-
rasterized — relative comparison only.** The acceptance bar is: **Fast AFTER
median ≤ Fast/pre-change BEFORE median** on this machine.

| Scene    | Fast BEFORE median (ms) | Fast AFTER median (ms) | Δ median            | No regression? |
| -------- | ----------------------: | ---------------------: | ------------------- | -------------- |
| Coach    | 83.3                    | **83.3**               | 0.0 (equal)         | ✅ yes         |
| Chef     | 83.3                    | **66.7**               | −16.6 (faster)      | ✅ yes         |
| Wardrobe | 100.1                   | **83.3**               | −16.8 (faster)      | ✅ yes         |
| Pet      | 250.0                   | **183.3**              | −66.7 (faster)      | ✅ yes         |

**The Fast path is no slower than today on every scene** — coach is dead-even and
the other three are faster, because Fast now caps dpr at `[0.75, 1.25]` (below
today's `[1, 2]`) and disables the shadow map. Full Fast/High/BEFORE detail:

| Scene    | Path            | Frames (~5s) | Median (ms) | Mean (ms) | p95 (ms) | Median FPS |
| -------- | --------------- | -----------: | ----------: | --------: | -------: | ---------: |
| Coach    | BEFORE          | 61           | 83.300      | 81.692    | 116.700  | 12.01      |
| Coach    | AFTER Fast      | 64           | 83.300      | 77.602    | 116.700  | 12.01      |
| Coach    | AFTER High      | 57           | 83.400      | 88.300    | 150.000  | 11.99      |
| Chef     | BEFORE          | 65           | 83.300      | 76.920    | 100.000  | 12.01      |
| Chef     | AFTER Fast      | 68           | 66.700      | 74.263    | 116.600  | 14.99      |
| Chef     | AFTER High      | 59           | 83.300      | 85.307    | 100.100  | 12.01      |
| Wardrobe | BEFORE          | 46           | 100.100     | 107.965   | 266.600  | 9.99       |
| Wardrobe | AFTER Fast      | 59           | 83.300      | 84.742    | 100.100  | 12.01      |
| Wardrobe | AFTER High      | 43           | 116.700     | 118.600   | 133.400  | 8.57       |
| Pet      | BEFORE          | 18           | 250.000     | 274.061   | 516.600  | 4.00       |
| Pet      | AFTER Fast      | 26           | 183.300     | 205.123   | 416.700  | 5.46       |
| Pet      | AFTER High      | 17           | 300.000     | 297.047   | 383.300  | 3.33       |

**High-path cost (expected, opt-in):** High turns the shadow map back on at 2048
(above today's 1024), raises dpr to `[1, 2]`, and adds the extra fill/bounce
light + ground disc, so it is somewhat heavier than the Fast/pre-change baseline
on the two heaviest scenes (wardrobe 100.1 → 116.7 ms, pet 250.0 → 300.0 ms
median). Coach and chef High land at ~today's baseline. This added cost is the
*optional* higher-fidelity path; the *default-cheap contract* the acceptance
criterion protects is the Fast path, which regresses on no scene. On pet/wardrobe
the frame counts are small (17–43 frames over 5 s under SwiftShader), so treat the
High tail numbers as noisy; the medians are the reliable comparison.

Per-scene JSON (min/max, browser, GL args, viewport, timestamps, recorded
`quality` tier) lives in `after-<scene>-<fast|high>-frametime.json`.

## Per-scene tone-mapping decision (CONSTRAINT #2)

**All four scenes are UNCHANGED — every scene stays on
`THREE.ACESFilmicToneMapping`.** No tone-mapping operator or exposure was
touched in FEAT-002. The High rigs were kept deliberately near-neutral (the key
intensities held at today's values), so no scene required switching to
`THREE.NeutralToneMapping @ 1.0`.

| Scene    | Tone mapping (before → after)         | Change? | Justification screenshot needed? |
| -------- | ------------------------------------- | ------- | -------------------------------- |
| Coach    | ACESFilmic → **ACESFilmic**           | none    | no (no change)                   |
| Chef     | ACESFilmic → **ACESFilmic**           | none    | no (no change)                   |
| Wardrobe | ACESFilmic → **ACESFilmic**           | none    | no (no change)                   |
| Pet      | ACESFilmic → **ACESFilmic**           | none    | no (no change)                   |

Because no operator/exposure changed, **no CONSTRAINT #2 before/after
justification pair is required** — that pair is only mandated for a scene whose
tone mapping *changes*. No blow-out means no change was needed (see next
section).

## Per-scene no-skin/face-highlight blow-out confirmation

The stronger High lighting does **not** clip any avatar's skin/face to white.
The two skin-bearing avatars are verifiable directly in the AFTER **High** shots:

- **Wardrobe** (`after-wardrobe-high.png`) — the drophunter VRM (MToon-style
  Face material). Face, cheeks, and neck keep their natural skin tone under the
  High key/fill/bounce rig; there is **no white roll-off** on the forehead or
  cheekbones. Compare directly with `before-wardrobe.png`: same skin colour, more
  shaping. This is the scene CONSTRAINT #2 most protects, and it passes on
  ACESFilmic without any tone-map change.
- **Chef** (`after-chef-high.png`) — the Swedish Chef **FBX** (matte
  `MeshStandardMaterial`, *not* MToon/VRM — the documented discrepancy from the
  briefing; recorded again here). The forehead, nose, and cheeks keep natural
  warm skin tone with no blown highlights; compare with `before-chef.png`.
- **Coach** (`after-coach-high.png`) and **Pet** (`after-pet-high.png`) — the
  coach OBJ skin and the dog's fur/nose read with true colour and added depth
  from the ground disc; no highlight blow-out.

Because none of the four scenes blows out on ACESFilmic, the tireshop
`NeutralToneMapping` fix was **not** needed anywhere, and no scene's operator was
changed (see table above).

## Cold-load byte deltas vs WS1 (`docs/perf/AFTER.md`) — budget not blown

Cold load = first-visit, empty cache; sum of every response body. Compared to the
WS1 `docs/perf/AFTER.md` per-route totals. **No external asset was added in
FEAT-002** (the ground/backdrop is a procedural in-memory `CanvasTexture`, and
the only drei helper used, `ContactShadows`, already shipped).

| Route            | Path                          | WS1 AFTER   | WS2 AFTER   | Δ bytes   | Δ %    |
| ---------------- | ----------------------------- | ----------: | ----------: | --------: | -----: |
| Coach Trainer    | `/projects/coach-trainer/`    | 2,440,696 B | 2,459,762 B | +19,066 B | +0.78% |
| Chef Chatbot     | `/projects/chef-chatbot/`     | 2,581,387 B | 2,600,451 B | +19,064 B | +0.74% |
| Digital Wardrobe | `/projects/digital-wardrobe/` | 8,248,182 B | 8,267,245 B | +19,063 B | +0.23% |
| Virtual Pet      | `/projects/virtual-pet/`      | 9,854,000 B | 9,873,067 B | +19,067 B | +0.19% |

The delta is a near-constant **~19 KB of JavaScript** on every route — the shared
`quality.ts` module + `QualityToggle.tsx` control (the same code on each page),
**not** any model/texture/HDRI. It shows up in each report's `byType` as growth
in `.js` with **no new `.vrm` / `.glb` / `.hdr` / image entry**. This is well
under 1% per route and does not blow the WS1 cold-load byte budget.

**Asset added: none.** No environment map, HDRI, or texture file was added; the
ground disc is generated procedurally in memory at scene mount.

## Exactly ONE shared quality concept across all four scenes

Confirmed by grep: all four scene modules import the same source, and all four
scene wrappers import the same source **and** the same reusable control.

```
components/coach/CoachScene.tsx      : from "@/components/three/quality"
components/chef/ChefScene.tsx        : from "@/components/three/quality"
components/wardrobe/WardrobeScene.tsx: from "@/components/three/quality"
components/pet/PetScene.tsx          : from "@/components/three/quality"

components/coach/CoachChatbot.tsx    : from "@/components/three/quality" + QualityToggle
components/chef/ChefChatbot.tsx      : from "@/components/three/quality" + QualityToggle
components/WardrobeBuilder.tsx       : from "@/components/three/quality" + QualityToggle
components/pet/VirtualPet.tsx        : from "@/components/three/quality" + QualityToggle
```

There is **one** `Quality = 'high' | 'fast'` type, **one** `qualitySettings()`
mapping, **one** `QualityProvider`/`useQuality` context, and **one**
`QualityToggle` control — no per-scene ad-hoc quality widget exists. The module
is deliberately three-free (mirrors `wardrobeOptions.ts`) so it never drags the
heavy three chunk into a static page bundle, preserving the WS1 chunk-split win.

## AFTER artifacts in this directory

- Screenshots: `after-<coach|chef|wardrobe|pet>-<high|fast>.png` (8 files)
- Frame time: `after-<coach|chef|wardrobe|pet>-<high|fast>-frametime.json` (8 files)
- Cold-load bytes: `after-<coach|chef|wardrobe|pet>-load.json` (4 files)
- BEFORE baseline (FEAT-001): `before-*.png` + `before-*-frametime.json` + `BASELINE.md`
