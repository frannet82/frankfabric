# Anime avatar revision

This revision supersedes the photographic face-texture experiments. Both live models again use the original anime facial textures and full-size authored eye geometry. Their original UVs are restored, so only one set of eyebrows is rendered. A shared skin shader uses the same chosen skin color on face and body while preserving the authored dark facial features. The wardrobe uses warm fair skin, blue-gray eyes, red-rose lips and a blonde swept bob. The coach uses warm brown skin, dark brown eyes, muted rose lips and long dark layered hair with bangs.

The hair uses the original modeled anime locks with neutralized texture colors rather than distorted fringes or a continuous procedural shell. Hair color controls still work for the wardrobe bob. Coach exercise speeds, speech expression targets, and wardrobe clothing/animation bindings are preserved.

The older generated face-albedo.png files remain as design history but are not referenced by either rebuilt VRM. Current appearance code is `lib/vrm/animeAppearance.ts`. Rebuild the two asset sets with `python3 scripts/build-wardrobe-reference.py` and `python3 scripts/build-coach-reference.py`.

Validation: production build/TypeScript passed; lint has only the existing font warning. Exercise pose tests passed. Browser review tests coach exercise demos, pause controls, wardrobe hair changes and waving, High/Fast rendering, desktop/mobile layout, and WebGL errors. Coach speech-event tests passed on desktop and mobile.
