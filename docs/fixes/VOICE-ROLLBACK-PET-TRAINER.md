# Fixes: voice rollback, pet color, trainer motion + zoom

Follow-up corrections after PRs #29 / #30 / #31. All four items land on one
branch. WS1–WS4 preserved throughout. No new dependencies.

---

## Item 1 — Roll back chef + trainer voices to Web Speech

PR #30 (commit `f03c8a8`) had replaced the browser Web Speech
(`SpeechSynthesis`) voices with `HTMLAudioElement` MP3 playback plus a real
`AnalyserNode` `getLoudness()`. That is rolled back:

- **`lib/chef/chefVoice.ts`** restored verbatim from commit `1d07b2b` (the
  pre-MP3 Web Speech version: `SpeechSynthesisUtterance`, tuned rate/pitch,
  Italian/male preferred-voice picker, anti-stuck-engine mitigations,
  `getLoudness()` returns `0`).
- **`lib/coach/coachVoice.ts`** restored verbatim from commit `f3fc04f` (the
  pre-MP3 Web Speech version, same robustness mitigations, `getLoudness()`
  returns `0`).
- Public interface preserved exactly: `speak(text, {onStart, onEnd})`,
  `setMuted`, `getLoudness`, `dispose`, `get isMuted`. `ChefChatbot.tsx` /
  `CoachChatbot.tsx` were not touched and still compile (WS3).

Scene-side consumption of the (now always-`0`) loudness was reverted:

- **`components/chef/ChefScene.tsx`** — no change needed. The jaw already prefers
  live loudness and **falls back to a sine wobble when `getLoudness()` returns
  0** (the `speaking` path), which is exactly what runs under Web Speech.
- **`components/coach/CoachScene.tsx`** — PR #30/#31 (commit `bb47523`) had wired
  the gesture INTENSITY to `getLoudness()`. Under Web Speech that is always `0`,
  which would pin the coach at the amplitude floor and read limp. The intensity
  is now driven by the plain **`speaking` window**: the amplitude multiplier
  eases toward `1` while `speaking` and relaxes to `GESTURE_LOUDNESS_FLOOR` when
  silent. `getLoudness` remains on the props type for API compatibility but is no
  longer consulted. The `onStart`/`onEnd` speaking-window contract is unchanged
  (WS3: gesture on the speaking window, no parallel state machine).

Assets removed after grep-confirming nothing else references them:
`public/audio/chef-voice.mp3` (104,877 B) and
`public/audio/personal-trainer.mp3` (80,388 B) — **185,265 B freed** (WS1). The
`docs/fixes/NEW-CHARACTERS.md` PART C section is annotated as rolled back.

> Note: the Web Speech voice was itself called "robotic" before — that is the
> known Web Speech limitation the user is choosing to return to. It is restored
> cleanly, not improved.

---

## Item 2 — Pet chicken rendered with NO color (TRUE root cause + fix)

**Symptom:** the chicken rendered flat grey/white (see
`docs/fixes/before-pet-1280.png`).

**Diagnosis (runtime evidence, not a tonal guess).** The wiring in
`components/pet/PetScene.tsx` was already correct: the base-color map is assigned
to every skinned mesh, uv0 exists (and is copied to uv2 for AO), `colorSpace` is
sRGB with `needsUpdate`, and the file serves 200. A **pixel probe** of the
committed albedo was the deciding evidence:

| file | bytes | mean RGB | colorful-pixel fraction |
| --- | --- | --- | --- |
| committed `DefaultMaterial_Base_color.png` | 72,788 | (220, 215, 208) near-white | **1.7%** |
| source `DefaultMaterial_Base_color.png` (the other zip entry) | 981,902 | (182, 148, 126) warm brown/tan | **69.9%** |

`chicken-character.zip` (frannet82/assets) ships **two** entries named
`textures/DefaultMaterial_Base_color.png` at different sizes. The committed 72 KB
copy was the **wrong near-white low-detail duplicate** — there was simply no
color IN the texture, so no map/roughness/lighting change could ever restore it.
(This is why PR #31 commit `0065972`, which only lowered roughness 1.0→0.72 and
added `normalScale`, did not fix it.)

