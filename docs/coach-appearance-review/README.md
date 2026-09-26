> Superseded by the anime revision: the live avatars now use the original anime face textures, larger authored eyes, and shared skin shading. The generated face atlas below is retained only as an earlier design asset and is no longer referenced by the models. See `docs/anime-avatar-review/README.md`.

# Coach reference appearance

Coach-specific assets are in `public/models/coach-reference/`: `body.vrm`, `eyes.vrm`, `waves.vrm`, and `face-albedo.png`. They preserve the original exercise skeleton and facial expression targets. The source photo guides the warm medium-brown skin, dark eyes, arched brows, rose-brown lips, friendly expression, and long center-parted dark waves. This is a stylized adaptation, not a photorealistic likeness. The wardrobe appearance is independent.

Rebuild geometry with `python3 scripts/build-coach-reference.py`. It imports the shared mesh helpers from `build-wardrobe-reference.py` without rebuilding the wardrobe. Long hair is skinned to the existing rig; it is not simulated strand-by-strand. The face atlas is a relative external texture and must ship alongside `body.vrm`.

## Generated asset provenance

The face texture was created with the built-in image_gen tool. The source UV atlas and user-supplied screenshot were used as references. The final image is saved at `public/models/coach-reference/face-albedo.png`.

Initial prompt:

> Create a 3D character face diffuse/albedo UV texture by editing image 1. Image 2 is the facial appearance reference: match warm medium-brown golden skin, dark softly arched brows, natural muted rose-brown lips, and warm friendly smiling features. Output ONLY a square UV atlas, not a portrait. Preserve EXACTLY image1's feature positions and sizes: blank eye areas centered x .37 and .63 at y .30, eyebrows near y .26, nose tip at x .5 y .425, mouth centered x .5 y .50 with width .08 of canvas, chin at y .60. Preserve detached ear islands in bottom corners. Eyes must remain blank skin-colored; separate eyeball meshes supply eyes. No hair, clothing, jewelry, text or background. The mouth must be gently closed with a slight upward smile, no painted teeth or open mouth since the 3D mesh will animate talking. Paint natural subtle skin texture, soft brown eyelid definition, defined eyebrows, soft cheek warmth. Remove anime linework. Flat even albedo lighting, no strong baked shadows or specular highlights. Keep ALL original UV island boundaries and feature locations pixel aligned. Matching the UV layout is essential for this image to work on the existing animated 3D face.

Final correction prompt:

> Technical correction to this face UV texture: make the entire square FULLY OPAQUE. Fill ALL transparent, black or red outside-island regions with uniform warm medium-brown skin color matching the face's cheeks. Remove dark shading at the bottom neck-shaped region, make it uniform matching cheek skin. Preserve existing face, eyes, brows, nose, lips, ears and their exact locations unchanged. Flatten harsh baked shadows in temple and nose areas. This is a diffuse UV texture atlas for a 3D mesh, not a cutout; no transparency anywhere and no black or red voids. Keep realistic facial features and skin detail. Output square opaque RGB image.
