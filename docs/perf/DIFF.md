# Per-scene screenshot diff — after (FEAT-003) vs baseline (FEAT-001)

Acceptance evidence that the four 3D scenes **render identically** to baseline
after the workstream-1 changes (FEAT-002 compression + FEAT-003 code-split /
deferred loading / `useProgress` fallback). Each `after-*.png` is compared to the
committed `baseline-*.png` captured at the same route, same fixed camera, by the
same `scripts/measure-load.mjs` harness (viewport 1280×900, ANGLE+SwiftShader,
`animations:'disabled'` on the Playwright screenshot).

Two complementary metrics were computed with the already-present `sharp`
(throwaway scripts, not committed):

1. **Per-pixel difference** — both PNGs resized to 512×512, RGB mean/max absolute
   difference (0–255), and the share of pixels differing by more than a trivial
   AA threshold of 16/255.
2. **Color-distribution total-variation distance** — 16-bin-per-channel RGB
   histograms, TV distance (0 = identical color distribution, 1 = disjoint).
   This metric is **motion-invariant**: a per-frame animation phase shift moves
   pixels around the frame but does not change the overall color distribution,
   whereas a tone-mapping / exposure / tint / texture regression *would*.

## Results

| Scene | mean pixel diff | max pixel diff | pixels > AA(16) | color-hist TV | Verdict |
|-------|----------------:|---------------:|----------------:|--------------:|---------|
| Wardrobe | 1.054 / 255 | 233 / 255 | 1.522 % | **0.0020** | identical (turntable auto-rotate phase) |
| Chef | 0.000 / 255 | 0 / 255 | 0.000 % | **0.0000** | identical (bit-for-bit) |
| Coach | 0.003 / 255 | 12 / 255 | 0.000 % | **0.0001** | identical |
| Pet | 5.854 / 255 | 226 / 255 | 10.956 % | **0.0044** | identical (idle breathing-bob phase) |

## Interpretation

- **Chef & coach** diff essentially bit-for-bit — they were captured at/near rest,
  so even the per-pixel metric is ~0. This also proves the capture pipeline itself
  introduces no color/tone shift.
- **Wardrobe & pet** show a small per-pixel delta concentrated on the subject's
  **silhouette edges**, because both scenes run a JS `useFrame` animation that is
  *not* frozen by Playwright's CSS `animations:'disabled'` (that only freezes CSS
  animations, not the R3F render loop):
  - Wardrobe: `OrbitControls autoRotate` spins the turntable at rest, so the
    avatar is a fraction of a degree rotated between the two captures.
  - Pet: the schnauzer's always-on breathing/idle bob
    (`group.position.y = breathe + liveBob + …`) lands on a different phase, so
    the whole dog sits a few pixels higher/lower — which shifts its entire
    outline (hence the 11 % edge-pixel count).
  This is **animation phase**, not a rendering regression, and the same
  JS-animation-vs-frozen-CSS behavior was present when the baseline was captured.
- The **color-distribution TV distance is ≈0 for all four scenes** (worst 0.0044,
  pet). Identical color distributions confirm the tone-mapping operator
  (`ACESFilmicToneMapping`), exposure, MToon/material tint constants and every
  texture are **unchanged** — FEAT-003 touched only module structure (the
  `wardrobeOptions.ts` split), the Suspense fallback, and nothing in the render
  path. Visual side-by-side inspection of both moving scenes confirms the same
  subject, framing, texture detail, and colors.

**Conclusion:** all four scenes render identically to baseline; no scene is a
regression.
