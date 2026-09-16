# WS4 Mobile & Accessibility — BEFORE vs AFTER (FEAT-003)

Summary of the workstream change per route, plus the full list of files touched. Screenshots and
JSON for both states live in this directory (`before-*` from FEAT-001, `after-*` from FEAT-002/003).

## Per-route before → after

Horizontal-scroll was already clean on the BASELINE (see `BASELINE.md`): every route reported
`scrollWidth == innerWidth` at both 390x844 and 1280x900, so the "no horizontal scroll" acceptance
criterion holds in BOTH states. The real 390px problem was layout **cramping** (stage/canvas fighting
the control panel for the small viewport) plus missing a11y wiring, not overflow. WS4 relieved the
cramping while preserving no-scroll, and added the reduced-motion / focus / aria work.

| route | 390 scroll/inner (before → after) | 1280 scroll/inner (before → after) | panel over canvas? | a11y delta |
|---|---|---|---|---|
| `/` (landing) | 390/390 → 390/390 | 1280/1280 → 1280/1280 | n/a (no canvas) | CSS animations now honour prefers-reduced-motion |
| `/projects/chef-chatbot` | 390/390 → 390/390 | 1280/1280 → 1280/1280 | no (stage on top, panel below via flex-col) | reduced-motion gating; canvas aria-label reworded; focus path confirmed |
| `/projects/coach-trainer` | 390/390 → 390/390 | 1280/1280 → 1280/1280 | no (flex-col) | reduced-motion gating; canvas aria-label reworded |
| `/projects/digital-wardrobe` | 390/390 → 390/390 | 1280/1280 → 1280/1280 | no (stage `order-1`, menus stack + scroll) | canvas GAINED role="img" + aria-label; autoRotate gated; focus rings added to option cards/swatches/custom colour/animation radios |
| `/projects/virtual-pet` | 390/390 → 390/390 | 1280/1280 → 1280/1280 | no (flex-col) | reduced-motion gating (idle + hop frozen, dust motes skipped); canvas aria-label reworded |

All ten AFTER JSON reports (5 routes x 2 widths) record `noHorizontalScroll: true`.

## Files changed in the workstream

Application code (FEAT-002):
- `components/three/useReducedMotion.ts` — NEW shared SSR-safe reduced-motion hook (no new dep).
- `components/chef/ChefChatbot.tsx`, `components/coach/CoachChatbot.tsx`,
  `components/pet/VirtualPet.tsx` — read the hook, pass `reducedMotion` prop into the scene.
- `components/WardrobeBuilder.tsx` — read the hook, thread `reducedMotion` via memoized `sceneProps`;
  add focus-visible rings to option-card / swatch / animation-radio buttons + custom-colour label.
- `components/chef/ChefScene.tsx`, `components/coach/CoachScene.tsx`, `components/pet/PetScene.tsx`,
  `components/wardrobe/WardrobeScene.tsx` — gate camera nudge / idle-ambient motion / autoRotate on
  `reducedMotion` (offsets zeroed / early return / node not rendered); reword or ADD (wardrobe)
  canvas `role="img"` + aria-label.
- `app/globals.css` — global `@media (prefers-reduced-motion: reduce)` rule neutralizing
  animation/transition durations (keyframes NOT deleted).

Harness + evidence (FEAT-001 / FEAT-003):
- `scripts/measure-viewports.mjs` — viewport/a11y harness; FEAT-003 added `--reduced-motion`
  (emulateMedia), `--animations`, and `--widths` flags.
- `docs/a11y/` — `BASELINE.md`, `AFTER.md`, `KEYBOARD.md`, this `DIFF.md`, and the
  `before-*` / `after-*` PNG+JSON evidence (incl. the `after-{landing,pet}-{reduced,motion}-1280`
  reduced-motion pair).

No pinned pose/transform/camera-framing/tone-mapping/light/tint constant was changed; `quality.ts` +
the single `QualityToggle` remain the only quality control; no re-eager asset preload was added.
`node_modules/`, `.next/`, `out/`, and `assets-src/` are not committed.
