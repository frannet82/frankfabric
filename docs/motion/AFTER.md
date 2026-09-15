# WS3 Motion & Interactivity — AFTER Evidence

This file is the **AFTER** evidence for Workstream 3 (Motion & Interactivity) on
branch `motion/interactivity`. It proves, with **numbers and images, not
adjectives**, that the WS3 changes (engine-driven camera framing, clickable 3D
objects that dispatch REAL queries/actions through the existing logic layer, and
small ambient life) landed **without regressing the WS2 Fast path** and without
adding any asset bytes, and that every interaction routes through the **existing
engine / state / content layer** — no parallel state machine, no answers
invented in a component.

Compare against `docs/motion/BASELINE.md` (the BEFORE numbers). The companion
`docs/motion/DIFF.md` is the compact BEFORE-vs-AFTER frame-time table.

## Git state this evidence was taken at

| Property            | Value                                                              |
| ------------------- | ------------------------------------------------------------------ |
| Branch              | `motion/interactivity`                                             |
| `main` fork point   | `68adeb7` (Merge #26 — WS1 perf + WS2 visual/lighting merged)      |
| WS3 commits on top  | `28109dd` BEFORE baseline · `029318c` chef+coach · `8c07346` pet+wardrobe · this commit (AFTER evidence) |

## Machine & browser (identical to the BEFORE baseline)

| Property        | Value                                                          |
| --------------- | -------------------------------------------------------------- |
| Machine         | Linux sandbox, x86-64                                          |
| GPU / renderer  | **Software rasterizer — ANGLE + SwiftShader** (headless Chrome, no real GPU) |
| Node            | v22.23.2 (`/opt/toolchains/.nvm/versions/node/v22.23.2/bin`)   |
| Browser         | Chrome for Testing **151.0.7922.10** (`/usr/local/bin/chrome`) — same build as BEFORE |
| Launch GL args  | `--use-gl=angle --use-angle=swiftshader --ignore-gpu-blocklist --no-sandbox` |
| Viewport        | 1280 × 900, deviceScaleFactor 1                               |
| Served from     | `npm run build` static export in `out/`, mounted under `/frankfabric` |

### ⚠️ Software-GL caveat (read before quoting FPS)

The sandbox has **no real GPU**; all WebGL runs through SwiftShader on the CPU.
The absolute frame-time / FPS numbers are **NOT representative of real
hardware**. They are meaningful only as a **relative** before/after comparison
**on this same machine + browser**. The WS3 gate is: the **Fast median must not
regress** against the BEFORE Fast median. On the heaviest scenes (pet, wardrobe)
the frame counts are low, so the tail percentiles carry software-rasterizer
noise — the **median** is the stable signal.

## Build gate (final, this commit)

- `npm run lint` → **clean** except the single pre-existing, expected
  `@next/next/no-page-custom-font` warning in `app/layout.tsx` (0 errors, 0
  other warnings). Full output:

  ```
  > frank-cloud-fabric@0.1.0 lint
  > eslint .

  /projects/sandbox/frankfabric/app/layout.tsx
    20:9  warning  Custom fonts not added in `pages/_document.js` will only load for a single page. This is discouraged. See: https://nextjs.org/docs/messages/no-page-custom-font  @next/next/no-page-custom-font

  ✖ 1 problem (0 errors, 1 warning)
  ```

- `npm run build` → **static export into `out/` succeeds**; all five pages
  prerender (`○ (Static)` each): `/`, `/_not-found`, `/projects/chef-chatbot`,
  `/projects/coach-trainer`, `/projects/digital-wardrobe`,
  `/projects/virtual-pet`. TypeScript passed (Next 16.2.11 / Turbopack,
  "Finished TypeScript"), confirming the additive engine `focus` field and the
  new scene props typecheck.

`out/`, `.next/`, `node_modules/`, and `assets-src/` are gitignored and are
**never** committed. Only the `docs/motion/` evidence + source is committed.

## AFTER frame time — median (ms), Fast + High per scene

Measured with the committed `scripts/measure-frametime.mjs` (rAF timing loop,
~5 s live rendering, animations left running; `--quality` clicks the shared
`QualityToggle` radio the same way a user would). Per-scene JSON:
`after-<scene>-<fast|high>-frametime.json`.

| Scene    | AFTER Fast median (ms) | Fast mean / p95 (ms) | Fast frames | AFTER High median (ms) | High mean / p95 (ms) | High frames |
| -------- | ---------------------- | -------------------- | ----------- | ---------------------- | -------------------- | ----------- |
| Chef     | **66.7**               | 75.37 / 116.7        | 67          | 83.3                   | 87.07 / 133.3        | 58          |
| Coach    | **83.3**               | 78.83 / 116.7        | 63          | 83.5                   | 92.28 / 100.1        | 54          |
| Pet      | **183.3**              | 191.66 / 416.6       | 28          | 283.3                  | 287.02 / 550.0       | 18          |
| Wardrobe | **83.3**               | 85.63 / 166.6        | 58          | 116.7                  | 120.63 / 133.4       | 42          |

## Fast-path regression check (the load-bearing WS3 gate)

| Scene    | BEFORE Fast median | AFTER Fast median | Δ (ms) | Verdict                         |
| -------- | ------------------ | ----------------- | ------ | ------------------------------- |
| Chef     | 66.7               | 66.7              | 0.0    | ✅ not regressed (identical)     |
| Coach    | 83.3               | 83.3              | 0.0    | ✅ not regressed (identical)     |
| Pet      | 183.3              | 183.3             | 0.0    | ✅ not regressed (identical)     |
| Wardrobe | 83.3               | 83.3              | 0.0    | ✅ not regressed (identical)     |

**Every Fast median is byte-identical to the BEFORE baseline (Δ = 0 ms).** The
Fast path is not regressed on any scene — well within software-rasterizer noise,
in fact with no measurable difference at the median at all.

High medians are likewise flat (chef 83.3→83.3, coach 83.4→83.5, pet 283.3→283.3,
wardrobe 116.7→116.7); the +0.1 ms on coach-High is a single-frame quantisation
step on a low-frame-count software-GL run, not a real regression.

### Why Fast stays flat — heavier ambient motion is High-only

The added ambient life is **gated to `quality==='high'`** in every scene, so the
Fast path only ever runs the tiny variant that already existed:

- **Chef** — `SteamWisps`: **26** drifting points on High vs **10** on Fast.
- **Coach** — `FloorShimmer`: **22** points on High vs **8** on Fast.
- **Pet** — `DustMotes`: **20** motes on High vs **7** on Fast.
- **Wardrobe** — `AtelierMotes`: **22** points on High vs **8** on Fast.

All four use an in-memory `CanvasTexture` sprite (no external asset), a single
`BufferGeometry` updated in place (no per-frame allocation), and dispose on
unmount. The gate is the scene's `isHigh = quality === 'high'`, read from the
shared WS2 quality tier — the same flag WS2 uses to gate the ground backdrop and
rim light. The engine-driven camera nudges and the clickable props are cheap and
run on both tiers; only the heavier particle counts are High-only.

## AFTER cold-load bytes + readiness (fixed-camera capture)

Captured with the committed `scripts/measure-load.mjs`. Every route reported
`ready: true` with `unresolvedFailures: []` (the two `errors` entries per route
are the benign `/favicon.ico` 404 + the aborted duplicate root fetch that the
harness reconciles against the successful loads — identical to BEFORE).

| Scene    | Route                         | BEFORE total | AFTER total | Δ         | Screenshot            | Load JSON              |
| -------- | ----------------------------- | ------------ | ----------- | --------- | --------------------- | ---------------------- |
| Chef     | `/projects/chef-chatbot/`     | 2.600 MB     | 2.605 MB    | +5 KB     | `after-chef.png`      | `after-chef.json`      |
| Coach    | `/projects/coach-trainer/`    | 2.460 MB     | 2.464 MB    | +4 KB     | `after-coach.png`     | `after-coach.json`     |
| Pet      | `/projects/virtual-pet/`      | 9.873 MB     | 9.877 MB    | +4 KB     | `after-pet.png`       | `after-pet.json`       |
| Wardrobe | `/projects/digital-wardrobe/` | 8.267 MB     | 8.271 MB    | +4 KB     | `after-wardrobe.png`  | `after-wardrobe.json`  |

The few-KB deltas are the additional JS for the camera-rig / clickable-prop /
ambient code inside the already-split scene chunk — **no new asset bytes**. The
WS1 cold-load byte budget (chef 2.60 MB, coach 2.46 MB, pet 9.87 MB, wardrobe
8.27 MB) is respected on every scene.

## Idle vs mid-interaction stills (motion a single fixed frame can't show)

A fixed-camera still can't show a camera *move*, a click *reaction*, or *ambient
motion*, so for each scene there is an **idle** still and a **mid-interaction**
still captured while the eased camera nudge / reaction is still playing. The
interaction in each capture was driven through the **exact same input path** a 3D
prop click raises (a real suggestion chip / action button / the canvas hit
target), so the reaction shown is the one the click produces.

| Scene    | Idle still               | Mid-interaction still         | What the pair shows                                                                 |
| -------- | ------------------------ | ----------------------------- | ----------------------------------------------------------------------------------- |
| Chef     | `after-chef-idle.png`    | `after-chef-interact.png`     | After `send("Suggest a recipe")` → engine `focus:'suggest'`, the camera eases its layered nudge (framing shifts vs idle). |
| Coach    | `after-coach-idle.png`   | `after-coach-interact.png`    | After `send("Suggest a workout")` → engine `focus:'suggest'`, the camera settle-nudge plays (framing shifts vs idle). |
| Pet      | `after-pet-idle.png`     | `after-pet-interact.png`      | After `doAction("play")` → `applyAction` (state engine), the playful push-in nudge is mid-flight (dog is closer). |
| Wardrobe | `after-wardrobe-idle.png`| `after-wardrobe-interact.png` | Clicking the torso region → `cycleCategory('outfit')` over `OPTIONS` **changed the garment** (orange tee → hooded top) + a small emphasis nudge. |

Ambient life (steam / shimmer / dust motes) is running in the idle stills (they
are captured with animations **not** disabled); the frame-time JSONs above are
the quantitative proof it costs nothing on Fast.

## Per-interaction routing — proof each goes through the EXISTING layer

The core WS3 acceptance criterion: **every** interaction routes through the
existing engine / state / content layer (mirrors tireshop's `reply.intent` +
`useConversation.send()`), and the engines' behavior is **unchanged**. Below,
each new interaction is traced to the real file/function.

### 1. Chef clickable prop → chef engine

- **Click target:** `SampleDishProp` (procedural plate + cloche, no asset) in
  `components/chef/ChefScene.tsx`; `onPointerDown` → `onSampleDishClick` prop
  (drei `useCursor` for hover).
- **Input path:** `components/chef/ChefChatbot.tsx` wires
  `onSampleDishClick={() => send("Suggest a recipe")}` — the **same `send()`**
  the chat composer and suggestion chips call.
- **Engine:** `send()` calls `respondToMessage(history, "Suggest a recipe")` in
  `lib/chef/chefEngine.ts`; the reply + suggestions come from the engine and are
  pushed to the transcript + spoken via `ChefVoice`. The scene constructs **no**
  recipe text.
- **Camera:** `send()` reads `response.focus` off the engine result and pushes it
  to `ChefScene` as `focus` + a monotonic `focusNonce`; `<CameraRig>` reacts only
  to that engine-returned `focus` (never re-derives intent from keywords).

### 2. Coach clickable prop → coach engine

- **Click target:** `KettlebellProp` (procedural sphere + half-torus handle) in
  `components/coach/CoachScene.tsx`; `onPointerDown` → `onKettlebellClick`.
- **Input path:** `components/coach/CoachChatbot.tsx` wires
  `onKettlebellClick={() => send("Suggest a workout")}` — the same `send()` as
  the composer / chips.
- **Engine:** `send()` → `respondToMessage(history, "Suggest a workout")` in
  `lib/coach/coachEngine.ts` → reply/suggestions/`focus`. No workout text in the
  scene.
- **Camera:** `focus` + `focusNonce` passed to `CoachScene`'s `<CameraRig>`;
  reacts only to the engine's `focus`.

### 3. Pet clickable → pet state engine

- **Click target:** the `<Pet>` group in `components/pet/PetScene.tsx`;
  `onPointerDown` → `onPetClick` prop (drei `useCursor`). The scene **never
  mutates stats**.
- **Input path:** `components/pet/VirtualPet.tsx` wires
  `onPetClick={() => doAction("play")}` — the **same `doAction`** the on-screen
  action buttons call.
- **State engine:** `doAction` runs `decayForElapsed` + `applyAction` from
  `lib/pet/petState.ts` and persists via `savePetState`; the stat bars update
  exactly as if the "Play" button was pressed. (`lib/pet/petState.ts` is
  **byte-unchanged** vs `main` — verified below.)
- **Camera:** `VirtualPet` already passes `action` + `actionNonce` (the state
  engine's transient output) to `PetScene`; the `CameraRig` layers a playful
  push-in keyed to that action and eases back to the pinned rest framing.

### 4. Wardrobe clickable → wardrobe content (OPTIONS) + builder setter

- **Click target:** `GarmentHitbox` (invisible box, `colorWrite` off) over
  torso/legs in `components/wardrobe/WardrobeScene.tsx`; `onPointerDown` →
  `cycleCategory('outfit')` (torso) / `cycleCategory('bottom')` (legs) (drei
  `useCursor`). The scene holds **no garment option list**.
- **Content + setter:** `components/WardrobeBuilder.tsx`
  `cycleCategory(cat) = setOption(cat, nextIndex(cat, selection[cat]))` —
  `setOption` is the **same selection setter** the menu cards call, and
  `nextIndex` is a pure helper in `components/wardrobe/wardrobeOptions.ts` that
  wraps over `OPTIONS[cat].length` (the content source of truth; `OPTIONS`
  content is unchanged). The garment change is visible in the AFTER stills
  (orange tee → hooded top).
- **Camera:** `setOption` bumps a `lastChange {category, nonce}` signal;
  `WardrobeScene`'s `CameraRig` eases a small dolly keyed to `lastChange` (the
  content-layer output, not click coordinates) and eases back **without**
  touching the OrbitControls turntable constants.

### 5. Responsive camera moves — all keyed to engine/state/content output

Each camera move above reacts **only** to a value the logic layer produced
(chef/coach `focus`, pet `action`+`actionNonce`, wardrobe `lastChange`). None
re-derives intent in the view, and all are **additive/layered** on top of the
pinned framing: the rigs compose `camera.position = PINNED_REST + easedOffset`
and re-aim at `PINNED_LOOK + easedLookOffset` via drei's `maath` `damp3`/`damp`,
then relax a per-nonce pulse to 0 so they always ease back to the locked shot.

## Engines' behavior unchanged (additive `focus` only)

- `lib/chef/chefEngine.ts` / `lib/coach/coachEngine.ts` gained only an
  **optional** `focus?` field on `ChefResponse` / `CoachResponse`, populated from
  the branch the engine **already** chose (greeting/ingredients/recipe/suggest/
  chat · greeting/exercises/walkthrough/suggest/chat). No input parsing, reply
  text, or suggestion changes. FEAT-002 proved this by capturing
  `{reply, suggestions}` for 6 chef + 6 coach representative inputs before/after
  (byte-identical, 6639 bytes, `Buffer.equals === true`).
- `lib/pet/petState.ts` (pet state engine) and
  `components/wardrobe/wardrobeOptions.ts` `OPTIONS` content are **unchanged**
  (only a pure `nextIndex` helper was appended to the latter).

## Assets added

**None.** `git diff --stat 68adeb7..HEAD -- public/ assets-src/` is empty — no
files under `public/` or `assets-src/` changed. Every clickable prop and every
ambient element is a **procedural mesh / in-memory `CanvasTexture`**; no texture,
model, or font was added. The few-KB per-route load deltas are code, not assets.

## WS1 + WS2 wins confirmed preserved

- **WS1 (load):** `components/three/SceneLoader.tsx` (the `useProgress`
  fallback) is **byte-unchanged** vs `main`; no scene re-added an eager preload;
  the per-route cold-load byte totals still match the WS1 budget (table above);
  scene code stays behind `next/dynamic { ssr:false }`.
- **WS2 (quality + lighting):** `components/three/quality.ts`,
  `components/three/QualityToggle.tsx` are **byte-unchanged** — the shared
  High/Fast tier + the single `QualityToggle` remain the **only** quality
  control. Tone mapping stays **ACESFilmic** on all four scenes and the
  key/fill/bounce light rigs, exposure, and the pinned framing constants
  (`AIM_HEIGHT`, `CAMERA_DISTANCE`, `fov`, `MODEL_SCALE`, `AIM_MODEL_FRACTION`,
  wardrobe turntable `autoRotate`) are unchanged (no `+`/`-` on those lines in
  `git diff 68adeb7..HEAD`).

## How to reproduce

```sh
export PATH=/opt/toolchains/.nvm/versions/node/v22.23.2/bin:$PATH
cd /projects/sandbox/frankfabric
npm install
npm run lint            # only the known no-page-custom-font warning
npm run build           # static export into out/, all five routes prerender

# AFTER fixed-camera screenshots + cold-load byte reports
for pair in chef:chef-chatbot coach:coach-trainer pet:virtual-pet wardrobe:digital-wardrobe; do
  name="${pair%%:*}"; route="${pair##*:}"
  node scripts/measure-load.mjs --dir out --route /projects/$route/ --label after-$name --out docs/motion
done

# AFTER frame time — Fast (regression gate) AND High per scene
for pair in chef:chef-chatbot coach:coach-trainer pet:virtual-pet wardrobe:digital-wardrobe; do
  name="${pair%%:*}"; route="${pair##*:}"
  for q in fast high; do
    node scripts/measure-frametime.mjs --dir out --route /projects/$route/ \
      --label after-$name-$q-frametime --out docs/motion --quality $q
  done
done
```

(The idle-vs-mid-interaction stills were captured with a throwaway
Playwright-core driver that reused the same server + Chrome launch args as the
committed harnesses; it was deleted after use and is not committed. It drove the
same real controls — chip / action button / canvas hit target — that exercise
the engine/state/content input path a 3D prop click routes through.)
