"use client";

// ---------------------------------------------------------------------------
// Digital Wardrobe — interactive 3D scene (modular rigged VRM avatar).
//
// The avatar is a minimally-clothed modular base body VRM ("drophunter") loaded
// with @pixiv/three-vrm. The selectable clothes are REAL fitted garment VRMs
// that each carry the SAME 198-joint skeleton as the base body. We adopt the
// loading/animation approach used by CharacterStudio
// (https://github.com/M3-org/CharacterStudio, MIT): create a three GLTFLoader,
// register the VRMLoaderPlugin, read the parsed avatar from `gltf.userData.vrm`,
// and call `vrm.update(delta)` every frame so the rig's SpringBones and lookAt
// animate. We adopt the APPROACH, not the editor code.
//
// GARMENT TRANSPLANT (CharacterStudio approach, MIT): each garment VRM ships as
// a full VRM whose SkinnedMeshes are bound to a skeleton identical to the base
// body's. To make a garment deform with the animated base skeleton we rebind
// every garment SkinnedMesh onto the BASE body's bone nodes, matched by bone
// name, then parent the mesh under the base VRM scene. This replaces the old
// procedural-primitive overlay that doubled up on Seed-san's built-in clothing
// and caused the mismatch the user reported.
//
// All URLs (base body, garments, animations) are routed through lib/asset.ts's
// asset() helper so they carry the deployment base path (/frankfabric/ in
// production).
//
// This component touches the DOM/WebGL (react-three-fiber <Canvas />) and is
// therefore imported by WardrobeBuilder.tsx via next/dynamic with
// { ssr: false } so it never runs during Next.js static generation.
// ---------------------------------------------------------------------------

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { OrbitControls, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import SceneLoader from "@/components/three/SceneLoader";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import {
  VRMLoaderPlugin,
  VRMUtils,
  type VRM,
} from "@pixiv/three-vrm";
import { asset } from "@/lib/asset";
import { retargetMixamoClip } from "@/lib/vrm/retarget";
import { Garment } from "@/lib/vrm/transplant";
import {
  OPTIONS,
  type Category,
  type WardrobeAnimation,
  type WardrobeSelection,
  type WardrobeColors,
} from "@/components/wardrobe/wardrobeOptions";

// OPTIONS and the shared wardrobe types now live in the lightweight
// components/wardrobe/wardrobeOptions.ts module (NO three.js imports), so the
// control UI (WardrobeBuilder) can import them WITHOUT dragging this
// three.js-heavy scene module into the static page bundle. Re-export OPTIONS +
// the types here so any existing importer of this module keeps working.
export {
  OPTIONS,
  type Category,
  type WardrobeAnimation,
  type WardrobeSelection,
  type WardrobeColors,
};

// FBX animation clips (Mixamo-style humanoid rigs). Loaded client-side only via
// FBXLoader and retargeted onto the VRM humanoid — see retargetMixamoClip
// below. URLs are base-path-prefixed so they resolve under /frankfabric/ in
// production.
const ANIMATION_URLS: Record<Exclude<WardrobeAnimation, "rest">, string> = {
  idle: asset("/animations/idle.fbx"),
  walking: asset("/animations/walking.fbx"),
  waving: asset("/animations/waving.fbx"),
};

// The minimally-clothed modular base body. Base-path-prefixed so it resolves to
// /frankfabric/models/characters/drophunter/body.vrm in production and
// /models/characters/drophunter/body.vrm in dev. NEVER hardcode a bare
// "/models/..." path — it would 404 on GitHub Pages.
const MODEL_URL = asset("/models/characters/drophunter/body.vrm");

// The eyes are a SEPARATE required trait of this modular avatar (the drophunter
// manifest lists requiredTraits=['body','eyes']). The base body VRM ships with
// empty eye sockets — without this mesh they render as black holes. We bundle
// the "Regular Eyes" VRM and transplant it onto the base skeleton UNCONDITIONALLY
// on load, using the same bone-rebind path garments use. It is NOT a
// user-selectable option, so it never appears in OPTIONS/GARMENT_URLS/THUMBNAILS.
// Routed through asset() so it resolves under /frankfabric/ in production.
const EYES_URL = asset("/models/characters/drophunter/eyes/regulareyes.vrm");

// Per-category, per-option-index map to the real garment VRM public paths.
// Index 0 is null (Base/None → no garment mounted). Every non-null path is
// routed through asset() so it carries the base path in production. The order
// of each array matches OPTIONS above exactly.
const GARMENT_URLS: Record<Category, (string | null)[]> = {
  outfit: [
    null,
    asset("/models/characters/drophunter/chest/tanktop.vrm"),
    asset("/models/characters/drophunter/chest/shirt.vrm"),
    asset("/models/characters/drophunter/chest/hoodie.vrm"),
    asset("/models/characters/drophunter/chest/croptop.vrm"),
    asset("/models/characters/drophunter/chest/lightshirt.vrm"),
    asset("/models/characters/drophunter/chest/fulljacket.vrm"),
    asset("/models/characters/drophunter/chest/tuckedshirt.vrm"),
    asset("/models/characters/drophunter/chest/sweater.vrm"),
  ],
  bottom: [
    null,
    asset("/models/characters/drophunter/legs/cargopants.vrm"),
    asset("/models/characters/drophunter/legs/casualshorts.vrm"),
    asset("/models/characters/drophunter/legs/skirt.vrm"),
    asset("/models/characters/drophunter/legs/sportshorts.vrm"),
    asset("/models/characters/drophunter/legs/abovekneeshorts.vrm"),
    asset("/models/characters/drophunter/legs/waistshorts.vrm"),
    asset("/models/characters/drophunter/legs/doublebeltpants.vrm"),
  ],
  shoes: [
    null,
    asset("/models/characters/drophunter/feet/sneakers.vrm"),
    asset("/models/characters/drophunter/feet/shortboots.vrm"),
    asset("/models/characters/drophunter/feet/thinshoe.vrm"),
    asset("/models/characters/drophunter/feet/dressboots.vrm"),
    asset("/models/characters/drophunter/feet/tallboots.vrm"),
    asset("/models/characters/drophunter/feet/tennisshoes.vrm"),
    asset("/models/characters/drophunter/feet/hightop.vrm"),
  ],
  hat: [
    null,
    asset("/models/characters/drophunter/head/short.vrm"),
    asset("/models/characters/drophunter/head/ponytail.vrm"),
    asset("/models/characters/drophunter/head/curledbangs.vrm"),
    asset("/models/characters/drophunter/head/buns.vrm"),
    asset("/models/characters/drophunter/head/straight.vrm"),
    asset("/models/characters/drophunter/head/swept.vrm"),
    asset("/models/characters/drophunter/head/longspike.vrm"),
    asset("/models/characters/drophunter/head/dreds.vrm"),
  ],
};

type SceneProps = {
  selection: WardrobeSelection;
  colors: WardrobeColors;
  animation: WardrobeAnimation;
};

function Avatar({ selection, colors, animation }: SceneProps) {
  const gltf = useLoader(GLTFLoader, MODEL_URL, (loader) => {
    loader.register(
      (parser) => new VRMLoaderPlugin(parser, { autoUpdateHumanBones: true })
    );
  });

  const vrm = gltf.userData.vrm as VRM;

  // One-time rig prep: optimise the scene, orient the avatar to face the
  // camera, and disable frustum culling for reliable draws. The drophunter base
  // body is VRM 1.0 (already faces +Z), so no 180° flip is needed. We do NOT
  // call combineSkeletons here: transplanted garment meshes bind to the base
  // skeleton's individual bone nodes by name, so those nodes must stay intact.
  useMemo(() => {
    VRMUtils.removeUnnecessaryVertices(vrm.scene);
    vrm.scene.traverse((obj) => {
      obj.frustumCulled = false;
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    return vrm;
  }, [vrm]);

  // Dispose GPU resources when the avatar unmounts (route changes) to avoid
  // leaks — VRMUtils.deepDispose walks the whole scene graph.
  useEffect(() => {
    return () => {
      VRMUtils.deepDispose(vrm.scene);
    };
  }, [vrm]);

  // --- Animation: load + retarget the Mixamo FBX clips -------------------
  //
  // useLoader with FBXLoader runs entirely client-side (this whole component
  // is loaded via next/dynamic { ssr:false }, so FBXLoader never executes
  // during static generation). Each raw FBX is retargeted onto the VRM
  // humanoid via retargetMixamoClip and driven by a single AnimationMixer.
  const idleFbx = useLoader(FBXLoader, ANIMATION_URLS.idle);
  const walkingFbx = useLoader(FBXLoader, ANIMATION_URLS.walking);
  const wavingFbx = useLoader(FBXLoader, ANIMATION_URLS.waving);

  // All mutable playback state (mixer + per-clip actions + the action that is
  // currently faded in) lives in a single ref that this component owns and
  // mutates. Keeping it in a ref — rather than in useMemo return values — keeps
  // the AnimationAction mutations (reset/fadeIn/play) off React-tracked values.
  const playback = useRef<{
    mixer: THREE.AnimationMixer;
    actions: Record<
      Exclude<WardrobeAnimation, "rest">,
      THREE.AnimationAction | null
    >;
  } | null>(null);
  // The action currently faded in (null at rest). Its own ref so the crossfade
  // effect only mutates `ref.current`, which is a permitted ref write.
  const currentAction = useRef<THREE.AnimationAction | null>(null);

  // (Re)build the mixer and retargeted actions whenever the avatar or a loaded
  // FBX changes. Retargeting maps each Mixamo clip onto the VRM humanoid bones.
  useEffect(() => {
    const mixer = new THREE.AnimationMixer(vrm.scene);
    const build = (fbx: THREE.Group): THREE.AnimationAction | null => {
      const raw = fbx.animations?.[0];
      if (!raw) return null;
      const clip = retargetMixamoClip(fbx, raw, vrm);
      return clip ? mixer.clipAction(clip) : null;
    };
    playback.current = {
      mixer,
      actions: {
        idle: build(idleFbx),
        walking: build(walkingFbx),
        waving: build(wavingFbx),
      },
    };
    currentAction.current = null;
    return () => {
      mixer.stopAllAction();
      playback.current = null;
      currentAction.current = null;
    };
  }, [vrm, idleFbx, walkingFbx, wavingFbx]);

  // Crossfade to the requested clip when `animation` changes; "rest" fades all
  // actions out so the avatar returns to its rest pose.
  useEffect(() => {
    const state = playback.current;
    if (!state) return;
    const next = animation === "rest" ? null : state.actions[animation];
    const prev = currentAction.current;
    if (next === prev) return;

    const FADE = 0.35;
    if (next) {
      // reset() re-enables the action and zeroes its time/weight; fadeIn then
      // ramps its weight to 1 over FADE seconds as we play it.
      next.reset();
      next.setEffectiveWeight(1);
      next.fadeIn(FADE);
      next.play();
    }
    if (prev) {
      prev.fadeOut(FADE);
    }
    currentAction.current = next;
  }, [animation, idleFbx, walkingFbx, wavingFbx, vrm]);

  // CharacterStudio's per-frame update contract: advance the animation mixer
  // first (which poses the normalized humanoid bones), then vrm.update(delta)
  // so SpringBones/lookAt and the retargeted pose are both applied. Garments
  // transplanted onto the base skeleton follow automatically.
  useFrame((_, delta) => {
    playback.current?.mixer.update(delta);
    vrm.update(delta);
  });

  return (
    <group>
      <primitive object={vrm.scene} />

      {/* Required eyes trait. The base body ships with empty eye sockets (the
          "black hole" bug); this transplants the authored "Regular Eyes" mesh
          onto the base skeleton ALWAYS, independent of any selection. It is not
          a user-selectable option. preserveMaterials keeps the VRM's authored
          irises/whites so the eyes render naturally rather than a flat tint. */}
      <Garment
        baseVrm={vrm}
        url={EYES_URL}
        color="#000000"
        preserveMaterials
      />

      {/* Real fitted garment VRMs, transplanted onto the base skeleton. Each
          category mounts nothing at option 0 (Base/None), so the base body
          shows through for that slot. */}
      <Garment
        baseVrm={vrm}
        url={GARMENT_URLS.outfit[selection.outfit] ?? null}
        color={colors.outfit}
      />
      <Garment
        baseVrm={vrm}
        url={GARMENT_URLS.bottom[selection.bottom] ?? null}
        color={colors.bottom}
      />
      <Garment
        baseVrm={vrm}
        url={GARMENT_URLS.shoes[selection.shoes] ?? null}
        color={colors.shoes}
      />
      <Garment
        baseVrm={vrm}
        url={GARMENT_URLS.hat[selection.hat] ?? null}
        color={colors.hat}
      />
    </group>
  );
}

export default function WardrobeScene({
  selection,
  colors,
  animation,
}: SceneProps) {
  // Keep the showroom turntable spinning at rest; hold still while a clip
  // plays so the motion reads clearly.
  const autoRotate = animation === "rest";
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [0, 1.35, 2.6], fov: 40 }}
      gl={{ antialias: true }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
      }}
    >
      <color attach="background" args={["#efede8"]} />
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[4, 8, 5]}
        intensity={1.4}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight position={[-5, 3, -4]} intensity={0.35} />
      <hemisphereLight args={["#ffffff", "#cbc7bd", 0.5]} />

      <Suspense fallback={<SceneLoader />}>
        <group position={[0, 0, 0]}>
          <Avatar selection={selection} colors={colors} animation={animation} />
        </group>
      </Suspense>

      <ContactShadows
        position={[0, 0, 0]}
        opacity={0.4}
        scale={4}
        blur={2.2}
        far={2}
        color="#2c2a26"
      />

      <OrbitControls
        enablePan={false}
        minDistance={1.4}
        maxDistance={5}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 1.9}
        target={[0, 1.1, 0]}
        autoRotate={autoRotate}
        autoRotateSpeed={0.6}
      />
    </Canvas>
  );
}
