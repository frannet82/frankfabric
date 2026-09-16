# New characters + recorded voices

This note summarizes the character/voice swap on the `feat/new-characters-and-voices`
branch: the virtual pet's dog became a rigged animated chicken, the coach's
unrigged OBJ became a rigged astronaut (Ed Stronaut) with real limb motion, and
the chef/coach Web Speech voices became playback of recorded MP3s with real
loudness. It also records the byte budget (WS1) and how WS1–WS4 were preserved.

All evidence lives under `docs/fixes/` (cold-load `after-*.json`/`.png`, viewport
`after-*-390.json`/`-1280.json` + PNGs). It does **not** touch `docs/perf`,
`docs/visual`, `docs/motion`, or `docs/a11y` (the prior baselines used for the
delta comparison below).

---

## PART A — Virtual pet: rigged animated chicken

`components/pet/PetScene.tsx` now loads `public/models/characters/chicken/chicken.fbx`
with `FBXLoader` + `SkeletonUtils.clone` (a plain clone collapses the skinned
mesh). The FBX's four 3ds-Max maps are **not** auto-loaded by three, so they are
wired manually onto a fresh matte `MeshStandardMaterial` per skinned mesh:

- `DefaultMaterial_Base_color.png` → `.map` (sRGB albedo)
- `DefaultMaterial_Normal_DirectX.webp` → `.normalMap` (linear)
- `DefaultMaterial_Roughness.webp` → `.roughnessMap` (linear)
- `DefaultMaterial_Mixed_AO.webp` → `.aoMap` (linear; `uv0` copied into `uv2`
  because the meshes carry only one UV channel)

`color` stays white so the material never tints the maps, `roughness=1`,
`metalness=0`, so the bird reads with true PBR color and no blow-out under the
near-neutral warm rig (WS2). ACESFilmic tone mapping is unchanged.

**Measured orientation / bounds** (Box3 at runtime): X`[-2.06, 2.15]`,
Y`[-0.27, 9.47]`, Z`[-3.63, 3.04]` → Y-up and **upright** (Y size ~9.75 is the
tallest axis; depth Z ~6.68 > width X ~4.21). Chosen framing constants:

- `MODEL_TARGET_SIZE = 1.9` (scaled off the tallest bound)
- `BODY_YAW = 35°` — the raw FBX faced its **back** to the fixed camera (which
  looks down −Z); a small positive yaw turns the chest/head toward the camera in
  a friendly three-quarter view. Verified empirically with the after-pet shots.
- `AIM_HEIGHT = 0.95`, `CAMERA_DISTANCE = 3.15`, `fov = 34` (raised aim +
  distance vs the old wide/low dog so the full upright bird fits).

**Animation:** a `THREE.AnimationMixer` plays the baked idle clip
`fbx.animations[0]` ("Take 001", ~2.67s) looping (`LoopRepeat`, `Infinity`),
advanced with `mixer.update(delta)` in `useFrame` — this is **real skeletal
motion**. Under `prefers-reduced-motion` the idle is paused and pinned at
frame 0 (`mixer.update(0)`) so the chicken holds still; the whole-group ambience,
camera nudge, and dust motes are gated too. The idle `timeScale` is nudged by
mood/wellbeing energy (feed/play/clean speed it up, sleep slows it), all sourced
from the `mood`/`action`/`actionNonce` props (lib/pet state) — no parallel state
machine. The mixer + freshly-created materials/maps are disposed on unmount.

---

## PART B — Coach: rigged astronaut (Ed Stronaut) with procedural limb motion

`components/coach/CoachScene.tsx` now loads
`public/models/characters/astronaut/astronaut.glb` via `GLTFLoader` +
`SkeletonUtils.clone`, replacing the unrigged `coach.obj`. The GLB is
self-contained (14 embedded textures decoded automatically by GLTFLoader — no
loose-texture wiring).

**Confirmed rig** (parsed from the GLB JSON chunk): **52 joints** across 57
nodes, 4 meshes, 1 skin, and **0 baked animation clips**. Bone names carry **no**
`mixamorig` prefix: `Hips`, `Spine`, `Spine1`, `Spine2`, `Neck`, `Head`,
`Left/Right Shoulder/Arm/ForeArm/Hand` (+ fingers), legs, feet. Because the rig
ships a skeleton but **zero** clips, limb motion is **procedural** (chosen over
FBX retargeting, whose Mixamo map expects the prefixed names this rig lacks).

