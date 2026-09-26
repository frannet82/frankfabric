# Schnauzer references and changing room

The pet was rebuilt as a procedural 3D miniature schnauzer using the four user-supplied white schnauzer photos for proportions and grooming cues. It has folded triangular ears, smaller dark eyes, a longer muzzle, a brushed beard, fuller legs, and individually tapered fur strands. It remains a stylized model rather than a photorealistic reconstruction. Forward-facing blinking, breathing, tail wagging, and care reactions remain active. Fast mode reduces strand density.

The wardrobe now contains an oak floor, rug, pleated curtain, clothes rail, upholstered bench, brass details, and a live full-length mirror. Fast mode reduces reflection resolution. The outfit selection camera pulse now applies incremental offsets, preventing repeated per-frame zoom accumulation.

Validation:
- `npm run lint`: no errors; existing font warning in app/layout.tsx.
- `npm run build -- --webpack`: successful static export and TypeScript checks (local native SWC is unavailable; webpack uses the installed WASM fallback).
- Geometry smoke check: skull, beard and both ears have finite vertices/normals and bounded fur.
- `node scripts/review-layouts.mjs virtual-pet digital-wardrobe --reference`: desktop 1440×900, wardrobe 1280×720, mobile 390×844; High and Fast screenshots; care actions; wardrobe selection; viewport fit and WebGL/runtime errors.

Screenshots and `results-focused.json` in this directory are local review artifacts.
