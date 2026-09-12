# Frank Cloud Fabric

Next.js 16 + Tailwind portfolio site.

**Live site:** [https://frannet82.github.io/frankfabric/](https://frannet82.github.io/frankfabric/)

## Run locally

```
npm install
npm run dev
```

Then open http://localhost:3000.

## Structure

- `app/page.tsx` — landing page (hero, capabilities, case studies, credentials, project gallery, contact)
- `app/projects/digital-wardrobe/page.tsx` — live interactive project page
- `components/WardrobeBuilder.tsx` — the Digital Wardrobe: an interactive 3D dress-up builder for swapping outfits and colors on a rigged VRM avatar
- `lib/data.ts` — content for stack, case studies, badges, and project gallery cards

## Attribution

The Digital Wardrobe builder (`components/WardrobeBuilder.tsx` and
`components/wardrobe/WardrobeScene.tsx`) is built on the following open-source
libraries, all MIT-licensed:

- [three.js](https://github.com/mrdoob/three.js) (MIT)
- [@react-three/fiber](https://github.com/pmndrs/react-three-fiber) (MIT)
- [@react-three/drei](https://github.com/pmndrs/drei) (MIT)
- [@pixiv/three-vrm](https://github.com/pixiv/three-vrm) (MIT) — VRM loader and
  runtime used to load, animate, and recolor the avatar.
- [CharacterStudio](https://github.com/M3-org/CharacterStudio) (MIT, Atlas
  Foundation) — we adopted its VRM loading/animation **approach** (a three.js
  `GLTFLoader` with the `VRMLoaderPlugin` registered, reading the parsed avatar
  from `gltf.userData.vrm`, and calling `vrm.update(delta)` every frame so the
  rig's SpringBones and lookAt animate) rather than vendoring the editor
  application itself.

### Bundled 3D model

The avatar is a real rigged VRM humanoid bundled at
`public/models/seed-san.vrm`:

- **Seed-san**, by VirtualCast, Inc., licensed under the
  [VRM Public License 1.0](https://vrm.dev/en/licenses/1.0/).
- Sourced from the VRM specification samples:
  [vrm-c/vrm-specification](https://github.com/vrm-c/vrm-specification/tree/master/samples/Seed-san).
- Redistribution with this project is permitted by the model's embedded VRM 1.0
  license metadata (`allowRedistribution` is set), and it is credited here per
  that license.

The model is bundled offline (never fetched from an external CDN at runtime),
and its loader URL is prefixed with the deployment base path via
`lib/asset.ts`'s `asset()` helper so it resolves under `/frankfabric/` on the
deployed site. The wardrobe garments layered on top of the avatar (bottoms,
shoes, hat, and the outfit overlay) are still generated procedurally from
three.js primitive meshes and anchored to the avatar's humanoid bones.

### Wardrobe garment assets — reviewed, not bundled

We reviewed [memelotsqui/character-assets](https://github.com/memelotsqui/character-assets)
as a potential source of ready-made VRM garments and deliberately did **not**
bundle any of its assets, for two reasons:

- **No license.** The repository (and its upstream
  `webaverse-studios/character-assets`) ships with no `LICENSE`/`COPYING`/
  `NOTICE` file and no stated terms, so it defaults to all-rights-reserved.
  Redistributing those files inside this public project would not be legally
  safe.
- **Incompatible fit.** Its garments are full VRM part files rigged to the
  Webaverse base bodies (drophunter/neurohacker), not to Seed-san's skeleton,
  so they would not deform or fit our avatar correctly.

Instead, the wardrobe garments are generated procedurally and sized from
Seed-san's real bone proportions at runtime (see
`components/wardrobe/WardrobeScene.tsx`).

### Preview image

The Digital Wardrobe project card on the landing page uses
`public/images/final_futuristic_avatar.jpg`, a **real JPEG render of the 3D
avatar** from the wardrobe. The source render arrived mislabeled with a `.png`
extension despite carrying JPEG bytes, so `scripts/convert-avatar-jpeg.mjs`
re-encodes it via `sharp` (`jpeg({ quality: 90, mozjpeg: true })`) into a
correctly-named `.jpg` with a matching `image/jpeg` container. Like every other
bundled asset it is served offline through `asset()` under the `/frankfabric/`
base path.

The earlier SVG-generated `public/images/digital-wardrobe-preview.png` (produced
by `scripts/gen-wardrobe-preview.mjs`, an original asset with no third-party
license) is no longer the card image, but the generator script remains in the
repo for reference.

## Deployment

The site is a static export (`output: 'export'`) and deploys automatically to
GitHub Pages via `.github/workflows/deploy.yml` on every push to `main`
(and via manual `workflow_dispatch`). It is served as a project site under the
`/frankfabric/` base path, so production builds prefix all routes and assets
with `/frankfabric`. The live site is served at
[https://frannet82.github.io/frankfabric/](https://frannet82.github.io/frankfabric/).
If a custom domain (CNAME) is configured later, clear
`basePath`/`assetPrefix` in `next.config.js`.
