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
- `components/WardrobeBuilder.tsx` — the Digital Wardrobe: an interactive 3D dress-up builder for swapping outfits and colors on a model
- `lib/data.ts` — content for stack, case studies, badges, and project gallery cards

## Attribution

The Digital Wardrobe builder (`components/WardrobeBuilder.tsx` and
`components/wardrobe/WardrobeScene.tsx`) is built on the following open-source
libraries, all MIT-licensed:

- [three.js](https://github.com/mrdoob/three.js) (MIT)
- [@react-three/fiber](https://github.com/pmndrs/react-three-fiber) (MIT)
- [@react-three/drei](https://github.com/pmndrs/drei) (MIT)

All 3D geometry (the avatar and every garment) is generated procedurally
in-scene from three.js primitive meshes. No third-party 3D model assets
(`.glb`/`.gltf`), textures, or environment maps are bundled or fetched, so
there is nothing to license beyond the libraries above.

## Deployment

The site is a static export (`output: 'export'`) and deploys automatically to
GitHub Pages via `.github/workflows/deploy.yml` on every push to `main`
(and via manual `workflow_dispatch`). It is served as a project site under the
`/frankfabric/` base path, so production builds prefix all routes and assets
with `/frankfabric`. The live site is served at
[https://frannet82.github.io/frankfabric/](https://frannet82.github.io/frankfabric/).
If a custom domain (CNAME) is configured later, clear
`basePath`/`assetPrefix` in `next.config.js`.
