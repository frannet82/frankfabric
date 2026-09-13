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
- `components/chef/ChefChatbot.tsx` — Chef Fabric: a fully client-side conversational recipe assistant with a 3D VRM chef avatar (see "Chef chatbot" below)
- `components/chef/ChefScene.tsx` — the chef's WebGL stage, reusing the drophunter avatar objects and the idle/waving animation clips
- `lib/chef/recipes.ts` — self-authored recipe knowledge base that grounds the chef's answers
- `lib/chef/chefEngine.ts` — deterministic, dependency-free retrieval/rule engine that turns a message into a recipe reply
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

The **Chef chatbot** (`components/chef/`) adds **no new** open-source library,
model, or external recipe dataset. Its 3D chef avatar reuses the same three.js /
`@react-three/fiber` / `@react-three/drei` / `@pixiv/three-vrm` stack credited
above (already bundled for the Digital Wardrobe), and its recipe knowledge base
(`lib/chef/recipes.ts`) is **self-authored** for this project — it is not
derived from a third-party dataset, so there is nothing further to attribute
here. See the "Chef chatbot" section below.

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

### Asset sourcing and licensing

This project bundles two kinds of external assets, from two different sources,
under two different licensing situations. They are handled differently on
purpose:

**1. The project owner's own assets — bundled with permission.**
The animation clips (`public/animations/`) and garment selection thumbnails
(`public/wardrobe/thumbnails/`) are sourced from
[frannet82/assets](https://github.com/frannet82/assets), which is the **project
owner's own repository** (same GitHub owner, `frannet82`, as this `frankfabric`
repo). They are bundled here **at the owner's direction and with their
permission**, so redistributing them inside this project is authorized by the
rights holder. The absence of a formal `LICENSE` file in that repo does not
create the redistribution risk that a third-party repository would, because it
is the same owner electing to bundle their own files here. See the "Bundled
animation clips" and "Garment selection thumbnails" sections below for details.

**2. Third-party garment VRMs — reviewed and deliberately NOT bundled.**
We separately reviewed
[memelotsqui/character-assets](https://github.com/memelotsqui/character-assets)
as a potential source of ready-made VRM garments and deliberately did **not**
bundle any of its assets, for two reasons:

- **No license, and not ours.** That repository (and its upstream
  `webaverse-studios/character-assets`) is owned by a **third party** and ships
  with no `LICENSE`/`COPYING`/`NOTICE` file and no stated terms, so it defaults
  to all-rights-reserved. Unlike the owner's own `frannet82/assets` above, we
  have no permission from that rights holder, so redistributing those files
  inside this public project would not be legally safe.
- **Incompatible fit.** Its garments are full VRM part files rigged to the
  Webaverse base bodies (drophunter/neurohacker), not to Seed-san's skeleton,
  so they would not deform or fit our avatar correctly.

Instead, the wardrobe garments themselves are generated procedurally and sized
from Seed-san's real bone proportions at runtime (see
`components/wardrobe/WardrobeScene.tsx`); the thumbnails from the owner's repo
are used only as selection previews for those procedural garments.

### Bundled animation clips

The avatar can play a few humanoid motions (Idle / Walking / Waving, plus a
static Rest pose) selected from the builder UI. The motion clips are
Mixamo-style humanoid FBX files bundled at `public/animations/`:

