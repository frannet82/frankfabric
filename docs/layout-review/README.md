# Exercise demos and desktop layout review

- Trainer: explicit Squats, March, and Jumping jacks controls, Pause/Resume, and automatic full-body framing. Demonstrations use procedural normalized VRM poses. These are illustrative animations rather than motion-captured instruction. No exercise starts automatically.
- Pet: replaced the jagged fur-card presentation with an original, locally sculpted white schnauzer. Rounded beard, eyebrow tufts, folded ears, dark eyes, and a sage collar; the seated pet faces the viewer. Blinking, breathing, tail wagging, feeding, paw/play, sleep, and cleaning responses respect reduced motion. Care state and storage are unchanged.
- Selected Builds in Detail: scroll-snap carousel with previous/next controls, position indicator, swipe, keyboard arrows, and reduced-motion-aware scrolling.
- Wardrobe: desktop page fits in the viewport, including the entire model and animation controls. The four option lists scroll independently. Verified at 1440×900 and 1280×720; mobile remains vertically arranged.
- Puzzles: desktop menu and both nested game boards use the available width. Tray slots are capped to preserve board height; tile sizing adapts to desktop. Rules below 900px remain unchanged.

Validation:
- `npm run lint` (one existing font warning, no errors).
- `npm run build -- --webpack` (production export and TypeScript pass; this checkout uses the WASM compiler).
- `node --test scripts/test-exercises.mjs` (foot alignment, bounded squat depth, alternating march, neutral pose).
- `node scripts/review-layouts.mjs` (desktop/mobile screenshots, exercise controls, pet care buttons, carousel navigation, both puzzle games, viewport overflow and wardrobe height checks).

Screenshots and machine-readable results are stored alongside this file.
