# Character and full-page experience review

## Changes

- Fixed a React state-update race in both chat handlers. Replies are computed synchronously before updating the conversation and invoking speech; the former handler could send an empty string to the voice engine.
- Kept the Swedish Chef model and verified that `Bip001_Jaw` influences 272 skin vertices. Mouth motion uses the speech articulation envelope; arms start in a relaxed lowered pose with small asymmetric gestures.
- Replaced the astronaut trainer (no mouth bones or facial morphs) with the project's existing VRM avatar, dressed in sportswear. It has actual mouth morphs, blinking, breathing, and gentle gestures. The asset remains stylized, not photorealistic.
- Unified speech lifecycle handling, including interruption, mute, and end/error cleanup. English replies prefer enhanced English voices at a natural pitch. Word-boundary events estimate mouth articulation and pauses; this is not phoneme-level lip synchronization. Browsers without boundary events use an approximate syllable envelope. Browser/OS voices still determine audio quality.
- Furnished the kitchen, fitness studio, and pet room with local geometry on both quality tiers.
- Corrected metallic fur and harsh alpha-card rendering on the pet. Removed synthetic bark/boof playback; quiet optional interaction feedback replaces it, with sound off initially.
- Expanded all four dedicated project pages to a 1600px maximum workspace, improved page copy and cross-project navigation, widened wardrobe controls, and pulled its camera back to show the complete outfit.

## Validation

- `node --test scripts/test-speech.mjs`: speech language selection, word-boundary pauses, interruption, repeat completion, and mute.
- `npm run lint`: no errors; one existing font warning in `app/layout.tsx`.
- `npm run build -- --webpack`: static production export and TypeScript pass. The default Turbopack build cannot run in this checkout because its native macOS SWC package is missing; Webpack uses the available WASM compiler.
- `node scripts/review-experiences.mjs`: local Chrome inspection at 1440px and 390px. Screenshots and `results.json` are in this folder. Browser checks stub speech events to make first/second reply and mute tests deterministic; they do not assess the audible quality of installed OS voices.