- `idle.fbx`, `walking.fbx`, and `waving.fbx`, sourced from the project owner's
  own [frannet82/assets](https://github.com/frannet82/assets) (`loot/animations/`)
  and bundled here with the owner's permission (see "Asset sourcing and
  licensing" above). The static Rest pose plays no clip, so no separate file is
  bundled for it.

Because the clips are authored on a Mixamo skeleton, they are **retargeted onto
Seed-san's VRM humanoid at runtime** following the well-known
[three-vrm](https://github.com/pixiv/three-vrm) Mixamo remap pattern: each
`mixamorig*` bone track is mapped to the corresponding VRM humanoid bone node
(via `vrm.humanoid.getNormalizedBoneNode(...)`), rotation (quaternion) tracks
are rebuilt into the VRM bone rest frame, the hips position track is scaled to
the VRM's hip height, and unmapped tracks are dropped. The retargeted clips are
driven by a `THREE.AnimationMixer` updated each frame alongside
`vrm.update(delta)`, so the procedural garments (parented to the humanoid bones)
follow the motion. The FBX files are loaded **client-side only** (the WebGL
scene is a `next/dynamic { ssr:false }` component, so `FBXLoader` never runs
during static export) and their URLs are wrapped in `asset()` for the base path.

### Garment selection thumbnails

To preview each clothing option, the builder shows a genuine 512×512 PNG
thumbnail per garment, bundled at `public/wardrobe/thumbnails/`:

- Sourced from the project owner's own
  [frannet82/assets](https://github.com/frannet82/assets) character thumbnails
  (`characters/drophunter/**`, e.g. `outer/jacket.png`, `legs/cargopants.png`,
  `feet/sneakers.png`) and bundled here with the owner's permission (see "Asset
  sourcing and licensing" above).

These images are used **only as selection previews** for the procedural
garments — the underlying garment `.vrm` files are still **not** bundled; the
full third-party VRM garments from `memelotsqui/character-assets` remain
excluded (see the no-license note above). The `None`/`Default` option for each
category has no garment and renders a neutral placeholder tile instead. All
thumbnail URLs are served offline through `asset()` under the `/frankfabric/`
base path.

### Preview image

The Digital Wardrobe project card on the landing page uses
`public/images/final_futuristic_avatar.jpg`, a **real JPEG render of the 3D
avatar** from the wardrobe. The source render arrived mislabeled with a `.png`
extension despite carrying JPEG bytes, so `scripts/convert-avatar-jpeg.mjs`
re-encodes it via `sharp` (`jpeg({ quality: 90, mozjpeg: true })`) into a
correctly-named `.jpg` with a matching `image/jpeg` container. Like every other
bundled asset it is served offline through `asset()` under the `/frankfabric/`
base path.

The one-time conversion script is kept at `scripts/convert-avatar-jpeg.mjs` to
document how the `.jpg` was produced; the committed `.jpg` is the only image the
card and hero reference. An earlier SVG-generated preview PNG and its generator
script were used before the real avatar render replaced them and have since been
removed.

## Chef chatbot

The **Chatbot interface** project card on the landing page (the `GenAI` tile,
`projects[2]` in `lib/data.ts`) renders **Chef Fabric**, a conversational recipe
assistant you can talk to right inside the card. Ask it for a recipe, tell it an
ingredient you have on hand, or ask how to cook a dish, and a 3D VRM chef avatar
waves back and answers.

It runs **100% client-side** — there is no server, no API route, no API key, and
no model download. That is deliberate: the site is a static export
(`output: 'export'`) served from GitHub Pages, which has no Node/server runtime,
so a server-hosted LLM would break the build. Instead the conversation is driven
by a deterministic, dependency-free retrieval/rule engine
(`lib/chef/chefEngine.ts`) grounded in a small, self-authored recipe knowledge
base (`lib/chef/recipes.ts`). It works instantly and offline and adds negligible
bundle weight.

The 3D chef reuses the existing **drophunter** avatar objects from
`public/models/characters/drophunter/` (the base `body.vrm`, the required eyes
trait, a hair top, and the `fulljacket.vrm` tinted near-white so it reads as chef
whites over `cargopants.vrm`), topped with a lightweight three.js primitive
toque. It plays the already-bundled `public/animations/idle.fbx` and
`waving.fbx` Mixamo clips (retargeted onto the VRM humanoid the same way the
Digital Wardrobe does), waving briefly whenever it replies before settling back
to idle. As with the wardrobe, the WebGL scene (`components/chef/ChefScene.tsx`)
is isolated behind `next/dynamic { ssr:false }` in
`components/chef/ChefChatbot.tsx`, so three.js never runs during static
generation, and every asset URL is wrapped in `asset()` for the `/frankfabric/`
base path.

New files: `lib/chef/recipes.ts`, `lib/chef/chefEngine.ts`,
`components/chef/ChefScene.tsx`, and `components/chef/ChefChatbot.tsx`.

## Deployment

The site is a static export (`output: 'export'`) and deploys automatically to
GitHub Pages via `.github/workflows/deploy.yml` on every push to `main`
(and via manual `workflow_dispatch`). It is served as a project site under the
`/frankfabric/` base path, so production builds prefix all routes and assets
with `/frankfabric`. The live site is served at
[https://frannet82.github.io/frankfabric/](https://frannet82.github.io/frankfabric/).
If a custom domain (CNAME) is configured later, clear
`basePath`/`assetPrefix` in `next.config.js`.
