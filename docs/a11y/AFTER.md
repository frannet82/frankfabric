# WS4 Mobile & Accessibility — AFTER (FEAT-002)

Machine/runtime: Node v22.23.2 via `/opt/toolchains`; Chromium via `/usr/local/bin/chrome`
(playwright chromium), headless, `--use-gl=angle --use-angle=swiftshader --no-sandbox`.

Gate (verbatim expectation):
- `npm run lint` → exactly ONE pre-existing warning `@next/next/no-page-custom-font` in
  `app/layout.tsx`; 0 errors, 0 other warnings.
- `npm run build` → clean static export, all five routes prerendered
  (`/`, `/projects/chef-chatbot`, `/projects/coach-trainer`, `/projects/digital-wardrobe`,
  `/projects/virtual-pet`).

## (A) Reduced-motion wiring

Shared source of truth: `components/three/useReducedMotion.ts` — a three-free, SSR-safe hook
built on `useSyncExternalStore` reading `window.matchMedia('(prefers-reduced-motion: reduce)')`
(server snapshot `false`, subscribes to OS changes). No new dependency.

Consumers read it once at the widget wrapper and pass a `reducedMotion` prop into the scene:
- `ChefChatbot` → `ChefScene`
- `CoachChatbot` → `CoachScene`
- `VirtualPet` → `PetScene`
- `WardrobeBuilder` → `WardrobeScene` (via memoized `sceneProps`)

What each scene gates when reduced motion is ON (offsets zeroed / early-returned; NO pinned
pose/camera/tone-mapping/light/tint constant is edited):
- Chef: CameraRig nudge held at pinned framing (pulse→0); SteamWisps not rendered; SampleDishProp
  idle sine-bob + continuous spin dropped (hover lift kept); Avatar talking arm gestures damped to
  rest (`gTarget`→0). Lip-sync jaw still tracks speech.
- Coach: CameraRig held; Avatar bob/sway/lean + breathing baseline frozen to rest (early return);
  FloorShimmer not rendered; KettlebellProp idle bob dropped.
- Pet: CameraRig held; whole-group breathing/bob/wiggle/droop + feed/play/sleep/clean hop frozen
  (early return, envelopes zeroed); DustMotes not rendered.
- Wardrobe: OrbitControls `autoRotate={false}`; CameraRig garment-change nudge held; AtelierMotes
  not rendered. Drag-to-rotate / scroll-to-zoom and explicitly-selected clips still work.

CSS animations (landing page + spinners): global rule in `app/globals.css`
`@media (prefers-reduced-motion: reduce)` neutralizes ALL `animation-*`/`transition-*` (so
animate-scan/ticker/marquee/emberPulse/ringSpin/floatY + SceneLoader spinners + hover translate
are stilled) without deleting keyframes; content still renders at its start position.

## (D) Canvas text alternatives (final aria-labels, role="img")

- Chef: "Animated 3D chef avatar in chef whites that gestures and speaks while giving cooking answers"
- Coach: "Animated 3D gym coach that bobs and gestures while giving workout advice"
- Pet: "Animated 3D schnauzer dog that reacts to feeding, play, sleep and cleaning"
- Wardrobe (previously had NEITHER role nor label): role="img" +
  "Rotating 3D avatar wearing the currently selected top, bottoms, shoes and hair; drag to rotate, scroll to zoom"

## (B) Mobile / responsive (390x844, no horizontal scroll)

Harness `scripts/measure-viewports.mjs` (built `out/`, per route+width):

| route | 390 scroll/inner | 1280 scroll/inner | noHorizontalScroll |
|---|---|---|---|
| / | 390 / 390 | 1280 / 1280 | true |
| /projects/chef-chatbot | 390 / 390 | 1280 / 1280 | true |
| /projects/coach-trainer | 390 / 390 | 1280 / 1280 | true |
| /projects/digital-wardrobe | 390 / 390 | 1280 / 1280 | true |
| /projects/virtual-pet | 390 / 390 | 1280 / 1280 | true |

Chef/coach/pet stack `flex-col` below md: (stage on top with a real min-height, panel below, not
overlaying); wardrobe is a 3-col `lg:grid` that stacks below lg: (stage `order-1` with min-h, menus
below with scrolling option lists + `flex-wrap` swatch rows). Landing `<main>` keeps
`overflow-x-hidden` and no child overflows at 390. Evidence PNGs: `docs/a11y/after-*-{390,1280}.png`.

## (C) Keyboard path + visible focus

All interactive controls are Tab-reachable with a visible focus-visible indicator. Per-widget order:
- Chef/Coach: QualityToggle (High/Fast radios) → mute toggle → suggestion chips → composer input → Send.
- Pet: QualityToggle → Feed/Play/Sleep/Clean buttons → name input → Save.
- Wardrobe: QualityToggle → left menu (Shoes, Hair) option-card buttons + colour swatches + custom
  colour picker → animation radios → right menu (Top, Bottoms) option cards + swatches + picker.

Focus-visible rings ADDED where missing: wardrobe option-card buttons, colour swatch buttons,
custom-colour `<label>` (focus-within), animation radios. Chef/coach/pet controls + QualityToggle
already had rings (kept). No labels/aria removed.

## WS3 clickable-prop keyboard equivalents (verified redundant — no new control added)

- Chef `onSampleDishClick → send("Suggest a recipe")`: the "Suggest a recipe" suggestion chip calls
  the SAME `send()`. Reachable by keyboard.
- Pet `onPetClick → doAction("play")`: the "Play" action button calls the SAME `doAction`.
- Wardrobe garment click `cycleCategory(outfit|bottom)`: routes through `setOption`; the per-category
  option-card buttons call the SAME `setOption`, so any garment is selectable by keyboard.

## WS1/WS2/WS3 invariants preserved

- No re-eager asset preload; chunk split + SceneLoader/useProgress fallback intact; `asset()` still
  wraps every public URL (WardrobeScene URL block untouched).
- `quality.ts` + the single `QualityToggle` remain the ONLY quality control.
- ACESFilmic tone mapping + lighting rigs + VRM tint pipeline untouched (diff shows only additive
  reduced-motion comments/branches; no numeric pose/camera/light/tone constant changed).
- Interactions still route through the chef/coach engines, `lib/pet` state, and `wardrobeOptions`;
  only the MOTION response is damped, engine output unchanged.
