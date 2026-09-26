> Superseded by the anime revision: the live avatars now use the original anime face textures, larger authored eyes, and shared skin shading. The generated face atlas below is retained only as an earlier design asset and is no longer referenced by the models. See `docs/anime-avatar-review/README.md`.

# Reference-inspired wardrobe avatar

The wardrobe now uses a dedicated head/body and eye asset with smaller eye proportions, a slightly wider jaw, warm skin shading, blue-gray irises, and a generated face albedo with brown brows and muted rose lips. A new tintable shoulder-length bob is the default hair choice. The original trainer assets are unchanged. The result is stylized, not a photorealistic likeness.

Assets: `public/models/wardrobe-reference/{body.vrm,eyes.vrm,bob.vrm,face-albedo.png}`. Rebuild the derived meshes with `python3 scripts/build-wardrobe-reference.py`; it reads the bundled drophunter originals and preserves the skeleton, skinning and expression targets. The generated texture must remain alongside body.vrm because it is referenced by relative URI. The new hair thumbnail is `public/wardrobe/thumbnails/head-reference-bob.svg`.

Validation: production webpack build and TypeScript passed; lint has only the existing app/layout.tsx font warning. Browser review covers desktop 1440×900 and 1280×720, mobile 390×844, hair switching, the waving animation, restored rest pose, and High/Fast rendering with WebGL error capture.

## Image-generation provenance

Used the built-in image_gen tool, not the fallback CLI. Inputs were the original face UV atlas extracted from the bundled body and the user's attached portrait. The selected output is saved at `public/models/wardrobe-reference/face-albedo.png`. UV coordinates are adjusted in the derived mesh to align the generated nose, lips and chin with the original islands.

Final generation prompt:

> Edit image 1, an existing square 3D face UV diffuse texture atlas. Image 2 is appearance reference only. Output a square texture atlas, NOT a portrait or 3D render. Preserve image 1 UV layout EXACTLY: face centered, blank eye socket regions at x .37/.63 y .30, eyebrow arcs x .37/.63 y .26, nose at x .5 y .425, mouth at x .5 y .50, chin around y .60, and detached ear islands at bottom corners. Keep these landmark positions and island boundaries pixel aligned with image1. Keep eyes blank skin-colored because separate eyeball meshes supply eyes. No hair, no clothes, no jewelry, no background, no text. Repaint just the diffuse surface to resemble image2: natural fair warm beige skin instead of pink anime paint, soft peach complexion, detailed subtle pores, darker softly arched taupe brown eyebrows, natural muted rose lips slightly fuller but same center and width, subtle warm eyelid makeup. Remove excessive pink blush and cartoon linework. Flat diffuse/albedo lighting with no directional shadow/specular baked in. Preserve skin texture everywhere including separate bottom ear islands. Uniform warm fair base palette. This will be mapped directly onto an existing 3D head; exact feature placement is more important than making the atlas look like an ordinary photograph.