**How limb motion is driven** (modeled on ChefScene's `ARM_BONES`): the gesture
bones are resolved **by name** on the cloned model in a `useEffect`, and each
bone's rest rotation is captured once (missing bones `console.warn` + skip, never
throw). In `useFrame` a single smoothed 0→1 gesture amount eases toward 1 while
`speaking` and 0 when silent (framerate-independent, `k = 1 − exp(−delta·6)`); it
multiplies bounded per-bone time-based sin offsets (different freq/phase per bone
and per side) **added on top of** each captured rest rotation. Amplitudes: arms
~0.26 rad, forearm raise ~0.50 rad, hands ~0.30 rad, spine/chest/neck/head under
~0.07 rad — clearly readable yet bounded so limbs never clip the torso/head. A
tiny always-on idle sway (~0.010–0.012 rad) keeps the figure alive when silent.
`prefers-reduced-motion` drives both the gesture target and the idle to 0 → exact
rest pose. **This is real arm/spine/head motion the old armless OBJ could not
do.**

**Framing:** measured bounds at runtime (upright, Y tallest); scaled off the
tallest bound to `MODEL_TARGET_HEIGHT = 1.7`, recentered so a point
`AIM_MODEL_FRACTION = 0.82` up its height sits at `AIM_HEIGHT = 1.3`, camera at
`[0, 1.3, 2.4]`, `fov = 34`. `after-coach.png` confirms a front-facing
head-and-torso shot; the NASA suit reads its true white/blue with **no blow-out**
under the unchanged ACESFilmic + near-neutral rig (WS2). GLTFLoader's color
spaces are made explicit (map/emissive sRGB, data maps linear) without swapping
the GLB's PBR materials; loader-owned resources are intentionally not disposed
(they are shared by the clone and disposing would corrupt strict-mode remounts).

---

## PART C — Voices: recorded MP3 playback with real loudness

`lib/chef/chefVoice.ts` (`ChefVoice`) and `lib/coach/coachVoice.ts`
(`CoachVoice`) were rewritten to replace the Web Speech API with playback of the
recorded MP3s over a lazily-created `HTMLAudioElement`:
`asset('/audio/chef-voice.mp3')` and `asset('/audio/personal-trainer.mp3')`. The
**exact public interface is preserved** (`constructor`, `get isMuted`,
`setMuted`, `speak(text, {onStart, onEnd})`, `getLoudness()`, `dispose()`), so
`ChefChatbot.tsx` / `CoachChatbot.tsx` were not touched and still compile (WS3).

**Real loudness:** a Web Audio graph
(`AudioContext → MediaElementAudioSourceNode(audioEl) → AnalyserNode →
destination`) yields a smoothed 0..1 RMS while the clip plays, so the chef's jaw
and the coach's motion can track the actual voice. `getLoudness()` returns 0 when
idle/muted, and falls back to 0 (while still playing audio) if `AudioContext` is
unavailable. The context is resumed inside the user-gesture `speak()` call to
satisfy autoplay policy, and a rejected `play()` promise is routed through
`onEnd` so a blocked play never wedges the speaking window. Anti-overlap stops a
previous clip before starting a new one; `setMuted(true)` stops playback
immediately; `dispose()` tears down the graph and listeners. All lazy /
client-guarded so static export does not crash.

