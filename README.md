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

## Deployment

The site is a static export (`output: 'export'`) and deploys automatically to
GitHub Pages via `.github/workflows/deploy.yml` on every push to `main`
(and via manual `workflow_dispatch`). It is served as a project site under the
`/frankfabric/` base path, so production builds prefix all routes and assets
with `/frankfabric`. The live site is served at
[https://frannet82.github.io/frankfabric/](https://frannet82.github.io/frankfabric/).
If a custom domain (CNAME) is configured later, clear
`basePath`/`assetPrefix` in `next.config.js`.