**Fix.** The correct 981,902 B albedo was WebP-compressed (q90, `sharp`) to
**97,842 B** — color verified to survive the encode (mean RGB unchanged, ~70.6%
colorful pixels) — committed as
`public/models/characters/chicken/DefaultMaterial_Base_color.webp` and wired via
`TEX_BASE_COLOR`. `three`'s `TextureLoader` decodes WebP natively (no new
dependency; consistent with the AO/normal/roughness maps already being WebP,
WS1). The wrong 72 KB PNG was removed. The 0.72 roughness + `normalScale` from
PR #31 are harmless and kept.

**Verified:** `docs/fixes/after-pet-1280.png` shows the chicken in true color
(reddish-brown body/wings, dark comb/wattle, cream belly, yellow-tan legs). No
horizontal scroll at 390×844 or 1280×900. Pet zoom framing (`CAMERA_DISTANCE`
4.5) left as-is.

---

## Item 3 — Mouth + eyes motion on the trainer (astronaut)

**Verified hard fact (probed by the orchestrator; not re-investigated).** The
`astronaut.glb` is an Avaturn-style avatar with 4 meshes (`avaturn_body`,
`avaturn_hair_0`, `avaturn_shoes_0`, `avaturn_look_0`). It has **ZERO morph
targets / blend shapes** on any mesh, and its only head-region bones are `Head`
and `Neck` — there is **NO jaw, mouth, eye, eyelid, brow, teeth or tongue**.
Therefore skeletal OR morph-based mouth/eye articulation is **impossible** on
this model, and floating a fake mouth/eye mesh over the baked-texture face
cannot be placed reliably, so it is intentionally NOT done.

**What was implemented (honest approximation).** A subtle "talking" **head
cadence** on the `Head` bone in `components/coach/CoachScene.tsx`: a small,
quicker nod (pitch) plus a faint side-tilt (roll), layered additively on the
head bone ONLY while speaking, so the coach reads as actively talking-to-you
rather than a frozen face. It:

- rides the SAME `speaking` window as every other gesture (eases in/out via
  `gestureRef`; sits at the exact rest pose when silent) — no parallel engine
  state, no ambient timer (WS3);
- is fully suppressed under `prefers-reduced-motion` (WS4);
- uses tiny amplitudes (≤ ~0.05 rad) so the head never clips the tight framing.

The canvas `aria-label` was updated to mention the head nod (WS4).

**Eyes / true mouth articulation: reported as impossible on this model.** With
no eyelid bones and no blink/viseme blendshapes, periodic blinks and real
lip-sync cannot be done honestly here. **Recommendation for a future model
swap:** a face-rigged / morph-target avatar — a VRM with viseme + blink
blendshapes, or a ReadyPlayerMe/Avaturn export WITH ARKit blendshapes — would be
required for real mouth + eye motion.

---

## Item 4 — Zoom in more on the trainer

`components/coach/CoachScene.tsx` framing constants tightened for a
head-and-torso portrait where the face reads prominently, without cropping the
top of the head:

- `CAMERA_DISTANCE` `2.4 → 1.7` (astronaut reads noticeably larger)
- `AIM_MODEL_FRACTION` `0.82 → 0.9` (aim point on the upper chest/lower face so
  the head stays comfortably inside the frame)

`PINNED_CAM` and the `<Canvas>` initial camera derive from these constants, so
the WS3 `CameraRig` eases back to the new closer framing after any engine nudge;
the routing is unchanged.

**Verified:** `docs/fixes/before-trainer-1280.png` → `after-trainer-1280.png`
(and `-390.png`). Larger figure, face prominent, head not cropped, no horizontal
scroll at 390×844 or 1280×900.

---

## Gate

- `npm run lint`: clean except the one pre-existing
  `@next/next/no-page-custom-font` warning in `app/layout.tsx` (0 errors).
- `npm run build`: static export succeeds; all 7 routes prerender.
- WS1 (asset() URLs, WebP-compressed re-fetched albedo, byte budget: −185 KB MP3
  removed, +26 KB net albedo swap), WS2 (shared quality, ACESFilmic, no
  blow-out), WS3 (engine/state routing unchanged; coach on the speaking window),
  WS4 (390×844 + 1280×900 no horizontal scroll, reduced-motion gating, canvas
  aria) — all preserved.