**Fixed-recording-vs-reply-text tradeoff (user's explicit instruction):** each
MP3 is a **single fixed recording**, so `speak(text)` does **not** synthesize the
reply words — it plays the **same** recorded voice line every time. `text` is
used only to decide whether to play (a non-empty reply opens the speaking window)
and is never spoken. The speaking window is driven by the **real audio duration**
(`onStart` on `playing`, `onEnd` on `ended`/`error`/cancel/stop). So the old
"speaks the actual reply words" behavior is now "plays the recorded voice line
while the reply text is displayed." This is a deliberate consequence of using
recorded MP3s rather than TTS.

---

## Model bytes: before / after

Textures were compressed with the **existing** approach (`sharp` 0.34.5 dev
dependency, `scripts/compress-assets.mjs`) — **no new dependency**. three's
GLTFLoader/TextureLoader decode `image/webp` natively, so WebP needs no runtime
decoder and stays static-export safe.

| Asset | Before | After | Note |
| --- | ---: | ---: | --- |
| schnauzer.glb (removed) | 7,978,696 B | 0 | replaced by chicken FBX (FEAT-002) |
| coach OBJ set (removed) | 611,189 B | 0 | coach.obj + 2 out.png + coach.mtl (FEAT-003) |
| astronaut.glb | 3,913,320 B | 2,110,508 B | embedded-texture WebP re-encode, −46% |
| chicken Normal (DirectX) | 1,428,239 B (PNG) | 299,250 B (WebP) | near-lossless, −79% |
| chicken Roughness | 333,855 B (PNG) | 32,302 B (WebP) | linear data map, −90% |
| chicken Mixed_AO | 475,940 B (PNG) | 63,246 B (WebP) | linear data map, −87% |
| chicken Base_color | 72,788 B (PNG) | 72,788 B (PNG) | already tiny; left as sRGB PNG |
| chicken.fbx | 4,621,472 B | 4,621,472 B | mesh + rig kept as-is |

Freed by removals: **~8.59 MB** (schnauzer 7.98 MB + coach OBJ set 0.61 MB).
Chicken loose textures: **2.24 MB → 0.39 MB (−82%)**. Astronaut GLB: **−1.80 MB**.

`scripts/compress-assets.mjs` was updated: its header/target comments now
describe the astronaut GLB + the chicken loose-texture pass instead of the
removed schnauzer, and a re-runnable loose-PNG→WebP pass was added (reads
`assets-src/`, writes `public/`; `assets-src/` stays gitignored and uncommitted).

## Per-route cold-load byte deltas (WS1 budget)

Measured with `scripts/measure-load.mjs` against a fresh `out/` build
(disk cache disabled). Baselines are the prior routes in `docs/perf/`.

| Route | Baseline (docs/perf) | After (docs/fixes) | Delta |
| --- | ---: | ---: | ---: |
| `/projects/virtual-pet/` | 14.328 MB (schnauzer) | 10.327 MB (chicken) | **−4.001 MB (−28%)** |
| `/projects/coach-trainer/` | 2.431 MB (unrigged OBJ) | 3.995 MB (astronaut) | **+1.564 MB** |

Notes:
- The pet route dropped ~4 MB because the 12.5 MB schnauzer GLB (with a 4.9 MB
  loose color PNG) was replaced by the 4.62 MB chicken FBX + 0.39 MB WebP maps +
  72 KB base PNG. (In the cold-load report the FBX's own embedded textures show
  up as in-memory `blob:` decodes, not extra network transfer.)
- The coach route grew ~1.56 MB: the old `coach.obj` was a tiny **unrigged**
  mesh, while the astronaut is a real 52-joint rig with 14 embedded textures.
  WebP compression already cut it from ~5.8 MB (raw GLB) to 3.995 MB, so this is
  the minimum cost of shipping a genuinely rigged, gesturing coach.
- Both after-routes: `ready=true`, `hasCanvas=true`, `unresolvedFailures=[]`
  (the 2 reported errors are the harness's own `/frankfabric/` base-path
  document/favicon fetches, present in every prior run and unrelated to the
  scene).

---

## WS1–WS4 preservation (how verified)

**WS1 — chunking + on-demand loading + `asset()` on every URL + byte budget.**
Every new URL (chicken FBX, its 3 WebP + 1 PNG maps, astronaut GLB, both MP3s)
goes through `asset()` so it resolves under `/frankfabric/…` on GitHub Pages;
verified in the cold-load reports (all `200`, `/frankfabric/…` prefixed). Scenes
are still imported via `next/dynamic { ssr: false }` and load on demand. Byte
budget recorded above (pet −4 MB; coach +1.56 MB with WebP already applied).

**WS2 — shared `quality.ts` / `QualityToggle`, ACESFilmic, no skin blow-out.**
`DEFAULT_QUALITY`/`qualitySettings` and the QualityToggle are intact in both
scenes; the High/Fast radio is visible in the after shots. Tone mapping stays
ACESFilmic and the light rig is unchanged. No blow-out on either new character:
the astronaut's white NASA suit and skin read true in `after-coach.png`, and the
chicken reads matte cream in `after-pet.png` — the WebP normal map was kept
near-lossless so its vectors are not mangled.

**WS3 — engine/state routing unchanged.** Pet interactions route only through
`lib/pet` (VirtualPet.doAction); the click on the pet mesh still calls
`onPetClick`. Coach routing (focus/focusNonce, kettlebell → `send()`) is
untouched. Voices swap only the **audio source** — the preserved
speak/getLoudness/setMuted/dispose interface means `ChefChatbot`/`CoachChatbot`
were not modified.

**WS4 — mobile/desktop + keyboard + reduced motion + text alternatives.** At
390×844 and 1280×900 both routes report `noHorizontalScroll=true` +
`hasCanvas=true` (`after-pet-390/1280.json`, `after-coach-390/1280.json`). The
keyboard path and visible focus are unaffected (chat inputs/buttons and the
QualityToggle are unchanged DOM). `prefers-reduced-motion` gating uses
`useReducedMotion`: the chicken idle freezes at frame 0 and the astronaut holds
its exact rest pose. Both canvases keep `role="img"` with updated alternatives —
pet: "Animated 3D chicken that reacts to feeding, play, sleep and cleaning";
coach: "Animated 3D astronaut gym coach that gestures with its arms while giving
workout advice."

## Verification

- `npm run lint` → 0 errors, only the expected `@next/next/no-page-custom-font`
  warning in `app/layout.tsx`.
- `npm run build` → static export succeeds, all routes prerender.
- Cold-load + viewport evidence regenerated under `docs/fixes/` against a fresh
  `out/` build; both characters render correctly and framed after compression.
